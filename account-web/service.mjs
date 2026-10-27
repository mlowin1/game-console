import { randomUUID, randomInt } from 'node:crypto'
import { randomToken, hashToken, hashPassword, verifyPassword } from './crypto.mjs'
const HOUR=3600000, DAY=24*HOUR
const DEVICE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function userCode() { const value=Array.from({length:8},()=>DEVICE_ALPHABET[randomInt(DEVICE_ALPHABET.length)]).join(''); return `${value.slice(0,4)}-${value.slice(4)}` }
export class AppError extends Error { constructor(status,code,message=code,extra={}) { super(message); Object.assign(this,{status,code,extra}) } }
export class AccountService {
  constructor(db, config, now=()=>Date.now()) { this.db=db; this.config=config; this.now=now; this.failedLogins=new Map() }
  publicUser(row) { return {id:row.id,email:row.email,display_name:row.display_name,email_verified:Boolean(row.email_verified)} }
  validatePassword(password) { if(typeof password!=='string'||password.length<12||password.length>128||Buffer.byteLength(password)>512) throw new AppError(400,'invalid_password','Use a password between 12 and 128 characters.') }
  validateEmail(email) { if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400,'invalid_email','Enter a valid email address.'); return email.trim().toLowerCase() }
  validateName(name) { if(typeof name!=='string'||name.trim().length<2||name.trim().length>60) throw new AppError(400,'invalid_display_name','Display name must be 2–60 characters.'); return name.trim() }
  async register(body) {
    const email=this.validateEmail(body.email), display=this.validateName(body.display_name); this.validatePassword(body.password)
    const hash=await hashPassword(body.password), id=randomUUID(), now=this.now()
    try {this.db.prepare('INSERT INTO users (id,email,display_name,password_hash,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,email,display,hash,this.config.verifyEmail?0:1,now,now)}
    catch(e) { if(e.code?.startsWith('SQLITE_CONSTRAINT')) throw new AppError(409,'email_in_use','Account already exists.'); throw e }
    const user=this.db.prepare('SELECT * FROM users WHERE id=?').get(id)
    const verification=this.config.verifyEmail?this.createVerification(id):null
    return {user:this.publicUser(user),verification}
  }
  createVerification(userId) { const token=randomToken(); this.db.prepare('INSERT INTO email_verifications VALUES (?,?,?)').run(hashToken(token),userId,this.now()+DAY); return token }
  verifyEmail(token) { if(typeof token!=='string'||token.length>200)throw new AppError(400,'invalid_verification');const now=this.now(), hashed=hashToken(token); return this.db.transaction(()=>{
    const row=this.db.prepare('SELECT * FROM email_verifications WHERE token_hash=?').get(hashed)
    if(!row||row.expires_at<=now) throw new AppError(400,'invalid_verification','Verification link is invalid or expired.')
    this.db.prepare('UPDATE users SET email_verified=1,updated_at=? WHERE id=?').run(now,row.user_id)
    this.db.prepare('DELETE FROM email_verifications WHERE user_id=?').run(row.user_id)
    return {verified:true}
  })() }
  issueSession(userId) { const sid=randomToken(), csrf=randomToken(), now=this.now(); this.db.prepare('INSERT INTO web_sessions VALUES (?,?,?,?,?)').run(hashToken(sid),userId,csrf,now,now+7*DAY); return {sid,csrf} }
  async login(body,ip='unknown') {
    const email=this.validateEmail(body.email), password=body.password
    if(typeof password!=='string') throw new AppError(400,'invalid_password')
    const key=`${ip}:${email}`, now=this.now(), attempt=this.failedLogins.get(key)
    if(attempt && attempt.until>now) throw new AppError(429,'too_many_attempts','Try again later.',{retry_after:Math.ceil((attempt.until-now)/1000)})
    const row=this.db.prepare('SELECT * FROM users WHERE email=?').get(email)
    const valid= row ? await verifyPassword(password,row.password_hash) : await verifyPassword(password,this.dummyHash())
    if(!valid) { const count=(attempt?.count||0)+1; this.failedLogins.set(key,{count,until:count>=5?now+15*60000:0}); throw new AppError(401,'invalid_credentials','Invalid email or password.') }
    this.failedLogins.delete(key)
    if(this.config.verifyEmail&&!row.email_verified) throw new AppError(403,'email_unverified','Verify your email before signing in.')
    return {user:this.publicUser(row),session:this.issueSession(row.id)}
  }
  dummyHash() { return 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }
  session(sid) { if(!sid) throw new AppError(401,'unauthorized'); const row=this.db.prepare('SELECT users.*,web_sessions.csrf_hash FROM web_sessions JOIN users ON users.id=web_sessions.user_id WHERE web_sessions.id_hash=? AND web_sessions.expires_at>?').get(hashToken(sid),this.now()); if(!row)throw new AppError(401,'unauthorized'); return row }
  csrf(user,token) { if(!token||token!==user.csrf_hash) throw new AppError(403,'invalid_csrf') }
  csrfForSession(sid) { return this.session(sid).csrf_hash }
  logout(sid) { this.db.prepare('DELETE FROM web_sessions WHERE id_hash=?').run(hashToken(sid)); return {signed_out:true} }
  updateName(userId,displayName){ const name=this.validateName(displayName);this.db.prepare('UPDATE users SET display_name=?,updated_at=? WHERE id=?').run(name,this.now(),userId);return this.publicUser(this.db.prepare('SELECT * FROM users WHERE id=?').get(userId)) }
  startDevice(clientId) { if(clientId!=='finalform-linux') throw new AppError(400,'invalid_client'); const now=this.now(), deviceCode=randomToken(32), id=randomUUID(); let code
    for(let i=0;i<8;i++){ code=userCode(); if(!this.db.prepare('SELECT 1 FROM device_authorizations WHERE user_code=?').get(code)) break }
    this.db.prepare('INSERT INTO device_authorizations (id,user_code,device_hash,status,created_at,expires_at) VALUES (?,?,?,?,?,?)').run(id,code,hashToken(deviceCode),'pending',now,now+600000)
    return {device_code:deviceCode,user_code:code,verification_uri:`${this.config.origin}/verify`,verification_uri_complete:`${this.config.origin}/verify?user_code=${encodeURIComponent(code)}`,expires_in:600,interval:5}
  }
  approveCode(userId, code,approve) { if(typeof approve!=='boolean')throw new AppError(400,'invalid_request');const normalized=String(code||'').trim().toUpperCase(); if(!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalized)) throw new AppError(400,'invalid_user_code'); const now=this.now()
    return this.db.transaction(()=>{const row=this.db.prepare('SELECT * FROM device_authorizations WHERE user_code=?').get(normalized)
      if(!row||row.expires_at<=now)throw new AppError(400,'expired_token','Code has expired or is invalid.')
      if(row.status!=='pending')throw new AppError(409,'code_already_used')
      this.db.prepare('UPDATE device_authorizations SET status=?,user_id=? WHERE id=? AND status=?').run(approve?'approved':'denied',userId,row.id,'pending')
      return {status:approve?'approved':'denied'}
    })()
  }
  pollDevice(clientId,deviceCode) { if(clientId!=='finalform-linux')throw new AppError(400,'invalid_client'); if(typeof deviceCode!=='string'||deviceCode.length>200)throw new AppError(400,'invalid_request');const now=this.now(), h=hashToken(deviceCode)
    const result=this.db.transaction(()=>{const row=this.db.prepare('SELECT * FROM device_authorizations WHERE device_hash=?').get(h)
      if(!row)throw new AppError(400,'invalid_grant')
      if(row.expires_at<=now)throw new AppError(400,'expired_token')
      if(row.last_polled_at!==null&&now-row.last_polled_at<row.poll_interval*1000){this.db.prepare('UPDATE device_authorizations SET poll_interval=poll_interval+5 WHERE id=?').run(row.id);return new AppError(400,'slow_down','Poll less frequently.',{interval:row.poll_interval+5})}
      this.db.prepare('UPDATE device_authorizations SET last_polled_at=? WHERE id=?').run(now,row.id)
      if(row.status==='pending')return new AppError(400,'authorization_pending')
      if(row.status==='denied')return new AppError(400,'access_denied')
      if(row.status==='consumed')throw new AppError(400,'invalid_grant')
      const updated=this.db.prepare("UPDATE device_authorizations SET status='consumed' WHERE id=? AND status='approved'").run(row.id)
      if(updated.changes!==1)throw new AppError(400,'invalid_grant')
      return this.issueDesktopGrant(row.user_id)
    })();if(result instanceof AppError)throw result;return result
  }
  issueDesktopGrant(userId) { const now=this.now(), grantId=randomUUID(),refresh=randomToken(),access=randomToken()
    this.db.prepare('INSERT INTO desktop_grants VALUES (?,?,?,?,?,NULL)').run(grantId,userId,hashToken(refresh),now,now+30*DAY)
    this.db.prepare('INSERT INTO access_tokens VALUES (?,?,?)').run(hashToken(access),grantId,now+15*60000)
    return {access_token:access,token_type:'Bearer',expires_in:900,refresh_token:refresh,refresh_expires_in:30*86400,scope:'account:read'}
  }
  refreshToken(clientId,token) { if(clientId!=='finalform-linux')throw new AppError(400,'invalid_client');if(typeof token!=='string'||token.length>200)throw new AppError(400,'invalid_grant')
    return this.db.transaction(()=>{const row=this.db.prepare('SELECT * FROM desktop_grants WHERE refresh_hash=?').get(hashToken(token)); const now=this.now()
      if(!row||row.revoked_at!==null||row.expires_at<=now)throw new AppError(400,'invalid_grant')
      this.db.prepare('UPDATE desktop_grants SET revoked_at=? WHERE id=?').run(now,row.id)
      this.db.prepare('DELETE FROM access_tokens WHERE grant_id=?').run(row.id)
      return this.issueDesktopGrant(row.user_id)
    })()
  }
  authenticateAccess(token) { if(!token)throw new AppError(401,'invalid_token');const row=this.db.prepare('SELECT users.* FROM access_tokens JOIN desktop_grants ON desktop_grants.id=access_tokens.grant_id JOIN users ON users.id=desktop_grants.user_id WHERE token_hash=? AND access_tokens.expires_at>? AND desktop_grants.expires_at>? AND desktop_grants.revoked_at IS NULL').get(hashToken(token),this.now(),this.now());if(!row)throw new AppError(401,'invalid_token');return this.publicUser(row) }
  revokeToken(token) { if(typeof token!=='string'||token.length>200)throw new AppError(400,'invalid_request');const h=hashToken(token),now=this.now();const grant=this.db.prepare('SELECT grant_id FROM access_tokens WHERE token_hash=?').get(h);const row=this.db.prepare('SELECT id FROM desktop_grants WHERE refresh_hash=?').get(h);const id=grant?.grant_id||row?.id;if(id)this.db.prepare('UPDATE desktop_grants SET revoked_at=? WHERE id=?').run(now,id);return {revoked:true} }
  listDevices(userId){return this.db.prepare('SELECT id,created_at,expires_at,revoked_at FROM desktop_grants WHERE user_id=? ORDER BY created_at DESC').all(userId)}
  revokeDevice(userId,id){const result=this.db.prepare('UPDATE desktop_grants SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL').run(this.now(),id,userId);if(!result.changes)throw new AppError(404,'not_found');return {revoked:true}}
}

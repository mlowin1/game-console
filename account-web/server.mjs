import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { openDatabase } from './db.mjs'
import { configFromEnv } from './config.mjs'
import { AccountService, AppError } from './service.mjs'
import { randomToken } from './crypto.mjs'
const DIR=dirname(fileURLToPath(import.meta.url))
async function sendVerificationEmail(_smtpUrl,_email,_url){throw new AppError(503,'mail_delivery_unavailable','SMTP delivery adapter is not configured; disable required verification for local use.')}
const parseCookies = header => Object.fromEntries((header||'').split(';').map(p=>p.trim().split('=')).filter(p=>p.length===2))
const send=(res,status,data,headers={}) => {res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(data))}
function cookie(value,secure,maxAge) {return `ff_session=${value||''}; Path=/; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${maxAge}`}
async function readBody(req) {
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw new AppError(413,'request_too_large');chunks.push(chunk)}
  try {const content=Buffer.concat(chunks).toString('utf8');const value=JSON.parse(content||'{}');if(!value||Array.isArray(value)||typeof value!=='object')throw 0;return value}catch{throw new AppError(400,'invalid_json')}
}
function requireJson(req) {if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new AppError(415,'unsupported_media_type')}
function routePath(req){return new URL(req.url,'http://localhost').pathname}
function corsGuard(req,config,mutation) {
  const origin=req.headers.origin
  if(origin&&origin!==config.origin)throw new AppError(403,'invalid_origin')
  if(mutation && req.headers['sec-fetch-site']==='cross-site')throw new AppError(403,'invalid_origin')
}
export function createAccountServer({db=openDatabase(),config=configFromEnv(),now}={}){
  const service=new AccountService(db,config,now)
  const server=createServer(async(req,res)=>{
    try{
      const path=routePath(req),method=req.method
      res.setHeader('x-frame-options','DENY')
      res.setHeader('referrer-policy','no-referrer')
      res.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
      if(method==='GET'&&(path==='/'||path==='/verify')){
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(readFileSync(join(DIR,'web/index.html')));return
      }
      if(method==='GET'&&(path==='/app.js'||path==='/style.css')){
        res.writeHead(200,{'content-type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','cache-control':'no-store'});res.end(readFileSync(join(DIR,'web',path.slice(1))));return
      }
      if(path==='/health'&&method==='GET')return send(res,200,{status:'ok'})
      if(method==='POST')requireJson(req)
      // Native clients have no browser session, and never receive CORS credentials.
      const browserMutation=method==='POST'&&(path.startsWith('/api/v1/account/')||path==='/api/v1/device/decision')
      if(browserMutation)corsGuard(req,config,true)
      const body=method==='POST'?await readBody(req):{}
      const sid=parseCookies(req.headers.cookie).ff_session
      const webUser=()=>service.session(sid)
      const protectedMutation=()=>{const user=webUser();service.csrf(user,req.headers['x-csrf-token']);return user}
      if(path==='/api/v1/account/register'&&method==='POST'){
        const result=await service.register(body)
        if(result.verification){
          const url=`${config.origin}/?verify_token=${encodeURIComponent(result.verification)}`
          if(config.allowLocalVerificationLog)console.log(`[DEV EMAIL VERIFICATION] ${url}`)
          if(config.smtpUrl)await sendVerificationEmail(config.smtpUrl,result.user.email,url)
        }
        // In verification-required mode, no session is issued until email is verified.
        if(config.verifyEmail)return send(res,201,{user:result.user,email_verification_required:true})
        const session=service.issueSession(result.user.id)
        return send(res,201,{user:result.user,csrf_token:session.csrf,email_verification_required:false},{'set-cookie':cookie(session.sid,config.production,7*86400)})
      }
      if(path==='/api/v1/account/verify-email'&&method==='POST')return send(res,200,service.verifyEmail(body.token))
      if(path==='/api/v1/account/login'&&method==='POST'){
        const result=await service.login(body,req.socket.remoteAddress||'unknown')
        return send(res,200,{user:result.user,csrf_token:result.session.csrf},{'set-cookie':cookie(result.session.sid,config.production,7*86400)})
      }
      if(path==='/api/v1/account/me'&&method==='GET'){
        const user=webUser();return send(res,200,{user:service.publicUser(user),csrf_token:service.csrfForSession(sid)})
      }
      if(path==='/api/v1/account/logout'&&method==='POST'){
        protectedMutation();service.logout(sid);return send(res,200,{signed_out:true},{'set-cookie':cookie('',config.production,0)})
      }
      if(path==='/api/v1/account/settings'&&method==='POST'){
        const user=protectedMutation();return send(res,200,{user:service.updateName(user.id,body.display_name)})
      }
      if(path==='/api/v1/account/devices'&&method==='GET'){
        const user=webUser();return send(res,200,{devices:service.listDevices(user.id)})
      }
      if(/^\/api\/v1\/account\/devices\/[a-f0-9-]+\/revoke$/.test(path)&&method==='POST'){
        const user=protectedMutation();const id=path.split('/')[5];return send(res,200,service.revokeDevice(user.id,id))
      }
      if(path==='/api/v1/device/authorize'&&method==='POST')return send(res,200,service.startDevice(body.client_id))
      if(path==='/api/v1/device/decision'&&method==='POST'){
        const user=protectedMutation();return send(res,200,service.approveCode(user.id,body.user_code,body.decision==='approve'?true:body.decision==='deny'?false:undefined))
      }
      if(path==='/api/v1/device/token'&&method==='POST'){
        if(body.grant_type==='urn:ietf:params:oauth:grant-type:device_code')return send(res,200,service.pollDevice(body.client_id,body.device_code))
        if(body.grant_type==='refresh_token')return send(res,200,service.refreshToken(body.client_id,body.refresh_token))
        throw new AppError(400,'unsupported_grant_type')
      }
      if(path==='/api/v1/device/revoke'&&method==='POST')return send(res,200,service.revokeToken(body.token))
      if(path==='/api/v1/device/me'&&method==='GET'){
        const bearer=/^Bearer (\S+)$/i.exec(req.headers.authorization||'')?.[1]
        return send(res,200,{user:service.authenticateAccess(bearer)})
      }
      throw new AppError(404,'not_found')
    }catch(e){
      const error=e instanceof AppError?e:new AppError(500,'server_error','Unexpected server error.')
      if(!(e instanceof AppError))console.error(e)
      if(error.extra?.retry_after)res.setHeader('retry-after',String(error.extra.retry_after))
      return send(res,error.status,{error:error.code,error_description:error.message,...error.extra})
    }
  })
  return {server,service,db}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const config=configFromEnv();const {server}=createAccountServer({config})
  server.listen(config.port,()=>console.log(`FinalForm account web: ${config.origin} (port ${config.port})`))
}

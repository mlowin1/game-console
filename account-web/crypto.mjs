import { randomBytes, createHash, timingSafeEqual, scrypt as callbackScrypt } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(callbackScrypt)
export const randomToken = (size=32) => randomBytes(size).toString('base64url')
export const hashToken = token => createHash('sha256').update(token).digest('hex')
export const safeEqual = (a,b) => {
  const x=Buffer.from(a), y=Buffer.from(b)
  return x.length===y.length && timingSafeEqual(x,y)
}
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 64, {N:32768,r:8,p:1,maxmem:64*1024*1024})
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`
}
export async function verifyPassword(password, stored) {
  const [type,n,r,p,salt,expected] = String(stored).split('$')
  if (type!=='scrypt' || n!=='32768' || r!=='8' || p!=='1' || !salt || !expected) return false
  const hash = await scrypt(password,Buffer.from(salt,'base64url'),64,{N:32768,r:8,p:1,maxmem:64*1024*1024})
  return safeEqual(hash, Buffer.from(expected,'base64url'))
}

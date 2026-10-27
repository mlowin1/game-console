const yes = value => value === 'true' || value === '1'
export function configFromEnv(env = process.env) {
  const origin = env.PUBLIC_ORIGIN || 'http://localhost:3001'
  const production = env.NODE_ENV === 'production'
  const url = new URL(origin)
  if (production && (url.protocol !== 'https:' || url.username || url.password)) throw new Error('Production PUBLIC_ORIGIN must use HTTPS')
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid PUBLIC_ORIGIN')
  const verifyEmail = yes(env.REQUIRE_EMAIL_VERIFICATION)
  if (production && verifyEmail) throw new Error('Email verification delivery is not implemented; cannot enable REQUIRE_EMAIL_VERIFICATION in production')
  return { origin:url.origin, production, verifyEmail, smtpUrl:env.SMTP_URL || '', port:Number(env.PORT || 3001), allowLocalVerificationLog:!production && yes(env.DEV_LOG_VERIFICATION_LINKS) }
}

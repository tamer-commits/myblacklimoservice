import crypto from 'crypto';
import { insertOtpCode, getLatestOtpCode, incrementOtpAttempts, consumeOtpCode } from './db';
import { sendEmail, otpEmailHtml, emailConfigured } from './email';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;

function generateCode(){
 // 6-digit numeric code, zero-padded
 return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code){
 return crypto.createHash('sha256').update(code).digest('hex');
}

// purpose: 'signup_email' | 'login_email' — keeps signup and login codes in
// separate lanes so a stale signup code can never be used to log in.
export async function startEmailOtp(email, purpose = 'signup_email'){
 if(!emailConfigured()) return { ok:false, reason:'email_not_configured' };
 const identifier = email.trim().toLowerCase();

 const existing = await getLatestOtpCode(identifier, purpose);
 if(existing){
  const ageSeconds = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
  if(ageSeconds < RESEND_COOLDOWN_SECONDS){
   return { ok:false, reason:'cooldown', retryInSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds) };
  }
 }

 const code = generateCode();
 const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
 await insertOtpCode({ identifier, purpose, codeHash: hashCode(code), expiresAt });

 const sent = await sendEmail({
  to: email,
  subject: `${code} is your My Black Limo Service verification code`,
  html: otpEmailHtml(code),
  text: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
 });
 if(!sent.ok) return { ok:false, reason: sent.reason || 'send_failed' };
 return { ok:true };
}

export async function verifyEmailOtp(email, purpose, code){
 const identifier = email.trim().toLowerCase();
 const row = await getLatestOtpCode(identifier, purpose);
 if(!row) return { ok:false, reason:'no_code' };
 if(row.attempts >= MAX_ATTEMPTS) return { ok:false, reason:'too_many_attempts' };
 if(new Date(row.expires_at) < new Date()) return { ok:false, reason:'expired' };

 if(hashCode(String(code).trim()) !== row.code_hash){
  await incrementOtpAttempts(row.id);
  return { ok:false, reason:'incorrect' };
 }
 await consumeOtpCode(row.id);
 return { ok:true };
}

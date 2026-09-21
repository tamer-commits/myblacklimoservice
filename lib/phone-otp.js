// Phone OTP — self-rolled (mirrors lib/otp.js exactly) rather than Twilio
// Verify. The only Twilio credential available to this project is a
// Restricted API Key (no Account Auth Token), and Twilio's
// verify/service/create endpoint returns 401 "required permission
// twilio/verify/service/create is missing" for that key — so a Twilio
// Verify Service cannot be created here. Instead we generate our own
// 6-digit code, store it (SHA-256 hashed) in the same otp_codes table used
// for email OTP, and send it with the raw Twilio Programmable SMS sender
// already wired up in lib/notify.js (sendSms), reusing the same
// TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET /
// TWILIO_SMS_FROM credentials and logic — nothing about that sender changes.

import crypto from 'crypto';
import { insertOtpCode, getLatestOtpCode, incrementOtpAttempts, consumeOtpCode } from './db';
import { sendSms, toE164, messagingConfigured } from './notify';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;
const DEFAULT_PURPOSE = 'phone_otp';

function generateCode(){
 // 6-digit numeric code, zero-padded
 return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code){
 return crypto.createHash('sha256').update(code).digest('hex');
}

export function phoneOtpConfigured(){
 return Boolean(messagingConfigured() && process.env.TWILIO_SMS_FROM);
}

// purpose defaults to a single shared lane for signup/login (matching the
// old Twilio-Verify behaviour, which was indifferent to why a phone was
// being verified). Guest booking checkout passes its own 'booking_phone'
// purpose so a code sent for a booking can't be reused to log in, and vice
// versa — same separation lib/otp.js already does for email.
export async function startPhoneOtp(phone, purpose = DEFAULT_PURPOSE){
 if(!phoneOtpConfigured()) return { ok:false, reason:'not_configured' };
 const identifier = toE164(phone);

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

 const sent = await sendSms(identifier, `${code} is your My Black Limo Service verification code. It expires in ${CODE_TTL_MINUTES} minutes.`);
 if(!sent.sent) return { ok:false, reason: sent.reason || 'send_failed' };
 return { ok:true };
}

export async function checkPhoneOtp(phone, code, purpose = DEFAULT_PURPOSE){
 const identifier = toE164(phone);
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

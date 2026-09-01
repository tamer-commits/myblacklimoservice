// Phone OTP via Twilio Verify — a separate Twilio product from the raw
// SMS/WhatsApp sending in lib/notify.js. Twilio Verify handles code
// generation, expiry and rate-limiting itself, so no local otp_codes rows
// are needed for phone (unlike email, which we hand-roll via lib/otp.js).

import { toE164 } from './notify';

let cachedClient = null;
function client(){
 if(cachedClient) return cachedClient;
 const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET } = process.env;
 if(!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) return null;
 const twilio = require('twilio');
 cachedClient = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, { accountSid: TWILIO_ACCOUNT_SID });
 return cachedClient;
}

export function phoneOtpConfigured(){
 return Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_API_KEY_SID &&
  process.env.TWILIO_API_KEY_SECRET &&
  process.env.TWILIO_VERIFY_SERVICE_SID
 );
}

export async function startPhoneOtp(phone){
 const c = client();
 if(!c || !process.env.TWILIO_VERIFY_SERVICE_SID) return { ok:false, reason:'not_configured' };
 try{
  const verification = await c.verify.v2
   .services(process.env.TWILIO_VERIFY_SERVICE_SID)
   .verifications.create({ to: toE164(phone), channel: 'sms' });
  return { ok:true, status: verification.status };
 }catch(e){
  console.error('TWILIO_VERIFY_START_FAILED', e.message);
  // Twilio throttles duplicate requests for the same number — surface that distinctly.
  if(e.status === 429 || /max send attempts/i.test(e.message||'')) return { ok:false, reason:'cooldown' };
  return { ok:false, reason:'error', error: e.message };
 }
}

export async function checkPhoneOtp(phone, code){
 const c = client();
 if(!c || !process.env.TWILIO_VERIFY_SERVICE_SID) return { ok:false, reason:'not_configured' };
 try{
  const check = await c.verify.v2
   .services(process.env.TWILIO_VERIFY_SERVICE_SID)
   .verificationChecks.create({ to: toE164(phone), code: String(code).trim() });
  return { ok: check.status === 'approved', status: check.status };
 }catch(e){
  console.error('TWILIO_VERIFY_CHECK_FAILED', e.message);
  return { ok:false, reason:'error', error: e.message };
 }
}

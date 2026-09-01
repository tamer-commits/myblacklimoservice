// Thin Twilio wrapper. Every function fails soft (logs + returns {sent:false})
// when Twilio env vars are not yet set in Vercel, so the booking/dispatch flow
// never crashes while credentials are still being wired up.

let cachedClient = null;
function client(){
 if(cachedClient) return cachedClient;
 const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET } = process.env;
 if(!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) return null;
 const twilio = require('twilio');
 cachedClient = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, { accountSid: TWILIO_ACCOUNT_SID });
 return cachedClient;
}

export function messagingConfigured(){
 return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET);
}

// Normalises AU-style local numbers (04xx xxx xxx) to E.164 (+614xxxxxxxx).
// Leaves anything already starting with '+' untouched.
export function toE164(raw){
 const v = String(raw||'').trim();
 if(v.startsWith('+')) return v.replace(/[^\d+]/g,'');
 const digits = v.replace(/\D/g,'');
 if(digits.startsWith('0')) return `+61${digits.slice(1)}`;
 if(digits.startsWith('61')) return `+${digits}`;
 return `+${digits}`;
}

async function send({to, body, whatsapp}){
 const c = client();
 const from = whatsapp ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
 if(!c || !from){
  console.log('NOTIFY_SKIPPED_NOT_CONFIGURED', { to, whatsapp: Boolean(whatsapp), body });
  return { sent:false, reason:'twilio_not_configured' };
 }
 try{
  const toAddr = whatsapp ? `whatsapp:${toE164(to)}` : toE164(to);
  const msg = await c.messages.create({ to: toAddr, from, body });
  return { sent:true, sid: msg.sid };
 }catch(e){
  console.error('NOTIFY_SEND_FAILED', { to, whatsapp: Boolean(whatsapp), error: e.message });
  return { sent:false, reason: e.message };
 }
}

// Sends the same message on WhatsApp and SMS, best-effort on both — this is
// the "confirmation goes out on WhatsApp AND a normal text" behaviour requested.
export async function sendWhatsAppAndSms(to, body){
 const [wa, sms] = await Promise.all([
  send({ to, body, whatsapp:true }),
  send({ to, body, whatsapp:false }),
 ]);
 return { whatsapp: wa, sms };
}

export async function sendSms(to, body){ return send({ to, body, whatsapp:false }); }
export async function sendWhatsApp(to, body){ return send({ to, body, whatsapp:true }); }

// Automated TTS call used for the 75-minute driver escalation. Uses inline
// TwiML (no separate webhook needed) so it works the moment TWILIO_SMS_FROM
// (used as the caller ID for voice too) is set.
export async function callDriver(to, spokenMessage){
 const c = client();
 const from = process.env.TWILIO_VOICE_FROM || process.env.TWILIO_SMS_FROM;
 if(!c || !from){
  console.log('CALL_SKIPPED_NOT_CONFIGURED', { to, spokenMessage });
  return { sent:false, reason:'twilio_not_configured' };
 }
 try{
  const twiml = `<Response><Say voice="Polly.Olivia">${spokenMessage.replace(/&/g,'and')}</Say><Pause length="1"/><Say voice="Polly.Olivia">${spokenMessage.replace(/&/g,'and')}</Say></Response>`;
  const call = await c.calls.create({ to: toE164(to), from, twiml });
  return { sent:true, sid: call.sid };
 }catch(e){
  console.error('CALL_FAILED', { to, error: e.message });
  return { sent:false, reason: e.message };
 }
}

// Thin wrapper around Resend's HTTP API using plain fetch — no npm package
// needed, same pattern already used elsewhere in this codebase for Square's
// server-side API. Fails soft: if RESEND_API_KEY isn't set yet, callers get
// { ok:false, reason:'not_configured' } instead of throwing.

export function emailConfigured(){
 return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({ to, subject, html, text }){
 if(!emailConfigured()) return { ok:false, reason:'not_configured' };
 try{
  const res = await fetch('https://api.resend.com/emails', {
   method: 'POST',
   headers: {
    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
   },
   body: JSON.stringify({
    from: process.env.RESEND_FROM || 'My Black Limo Service <accounts@myblacklimoservice.com>',
    to: [to],
    subject,
    html,
    text: text || undefined,
   }),
  });
  if(!res.ok){
   const body = await res.text().catch(()=> '');
   console.error('RESEND_SEND_FAILED', res.status, body);
   return { ok:false, reason:'send_failed', status: res.status };
  }
  const data = await res.json();
  return { ok:true, id: data.id };
 }catch(e){
  console.error('RESEND_SEND_ERROR', e.message);
  return { ok:false, reason:'error', error: e.message };
 }
}

export function otpEmailHtml(code){
 return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
   <h2 style="margin:0 0 16px">My Black Limo Service</h2>
   <p style="margin:0 0 16px">Your verification code is:</p>
   <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:0 0 16px">${code}</p>
   <p style="margin:0 0 8px;color:#555;font-size:14px">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  </div>
 `;
}

import { NextResponse } from 'next/server';
import { startEmailOtp } from '../../../../lib/otp';
import { startPhoneOtp, phoneOtpConfigured } from '../../../../lib/phone-otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Only booking's own guest-checkout purposes may be started here — this is
// a generic identifier+purpose OTP endpoint reused by the /quote booking
// gate for a customer who is not creating an account. Signup/login keep
// their own dedicated routes (app/api/auth/signup/*, app/api/auth/login/*).
const ALLOWED_PURPOSES = new Set(['booking_email', 'booking_phone']);

export async function POST(req){
 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }

 const channel = body.channel === 'phone' ? 'phone' : 'email';
 const purpose = String(body.purpose || '').trim();
 if(!ALLOWED_PURPOSES.has(purpose)) return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 });
 const identifierRaw = String(body.identifier || '').trim();

 if(channel === 'email'){
  const email = identifierRaw.toLowerCase();
  if(!EMAIL_RE.test(email)) return NextResponse.json({ ok:false, error:'Please enter a valid email address.' }, { status:400 });
  const result = await startEmailOtp(email, purpose);
  if(!result.ok) return NextResponse.json({ ok:false, error: result.reason==='cooldown' ? 'Please wait before requesting another code.' : 'Could not send the email verification code. Please try again.', detail: result.reason }, { status: result.reason==='cooldown' ? 429 : 502 });
  return NextResponse.json({ ok:true });
 }

 if(identifierRaw.replace(/\D/g,'').length < 8) return NextResponse.json({ ok:false, error:'Please enter a valid mobile number.' }, { status:400 });
 if(!phoneOtpConfigured()) return NextResponse.json({ ok:false, error:'SMS verification is temporarily unavailable. Please try again shortly.' }, { status:503 });
 const result = await startPhoneOtp(identifierRaw, purpose);
 if(!result.ok) return NextResponse.json({ ok:false, error: result.reason==='cooldown' ? 'Please wait before requesting another code.' : 'Could not send the SMS verification code. Please try again.', detail: result.reason }, { status: result.reason==='cooldown' ? 429 : 502 });
 return NextResponse.json({ ok:true });
}

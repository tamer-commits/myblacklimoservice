import { NextResponse } from 'next/server';
import { verifyEmailOtp } from '../../../../lib/otp';
import { checkPhoneOtp } from '../../../../lib/phone-otp';
import { toE164 } from '../../../../lib/notify';
import { signVerificationToken } from '../../../../lib/session';

const ALLOWED_PURPOSES = new Set(['booking_email', 'booking_phone']);
const MESSAGES = { incorrect:'That code is incorrect.', expired:'That code has expired — request a new one.', too_many_attempts:'Too many incorrect attempts. Please request a new code.', no_code:'No code found — request a new one.' };

// Checks a guest-checkout OTP started via /api/otp/start and, on success,
// hands back a short-lived signed token (lib/session.signVerificationToken)
// scoped to {channel, identifier, purpose} instead of creating a user or DB
// row — app/api/booking/route.js re-verifies that token as proof of a fresh
// OTP check for the phone/email submitted with the booking.
export async function POST(req){
 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }

 const channel = body.channel === 'phone' ? 'phone' : 'email';
 const purpose = String(body.purpose || '').trim();
 if(!ALLOWED_PURPOSES.has(purpose)) return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 });
 const identifierRaw = String(body.identifier || '').trim();
 const code = String(body.code || '').trim();
 if(!code) return NextResponse.json({ ok:false, error:'Please enter the code.' }, { status:400 });

 const identifier = channel === 'email' ? identifierRaw.toLowerCase() : toE164(identifierRaw);
 const result = channel === 'email'
  ? await verifyEmailOtp(identifier, purpose, code)
  : await checkPhoneOtp(identifier, code, purpose);

 if(!result.ok) return NextResponse.json({ ok:false, error: MESSAGES[result.reason] || 'That code is incorrect or has expired.', code: result.reason }, { status:400 });

 const token = signVerificationToken({ channel, identifier, purpose });
 return NextResponse.json({ ok:true, token });
}

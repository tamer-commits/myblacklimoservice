import { NextResponse } from 'next/server';
import { dbConfigured, getUserByEmail, getUserByPhone } from '../../../../lib/db';
import { startEmailOtp } from '../../../../lib/otp';
import { startPhoneOtp, phoneOtpConfigured } from '../../../../lib/phone-otp';
import { toE164 } from '../../../../lib/notify';
import { signPendingSignup, pendingSignupCookieHeader } from '../../../../lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Starts the signup flow: validates full name / email / phone, checks
// neither is already registered, kicks off BOTH the email OTP and the phone
// OTP, and stashes the not-yet-verified signup details in a short-lived
// signed cookie (not a DB row — nothing is persisted until both codes are
// confirmed in signup/verify-email and signup/verify-phone).
export async function POST(req){
 if(!dbConfigured()) return NextResponse.json({ ok:false, error:'Account creation is temporarily unavailable. Please try again shortly.' }, { status:503 });

 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }

 const fullName = String(body.fullName || '').trim();
 const email = String(body.email || '').trim().toLowerCase();
 const phoneRaw = String(body.phone || '').trim();
 const whatsappSameAsMobile = body.whatsappSameAsMobile !== false;
 const whatsappNumberRaw = whatsappSameAsMobile ? '' : String(body.whatsappNumber || '').trim();

 if(fullName.length < 2) return NextResponse.json({ ok:false, error:'Please enter your full name.' }, { status:400 });
 if(!EMAIL_RE.test(email)) return NextResponse.json({ ok:false, error:'Please enter a valid email address.' }, { status:400 });
 if(phoneRaw.replace(/\D/g,'').length < 8) return NextResponse.json({ ok:false, error:'Please enter a valid mobile number.' }, { status:400 });
 if(!whatsappSameAsMobile && whatsappNumberRaw.replace(/\D/g,'').length < 8){
  return NextResponse.json({ ok:false, error:'Please enter a valid WhatsApp number, or tick that it’s the same as your mobile.' }, { status:400 });
 }

 const phone = toE164(phoneRaw);
 const whatsappNumber = whatsappSameAsMobile ? null : toE164(whatsappNumberRaw);

 const [existingByEmail, existingByPhone] = await Promise.all([getUserByEmail(email), getUserByPhone(phone)]);
 if(existingByEmail) return NextResponse.json({ ok:false, error:'An account already exists with that email. Try logging in instead.', code:'email_taken' }, { status:409 });
 if(existingByPhone) return NextResponse.json({ ok:false, error:'An account already exists with that mobile number. Try logging in instead.', code:'phone_taken' }, { status:409 });

 if(!phoneOtpConfigured()) return NextResponse.json({ ok:false, error:'Account creation is temporarily unavailable. Please try again shortly.' }, { status:503 });

 const [emailResult, phoneResult] = await Promise.all([
  startEmailOtp(email, 'signup_email'),
  startPhoneOtp(phone),
 ]);
 if(!emailResult.ok) return NextResponse.json({ ok:false, error:'Could not send the email verification code. Please try again.', detail: emailResult.reason }, { status:502 });
 if(!phoneResult.ok) return NextResponse.json({ ok:false, error:'Could not send the SMS verification code. Please try again.', detail: phoneResult.reason }, { status:502 });

 const pendingToken = signPendingSignup({ fullName, email, phone, whatsappSameAsMobile, whatsappNumber, emailVerified:false, phoneVerified:false });

 const res = NextResponse.json({ ok:true });
 res.headers.append('Set-Cookie', pendingSignupCookieHeader(pendingToken));
 return res;
}

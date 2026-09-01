import { NextResponse } from 'next/server';
import { dbConfigured, getUserByEmail, getUserByPhone } from '../../../../../lib/db';
import { startEmailOtp } from '../../../../../lib/otp';
import { startPhoneOtp } from '../../../../../lib/phone-otp';
import { toE164 } from '../../../../../lib/notify';
import { signPendingLogin, pendingLoginCookieHeader } from '../../../../../lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Passwordless login: the customer enters the email or mobile number they
// signed up with, we send a fresh OTP to whichever they gave us.
export async function POST(req){
 if(!dbConfigured()) return NextResponse.json({ ok:false, error:'Login is temporarily unavailable. Please try again shortly.' }, { status:503 });

 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }
 const identifierRaw = String(body.identifier || '').trim();
 if(!identifierRaw) return NextResponse.json({ ok:false, error:'Please enter your email or mobile number.' }, { status:400 });

 const isEmail = EMAIL_RE.test(identifierRaw);
 const method = isEmail ? 'email' : 'phone';
 const identifier = isEmail ? identifierRaw.toLowerCase() : toE164(identifierRaw);

 const user = isEmail ? await getUserByEmail(identifier) : await getUserByPhone(identifier);
 if(!user) return NextResponse.json({ ok:false, error:'We couldn’t find an account with that email or number. Create an account first.', code:'not_found' }, { status:404 });

 const result = method === 'email'
  ? await startEmailOtp(identifier, 'login_email')
  : await startPhoneOtp(identifier);
 if(!result.ok) return NextResponse.json({ ok:false, error:'Could not send the verification code. Please try again.', detail: result.reason }, { status:502 });

 const pendingToken = signPendingLogin({ userId: user.id, method, identifier });
 const res = NextResponse.json({ ok:true, method });
 res.headers.append('Set-Cookie', pendingLoginCookieHeader(pendingToken));
 return res;
}

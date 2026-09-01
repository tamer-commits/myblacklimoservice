import { NextResponse } from 'next/server';
import { verifyEmailOtp } from '../../../../../lib/otp';
import { getPendingSignup, signPendingSignup, pendingSignupCookieHeader } from '../../../../../lib/session';
import { completeSignupIfReady } from '../_complete';

export async function POST(req){
 const pending = getPendingSignup(req);
 if(!pending) return NextResponse.json({ ok:false, error:'Your signup session expired. Please start again.', code:'expired' }, { status:440 });

 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }
 const code = String(body.code || '').trim();
 if(!code) return NextResponse.json({ ok:false, error:'Please enter the code.' }, { status:400 });

 const result = await verifyEmailOtp(pending.email, 'signup_email', code);
 if(!result.ok){
  const messages = { incorrect:'That code is incorrect.', expired:'That code has expired — request a new one.', too_many_attempts:'Too many incorrect attempts. Please request a new code.', no_code:'No code found — request a new one.' };
  return NextResponse.json({ ok:false, error: messages[result.reason] || 'Verification failed.', code: result.reason }, { status:400 });
 }

 const updated = { ...pending, emailVerified:true };
 const outcome = await completeSignupIfReady(updated);
 if(outcome.completed) return outcome.response;

 const res = NextResponse.json({ ok:true, emailVerified:true, phoneVerified: Boolean(updated.phoneVerified) });
 res.headers.append('Set-Cookie', pendingSignupCookieHeader(signPendingSignup(updated)));
 return res;
}

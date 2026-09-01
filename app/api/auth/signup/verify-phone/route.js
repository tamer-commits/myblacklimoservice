import { NextResponse } from 'next/server';
import { checkPhoneOtp } from '../../../../../lib/phone-otp';
import { getPendingSignup, signPendingSignup, pendingSignupCookieHeader } from '../../../../../lib/session';
import { completeSignupIfReady } from '../_complete';

export async function POST(req){
 const pending = getPendingSignup(req);
 if(!pending) return NextResponse.json({ ok:false, error:'Your signup session expired. Please start again.', code:'expired' }, { status:440 });

 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }
 const code = String(body.code || '').trim();
 if(!code) return NextResponse.json({ ok:false, error:'Please enter the code.' }, { status:400 });

 const result = await checkPhoneOtp(pending.phone, code);
 if(!result.ok) return NextResponse.json({ ok:false, error:'That code is incorrect or has expired.' }, { status:400 });

 const updated = { ...pending, phoneVerified:true };
 const outcome = await completeSignupIfReady(updated);
 if(outcome.completed) return outcome.response;

 const res = NextResponse.json({ ok:true, phoneVerified:true, emailVerified: Boolean(updated.emailVerified) });
 res.headers.append('Set-Cookie', pendingSignupCookieHeader(signPendingSignup(updated)));
 return res;
}

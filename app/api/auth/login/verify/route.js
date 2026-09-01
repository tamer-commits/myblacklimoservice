import { NextResponse } from 'next/server';
import { getUserById } from '../../../../../lib/db';
import { verifyEmailOtp } from '../../../../../lib/otp';
import { checkPhoneOtp } from '../../../../../lib/phone-otp';
import { getPendingLogin, clearPendingLoginCookieHeader, signSession, sessionCookieHeader } from '../../../../../lib/session';
import { publicUser } from '../../signup/_complete';

export async function POST(req){
 const pending = getPendingLogin(req);
 if(!pending) return NextResponse.json({ ok:false, error:'Your login session expired. Please try again.', code:'expired' }, { status:440 });

 let body;
 try{ body = await req.json(); }catch{ return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 }); }
 const code = String(body.code || '').trim();
 if(!code) return NextResponse.json({ ok:false, error:'Please enter the code.' }, { status:400 });

 const result = pending.method === 'email'
  ? await verifyEmailOtp(pending.identifier, 'login_email', code)
  : await checkPhoneOtp(pending.identifier, code);
 if(!result.ok) return NextResponse.json({ ok:false, error:'That code is incorrect or has expired.' }, { status:400 });

 const user = await getUserById(pending.userId);
 if(!user) return NextResponse.json({ ok:false, error:'Account not found.' }, { status:404 });

 const sessionToken = signSession({ userId: user.id });
 const res = NextResponse.json({ ok:true, user: publicUser(user) });
 res.headers.append('Set-Cookie', clearPendingLoginCookieHeader());
 res.headers.append('Set-Cookie', sessionCookieHeader(sessionToken));
 return res;
}

import { NextResponse } from 'next/server';
import { clearSessionCookieHeader } from '../../../../lib/session';

export async function POST(){
 const res = NextResponse.json({ ok:true });
 res.headers.append('Set-Cookie', clearSessionCookieHeader());
 return res;
}

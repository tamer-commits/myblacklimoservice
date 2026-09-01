import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { googleOAuthConfigured, googleAuthUrl } from '../../../../../lib/google-oauth';
import { signOAuthState, oauthStateCookieHeader } from '../../../../../lib/session';

export async function GET(req){
 if(!googleOAuthConfigured()){
  const url = new URL('/login', req.url);
  url.searchParams.set('error', 'google_not_configured');
  return NextResponse.redirect(url);
 }
 const { searchParams } = new URL(req.url);
 const next = searchParams.get('next') || '/account';
 const nonce = crypto.randomBytes(16).toString('hex');

 const res = NextResponse.redirect(googleAuthUrl(nonce));
 res.headers.append('Set-Cookie', oauthStateCookieHeader(signOAuthState({ nonce, next })));
 return res;
}

import { NextResponse } from 'next/server';
import { exchangeGoogleCode, fetchGoogleUserinfo } from '../../../../../lib/google-oauth';
import { getUserByGoogleId, getUserByEmail, updateUser, dbConfigured } from '../../../../../lib/db';
import {
 getOAuthState, clearOAuthStateCookieHeader,
 signSession, sessionCookieHeader,
 signPendingSignup, pendingSignupCookieHeader,
} from '../../../../../lib/session';

// After Google confirms identity, an existing account is logged straight in.
// A brand-new visitor still needs a verified mobile number before an account
// can exist (that's an absolute requirement, Google or not) — so they're
// handed to /signup with their name/email pre-filled and email already
// marked verified, needing only the phone step.
export async function GET(req){
 const { searchParams } = new URL(req.url);
 const code = searchParams.get('code');
 const state = searchParams.get('state');
 const oauthState = getOAuthState(req);

 const failUrl = new URL('/login', req.url);
 if(!code || !state || !oauthState || oauthState.nonce !== state){
  failUrl.searchParams.set('error', 'google_auth_failed');
  const res = NextResponse.redirect(failUrl);
  res.headers.append('Set-Cookie', clearOAuthStateCookieHeader());
  return res;
 }
 if(!dbConfigured()){
  failUrl.searchParams.set('error', 'accounts_unavailable');
  return NextResponse.redirect(failUrl);
 }

 let profile;
 try{
  const tokens = await exchangeGoogleCode(code);
  profile = await fetchGoogleUserinfo(tokens.access_token);
 }catch(e){
  console.error('GOOGLE_OAUTH_CALLBACK_FAILED', e.message);
  failUrl.searchParams.set('error', 'google_auth_failed');
  const res = NextResponse.redirect(failUrl);
  res.headers.append('Set-Cookie', clearOAuthStateCookieHeader());
  return res;
 }

 const existingByGoogle = await getUserByGoogleId(profile.sub);
 const existingByEmail = existingByGoogle ? null : await getUserByEmail((profile.email||'').toLowerCase());
 const existing = existingByGoogle || existingByEmail;

 if(existing){
  if(!existingByGoogle){
   await updateUser(existing.id, { google_id: profile.sub, avatar_url: existing.avatar_url || profile.picture || null });
  }
  const sessionToken = signSession({ userId: existing.id });
  const res = NextResponse.redirect(new URL(oauthState.next || '/account', req.url));
  res.headers.append('Set-Cookie', clearOAuthStateCookieHeader());
  res.headers.append('Set-Cookie', sessionCookieHeader(sessionToken));
  return res;
 }

 // New visitor via Google: name + email are known and email is verified;
 // still need a verified mobile number to finish creating the account.
 const pendingToken = signPendingSignup({
  fullName: profile.name || '',
  email: (profile.email || '').toLowerCase(),
  phone: '',
  whatsappSameAsMobile: true,
  whatsappNumber: null,
  emailVerified: Boolean(profile.email_verified),
  phoneVerified: false,
  googleId: profile.sub,
  avatarUrl: profile.picture || null,
 });
 const signupUrl = new URL('/signup', req.url);
 signupUrl.searchParams.set('step', 'phone');
 if(oauthState.next) signupUrl.searchParams.set('next', oauthState.next);
 const res = NextResponse.redirect(signupUrl);
 res.headers.append('Set-Cookie', clearOAuthStateCookieHeader());
 res.headers.append('Set-Cookie', pendingSignupCookieHeader(pendingToken));
 return res;
}

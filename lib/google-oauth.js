// Hand-rolled Google OAuth 2.0 Authorization Code flow — deliberately not
// next-auth/Auth.js, because its App-Router-native release (v5) is still a
// beta package (5.0.0-beta.x) with the stable npm tag pointing at the older
// v4. This is a small, fully-inspectable flow using plain fetch, no
// dependency beyond what's already in the project.

export function googleOAuthConfigured(){
 return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(){
 const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myblacklimoservice.com';
 return `${site.replace(/\/$/, '')}/api/auth/google/callback`;
}

// `state` should be a short random token the caller stores in a short-lived
// httpOnly cookie and compares on callback (CSRF protection), plus optionally
// carries the post-login redirect target (e.g. "/quote").
export function googleAuthUrl(state){
 const params = new URLSearchParams({
  client_id: process.env.GOOGLE_CLIENT_ID,
  redirect_uri: redirectUri(),
  response_type: 'code',
  scope: 'openid email profile',
  access_type: 'online',
  prompt: 'select_account',
  state,
 });
 return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code){
 const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
   code,
   client_id: process.env.GOOGLE_CLIENT_ID,
   client_secret: process.env.GOOGLE_CLIENT_SECRET,
   redirect_uri: redirectUri(),
   grant_type: 'authorization_code',
  }),
 });
 if(!res.ok){
  const body = await res.text().catch(()=> '');
  throw new Error(`google_token_exchange_failed: ${res.status} ${body}`);
 }
 return res.json(); // { access_token, id_token, ... }
}

export async function fetchGoogleUserinfo(accessToken){
 const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
  headers: { Authorization: `Bearer ${accessToken}` },
 });
 if(!res.ok) throw new Error(`google_userinfo_failed: ${res.status}`);
 return res.json(); // { sub, email, email_verified, name, picture, ... }
}

import crypto from 'crypto';

// Hand-rolled signed session cookie (HMAC-SHA256) instead of a JWT library —
// same idea as a JWT (base64url payload + signature) but zero extra
// dependencies, which matters after the earlier Vercel Cron deploy failure
// taught us to keep production changes as small/inspectable as possible.
//
// Cookie value shape: base64url(json payload) + "." + base64url(hmac sig)

const COOKIE_NAME = 'mbls_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days — passwordless, so keep people signed in
const PENDING_SIGNUP_COOKIE = 'mbls_pending_signup';
const PENDING_SIGNUP_MAX_AGE = 60 * 20; // 20 minutes to finish OTP steps
const PENDING_LOGIN_COOKIE = 'mbls_pending_login';
const PENDING_LOGIN_MAX_AGE = 60 * 10;
const OAUTH_STATE_COOKIE = 'mbls_oauth_state';
const OAUTH_STATE_MAX_AGE = 60 * 10;
const VERIFICATION_MAX_AGE_SECONDS = 60 * 30; // 30 minutes — long enough to finish a booking after verifying

function secret(){
 const s = process.env.AUTH_SECRET;
 if(!s) throw new Error('AUTH_SECRET is not set');
 return s;
}

function b64url(input){
 return Buffer.from(input).toString('base64url');
}
function fromB64url(input){
 return Buffer.from(input, 'base64url').toString('utf8');
}

// Generic signed-token helpers (base64url payload + HMAC-SHA256 signature —
// same shape as a JWT, hand-rolled to avoid a dependency). Used for the
// long-lived login session as well as short-lived pending-signup/login/OAuth
// state, each with its own max age.
export function signToken(payload){
 const body = JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000) });
 const encoded = b64url(body);
 const sig = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
 return `${encoded}.${sig}`;
}

export function verifyToken(token, maxAgeSeconds){
 if(!token || typeof token !== 'string' || !token.includes('.')) return null;
 const [encoded, sig] = token.split('.');
 if(!encoded || !sig) return null;
 let expectedSig;
 try{
  expectedSig = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
 }catch{
  return null;
 }
 const a = Buffer.from(sig);
 const b = Buffer.from(expectedSig);
 if(a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
 try{
  const payload = JSON.parse(fromB64url(encoded));
  const ageSeconds = Math.floor(Date.now()/1000) - (payload.iat || 0);
  if(ageSeconds > maxAgeSeconds) return null;
  return payload;
 }catch{
  return null;
 }
}

export function signSession(payload){ return signToken(payload); }
export function verifySessionToken(token){ return verifyToken(token, MAX_AGE_SECONDS); }

export function sessionCookieHeader(token){
 const parts = [
  `${COOKIE_NAME}=${token}`,
  'Path=/',
  'HttpOnly',
  'Secure',
  'SameSite=Lax',
  `Max-Age=${MAX_AGE_SECONDS}`,
 ];
 return parts.join('; ');
}

export function clearSessionCookieHeader(){
 return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(req, name){
 const cookieHeader = req.headers.get ? req.headers.get('cookie') : req.headers.cookie;
 if(!cookieHeader) return null;
 const match = cookieHeader.split(';').map(c=>c.trim()).find(c=>c.startsWith(`${name}=`));
 if(!match) return null;
 return match.slice(name.length + 1);
}

export function getSessionFromRequest(req){
 const token = readCookie(req, COOKIE_NAME);
 return token ? verifySessionToken(token) : null;
}

// --- Short-lived cookies used mid-signup / mid-login / mid-OAuth -----------

function shortCookieHeader(name, token, maxAge){
 return [`${name}=${token}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${maxAge}`].join('; ');
}
function clearCookieHeader(name){
 return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function signPendingSignup(payload){ return signToken(payload); }
export function pendingSignupCookieHeader(token){ return shortCookieHeader(PENDING_SIGNUP_COOKIE, token, PENDING_SIGNUP_MAX_AGE); }
export function clearPendingSignupCookieHeader(){ return clearCookieHeader(PENDING_SIGNUP_COOKIE); }
export function getPendingSignup(req){
 const token = readCookie(req, PENDING_SIGNUP_COOKIE);
 return token ? verifyToken(token, PENDING_SIGNUP_MAX_AGE) : null;
}

export function signPendingLogin(payload){ return signToken(payload); }
export function pendingLoginCookieHeader(token){ return shortCookieHeader(PENDING_LOGIN_COOKIE, token, PENDING_LOGIN_MAX_AGE); }
export function clearPendingLoginCookieHeader(){ return clearCookieHeader(PENDING_LOGIN_COOKIE); }
export function getPendingLogin(req){
 const token = readCookie(req, PENDING_LOGIN_COOKIE);
 return token ? verifyToken(token, PENDING_LOGIN_MAX_AGE) : null;
}

export function signOAuthState(payload){ return signToken(payload); }
export function oauthStateCookieHeader(token){ return shortCookieHeader(OAUTH_STATE_COOKIE, token, OAUTH_STATE_MAX_AGE); }
export function clearOAuthStateCookieHeader(){ return clearCookieHeader(OAUTH_STATE_COOKIE); }
export function getOAuthState(req){
 const token = readCookie(req, OAUTH_STATE_COOKIE);
 return token ? verifyToken(token, OAUTH_STATE_MAX_AGE) : null;
}

// --- Short-lived "OTP just verified" proof token ----------------------------
// Used by guest (no-account) booking checkout: after /api/otp/check confirms
// a code for a given channel+identifier+purpose, we hand the browser this
// signed token instead of a DB flag. /api/booking then re-verifies it
// server-side (signature + max age + identifier match) as proof that email
// or phone was actually OTP-verified moments earlier, without creating a
// user record. Not a general-purpose token — scoped to 'otp_verified' kind.
export function signVerificationToken(payload){ return signToken({ ...payload, kind:'otp_verified' }); }
export function verifyVerificationToken(token){
 const payload = verifyToken(token, VERIFICATION_MAX_AGE_SECONDS);
 if(!payload || payload.kind !== 'otp_verified') return null;
 return payload;
}

export { COOKIE_NAME };

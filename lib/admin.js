import { getUserById, dbConfigured } from './db';
import { getSessionFromRequest } from './session';

// Comma-separated allowlist of admin emails, e.g. "tamer@ilearn.ae, ops@x.com".
// Fails closed: unset/empty ADMIN_EMAILS means nobody is admin — never
// default-allow. Compared case-insensitively, each entry trimmed.
function adminEmailAllowlist(){
 const raw = process.env.ADMIN_EMAILS;
 if(!raw) return [];
 return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

// The ONLY admin gate in this app: no separate password, no new cookie —
// just "already logged in via the normal OTP /login flow, AND that account's
// verified email is in ADMIN_EMAILS". Returns the raw DB user row (or null).
// Every admin API route and every admin page must go through this — the
// client-side checks in app/admin/* pages are UX only, this is the real
// security boundary.
export async function getAdminFromRequest(req){
 const allowlist = adminEmailAllowlist();
 if(!allowlist.length) return null; // fail closed: no allowlist configured
 if(!dbConfigured()) return null;
 const session = getSessionFromRequest(req);
 if(!session || !session.userId) return null;
 const user = await getUserById(session.userId);
 if(!user) return null;
 if(!user.email_verified_at) return null; // must actually be OTP-verified, not just typed at signup
 const email = String(user.email || '').trim().toLowerCase();
 if(!email || !allowlist.includes(email)) return null;
 return user;
}

// Header-key auth used by the pre-existing /api/admin/drivers automation
// (ADMIN_API_KEY env var, sent as `x-admin-key`). Kept so nothing that
// already depends on that key breaks when the route also starts accepting
// an admin session.
export function hasValidAdminKey(req){
 const key = process.env.ADMIN_API_KEY;
 if(!key) return false; // fail closed: no key configured means no key-based access
 return req.headers.get('x-admin-key') === key;
}

// Dual auth used by routes that both the old machine-to-machine key and the
// new admin UI need to call: a valid x-admin-key header OR a valid admin
// session, either is sufficient.
export async function authorizedByKeyOrSession(req){
 if(hasValidAdminKey(req)) return true;
 return Boolean(await getAdminFromRequest(req));
}

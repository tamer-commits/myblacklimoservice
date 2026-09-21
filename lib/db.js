import { sql } from '@vercel/postgres';

// All tables are created lazily/idempotently so the app never crashes before
// a Postgres database has been provisioned in Vercel (Storage > Create Database).
// Once POSTGRES_URL exists in the environment, the first request that touches
// the DB will self-provision the schema.
let schemaReady = null;
export function dbConfigured(){ return Boolean(process.env.POSTGRES_URL); }

export async function ensureSchema(){
 if(!dbConfigured()) return false;
 if(schemaReady) return schemaReady;
 schemaReady = (async () => {
  // Users must exist before bookings/saved_cards reference them.
  await sql`CREATE TABLE IF NOT EXISTS users(
   id SERIAL PRIMARY KEY,
   full_name TEXT NOT NULL,
   email TEXT UNIQUE NOT NULL,
   email_verified_at TIMESTAMPTZ,
   phone TEXT UNIQUE NOT NULL,
   phone_verified_at TIMESTAMPTZ,
   whatsapp_number TEXT,
   whatsapp_same_as_mobile BOOLEAN NOT NULL DEFAULT TRUE,
   second_phone TEXT,
   google_id TEXT UNIQUE,
   avatar_url TEXT,
   square_customer_id TEXT,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // users already existed before the second-phone field did — add the
  // column for deployments that created the table on an earlier schema.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS second_phone TEXT`;

  await sql`CREATE TABLE IF NOT EXISTS otp_codes(
   id SERIAL PRIMARY KEY,
   identifier TEXT NOT NULL,
   purpose TEXT NOT NULL,
   code_hash TEXT NOT NULL,
   attempts INT NOT NULL DEFAULT 0,
   expires_at TIMESTAMPTZ NOT NULL,
   consumed_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS otp_codes_lookup_idx ON otp_codes(identifier, purpose, created_at DESC)`;

  await sql`CREATE TABLE IF NOT EXISTS saved_cards(
   id SERIAL PRIMARY KEY,
   user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   square_card_id TEXT NOT NULL,
   brand TEXT,
   last4 TEXT,
   exp_month INT,
   exp_year INT,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS drivers(
   id SERIAL PRIMARY KEY,
   name TEXT NOT NULL,
   phone TEXT NOT NULL,
   active BOOLEAN NOT NULL DEFAULT TRUE,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bookings(
   id SERIAL PRIMARY KEY,
   reference TEXT UNIQUE NOT NULL,
   user_id INT REFERENCES users(id),
   name TEXT NOT NULL,
   email TEXT NOT NULL,
   phone TEXT NOT NULL,
   second_phone TEXT,
   flight_number TEXT,
   origin TEXT NOT NULL,
   destination TEXT NOT NULL,
   pickup_at TIMESTAMPTZ NOT NULL,
   vehicle TEXT,
   passengers INT DEFAULT 1,
   notes TEXT,
   quoted_fare NUMERIC,
   status TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
   driver_id INT REFERENCES drivers(id),
   customer_confirmation_sent_at TIMESTAMPTZ,
   driver_confirm_24h_sent_at TIMESTAMPTZ,
   driver_confirmed_24h_at TIMESTAMPTZ,
   driver_confirm_90m_sent_at TIMESTAMPTZ,
   driver_confirmed_90m_at TIMESTAMPTZ,
   driver_call_75m_sent_at TIMESTAMPTZ,
   reassigned_60m_at TIMESTAMPTZ,
   reassignment_count INT NOT NULL DEFAULT 0,
   customer_reminder_90m_sent_at TIMESTAMPTZ,
   customer_reminder_60m_sent_at TIMESTAMPTZ,
   needs_manual_dispatch BOOLEAN NOT NULL DEFAULT FALSE,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // bookings already existed before user accounts / second phone / flight
  // number did — add the columns for deployments that created the table on
  // an earlier version of this schema.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id)`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_phone TEXT`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_number TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS bookings_pickup_at_idx ON bookings(pickup_at)`;
  await sql`CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id)`;
  await sql`CREATE TABLE IF NOT EXISTS driver_confirm_tokens(
   token TEXT PRIMARY KEY,
   booking_id INT NOT NULL REFERENCES bookings(id),
   driver_id INT NOT NULL REFERENCES drivers(id),
   stage TEXT NOT NULL,
   expires_at TIMESTAMPTZ NOT NULL,
   used_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  return true;
 })();
 return schemaReady;
}

// --- Users -----------------------------------------------------------------

export async function getUserById(id){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
 return rows[0] || null;
}

export async function getUserByEmail(email){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
 return rows[0] || null;
}

export async function getUserByPhone(phone){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM users WHERE phone = ${phone}`;
 return rows[0] || null;
}

export async function getUserByGoogleId(googleId){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM users WHERE google_id = ${googleId}`;
 return rows[0] || null;
}

export async function createUser(u){
 await ensureSchema();
 const { rows } = await sql`
  INSERT INTO users(full_name, email, email_verified_at, phone, phone_verified_at, whatsapp_number, whatsapp_same_as_mobile, second_phone, google_id, avatar_url)
  VALUES (${u.fullName}, ${u.email}, ${u.emailVerifiedAt || null}, ${u.phone}, ${u.phoneVerifiedAt || null}, ${u.whatsappNumber || null}, ${u.whatsappSameAsMobile !== false}, ${u.secondPhone || null}, ${u.googleId || null}, ${u.avatarUrl || null})
  RETURNING *
 `;
 return rows[0];
}

export async function updateUser(id, fields){
 await ensureSchema();
 const keys = Object.keys(fields);
 if(!keys.length) return null;
 const sets = keys.map((k,i)=>`${k} = $${i+2}`).join(', ');
 const values = keys.map(k=>fields[k]);
 const { rows } = await sql.query(`UPDATE users SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...values]);
 return rows[0] || null;
}

// --- Email OTP codes ---------------------------------------------------------

export async function insertOtpCode({ identifier, purpose, codeHash, expiresAt }){
 await ensureSchema();
 const { rows } = await sql`INSERT INTO otp_codes(identifier, purpose, code_hash, expires_at) VALUES (${identifier}, ${purpose}, ${codeHash}, ${expiresAt}) RETURNING id`;
 return rows[0].id;
}

export async function getLatestOtpCode(identifier, purpose){
 await ensureSchema();
 const { rows } = await sql`
  SELECT * FROM otp_codes
  WHERE identifier = ${identifier} AND purpose = ${purpose} AND consumed_at IS NULL
  ORDER BY created_at DESC LIMIT 1
 `;
 return rows[0] || null;
}

export async function incrementOtpAttempts(id){
 await ensureSchema();
 await sql`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ${id}`;
}

export async function consumeOtpCode(id){
 await ensureSchema();
 await sql`UPDATE otp_codes SET consumed_at = now() WHERE id = ${id}`;
}

// --- Saved cards -------------------------------------------------------------

export async function getSavedCard(userId){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM saved_cards WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
 return rows[0] || null;
}

export async function insertSavedCard(c){
 await ensureSchema();
 const { rows } = await sql`
  INSERT INTO saved_cards(user_id, square_card_id, brand, last4, exp_month, exp_year)
  VALUES (${c.userId}, ${c.squareCardId}, ${c.brand}, ${c.last4}, ${c.expMonth}, ${c.expYear})
  RETURNING *
 `;
 return rows[0];
}

export async function deleteSavedCard(userId, id){
 await ensureSchema();
 await sql`DELETE FROM saved_cards WHERE id = ${id} AND user_id = ${userId}`;
}

// --- Drivers -----------------------------------------------------------

export async function getActiveDrivers(){
 await ensureSchema();
 const { rows } = await sql`SELECT id, name, phone, active FROM drivers WHERE active = TRUE ORDER BY id ASC`;
 return rows;
}

export async function listDrivers(){
 await ensureSchema();
 const { rows } = await sql`SELECT id, name, phone, active, created_at FROM drivers ORDER BY id ASC`;
 return rows;
}

export async function addDriver({ name, phone }){
 await ensureSchema();
 const { rows } = await sql`INSERT INTO drivers(name, phone) VALUES (${name}, ${phone}) RETURNING id, name, phone, active`;
 return rows[0];
}

// Admin roster toggle — turn a driver active/inactive without deleting them
// (an inactive driver drops out of getActiveDrivers()/pickNextDriver() but
// keeps their booking history intact via driver_id).
export async function setDriverActive(id, active){
 await ensureSchema();
 const { rows } = await sql`UPDATE drivers SET active = ${active} WHERE id = ${id} RETURNING id, name, phone, active, created_at`;
 return rows[0] || null;
}

export async function countActiveDrivers(){
 await ensureSchema();
 const { rows } = await sql`SELECT COUNT(*)::int AS count FROM drivers WHERE active = TRUE`;
 return rows[0].count;
}

// Simple round-robin: the active driver currently carrying the fewest
// upcoming (not-yet-departed) bookings gets the next job. `excludeId` lets
// the 60-minute reassignment flow skip the driver who just failed to confirm.
export async function pickNextDriver({ excludeId } = {}){
 await ensureSchema();
 // Built with sql.query() (parameterized $1 placeholders) rather than the
 // sql`` tagged template, because the WHERE clause is conditional and
 // @vercel/postgres's tagged template does not support splicing nested sql``
 // fragments as raw SQL — a nested fragment would just be bound as a value.
 const text = `
  SELECT d.id, d.name, d.phone
  FROM drivers d
  LEFT JOIN bookings b ON b.driver_id = d.id AND b.pickup_at > now() AND b.status <> 'CANCELLED'
  WHERE d.active = TRUE ${excludeId ? 'AND d.id <> $1' : ''}
  GROUP BY d.id, d.name, d.phone
  ORDER BY COUNT(b.id) ASC, d.id ASC
  LIMIT 1
 `;
 const { rows } = await sql.query(text, excludeId ? [excludeId] : []);
 return rows[0] || null;
}

// --- Bookings ------------------------------------------------------------

export async function insertBooking(b){
 await ensureSchema();
 const { rows } = await sql`
  INSERT INTO bookings(reference, user_id, name, email, phone, second_phone, flight_number, origin, destination, pickup_at, vehicle, passengers, notes, quoted_fare, status, driver_id)
  VALUES (${b.reference}, ${b.userId || null}, ${b.name}, ${b.email}, ${b.phone}, ${b.secondPhone || null}, ${b.flightNumber || null}, ${b.origin}, ${b.destination}, ${b.pickupAt}, ${b.vehicle}, ${b.passengers}, ${b.notes}, ${b.quotedFare}, ${b.status}, ${b.driverId || null})
  RETURNING *
 `;
 return rows[0];
}

export async function getBookingById(id){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM bookings WHERE id = ${id}`;
 return rows[0] || null;
}

export async function getBookingsByUserId(userId){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM bookings WHERE user_id = ${userId} ORDER BY created_at DESC`;
 return rows;
}

export async function getUpcomingBookings(){
 await ensureSchema();
 // Window covers everything from 2h in the past (so a just-missed reassignment
 // still gets one more cron pass) to 25h ahead (covers the 24h driver checkpoint).
 const { rows } = await sql`
  SELECT * FROM bookings
  WHERE status <> 'CANCELLED'
   AND pickup_at BETWEEN now() - interval '2 hours' AND now() + interval '25 hours'
  ORDER BY pickup_at ASC
 `;
 return rows;
}

export async function updateBooking(id, fields){
 await ensureSchema();
 const keys = Object.keys(fields);
 if(!keys.length) return null;
 const sets = keys.map((k,i)=>`${k} = $${i+2}`).join(', ');
 const values = keys.map(k=>fields[k]);
 const { rows } = await sql.query(`UPDATE bookings SET ${sets} WHERE id = $1 RETURNING *`, [id, ...values]);
 return rows[0] || null;
}

// --- Driver confirm tokens -------------------------------------------------

function randomToken(){
 const bytes = new Uint8Array(24);
 (globalThis.crypto || require('crypto').webcrypto).getRandomValues(bytes);
 return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
}

export async function issueDriverConfirmToken({ bookingId, driverId, stage, expiresAt }){
 await ensureSchema();
 const token = randomToken();
 await sql`INSERT INTO driver_confirm_tokens(token, booking_id, driver_id, stage, expires_at) VALUES (${token}, ${bookingId}, ${driverId}, ${stage}, ${expiresAt})`;
 return token;
}

export async function consumeDriverConfirmToken(token){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM driver_confirm_tokens WHERE token = ${token}`;
 const row = rows[0];
 if(!row) return { ok:false, reason:'not_found' };
 if(row.used_at) return { ok:false, reason:'already_used', row };
 if(new Date(row.expires_at) < new Date()) return { ok:false, reason:'expired', row };
 await sql`UPDATE driver_confirm_tokens SET used_at = now() WHERE token = ${token}`;
 return { ok:true, row };
}

// --- Admin: customers --------------------------------------------------
// Simple staff-facing listing/search — not exposed to customers. `q`
// matches full_name/email/phone/second_phone with a case-insensitive
// substring search; booking_count comes from a LEFT JOIN so 0-booking
// customers are still included.

export async function listUsersAdmin({ q, limit = 200, offset = 0 } = {}){
 await ensureSchema();
 const cappedLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);
 const cappedOffset = Math.max(Number(offset) || 0, 0);
 if(q){
  const like = `%${q}%`;
  const { rows } = await sql`
   SELECT u.*, COUNT(b.id)::int AS booking_count
   FROM users u
   LEFT JOIN bookings b ON b.user_id = u.id
   WHERE u.full_name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone ILIKE ${like} OR u.second_phone ILIKE ${like} OR u.whatsapp_number ILIKE ${like}
   GROUP BY u.id
   ORDER BY u.created_at DESC
   LIMIT ${cappedLimit} OFFSET ${cappedOffset}
  `;
  return rows;
 }
 const { rows } = await sql`
  SELECT u.*, COUNT(b.id)::int AS booking_count
  FROM users u
  LEFT JOIN bookings b ON b.user_id = u.id
  GROUP BY u.id
  ORDER BY u.created_at DESC
  LIMIT ${cappedLimit} OFFSET ${cappedOffset}
 `;
 return rows;
}

export async function countUsers(){
 await ensureSchema();
 const { rows } = await sql`SELECT COUNT(*)::int AS count FROM users`;
 return rows[0].count;
}

// --- Admin: bookings -----------------------------------------------------
// listBookingsAdmin/getBookingWithDriver join in the driver's name/phone so
// the admin UI never has to make a second round trip per row.

export async function listBookingsAdmin({ status, limit = 200, offset = 0 } = {}){
 await ensureSchema();
 const cappedLimit = Math.min(Math.max(Number(limit) || 200, 1), 200);
 const cappedOffset = Math.max(Number(offset) || 0, 0);
 if(status){
  const { rows } = await sql`
   SELECT b.*, d.name AS driver_name, d.phone AS driver_phone
   FROM bookings b
   LEFT JOIN drivers d ON d.id = b.driver_id
   WHERE b.status = ${status}
   ORDER BY b.pickup_at DESC
   LIMIT ${cappedLimit} OFFSET ${cappedOffset}
  `;
  return rows;
 }
 const { rows } = await sql`
  SELECT b.*, d.name AS driver_name, d.phone AS driver_phone
  FROM bookings b
  LEFT JOIN drivers d ON d.id = b.driver_id
  ORDER BY b.pickup_at DESC
  LIMIT ${cappedLimit} OFFSET ${cappedOffset}
 `;
 return rows;
}

export async function getBookingWithDriver(id){
 await ensureSchema();
 const { rows } = await sql`
  SELECT b.*, d.name AS driver_name, d.phone AS driver_phone
  FROM bookings b
  LEFT JOIN drivers d ON d.id = b.driver_id
  WHERE b.id = ${id}
 `;
 return rows[0] || null;
}

export async function countBookings({ status } = {}){
 await ensureSchema();
 if(status){
  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM bookings WHERE status = ${status}`;
  return rows[0].count;
 }
 const { rows } = await sql`SELECT COUNT(*)::int AS count FROM bookings`;
 return rows[0].count;
}

export async function countUpcomingBookings(){
 await ensureSchema();
 const { rows } = await sql`SELECT COUNT(*)::int AS count FROM bookings WHERE status <> 'CANCELLED' AND pickup_at > now()`;
 return rows[0].count;
}

export async function countNeedsManualDispatch(){
 await ensureSchema();
 const { rows } = await sql`SELECT COUNT(*)::int AS count FROM bookings WHERE needs_manual_dispatch = TRUE AND status <> 'CANCELLED'`;
 return rows[0].count;
}

export { sql, randomToken };

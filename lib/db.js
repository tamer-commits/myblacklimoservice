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

  // Live GPS tracking (dispatch use — driver is staff on shift, consenting
  // to be tracked). One row per driver holding only their LATEST fix, not a
  // history: upserted in place by app/api/driver-location/route.js every
  // time the driver's phone posts a new position. `on_shift` flips true on
  // every position post and false when the driver toggles sharing off, so
  // the admin map can grey a driver out without losing their last-known spot.
  await sql`CREATE TABLE IF NOT EXISTS driver_locations(
   driver_id INT PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
   lat DOUBLE PRECISION NOT NULL,
   lng DOUBLE PRECISION NOT NULL,
   accuracy DOUBLE PRECISION,
   on_shift BOOLEAN NOT NULL DEFAULT TRUE,
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // A persistent, reusable per-driver share link — unlike driver_confirm_tokens
  // below (single-use, per-checkpoint), this token never expires and is
  // reused across shifts: a driver bookmarks one link and taps "share"/"stop"
  // on it each shift instead of getting a new link every time. Issued lazily
  // by getOrCreateDriverLocationToken when an admin first asks for a driver's
  // link (see app/api/admin/drivers/[id]/location-link/route.js).
  await sql`CREATE TABLE IF NOT EXISTS driver_location_tokens(
   driver_id INT PRIMARY KEY REFERENCES drivers(id) ON DELETE CASCADE,
   token TEXT UNIQUE NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS bookings(
   id SERIAL PRIMARY KEY,
   reference TEXT UNIQUE NOT NULL,
   source TEXT DEFAULT 'web',
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
   reassigned_50m_at TIMESTAMPTZ,
   reassignment_count INT NOT NULL DEFAULT 0,
   customer_reminder_90m_sent_at TIMESTAMPTZ,
   customer_reminder_60m_sent_at TIMESTAMPTZ,
   customer_confirmed_at TIMESTAMPTZ,
   customer_confirm_48h_sent_at TIMESTAMPTZ,
   customer_confirm_24h_sent_at TIMESTAMPTZ,
   customer_confirm_2h_sent_at TIMESTAMPTZ,
   needs_manual_dispatch BOOLEAN NOT NULL DEFAULT FALSE,
   manual_dispatch_reason TEXT,
   driver_manual_dispatch_at TIMESTAMPTZ,
   customer_manual_dispatch_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // bookings already existed before user accounts / second phone / flight
  // number / source did — add the columns for deployments that created the
  // table on an earlier version of this schema.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id)`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS second_phone TEXT`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_number TEXT`;
  // 'web' (default, backward compatible) | 'whatsapp' | 'sms' — lets the
  // admin UI and reports tell a WhatsApp/SMS intake-bot booking apart from a
  // normal website booking at a glance.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web'`;
  // Cached geocode of origin/destination for the admin dispatch map's static
  // pickup/drop-off pins (see getBookingsForMap / saveBookingGeocode below).
  // Populated lazily on first geocode so the same free-text address is never
  // re-sent to Google's Geocoding API twice.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS origin_lat DOUBLE PRECISION`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS origin_lng DOUBLE PRECISION`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION`;
  // Driver-side: final-opportunity reassignment now fires at T-50m (was
  // T-60m). The old reassigned_60m_at column is kept (harmless, no longer
  // written) so nothing breaks for any in-flight booking that already has it
  // set; reassigned_50m_at is the column the current logic uses.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reassigned_50m_at TIMESTAMPTZ`;
  // Customer-side slide-confirm workflow (48h / 24h / 2h checkpoints) — new.
  // customer_confirmed_at is a single "confirmed at any checkpoint" flag
  // rather than one per checkpoint: once true, later checkpoints send a
  // lighter reminder instead of demanding re-confirmation every time.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_confirm_48h_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_confirm_24h_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_confirm_2h_sent_at TIMESTAMPTZ`;
  // manual_dispatch_reason is a short, human-readable, appendable trail of
  // WHY needs_manual_dispatch got set (e.g. "no_active_driver;
  // driver_unconfirmed_after_reassignment") — a single boolean alone can't
  // tell Tamer what's wrong at a glance. driver_manual_dispatch_at /
  // customer_manual_dispatch_at gate each SIDE's escalation independently,
  // so a driver-side problem being flagged never hides a customer-side one
  // (or vice versa) and neither re-fires its alert every 5-minute cron pass.
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS manual_dispatch_reason TEXT`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_manual_dispatch_at TIMESTAMPTZ`;
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_manual_dispatch_at TIMESTAMPTZ`;
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

  // Customer-facing mirror of driver_confirm_tokens above — single-use,
  // per-checkpoint slide-confirm tokens issued to the CUSTOMER instead of
  // the driver (48h / 24h / 2h checkpoints). Kept as a separate table rather
  // than adding a "party" column to driver_confirm_tokens: that table is
  // already live in production and FK's to driver_id (NOT NULL), which a
  // customer token has no value for — a new table is the lower-risk change.
  await sql`CREATE TABLE IF NOT EXISTS customer_confirm_tokens(
   token TEXT PRIMARY KEY,
   booking_id INT NOT NULL REFERENCES bookings(id),
   stage TEXT NOT NULL,
   expires_at TIMESTAMPTZ NOT NULL,
   used_at TIMESTAMPTZ,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // WhatsApp intake conversation state — one row per customer WhatsApp
  // number, tracking a linear question-by-question chat that ends in a
  // booking row (status AWAITING_MANUAL_QUOTE, source 'whatsapp'). See
  // app/api/whatsapp/webhook/route.js for the state machine that reads and
  // writes this table. `state` holds which question we're waiting on an
  // answer to; `pickup_at_text` deliberately stores whatever free text the
  // customer typed for date/time rather than a parsed timestamp — natural
  // language date parsing over chat is unreliable, so a human reads it
  // instead, same as the rest of this intake's manual-quote model.
  await sql`CREATE TABLE IF NOT EXISTS whatsapp_intakes(
   id SERIAL PRIMARY KEY,
   phone TEXT UNIQUE NOT NULL,
   state TEXT NOT NULL DEFAULT 'ASK_NAME',
   name TEXT,
   origin TEXT,
   destination TEXT,
   pickup_at_text TEXT,
   vehicle_preference TEXT,
   passengers INT,
   second_phone TEXT,
   email TEXT,
   email_verified_at TIMESTAMPTZ,
   flight_number TEXT,
   booking_id INT REFERENCES bookings(id),
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS whatsapp_intakes_phone_idx ON whatsapp_intakes(phone)`;

  // SMS intake conversation state — identical shape/purpose to
  // whatsapp_intakes above (see the comment on that table), but for the
  // plain-SMS version of the same intake bot (app/api/sms/webhook/route.js).
  // Kept as a separate table rather than a shared 'channel' column so the
  // already-working (shelved) WhatsApp webhook and its table are untouched.
  await sql`CREATE TABLE IF NOT EXISTS sms_intakes(
   id SERIAL PRIMARY KEY,
   phone TEXT UNIQUE NOT NULL,
   state TEXT NOT NULL DEFAULT 'ASK_NAME',
   name TEXT,
   origin TEXT,
   destination TEXT,
   pickup_at_text TEXT,
   vehicle_preference TEXT,
   passengers INT,
   second_phone TEXT,
   email TEXT,
   email_verified_at TIMESTAMPTZ,
   flight_number TEXT,
   booking_id INT REFERENCES bookings(id),
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sms_intakes_phone_idx ON sms_intakes(phone)`;

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
// the 50-minute reassignment flow skip the driver who just failed to confirm.
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

// --- Driver locations (live GPS tracking, dispatch use) ---------------------
// Drivers are staff on shift, consenting to be tracked for dispatch. Only
// the LATEST fix per driver is kept (not a history) — see the table comment
// in ensureSchema above.

export async function recordDriverLocation(driverId, lat, lng, accuracy){
 await ensureSchema();
 const { rows } = await sql`
  INSERT INTO driver_locations(driver_id, lat, lng, accuracy, on_shift, updated_at)
  VALUES (${driverId}, ${lat}, ${lng}, ${accuracy != null ? accuracy : null}, TRUE, now())
  ON CONFLICT (driver_id) DO UPDATE SET
   lat = EXCLUDED.lat, lng = EXCLUDED.lng, accuracy = EXCLUDED.accuracy,
   on_shift = TRUE, updated_at = now()
  RETURNING *
 `;
 return rows[0];
}

// Called when a driver taps "stop sharing" — keeps their last-known fix
// (useful context) but flags it stale so the admin map greys them out.
export async function setDriverOffShift(driverId){
 await ensureSchema();
 await sql`UPDATE driver_locations SET on_shift = FALSE WHERE driver_id = ${driverId}`;
}

export async function getLatestDriverLocations(){
 await ensureSchema();
 const { rows } = await sql`
  SELECT d.id AS driver_id, d.name, d.phone, d.active,
   l.lat, l.lng, l.accuracy, l.on_shift, l.updated_at
  FROM driver_locations l
  JOIN drivers d ON d.id = l.driver_id
  ORDER BY l.updated_at DESC
 `;
 return rows;
}

// --- Driver location share tokens -------------------------------------------
// A persistent, reusable per-driver token (unlike driver_confirm_tokens,
// which are single-use per checkpoint) so a driver can bookmark one link and
// toggle sharing on/off across shifts without needing a fresh link every time.

export async function getOrCreateDriverLocationToken(driverId){
 await ensureSchema();
 const existing = await sql`SELECT token FROM driver_location_tokens WHERE driver_id = ${driverId}`;
 if(existing.rows[0]) return existing.rows[0].token;
 const token = randomToken();
 await sql`INSERT INTO driver_location_tokens(driver_id, token) VALUES (${driverId}, ${token}) ON CONFLICT (driver_id) DO NOTHING`;
 const { rows } = await sql`SELECT token FROM driver_location_tokens WHERE driver_id = ${driverId}`;
 return rows[0].token;
}

export async function getDriverByLocationToken(token){
 await ensureSchema();
 const { rows } = await sql`
  SELECT d.id, d.name, d.active
  FROM driver_location_tokens t
  JOIN drivers d ON d.id = t.driver_id
  WHERE t.token = ${token}
 `;
 return rows[0] || null;
}

// --- Bookings ------------------------------------------------------------

export async function insertBooking(b){
 await ensureSchema();
 const { rows } = await sql`
  INSERT INTO bookings(reference, user_id, name, email, phone, second_phone, flight_number, origin, destination, pickup_at, vehicle, passengers, notes, quoted_fare, status, driver_id, source)
  VALUES (${b.reference}, ${b.userId || null}, ${b.name}, ${b.email}, ${b.phone}, ${b.secondPhone || null}, ${b.flightNumber || null}, ${b.origin}, ${b.destination}, ${b.pickupAt}, ${b.vehicle || null}, ${b.passengers || null}, ${b.notes || null}, ${b.quotedFare != null ? b.quotedFare : null}, ${b.status}, ${b.driverId || null}, ${b.source || 'web'})
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
 // Window covers everything from 2h in the past (so a just-missed
 // reassignment/escalation still gets one more cron pass) to 49h ahead
 // (covers the 48h customer checkpoint with an hour of buffer for the
 // 5-minute cron cadence).
 const { rows } = await sql`
  SELECT * FROM bookings
  WHERE status <> 'CANCELLED'
   AND pickup_at BETWEEN now() - interval '2 hours' AND now() + interval '49 hours'
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

// Sets needs_manual_dispatch = TRUE and appends `reason` to
// manual_dispatch_reason (rather than overwriting it), so if a booking ends
// up needing manual attention for MORE than one reason (e.g. the driver
// never confirmed AND separately the customer never confirmed) neither
// reason silently overwrites the other — the admin UI can show the full
// trail. Idempotent-ish: calling it again with the same reason string just
// appends it again, but callers gate this behind their own *_manual_dispatch_at
// column so in practice each reason is only appended once per booking.
export async function flagManualDispatch(id, reason){
 await ensureSchema();
 const { rows } = await sql`
  UPDATE bookings SET
   needs_manual_dispatch = TRUE,
   manual_dispatch_reason = CASE
    WHEN manual_dispatch_reason IS NULL OR manual_dispatch_reason = '' THEN ${reason}
    ELSE manual_dispatch_reason || '; ' || ${reason}
   END
  WHERE id = ${id}
  RETURNING *
 `;
 return rows[0] || null;
}

// --- Booking map pins (geocoded pickup/drop-off, cached) --------------------
// Static, address-derived pins for the admin dispatch map — plotting where
// bookings' pickup/drop-off ADDRESSES are, not live tracking of a customer's
// phone. See app/api/admin/bookings/map/route.js for the geocode + cache
// step that fills origin_lat/lng and dest_lat/lng on first use.

export async function getBookingsForMap(){
 await ensureSchema();
 const { rows } = await sql`
  SELECT id, reference, name, status, origin, destination, pickup_at,
   origin_lat, origin_lng, dest_lat, dest_lng
  FROM bookings
  WHERE status <> 'CANCELLED'
   AND pickup_at BETWEEN now() - interval '1 day' AND now() + interval '7 days'
  ORDER BY pickup_at ASC
 `;
 return rows;
}

export async function saveBookingGeocode(id, { originLat, originLng, destLat, destLng } = {}){
 await ensureSchema();
 await sql`
  UPDATE bookings SET
   origin_lat = COALESCE(${originLat != null ? originLat : null}, origin_lat),
   origin_lng = COALESCE(${originLng != null ? originLng : null}, origin_lng),
   dest_lat = COALESCE(${destLat != null ? destLat : null}, dest_lat),
   dest_lng = COALESCE(${destLng != null ? destLng : null}, dest_lng)
  WHERE id = ${id}
 `;
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

// --- Customer confirm tokens -------------------------------------------------
// Mirrors driver_confirm_tokens exactly (see its comments) but for the
// customer-facing slide-confirm flow (48h / 24h / 2h checkpoints, consumed
// by app/api/booking-confirm/route.js).

export async function issueCustomerConfirmToken({ bookingId, stage, expiresAt }){
 await ensureSchema();
 const token = randomToken();
 await sql`INSERT INTO customer_confirm_tokens(token, booking_id, stage, expires_at) VALUES (${token}, ${bookingId}, ${stage}, ${expiresAt})`;
 return token;
}

export async function consumeCustomerConfirmToken(token){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM customer_confirm_tokens WHERE token = ${token}`;
 const row = rows[0];
 if(!row) return { ok:false, reason:'not_found' };
 if(row.used_at) return { ok:false, reason:'already_used', row };
 if(new Date(row.expires_at) < new Date()) return { ok:false, reason:'expired', row };
 await sql`UPDATE customer_confirm_tokens SET used_at = now() WHERE token = ${token}`;
 return { ok:true, row };
}

// --- WhatsApp intake conversation state -------------------------------------
// One row per customer WhatsApp number. `state` is the question the bot is
// currently waiting on an answer for (see app/api/whatsapp/webhook/route.js).
// A row is never deleted by the bot itself once a booking is created — the
// booking_id foreign key links back to it — but deleteWhatsAppIntake is
// exposed for admin/test cleanup.

export async function getWhatsAppIntake(phone){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM whatsapp_intakes WHERE phone = ${phone}`;
 return rows[0] || null;
}

export async function upsertWhatsAppIntake(phone, fields = {}){
 await ensureSchema();
 const existing = await getWhatsAppIntake(phone);
 if(!existing){
  const { rows } = await sql`
   INSERT INTO whatsapp_intakes(phone, state, name, origin, destination, pickup_at_text, vehicle_preference, passengers, second_phone, email, email_verified_at, flight_number, booking_id)
   VALUES (${phone}, ${fields.state || 'ASK_NAME'}, ${fields.name || null}, ${fields.origin || null}, ${fields.destination || null}, ${fields.pickup_at_text || null}, ${fields.vehicle_preference || null}, ${fields.passengers || null}, ${fields.second_phone || null}, ${fields.email || null}, ${fields.email_verified_at || null}, ${fields.flight_number || null}, ${fields.booking_id || null})
   RETURNING *
  `;
  return rows[0];
 }
 const keys = Object.keys(fields);
 if(!keys.length) return existing;
 const sets = keys.map((k,i)=>`${k} = $${i+2}`).join(', ');
 const values = keys.map(k=>fields[k]);
 const { rows } = await sql.query(`UPDATE whatsapp_intakes SET ${sets}, updated_at = now() WHERE phone = $1 RETURNING *`, [phone, ...values]);
 return rows[0] || null;
}

// Used both by the "restart"/"start over" keyword and by the 24h stale-
// session timeout — puts an existing row back to a clean first-question
// state rather than deleting it (keeps one row per phone number forever).
export async function resetWhatsAppIntake(phone){
 await ensureSchema();
 const { rows } = await sql`
  UPDATE whatsapp_intakes SET
   state = 'ASK_NAME', name = NULL, origin = NULL, destination = NULL, pickup_at_text = NULL,
   vehicle_preference = NULL, passengers = NULL, second_phone = NULL, email = NULL,
   email_verified_at = NULL, flight_number = NULL, booking_id = NULL, updated_at = now()
  WHERE phone = ${phone}
  RETURNING *
 `;
 return rows[0] || null;
}

export async function deleteWhatsAppIntake(phone){
 await ensureSchema();
 await sql`DELETE FROM whatsapp_intakes WHERE phone = ${phone}`;
}

// --- SMS intake conversation state -----------------------------------------
// Mirrors the WhatsApp intake functions above exactly (see their comments)
// but reads/writes sms_intakes instead of whatsapp_intakes, for the plain-SMS
// version of the same intake bot (app/api/sms/webhook/route.js).

export async function getSmsIntake(phone){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM sms_intakes WHERE phone = ${phone}`;
 return rows[0] || null;
}

export async function upsertSmsIntake(phone, fields = {}){
 await ensureSchema();
 const existing = await getSmsIntake(phone);
 if(!existing){
  const { rows } = await sql`
   INSERT INTO sms_intakes(phone, state, name, origin, destination, pickup_at_text, vehicle_preference, passengers, second_phone, email, email_verified_at, flight_number, booking_id)
   VALUES (${phone}, ${fields.state || 'ASK_NAME'}, ${fields.name || null}, ${fields.origin || null}, ${fields.destination || null}, ${fields.pickup_at_text || null}, ${fields.vehicle_preference || null}, ${fields.passengers || null}, ${fields.second_phone || null}, ${fields.email || null}, ${fields.email_verified_at || null}, ${fields.flight_number || null}, ${fields.booking_id || null})
   RETURNING *
  `;
  return rows[0];
 }
 const keys = Object.keys(fields);
 if(!keys.length) return existing;
 const sets = keys.map((k,i)=>`${k} = $${i+2}`).join(', ');
 const values = keys.map(k=>fields[k]);
 const { rows } = await sql.query(`UPDATE sms_intakes SET ${sets}, updated_at = now() WHERE phone = $1 RETURNING *`, [phone, ...values]);
 return rows[0] || null;
}

export async function resetSmsIntake(phone){
 await ensureSchema();
 const { rows } = await sql`
  UPDATE sms_intakes SET
   state = 'ASK_NAME', name = NULL, origin = NULL, destination = NULL, pickup_at_text = NULL,
   vehicle_preference = NULL, passengers = NULL, second_phone = NULL, email = NULL,
   email_verified_at = NULL, flight_number = NULL, booking_id = NULL, updated_at = now()
  WHERE phone = ${phone}
  RETURNING *
 `;
 return rows[0] || null;
}

export async function deleteSmsIntake(phone){
 await ensureSchema();
 await sql`DELETE FROM sms_intakes WHERE phone = ${phone}`;
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

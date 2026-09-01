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
   name TEXT NOT NULL,
   email TEXT NOT NULL,
   phone TEXT NOT NULL,
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
  await sql`CREATE INDEX IF NOT EXISTS bookings_pickup_at_idx ON bookings(pickup_at)`;
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
  INSERT INTO bookings(reference, name, email, phone, origin, destination, pickup_at, vehicle, passengers, notes, quoted_fare, status, driver_id)
  VALUES (${b.reference}, ${b.name}, ${b.email}, ${b.phone}, ${b.origin}, ${b.destination}, ${b.pickupAt}, ${b.vehicle}, ${b.passengers}, ${b.notes}, ${b.quotedFare}, ${b.status}, ${b.driverId || null})
  RETURNING *
 `;
 return rows[0];
}

export async function getBookingById(id){
 await ensureSchema();
 const { rows } = await sql`SELECT * FROM bookings WHERE id = ${id}`;
 return rows[0] || null;
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

export { sql };

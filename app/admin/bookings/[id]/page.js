'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminGate from '../../AdminGate';

function fmt(ts){
 if(!ts) return '—';
 try{ return new Date(ts).toLocaleString('en-AU', { timeZone:'Australia/Sydney', dateStyle:'medium', timeStyle:'short' }); }
 catch{ return String(ts); }
}

const REASON_LABELS = {
 no_active_driver: 'No driver available',
 no_backup_driver_at_50m: 'No backup driver at T-50m',
 driver_unconfirmed_after_reassignment: 'Reassigned driver unconfirmed',
 customer_unconfirmed_1h_before_pickup: 'Customer unconfirmed at T-1h',
};

function humanizeReason(reason){
 if(!reason) return '';
 return reason.split(';').map(r => r.trim()).filter(Boolean).map(r => REASON_LABELS[r] || r).join(' · ');
}

const CHECKPOINTS = [
 ['customer_confirmation_sent_at', 'Booking confirmation sent'],
 ['driver_confirm_24h_sent_at', 'Driver 24h confirm request sent'],
 ['driver_confirmed_24h_at', 'Driver confirmed (24h)'],
 ['driver_confirm_90m_sent_at', 'Driver 90m confirm request sent'],
 ['driver_confirmed_90m_at', 'Driver confirmed (current assignment)'],
 ['driver_call_75m_sent_at', 'Driver 75m confirmation call'],
 ['reassigned_50m_at', 'Reassigned at T-50m (final opportunity)'],
 ['driver_manual_dispatch_at', 'Driver-side management alert sent'],
 ['customer_confirm_48h_sent_at', 'Customer 48h confirm/reminder sent'],
 ['customer_confirm_24h_sent_at', 'Customer 24h confirm/reminder sent'],
 ['customer_confirm_2h_sent_at', 'Customer 2h confirm/reminder sent'],
 ['customer_confirmed_at', 'Customer confirmed'],
 ['customer_manual_dispatch_at', 'Customer-side management alert sent'],
];

function BookingDetailInner(){
 const params = useParams();
 const [booking, setBooking] = useState(null);
 const [drivers, setDrivers] = useState([]);
 const [err, setErr] = useState('');
 const [loading, setLoading] = useState(true);
 const [status, setStatus] = useState('');
 const [driverId, setDriverId] = useState('');
 const [saving, setSaving] = useState(false);
 const [saveMsg, setSaveMsg] = useState('');

 function load(){
  setLoading(true);
  fetch(`/api/admin/bookings/${params.id}`).then(r=>r.json()).then(d => {
   if(d.ok){ setBooking(d.booking); setStatus(d.booking.status || ''); setDriverId(d.booking.driver_id || ''); }
   else setErr(d.error || 'Unable to load booking.');
  }).catch(() => setErr('Unable to load booking.')).finally(() => setLoading(false));
 }

 useEffect(() => { load(); }, [params.id]);
 useEffect(() => {
  fetch('/api/admin/drivers').then(r=>r.json()).then(d => { if(d.ok) setDrivers(d.drivers.filter(x=>x.active)); }).catch(()=>{});
 }, []);

 async function save(e){
  e.preventDefault();
  setSaving(true); setSaveMsg('');
  try{
   const r = await fetch(`/api/admin/bookings/${params.id}`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ status, driverId: driverId === '' ? null : Number(driverId) }),
   });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Unable to update booking.');
   setBooking(d.booking);
   setSaveMsg('Saved.');
  }catch(err){ setSaveMsg(err.message); }
  finally{ setSaving(false); }
 }

 if(loading) return <main className="innerPage"><section className="quoteIntro"><p className="status">Loading…</p></section></main>;
 if(err || !booking) return <main className="innerPage"><section className="quoteIntro"><p className="status">{err || 'Booking not found.'}</p></section></main>;

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker"><a href="/admin/bookings" style={{color:'#999'}}>← BOOKINGS</a></p>
    <h1>{booking.reference}</h1>
   </section>
   <section className="quoteWorkspace" style={{maxWidth:1100}}>
    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Trip</h2>
     <p><b>Customer:</b> {booking.name} — {booking.email} — {booking.phone}</p>
     {booking.second_phone && <p><b>Second phone:</b> {booking.second_phone}</p>}
     {booking.flight_number && <p><b>Flight:</b> {booking.flight_number}</p>}
     <p><b>Route:</b> {booking.origin} → {booking.destination}</p>
     <p><b>Pickup:</b> {fmt(booking.pickup_at)}</p>
     <p><b>Vehicle:</b> {booking.vehicle || '—'} · <b>Passengers:</b> {booking.passengers ?? '—'}</p>
     <p><b>Fare:</b> {booking.quoted_fare ? `$${Number(booking.quoted_fare).toFixed(0)} AUD` : '—'}</p>
     {booking.notes && <p><b>Notes:</b> {booking.notes}</p>}
     <p><b>Current status:</b> {booking.status}</p>
     <p><b>Assigned driver:</b> {booking.driver_name ? `${booking.driver_name} (${booking.driver_phone})` : 'Unassigned'}</p>
     {booking.needs_manual_dispatch && (
      <p className="status" style={{color:'#e0763f', fontWeight:600}}>
       Needs manual dispatch{booking.manual_dispatch_reason ? `: ${humanizeReason(booking.manual_dispatch_reason)}` : ''}.
      </p>
     )}

     <h2>Dispatch checkpoints</h2>
     <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
      <tbody>
       {CHECKPOINTS.map(([key, label]) => (
        <tr key={key} style={{borderTop:'1px solid #2a2a2a'}}>
         <td style={{padding:'8px 6px', color:'#bbb'}}>{label}</td>
         <td style={{padding:'8px 6px', color: booking[key] ? '#d9a526' : '#666'}}>{fmt(booking[key])}</td>
        </tr>
       ))}
       <tr style={{borderTop:'1px solid #2a2a2a'}}>
        <td style={{padding:'8px 6px', color:'#bbb'}}>Reassignment count</td>
        <td style={{padding:'8px 6px'}}>{booking.reassignment_count ?? 0}</td>
       </tr>
      </tbody>
     </table>
    </div>

    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Manual override</h2>
     <form onSubmit={save} style={{display:'grid', gap:12}}>
      <label>STATUS<input value={status} onChange={e=>setStatus(e.target.value)} placeholder="e.g. CONFIRMED"/></label>
      <label>DRIVER
       <select value={driverId} onChange={e=>setDriverId(e.target.value)} style={{width:'100%', padding:'13px', marginTop:7, background:'#181818', border:'1px solid #383838', color:'#eee'}}>
        <option value="">Unassigned</option>
        {drivers.map(d => <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>)}
       </select>
      </label>
      <button className="goldButton button" type="submit" disabled={saving}>{saving ? 'SAVING…' : 'SAVE CHANGES'}</button>
      {saveMsg && <p className="status">{saveMsg}</p>}
     </form>
    </div>
   </section>
  </main>
 );
}

export default function AdminBookingDetailPage(){
 return <AdminGate><BookingDetailInner/></AdminGate>;
}

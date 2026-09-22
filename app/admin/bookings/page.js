'use client';
import { useEffect, useState } from 'react';
import AdminGate from '../AdminGate';

const STATUS_FILTERS = ['', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_CONFIRMATION', 'AWAITING_MANUAL_QUOTE', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

function SourceBadge({ source }){
 const isWhatsApp = source === 'whatsapp';
 return (
  <span style={{
   display: 'inline-block',
   padding: '2px 8px',
   borderRadius: 999,
   fontSize: 11,
   fontWeight: 600,
   letterSpacing: '.02em',
   color: isWhatsApp ? '#0b1f14' : '#ccc',
   background: isWhatsApp ? '#25D366' : '#2a2a2a',
   border: isWhatsApp ? 'none' : '1px solid #3a3a3a',
  }}>
   {isWhatsApp ? 'WhatsApp' : 'Web'}
  </span>
 );
}

function BookingsInner(){
 const [bookings, setBookings] = useState([]);
 const [status, setStatus] = useState('');
 const [loading, setLoading] = useState(true);
 const [err, setErr] = useState('');

 function load(s){
  setLoading(true);
  const url = s ? `/api/admin/bookings?status=${encodeURIComponent(s)}` : '/api/admin/bookings';
  fetch(url).then(r=>r.json()).then(d => {
   if(d.ok) setBookings(d.bookings); else setErr(d.error || 'Unable to load bookings.');
  }).catch(() => setErr('Unable to load bookings.')).finally(() => setLoading(false));
 }

 useEffect(() => { load(''); }, []);

 function onFilter(e){
  const s = e.target.value;
  setStatus(s);
  load(s);
 }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker"><a href="/admin" style={{color:'#999'}}>← ADMIN</a></p>
    <h1>Bookings</h1>
   </section>
   <section className="quoteWorkspace" style={{gridTemplateColumns:'1fr', maxWidth:1200}}>
    <div className="quotePanel">
     <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:20}}>
      <label style={{fontSize:11, color:'#aaa'}}>STATUS
       <select value={status} onChange={onFilter} style={{marginLeft:8, padding:'8px 10px', background:'#181818', border:'1px solid #383838', color:'#eee'}}>
        {STATUS_FILTERS.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
       </select>
      </label>
     </div>
     {err && <p className="status">{err}</p>}
     {loading && <p className="status">Loading…</p>}
     {!loading && !err && bookings.length === 0 && <p className="status">No bookings found.</p>}
     {!loading && bookings.length > 0 && (
      <div style={{overflowX:'auto'}}>
       <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
        <thead>
         <tr style={{textAlign:'left', color:'#999', textTransform:'uppercase', fontSize:11}}>
          <th style={{padding:'8px 6px'}}>Reference</th>
          <th style={{padding:'8px 6px'}}>Source</th>
          <th style={{padding:'8px 6px'}}>Customer</th>
          <th style={{padding:'8px 6px'}}>Route</th>
          <th style={{padding:'8px 6px'}}>Pickup</th>
          <th style={{padding:'8px 6px'}}>Vehicle</th>
          <th style={{padding:'8px 6px'}}>Status</th>
          <th style={{padding:'8px 6px'}}>Driver</th>
          <th style={{padding:'8px 6px'}}>Fare</th>
         </tr>
        </thead>
        <tbody>
         {bookings.map(b => (
          <tr key={b.id} style={{borderTop:'1px solid #2a2a2a'}}>
           <td style={{padding:'10px 6px'}}><a href={`/admin/bookings/${b.id}`} style={{color:'#d9a526'}}>{b.reference}</a></td>
           <td style={{padding:'10px 6px'}}><SourceBadge source={b.source} /></td>
           <td style={{padding:'10px 6px'}}>{b.name}<br/><span style={{color:'#888', fontSize:12}}>{b.phone}</span></td>
           <td style={{padding:'10px 6px', maxWidth:220}}>{b.origin} → {b.destination}</td>
           <td style={{padding:'10px 6px', whiteSpace:'nowrap'}}>{b.pickup_at ? new Date(b.pickup_at).toLocaleString('en-AU',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'}) : ''}</td>
           <td style={{padding:'10px 6px'}}>{b.vehicle || '—'}</td>
           <td style={{padding:'10px 6px'}}>{b.status}{b.needs_manual_dispatch && <div style={{color:'#e0763f', fontSize:11}}>NEEDS DISPATCH</div>}</td>
           <td style={{padding:'10px 6px'}}>{b.driver_name || '—'}</td>
           <td style={{padding:'10px 6px'}}>{b.quoted_fare ? `$${Number(b.quoted_fare).toFixed(0)}` : '—'}</td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </div>
   </section>
  </main>
 );
}

export default function AdminBookingsPage(){
 return <AdminGate><BookingsInner/></AdminGate>;
}

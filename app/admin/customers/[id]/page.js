'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminGate from '../../AdminGate';

function CustomerDetailInner(){
 const params = useParams();
 const [customer, setCustomer] = useState(null);
 const [bookings, setBookings] = useState([]);
 const [err, setErr] = useState('');
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  fetch(`/api/admin/customers/${params.id}`).then(r=>r.json()).then(d => {
   if(d.ok){ setCustomer(d.customer); setBookings(d.bookings || []); }
   else setErr(d.error || 'Unable to load customer.');
  }).catch(() => setErr('Unable to load customer.')).finally(() => setLoading(false));
 }, [params.id]);

 if(loading){
  return <main className="innerPage"><section className="quoteIntro"><p className="status">Loading…</p></section></main>;
 }
 if(err || !customer){
  return <main className="innerPage"><section className="quoteIntro"><p className="status">{err || 'Customer not found.'}</p></section></main>;
 }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker"><a href="/admin/customers" style={{color:'#999'}}>← CUSTOMERS</a></p>
    <h1>{customer.fullName}</h1>
   </section>
   <section className="quoteWorkspace" style={{maxWidth:1100}}>
    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Details</h2>
     <p><b>Email:</b> {customer.email} {customer.emailVerified && <span style={{color:'#d9a526'}}>✓ verified</span>}</p>
     <p><b>Mobile:</b> {customer.phone} {customer.phoneVerified && <span style={{color:'#d9a526'}}>✓ verified</span>}</p>
     {customer.secondPhone && <p><b>Second phone:</b> {customer.secondPhone}</p>}
     {customer.whatsappNumber && <p><b>WhatsApp:</b> {customer.whatsappNumber}</p>}
     <p><b>Customer since:</b> {customer.createdAt ? new Date(customer.createdAt).toLocaleString('en-AU',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'}) : '—'}</p>
    </div>
    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Bookings ({bookings.length})</h2>
     {bookings.length === 0 && <p className="status">No bookings yet.</p>}
     {bookings.map(b => (
      <div key={b.id} style={{borderBottom:'1px solid #333', padding:'12px 0'}}>
       <p style={{margin:0}}><a href={`/admin/bookings/${b.id}`} style={{color:'#d9a526'}}><b>{b.reference}</b></a> — {b.status}</p>
       <p style={{margin:'4px 0', color:'#bbb'}}>{b.origin} → {b.destination}</p>
       <p style={{margin:0, color:'#888', fontSize:13}}>{b.pickup_at ? new Date(b.pickup_at).toLocaleString('en-AU',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'}) : ''}</p>
      </div>
     ))}
    </div>
   </section>
  </main>
 );
}

export default function AdminCustomerDetailPage(){
 return <AdminGate><CustomerDetailInner/></AdminGate>;
}

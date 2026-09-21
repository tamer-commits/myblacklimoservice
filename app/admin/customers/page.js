'use client';
import { useEffect, useState } from 'react';
import AdminGate from '../AdminGate';

function CustomersInner(){
 const [customers, setCustomers] = useState([]);
 const [q, setQ] = useState('');
 const [loading, setLoading] = useState(true);
 const [err, setErr] = useState('');

 function load(query){
  setLoading(true);
  setErr('');
  const url = query ? `/api/admin/customers?q=${encodeURIComponent(query)}` : '/api/admin/customers';
  fetch(url).then(r=>r.json()).then(d => {
   if(d.ok) setCustomers(d.customers);
   else setErr(d.error || 'Unable to load customers.');
  }).catch(() => setErr('Unable to load customers.')).finally(() => setLoading(false));
 }

 useEffect(() => { load(''); }, []);

 function onSearch(e){ e.preventDefault(); load(q); }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker"><a href="/admin" style={{color:'#999'}}>← ADMIN</a></p>
    <h1>Customers</h1>
   </section>
   <section className="quoteWorkspace" style={{gridTemplateColumns:'1fr', maxWidth:1100}}>
    <div className="quotePanel">
     <form onSubmit={onSearch} style={{display:'flex', gap:10, marginBottom:20}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, email or phone" style={{flex:1, padding:'12px 13px', background:'#181818', border:'1px solid #383838', color:'#eee'}}/>
      <button className="outlineButton" type="submit">SEARCH</button>
     </form>
     {err && <p className="status">{err}</p>}
     {loading && <p className="status">Loading…</p>}
     {!loading && !err && customers.length === 0 && <p className="status">No customers found.</p>}
     {!loading && customers.length > 0 && (
      <div style={{overflowX:'auto'}}>
       <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
        <thead>
         <tr style={{textAlign:'left', color:'#999', textTransform:'uppercase', fontSize:11}}>
          <th style={{padding:'8px 6px'}}>Name</th>
          <th style={{padding:'8px 6px'}}>Email</th>
          <th style={{padding:'8px 6px'}}>Phone</th>
          <th style={{padding:'8px 6px'}}>Bookings</th>
          <th style={{padding:'8px 6px'}}>Joined</th>
         </tr>
        </thead>
        <tbody>
         {customers.map(c => (
          <tr key={c.id} style={{borderTop:'1px solid #2a2a2a'}}>
           <td style={{padding:'10px 6px'}}><a href={`/admin/customers/${c.id}`} style={{color:'#d9a526'}}>{c.fullName}</a></td>
           <td style={{padding:'10px 6px'}}>{c.email} {c.emailVerified && <span style={{color:'#d9a526'}}>✓</span>}</td>
           <td style={{padding:'10px 6px'}}>{c.phone} {c.phoneVerified && <span style={{color:'#d9a526'}}>✓</span>}</td>
           <td style={{padding:'10px 6px'}}>{c.bookingCount}</td>
           <td style={{padding:'10px 6px', color:'#888'}}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-AU') : '—'}</td>
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

export default function AdminCustomersPage(){
 return <AdminGate><CustomersInner/></AdminGate>;
}

'use client';
import { useEffect, useState } from 'react';
import AdminGate from './AdminGate';

function StatCard({ label, value, warn }){
 const hot = warn && Number(value) > 0;
 return (
  <div className="quotePanel" style={{textAlign:'center'}}>
   <div style={{fontSize:34, fontFamily:'Georgia,serif', color: hot ? '#e0763f' : '#d9a526'}}>
    {value === undefined || value === null ? '—' : value}
   </div>
   <div style={{fontSize:12, color:'#aaa', textTransform:'uppercase', letterSpacing:1, marginTop:6}}>{label}</div>
  </div>
 );
}

function DashboardInner(){
 const [stats, setStats] = useState(null);
 const [err, setErr] = useState('');

 useEffect(() => {
  fetch('/api/admin/stats').then(r=>r.json()).then(d => {
   if(d.ok) setStats(d.stats); else setErr(d.error || 'Unable to load dashboard.');
  }).catch(() => setErr('Unable to load dashboard.'));
 }, []);

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker">ADMIN</p>
    <h1>Dashboard</h1>
    <p>Signed in as an administrator. Manage customers, drivers and bookings below.</p>
   </section>
   <section className="quoteWorkspace" style={{gridTemplateColumns:'1fr', maxWidth:1000}}>
    <div>
     {err && <p className="status">{err}</p>}
     <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:30}}>
      <StatCard label="Customers" value={stats?.customers} />
      <StatCard label="Active drivers" value={stats?.activeDrivers} />
      <StatCard label="Upcoming bookings" value={stats?.upcomingBookings} />
      <StatCard label="Needs manual dispatch" value={stats?.needsManualDispatch} warn />
     </div>
     <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
      <a className="goldButton button" href="/admin/bookings">BOOKINGS</a>
      <a className="outlineButton" href="/admin/customers">CUSTOMERS</a>
      <a className="outlineButton" href="/admin/drivers">DRIVERS</a>
     </div>
    </div>
   </section>
  </main>
 );
}

export default function AdminDashboardPage(){
 return <AdminGate><DashboardInner/></AdminGate>;
}

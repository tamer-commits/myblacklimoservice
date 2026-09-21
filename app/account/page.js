'use client';
import { useEffect, useState } from 'react';

export default function AccountPage(){
 const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
 const [bookings, setBookings] = useState([]);

 useEffect(() => {
  fetch('/api/auth/session').then(r=>r.json()).then(d=>{
   const u = d.user || null;
   setUser(u);
   if(u){
    fetch('/api/account/bookings').then(r=>r.json()).then(bd=>setBookings(bd.bookings || [])).catch(()=>{});
   }
  }).catch(()=>setUser(null));
 }, []);

 async function logout(){
  await fetch('/api/auth/logout', { method:'POST' });
  window.location.href = '/';
 }

 if(user === undefined){
  return <main className="innerPage"><section className="quoteIntro"><p className="status">Loading…</p></section></main>;
 }

 if(user === null){
  return (
   <main className="innerPage">
    <section className="quoteIntro">
     <p className="goldKicker">MY ACCOUNT</p>
     <h1>You’re not logged in.</h1>
     <p style={{display:'flex',gap:16,justifyContent:'center',marginTop:20}}>
      <a className="goldButton button" href="/login">LOG IN</a>
      <a className="outlineButton" href="/signup">CREATE ACCOUNT</a>
     </p>
    </section>
   </main>
  );
 }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker">MY ACCOUNT</p>
    <h1>Welcome, {(user.fullName || '').split(' ')[0] || 'there'}.</h1>
   </section>
   <section className="quoteWorkspace">
    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Your details</h2>
     <p><b>Name:</b> {user.fullName}</p>
     <p><b>Email:</b> {user.email} {user.emailVerified && <span style={{color:'#d9a526'}}>✓</span>}</p>
     <p><b>Mobile:</b> {user.phone} {user.phoneVerified && <span style={{color:'#d9a526'}}>✓</span>}</p>
     {user.secondPhone && <p><b>Second phone:</b> {user.secondPhone}</p>}
     <button className="outlineButton" onClick={logout} style={{marginTop:12}}>LOG OUT</button>
    </div>
    <div className="quotePanel" style={{flex:1}}>
     <h2 style={{marginTop:0}}>Your bookings</h2>
     {bookings.length === 0 && <p className="status">No bookings yet — <a href="/quote">get a quote</a> to make your first one.</p>}
     {bookings.map(b => (
      <div key={b.id} style={{borderBottom:'1px solid #333',padding:'12px 0'}}>
       <p style={{margin:0}}><b>{b.reference}</b> — {b.status}</p>
       <p style={{margin:'4px 0',color:'#bbb'}}>{b.origin} → {b.destination}</p>
       <p style={{margin:0,color:'#888',fontSize:13}}>{new Date(b.pickup_at).toLocaleString('en-AU',{timeZone:'Australia/Sydney',dateStyle:'medium',timeStyle:'short'})}</p>
      </div>
     ))}
    </div>
   </section>
  </main>
 );
}

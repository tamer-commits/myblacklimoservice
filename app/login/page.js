'use client';
import { useState } from 'react';

export default function LoginPage(){
 const [step, setStep] = useState('start');
 const [identifier, setIdentifier] = useState('');
 const [method, setMethod] = useState('');
 const [code, setCode] = useState('');
 const [status, setStatus] = useState('');
 const [busy, setBusy] = useState(false);

 async function start(e){
  e.preventDefault();
  setBusy(true); setStatus('Sending code…');
  try{
   const r = await fetch('/api/auth/login/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ identifier }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Could not send code.');
   setMethod(d.method);
   setStep('verify');
   setStatus(`Code sent via ${d.method === 'email' ? 'email' : 'SMS'}.`);
  }catch(err){ setStatus(err.message); } finally{ setBusy(false); }
 }

 async function verify(e){
  e.preventDefault();
  setBusy(true); setStatus('Verifying…');
  try{
   const r = await fetch('/api/auth/login/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Incorrect code.');
   window.location.href = '/account';
  }catch(err){ setStatus(err.message); } finally{ setBusy(false); }
 }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker">LOG IN</p>
    <h1>Welcome back.</h1>
    <p>Enter the email or mobile number you signed up with.</p>
   </section>
   <section className="quoteWorkspace" style={{gridTemplateColumns:'1fr',maxWidth:480}}>
    <div className="quotePanel">
     {step === 'start' && (
      <form className="bookingForm" onSubmit={start} style={{display:'grid',gap:12}}>
       <label>EMAIL OR MOBILE<input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@example.com or 04xx xxx xxx"/></label>
       <button className="goldButton button" type="submit" disabled={busy}>{busy ? 'SENDING CODE…' : 'SEND CODE'}</button>
       {status && <p className="status">{status}</p>}
       <p className="status">New here? <a href="/signup">Create an account</a></p>
      </form>
     )}
     {step === 'verify' && (
      <form className="bookingForm" onSubmit={verify} style={{display:'grid',gap:12}}>
       <label>{method === 'email' ? 'EMAIL CODE' : 'SMS CODE'}<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code"/></label>
       <button className="goldButton button" type="submit" disabled={busy}>{busy ? 'VERIFYING…' : 'LOG IN'}</button>
       {status && <p className="status">{status}</p>}
      </form>
     )}
    </div>
   </section>
  </main>
 );
}

'use client';
import { useState } from 'react';

export default function SignupPage(){
 const [step, setStep] = useState('form');
 const [fullName, setFullName] = useState('');
 const [email, setEmail] = useState('');
 const [phone, setPhone] = useState('');
 const [secondPhone, setSecondPhone] = useState('');
 const [emailCode, setEmailCode] = useState('');
 const [phoneCode, setPhoneCode] = useState('');
 const [emailVerified, setEmailVerified] = useState(false);
 const [phoneVerified, setPhoneVerified] = useState(false);
 const [status, setStatus] = useState('');
 const [busy, setBusy] = useState(false);

 async function submitSignup(e){
  e.preventDefault();
  setBusy(true); setStatus('Sending verification codes…');
  try{
   const r = await fetch('/api/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fullName, email, phone, whatsappSameAsMobile: true, secondPhone }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Could not start signup.');
   setStep('verify');
   setStatus('Enter the codes we just sent to your email and your mobile.');
  }catch(err){ setStatus(err.message); } finally{ setBusy(false); }
 }

 async function verifyEmail(e){
  e.preventDefault();
  setBusy(true); setStatus('');
  try{
   const r = await fetch('/api/auth/signup/verify-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: emailCode }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Incorrect code.');
   setEmailVerified(true);
   if(d.completed){ window.location.href = '/account'; return; }
   setStatus('Email verified. Now enter the SMS code to finish.');
  }catch(err){ setStatus(err.message); } finally{ setBusy(false); }
 }

 async function verifyPhone(e){
  e.preventDefault();
  setBusy(true); setStatus('');
  try{
   const r = await fetch('/api/auth/signup/verify-phone', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: phoneCode }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Incorrect code.');
   setPhoneVerified(true);
   if(d.completed){ window.location.href = '/account'; return; }
   setStatus('Mobile verified. Now enter the email code to finish.');
  }catch(err){ setStatus(err.message); } finally{ setBusy(false); }
 }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker">CREATE ACCOUNT</p>
    <h1>Join My Black Limo Service.</h1>
    <p>Save your details once and skip re-verifying your phone and email on future bookings.</p>
   </section>
   <section className="quoteWorkspace" style={{gridTemplateColumns:'1fr',maxWidth:560}}>
    <div className="quotePanel">
     {step === 'form' && (
      <form className="bookingForm" onSubmit={submitSignup} style={{display:'grid',gap:12}}>
       <label>FULL NAME<input required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name"/></label>
       <label>EMAIL<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
       <label>MOBILE<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="04xx xxx xxx"/></label>
       <label>SECOND PHONE <span style={{color:'#888',fontWeight:400}}>(important for airport pickup)</span><input value={secondPhone} onChange={e=>setSecondPhone(e.target.value)} placeholder="Alternate contact number"/></label>
       <button className="goldButton button" type="submit" disabled={busy}>{busy ? 'SENDING CODES…' : 'CREATE ACCOUNT'}</button>
       {status && <p className="status">{status}</p>}
       <p className="status">Already have an account? <a href="/login">Log in</a></p>
      </form>
     )}
     {step === 'verify' && (
      <div style={{display:'grid',gap:24}}>
       <form onSubmit={verifyEmail} style={{display:'grid',gap:10}}>
        <label style={{fontSize:9,color:'#aaa'}}>EMAIL CODE {emailVerified && <span style={{color:'#d9a526'}}>✓ Verified</span>}</label>
        <div style={{display:'flex',gap:10}}>
         <input value={emailCode} onChange={e=>setEmailCode(e.target.value)} placeholder="6-digit code" disabled={emailVerified} style={{flex:1,padding:13,background:'#181818',border:'1px solid #383838',color:'#eee'}}/>
         <button className="outlineButton" type="submit" disabled={busy || emailVerified}>VERIFY</button>
        </div>
       </form>
       <form onSubmit={verifyPhone} style={{display:'grid',gap:10}}>
        <label style={{fontSize:9,color:'#aaa'}}>SMS CODE {phoneVerified && <span style={{color:'#d9a526'}}>✓ Verified</span>}</label>
        <div style={{display:'flex',gap:10}}>
         <input value={phoneCode} onChange={e=>setPhoneCode(e.target.value)} placeholder="6-digit code" disabled={phoneVerified} style={{flex:1,padding:13,background:'#181818',border:'1px solid #383838',color:'#eee'}}/>
         <button className="outlineButton" type="submit" disabled={busy || phoneVerified}>VERIFY</button>
        </div>
       </form>
       {status && <p className="status">{status}</p>}
      </div>
     )}
    </div>
   </section>
  </main>
 );
}

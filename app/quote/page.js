'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AddressAutocomplete from '../components/AddressAutocomplete';
import PickerInput from '../components/PickerInput';

const AIRPORT_RX = /sydney airport|kingsford smith|\bSYD\b/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function QuotePageInner(){
 const searchParams=useSearchParams();
 const [vehicle,setVehicle]=useState(searchParams.get('vehicle')||'V-Class'),[baby,setBaby]=useState(searchParams.get('babySeat')==='on'?1:0),[booster,setBooster]=useState(searchParams.get('boosterSeat')==='on'?1:0),[meet,setMeet]=useState(false),[returnTrip,setReturnTrip]=useState(false);
 const [origin,setOrigin]=useState(searchParams.get('pickup')||''),[destination,setDestination]=useState(searchParams.get('dropoff')||''),[date,setDate]=useState(searchParams.get('date')||''),[time,setTime]=useState(searchParams.get('time')||''),[passengers,setPassengers]=useState(searchParams.get('passengers')||1),[notes,setNotes]=useState('');
 const [liveQuote,setLiveQuote]=useState(null),[quoteStatus,setQuoteStatus]=useState(''),[bookingStatus,setBookingStatus]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[secondPhone,setSecondPhone]=useState(''),[flightNumber,setFlightNumber]=useState(''),[busy,setBusy]=useState(false);

 // Session-aware prefill: a logged-in customer whose account phone/email are
 // already OTP-verified skips re-verification at booking time (they can
 // still edit second phone / flight number per booking).
 const [sessionUser,setSessionUser]=useState(undefined);
 useEffect(()=>{
  fetch('/api/auth/session').then(r=>r.json()).then(d=>{
   const u=d.user||null;
   setSessionUser(u);
   if(u){
    setName(n=>n||u.fullName||'');
    setEmail(e=>e||u.email||'');
    setPhone(p=>p||u.phone||'');
    setSecondPhone(sp=>sp||u.secondPhone||'');
   }
  }).catch(()=>setSessionUser(null));
 },[]);

 const accountEmailVerified = Boolean(sessionUser && sessionUser.emailVerified && email.trim().toLowerCase()===String(sessionUser.email||'').toLowerCase());
 const accountPhoneVerified = Boolean(sessionUser && sessionUser.phoneVerified && phone.trim()===String(sessionUser.phone||'').trim());

 const [emailOtp,setEmailOtp]=useState({status:'idle',code:'',token:'',error:''});
 const [phoneOtp,setPhoneOtp]=useState({status:'idle',code:'',token:'',error:''});

 function invalidate(){setLiveQuote(null);setQuoteStatus('Trip details changed — please recalculate your route.')}

 async function calculateRoute(){setQuoteStatus('Calculating live route…');setLiveQuote(null);try{const r=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,destination,vehicle,baby,booster,meet,returnTrip,date,time})});const d=await r.json();if(!r.ok)throw new Error(d.error);setLiveQuote(d);setQuoteStatus(`${d.km} km · approximately ${d.minutes} min · fixed indicative fare $${d.fare} AUD`)}catch(e){setQuoteStatus(e.message||'Live route pricing is not available yet.')}}

 async function sendEmailCode(){
  if(!EMAIL_RE.test(email)){ setEmailOtp(s=>({...s,error:'Enter a valid email address first.'})); return; }
  setEmailOtp(s=>({...s,status:'sending',error:''}));
  try{
   const r=await fetch('/api/otp/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:'email',identifier:email,purpose:'booking_email'})});
   const d=await r.json();
   if(!r.ok) throw new Error(d.error||'Could not send code.');
   setEmailOtp(s=>({...s,status:'sent'}));
  }catch(e){ setEmailOtp(s=>({...s,status:'idle',error:e.message})); }
 }
 async function checkEmailCode(){
  setEmailOtp(s=>({...s,status:'checking',error:''}));
  try{
   const r=await fetch('/api/otp/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:'email',identifier:email,purpose:'booking_email',code:emailOtp.code})});
   const d=await r.json();
   if(!r.ok) throw new Error(d.error||'Incorrect code.');
   setEmailOtp(s=>({...s,status:'verified',token:d.token,error:''}));
  }catch(e){ setEmailOtp(s=>({...s,status:'sent',error:e.message})); }
 }
 async function sendPhoneCode(){
  if(phone.replace(/\D/g,'').length<8){ setPhoneOtp(s=>({...s,error:'Enter a valid mobile number first.'})); return; }
  setPhoneOtp(s=>({...s,status:'sending',error:''}));
  try{
   const r=await fetch('/api/otp/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:'phone',identifier:phone,purpose:'booking_phone'})});
   const d=await r.json();
   if(!r.ok) throw new Error(d.error||'Could not send code.');
   setPhoneOtp(s=>({...s,status:'sent'}));
  }catch(e){ setPhoneOtp(s=>({...s,status:'idle',error:e.message})); }
 }
 async function checkPhoneCode(){
  setPhoneOtp(s=>({...s,status:'checking',error:''}));
  try{
   const r=await fetch('/api/otp/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:'phone',identifier:phone,purpose:'booking_phone',code:phoneOtp.code})});
   const d=await r.json();
   if(!r.ok) throw new Error(d.error||'Incorrect code.');
   setPhoneOtp(s=>({...s,status:'verified',token:d.token,error:''}));
  }catch(e){ setPhoneOtp(s=>({...s,status:'sent',error:e.message})); }
 }

 const airportInvolved = AIRPORT_RX.test(origin) || AIRPORT_RX.test(destination);
 const emailOk = accountEmailVerified || emailOtp.status==='verified';
 const phoneOk = accountPhoneVerified || phoneOtp.status==='verified';
 const canSubmit = Boolean(liveQuote && name && EMAIL_RE.test(email) && phone && secondPhone && destination && emailOk && phoneOk && (!airportInvolved || flightNumber));

 async function submitBooking(e){
  e.preventDefault();
  if(!liveQuote){setBookingStatus('Please calculate the live route before booking.');return}
  if(!canSubmit){setBookingStatus('Please complete and verify all required fields (destination, both phone numbers, verified email' + (airportInvolved?', flight number' : '') + ') before booking.');return}
  setBusy(true);setBookingStatus('Creating your booking…');
  try{const r=await fetch('/api/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,phone,secondPhone,flightNumber,origin,destination,date,time,passengers,vehicle,baby,booster,meet,returnTrip,notes,quotedFare:liveQuote.fare,routeKm:liveQuote.km,routeMinutes:liveQuote.minutes,emailVerifyToken:emailOtp.token,phoneVerifyToken:phoneOtp.token})});const d=await r.json();if(!r.ok)throw new Error(d.error);if(d.paymentUrl){setBookingStatus(`Booking ${d.reference} created. Opening secure Square payment…`);window.location.href=d.paymentUrl;return}setBookingStatus(`Request ${d.reference} received. Payment is not yet enabled; we will contact you to confirm.`)}catch(e){setBookingStatus(e.message||'Unable to submit your request. Please call us.')}finally{setBusy(false)}}
 const mapSrc=origin&&destination?`https://www.google.com/maps?q=${encodeURIComponent(origin+' to '+destination)}&output=embed`:'';
 return <main className="quotePage"><section className="quoteIntro"><p className="goldKicker">PRIVATE CHAUFFEUR BOOKING</p><h1>Plan your journey.</h1><p>Calculate your live route and fare, enter your details, then continue to secure payment when enabled.</p></section><section className="quoteWorkspace"><div className="quotePanel"><div className="routeFields"><label>FROM<AddressAutocomplete value={origin} onChange={v=>{setOrigin(v);invalidate()}} placeholder="Pickup location"/></label><label>TO<AddressAutocomplete value={destination} onChange={v=>{setDestination(v);invalidate()}} placeholder="Destination"/></label><label>DATE<PickerInput value={date} onChange={e=>{setDate(e.target.value);invalidate()}} type="date"/></label><label>TIME<PickerInput value={time} onChange={e=>{setTime(e.target.value);invalidate()}} type="time"/></label></div><div className="quoteGrid"><label>VEHICLE<select value={vehicle} onChange={e=>{setVehicle(e.target.value);invalidate()}}><option>V-Class</option><option>S-Class</option><option>Audi Q7</option><option>Sprinter</option></select></label><label>PASSENGERS<input type="number" min="1" max="14" value={passengers} onChange={e=>setPassengers(e.target.value)}/></label><label>BABY SEAT<select value={baby} onChange={e=>{setBaby(e.target.value);invalidate()}}><option value="0">None</option><option value="1">1 (+$20)</option><option value="2">2 (+$40)</option></select></label><label>BOOSTER<select value={booster} onChange={e=>{setBooster(e.target.value);invalidate()}}><option value="0">None</option><option value="1">1 (+$10)</option><option value="2">2 (+$20)</option></select></label></div><div className="toggles"><label><input type="checkbox" checked={meet} onChange={e=>{setMeet(e.target.checked);invalidate()}}/> Meet & Greet</label><label><input type="checkbox" checked={returnTrip} onChange={e=>{setReturnTrip(e.target.checked);invalidate()}}/> Return trip</label></div><div className="quoteActions"><button className="goldButton button" onClick={calculateRoute} disabled={!origin||!destination||!date||!time}>CALCULATE LIVE ROUTE</button>{quoteStatus&&<span className="status">{quoteStatus}</span>}</div>{liveQuote&&<div className="estimate"><span>ROUTE-BASED ESTIMATE</span><strong>${liveQuote.fare} AUD</strong></div>}

 <form className="bookingForm quoteBooking" onSubmit={submitBooking}>
  <label>NAME<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label>

  <label>EMAIL
   <input required type="email" value={email} readOnly={accountEmailVerified} onChange={e=>{setEmail(e.target.value);setEmailOtp({status:'idle',code:'',token:'',error:''})}} placeholder="you@example.com"/>
   {accountEmailVerified
    ? <small style={{display:'block',color:'#d9a526',marginTop:6}}>✓ Verified account email</small>
    : <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
       {emailOtp.status!=='verified' && (emailOtp.status==='sent'||emailOtp.status==='checking'
        ? <>
           <input value={emailOtp.code} onChange={e=>setEmailOtp(s=>({...s,code:e.target.value}))} placeholder="6-digit code" style={{width:110,padding:10,background:'#181818',border:'1px solid #383838',color:'#eee'}}/>
           <button type="button" className="outlineButton" onClick={checkEmailCode} disabled={emailOtp.status==='checking'}>VERIFY</button>
           <button type="button" className="outlineButton" onClick={sendEmailCode} disabled={emailOtp.status==='sending'}>RESEND</button>
          </>
        : <button type="button" className="outlineButton" onClick={sendEmailCode} disabled={emailOtp.status==='sending'}>{emailOtp.status==='sending'?'SENDING…':'SEND CODE'}</button>)}
       {emailOtp.status==='verified' && <small style={{color:'#d9a526'}}>✓ Verified</small>}
       {emailOtp.error && <small style={{color:'#e08a8a'}}>{emailOtp.error}</small>}
      </div>}
  </label>

  <label>PHONE
   <input required value={phone} readOnly={accountPhoneVerified} onChange={e=>{setPhone(e.target.value);setPhoneOtp({status:'idle',code:'',token:'',error:''})}} placeholder="Mobile number"/>
   {accountPhoneVerified
    ? <small style={{display:'block',color:'#d9a526',marginTop:6}}>✓ Verified account mobile</small>
    : <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
       {phoneOtp.status!=='verified' && (phoneOtp.status==='sent'||phoneOtp.status==='checking'
        ? <>
           <input value={phoneOtp.code} onChange={e=>setPhoneOtp(s=>({...s,code:e.target.value}))} placeholder="6-digit code" style={{width:110,padding:10,background:'#181818',border:'1px solid #383838',color:'#eee'}}/>
           <button type="button" className="outlineButton" onClick={checkPhoneCode} disabled={phoneOtp.status==='checking'}>VERIFY</button>
           <button type="button" className="outlineButton" onClick={sendPhoneCode} disabled={phoneOtp.status==='sending'}>RESEND</button>
          </>
        : <button type="button" className="outlineButton" onClick={sendPhoneCode} disabled={phoneOtp.status==='sending'}>{phoneOtp.status==='sending'?'SENDING…':'SEND CODE'}</button>)}
       {phoneOtp.status==='verified' && <small style={{color:'#d9a526'}}>✓ Verified</small>}
       {phoneOtp.error && <small style={{color:'#e08a8a'}}>{phoneOtp.error}</small>}
      </div>}
  </label>

  <label>SECOND PHONE<input required value={secondPhone} onChange={e=>setSecondPhone(e.target.value)} placeholder="Alternate contact number"/></label>

  {airportInvolved && <label>FLIGHT NUMBER<input required value={flightNumber} onChange={e=>setFlightNumber(e.target.value)} placeholder="e.g. QF1 (required for airport trips)"/></label>}

  <label className="fullWidth">NOTES<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Luggage, special requests or return details"/></label>

  {!sessionUser && <p className="fullWidth status">Already have an account? <a href="/login">Log in</a> to skip re-verifying your phone and email.</p>}

  <button className="goldButton button fullWidth" type="submit" disabled={!liveQuote||busy||!canSubmit}>{busy?'CREATING BOOKING…':'CONTINUE TO BOOKING →'}</button>
  {bookingStatus&&<p className="status fullWidth">{bookingStatus}</p>}
 </form>

 </div><aside className="mapPanel"><div><p className="goldKicker">ROUTE VIEW</p><h2>Your journey at a glance.</h2><p>Enter pickup and destination details to preview the route.</p></div>{mapSrc?<iframe title="Journey map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>:<div className="mapPlaceholder">Enter your pickup and destination to preview the route.</div>}<small>Displayed fares are indicative until the booking is confirmed. Special-event access, extended waiting or unusual charges may require adjustment.</small></aside></section></main>
}
export default function QuotePage(){
 return <Suspense fallback={null}><QuotePageInner/></Suspense>
}

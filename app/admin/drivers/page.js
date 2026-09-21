'use client';
import { useEffect, useState } from 'react';
import AdminGate from '../AdminGate';

function DriversInner(){
 const [drivers, setDrivers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [err, setErr] = useState('');
 const [name, setName] = useState('');
 const [phone, setPhone] = useState('');
 const [busy, setBusy] = useState(false);
 const [addErr, setAddErr] = useState('');

 function load(){
  setLoading(true);
  fetch('/api/admin/drivers').then(r=>r.json()).then(d => {
   if(d.ok) setDrivers(d.drivers); else setErr(d.error || 'Unable to load drivers.');
  }).catch(() => setErr('Unable to load drivers.')).finally(() => setLoading(false));
 }

 useEffect(() => { load(); }, []);

 async function addDriver(e){
  e.preventDefault();
  setBusy(true); setAddErr('');
  try{
   const r = await fetch('/api/admin/drivers', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, phone }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Unable to add driver.');
   setName(''); setPhone('');
   load();
  }catch(err){ setAddErr(err.message); }
  finally{ setBusy(false); }
 }

 async function toggleActive(driver){
  try{
   const r = await fetch(`/api/admin/drivers/${driver.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: !driver.active }) });
   const d = await r.json();
   if(!r.ok) throw new Error(d.error || 'Unable to update driver.');
   setDrivers(prev => prev.map(x => x.id === driver.id ? d.driver : x));
  }catch(err){ setErr(err.message); }
 }

 return (
  <main className="innerPage">
   <section className="quoteIntro">
    <p className="goldKicker"><a href="/admin" style={{color:'#999'}}>← ADMIN</a></p>
    <h1>Drivers</h1>
   </section>
   <section className="quoteWorkspace" style={{maxWidth:1100}}>
    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Roster</h2>
     {err && <p className="status">{err}</p>}
     {loading && <p className="status">Loading…</p>}
     {!loading && drivers.length === 0 && <p className="status">No drivers yet — add one on the right.</p>}
     {!loading && drivers.length > 0 && (
      <div style={{overflowX:'auto'}}>
       <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
        <thead>
         <tr style={{textAlign:'left', color:'#999', textTransform:'uppercase', fontSize:11}}>
          <th style={{padding:'8px 6px'}}>Name</th>
          <th style={{padding:'8px 6px'}}>Phone</th>
          <th style={{padding:'8px 6px'}}>Status</th>
          <th style={{padding:'8px 6px'}}></th>
         </tr>
        </thead>
        <tbody>
         {drivers.map(d => (
          <tr key={d.id} style={{borderTop:'1px solid #2a2a2a'}}>
           <td style={{padding:'10px 6px'}}>{d.name}</td>
           <td style={{padding:'10px 6px'}}>{d.phone}</td>
           <td style={{padding:'10px 6px', color: d.active ? '#d9a526' : '#888'}}>{d.active ? 'Active' : 'Inactive'}</td>
           <td style={{padding:'10px 6px'}}>
            <button className="outlineButton" style={{padding:'6px 14px', fontSize:10}} onClick={()=>toggleActive(d)}>
             {d.active ? 'DEACTIVATE' : 'ACTIVATE'}
            </button>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>
     )}
    </div>
    <div className="quotePanel">
     <h2 style={{marginTop:0}}>Add driver</h2>
     <form onSubmit={addDriver} style={{display:'grid', gap:12}}>
      <label>NAME<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Driver name"/></label>
      <label>PHONE<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+61 4xx xxx xxx"/></label>
      <button className="goldButton button" type="submit" disabled={busy}>{busy ? 'ADDING…' : 'ADD DRIVER'}</button>
      {addErr && <p className="status">{addErr}</p>}
     </form>
    </div>
   </section>
  </main>
 );
}

export default function AdminDriversPage(){
 return <AdminGate><DriversInner/></AdminGate>;
}

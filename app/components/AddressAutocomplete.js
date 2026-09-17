'use client';
import { useState, useRef, useEffect } from 'react';

export default function AddressAutocomplete({ name, value, onChange, placeholder }) {
 const isControlled = value !== undefined;
 const [internal, setInternal] = useState('');
 const val = isControlled ? value : internal;
 const [suggestions, setSuggestions] = useState([]);
 const [open, setOpen] = useState(false);
 const [active, setActive] = useState(-1);
 const tokenRef = useRef(null);
 const timerRef = useRef(null);
 const abortRef = useRef(null);
 const wrapRef = useRef(null);

 useEffect(() => {
  function onOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
  document.addEventListener('mousedown', onOutside);
  return () => document.removeEventListener('mousedown', onOutside);
 }, []);

 function newToken() {
  tokenRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
 }

 function setVal(v) { isControlled ? (onChange && onChange(v)) : setInternal(v); }

 async function fetchSuggestions(v) {
  if (abortRef.current) abortRef.current.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  try {
   const r = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: v, sessionToken: tokenRef.current }), signal: controller.signal });
   const d = await r.json();
   setSuggestions(d.suggestions || []);
   setOpen((d.suggestions || []).length > 0);
  } catch (err) {
   if (err.name !== 'AbortError') setSuggestions([]);
  }
 }

 function handleChange(e) {
  const v = e.target.value;
  setVal(v);
  setActive(-1);
  if (timerRef.current) clearTimeout(timerRef.current);
  if (v.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
  if (!tokenRef.current) newToken();
  timerRef.current = setTimeout(() => fetchSuggestions(v), 400);
 }

 function select(s) {
  setVal(s.text);
  setSuggestions([]);
  setOpen(false);
  setActive(-1);
  newToken();
 }

 function handleKeyDown(e) {
  if (!open || !suggestions.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
  else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); select(suggestions[active]); } }
  else if (e.key === 'Escape') setOpen(false);
 }

 return (
  <div className="addressAutocomplete" ref={wrapRef}>
   <input name={name} value={val} onChange={handleChange} onKeyDown={handleKeyDown} onFocus={() => suggestions.length && setOpen(true)} placeholder={placeholder} autoComplete="off" />
   {open && suggestions.length > 0 && (
    <ul className="addressSuggestions">
     {suggestions.map((s, i) => (
      <li key={s.placeId || s.text} className={i === active ? 'active' : ''} onMouseDown={e => { e.preventDefault(); select(s); }}>{s.text}</li>
     ))}
    </ul>
   )}
  </div>
 );
}

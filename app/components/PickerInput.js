'use client';
export default function PickerInput({ type, ...props }) {
 function openPicker(e) {
  if (e.target.showPicker) {
   try { e.target.showPicker(); } catch (err) {}
  }
 }
 return <input type={type} onClick={openPicker} onFocus={openPicker} {...props} />;
}

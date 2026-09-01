// Converts a "YYYY-MM-DD" + "HH:MM" pair, entered as Sydney local time on the
// booking form, into a UTC Date — without pulling in a timezone-database
// package. Works by asking the runtime's Intl implementation (which does
// carry the IANA database) what Australia/Sydney's offset is at that instant,
// then applying it. Accurate everywhere except inside the one-hour DST
// transition window itself (twice a year), which is an acceptable v1
// limitation for a booking form granular to the minute.
export function sydneyLocalToUtc(dateStr, timeStr){
 const guess = new Date(`${dateStr}T${timeStr}:00Z`);
 const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', timeZoneName: 'shortOffset' }).formatToParts(guess);
 const offsetLabel = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+10';
 const match = offsetLabel.match(/GMT([+-]\d+)(?::(\d+))?/);
 const offsetHours = match ? parseInt(match[1], 10) : 10;
 const offsetMinutes = match && match[2] ? parseInt(match[2], 10) : 0;
 const offsetMs = (offsetHours * 60 + Math.sign(offsetHours || 1) * offsetMinutes) * 60000;
 return new Date(guess.getTime() - offsetMs);
}

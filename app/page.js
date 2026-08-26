'use client';

const amenities=[
 ['Still & sparkling water','Chilled and ready for every journey'],
 ['Fresh mints','A small touch of first-class hospitality'],
 ['Premium comfort','Immaculate, quiet and climate controlled'],
 ['Charging throughout','USB and phone charging within easy reach'],
 ['Unlimited Wi-Fi','Stay connected while you travel'],
 ['Phone holders','Hands-free convenience for every passenger'],
 ['Premium surround sound','Rich, clear audio throughout the cabin'],
 ['Live journey sharing','Share your journey with loved ones when available']
];

const services=[
 ['Airport Transfers','Reliable, punctual and flight-aware'],
 ['Corporate Travel','Discreet, polished and schedule focused'],
 ['Weddings','Elegant arrivals for an important day'],
 ['VIP & Events','Private transport with presence and discretion']
];

export default function Home(){
 return <main className="luxuryHome">
  <header className="luxHeader">
   <a className="luxBrand" href="/"><span className="crest">MB</span><span><b>MBLS</b><small>MY BLACK LIMO SERVICE</small></span></a>
   <nav><a href="#experience">Experience</a><a href="#services">Services</a><a href="#fleet">Fleet</a><a href="#contact">Contact</a></nav>
   <div className="headerActions"><a href="tel:+61420770707">+61 420 770 707</a><a className="goldButton" href="/quote" target="_blank">BOOK NOW</a></div>
  </header>

  <section className="luxHero">
   <img className="heroBg" src="https://www.imperialride.com/images/2025/04/luxury-chauffeur-sesrvice-london.jpg" alt="Luxury black Mercedes chauffeur service"/>
   <div className="heroVeil"/>
   <div className="luxHeroCopy">
    <p className="goldKicker">SYDNEY'S PRIVATE CHAUFFEUR SERVICE</p>
    <h1>LUXURY<br/>CHAUFFEUR<br/>SERVICE</h1>
    <p className="heroLine">Sophistication. Discretion. Excellence.</p>
    <p className="heroSub">First-class chauffeur travel with a focus on reliability, presentation and an exceptional in-car experience.</p>
    <a className="goldButton heroButton" href="/quote" target="_blank">BOOK YOUR RIDE →</a>
   </div>
  </section>

  <section id="experience" className="experienceBand">
   <p className="sectionKicker">EXPERIENCE THE DIFFERENCE</p>
   <div className="amenityRow">{amenities.map((a,i)=><article key={a[0]}><span>{String(i+1).padStart(2,'0')}</span><h3>{a[0]}</h3><p>{a[1]}</p></article>)}</div>
  </section>

  <section className="imageStory" id="fleet">
   <article className="storyCard"><img src="https://signaturechauffeurs.com.au/images/2022/09/29/van1.jpg" alt="Luxury Mercedes V-Class"/><div><p className="goldKicker">TRAVEL IN STYLE</p><h2>Luxury that begins before you arrive.</h2><p>Beautifully presented black vehicles, spacious cabins and a calm environment prepared for every passenger.</p></div></article>
   <article className="storyCard"><img src="https://m.somewheregood.com/media/brisbanes-ultimate-chauffeur-airport-arrival-experience-d363-119938P5-2.jpg" alt="Professional chauffeur service"/><div><p className="goldKicker">PROFESSIONAL & RELIABLE</p><h2>A driver you can depend on.</h2><p>Punctual, discreet and professionally presented, with every journey planned around your time and comfort.</p></div></article>
   <article className="storyCard"><img src="https://res.cloudinary.com/db54ocawg/image/upload/v1721722046/photos/aaddsneofgjyntfljd1o.jpg" alt="Premium luxury vehicle interior"/><div><p className="goldKicker">FIRST-CLASS EXPERIENCE</p><h2>Every detail considered.</h2><p>Cold water, fresh mints, Wi-Fi, charging, phone holders and premium sound create a cabin designed around the passenger.</p></div></article>
  </section>

  <section id="services" className="commitment">
   <p className="sectionKicker">YOUR JOURNEY. OUR COMMITMENT.</p>
   <h2>Private transport with the standard of a luxury hotel.</h2>
   <p className="commitLead">From airport transfers to corporate travel, weddings and private events, we deliver a composed and dependable experience from door to door.</p>
   <div className="serviceRow">{services.map(s=><article key={s[0]}><h3>{s[0]}</h3><p>{s[1]}</p></article>)}</div>
   <div className="quoteStrip"><div><span>GET AN INSTANT QUOTE</span><small>Fast. Easy. No obligation.</small></div><a className="goldButton" href="/quote" target="_blank">GET QUOTE & VIEW MAP →</a></div>
  </section>

  <footer id="contact" className="luxFooter">
   <div className="luxBrand"><span className="crest">MB</span><span><b>MBLS</b><small>MY BLACK LIMO SERVICE</small></span></div>
   <div><b>CONTACT</b><a href="tel:+61420770707">+61 420 770 707</a><a href="mailto:info@myblacklimoservice.com">info@myblacklimoservice.com</a><span>Sydney, Australia</span></div>
   <div><b>QUICK LINKS</b><a href="#services">Services</a><a href="#fleet">Fleet</a><a href="/quote" target="_blank">Booking</a></div>
   <div><b>LEGAL</b><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><span>ABN 14 106 640 832</span></div>
   <small>© 2026 My Black Limo Service. All rights reserved.</small>
  </footer>
 </main>
}
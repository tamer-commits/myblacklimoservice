'use client';
import { HERO_IMAGE } from './heroData';

const amenities=[
  ['💧','Still & sparkling water','Chilled and ready'],
  ['✦','Fresh mints','First-class hospitality'],
  ['♛','Premium comfort','Quiet and climate controlled'],
  ['⚡','Charging throughout','Power within easy reach'],
  ['◉','Unlimited Wi-Fi','Stay connected'],
  ['▣','Phone holders','Hands-free convenience'],
  ['♫','Premium surround sound','Rich cabin audio'],
  ['🗺️','Live journey sharing','Share your journey']
];
const services=[
  ['Airport Transfers','Flight-aware pickups'],
  ['Corporate Travel','Professional and discreet'],
  ['Weddings','Elegant arrivals'],
  ['VIP & Events','Private transport'],
  ['Formal','Make an entrance'],
  ['As Directed','Chauffeur by the hour']
];

export default function Home(){
 return <main className="luxuryHome">
  <section className="approvedHero desktopApprovedHero" style={{backgroundImage:`url(${HERO_IMAGE})`}} aria-label="My Black Limo Service Sydney luxury chauffeur fleet">
    <a className="approvedHeroBookingHotspot" href="/quote" aria-label="Book your ride"></a>
  </section>

  <section className="mobileApprovedHero">
    <img src={HERO_IMAGE} alt="My Black Limo Service Sydney luxury chauffeur fleet"/>
    <div className="mobileApprovedCopy">
      <p className="goldKicker">SYDNEY'S PRIVATE CHAUFFEUR SERVICE</p>
      <h1>LUXURY CHAUFFEUR SERVICE</h1>
      <p>Sophistication. Discretion. Excellence.</p>
      <a className="goldButton" href="/quote">BOOK YOUR RIDE →</a>
    </div>
  </section>

  <section id="experience" className="experienceBand">
    <p className="sectionKicker">EXPERIENCE THE DIFFERENCE</p>
    <div className="amenityRow">{amenities.map(a=><article key={a[1]}><span className="amenityIcon">{a[0]}</span><h3>{a[1]}</h3><p>{a[2]}</p></article>)}</div>
  </section>

  <section className="imageStory">
    <article className="storyCard"><img src="https://signaturechauffeurs.com.au/images/2022/09/29/van1.jpg" alt="Mercedes luxury chauffeur vehicle"/><div><p className="goldKicker">TRAVEL IN STYLE</p><h2>Luxury that begins before you arrive.</h2><p>Beautifully presented vehicles, spacious cabins and a calm environment prepared for every passenger.</p></div></article>
    <article className="storyCard"><img src="https://m.somewheregood.com/media/brisbanes-ultimate-chauffeur-airport-arrival-experience-d363-119938P5-2.jpg" alt="Professional chauffeur"/><div><p className="goldKicker">PROFESSIONAL & RELIABLE</p><h2>A chauffeur you can depend on.</h2><p>Punctual, discreet and professionally presented, with every journey planned around your time.</p></div></article>
    <article className="storyCard"><img src="https://res.cloudinary.com/db54ocawg/image/upload/v1721722046/photos/aaddsneofgjyntfljd1o.jpg" alt="Luxury vehicle interior"/><div><p className="goldKicker">FIRST-CLASS EXPERIENCE</p><h2>Every detail considered.</h2><p>Cold water, mints, Wi-Fi, charging, phone holders and premium sound create a cabin designed around you.</p></div></article>
  </section>

  <section className="commitment">
    <p className="sectionKicker">YOUR JOURNEY. OUR COMMITMENT.</p>
    <h2>Private transport with the standard of a luxury hotel.</h2>
    <div className="serviceRow sixServices">{services.map(s=><article key={s[0]}><h3>{s[0]}</h3><p>{s[1]}</p></article>)}</div>
    <div className="quoteStrip"><div><span>READY WHEN YOU ARE</span><small>Plan your route, calculate an indicative fare and request your booking.</small></div><a className="goldButton" href="/quote">GET QUOTE & VIEW MAP →</a></div>
  </section>

  <style jsx global>{`
    .approvedHero{position:relative;width:100%;background-color:#080808;background-repeat:no-repeat;background-position:center top;background-size:cover;aspect-ratio:1110/435;min-height:500px;border-bottom:1px solid #9a742f;overflow:hidden}
    .approvedHeroBookingHotspot{position:absolute;left:60%;top:47%;width:17%;height:15%;z-index:4;border-radius:4px}
    .approvedHeroBookingHotspot:focus{outline:2px solid #e0b65c;outline-offset:3px}
    .mobileApprovedHero{display:none;background:#080808;border-bottom:1px solid #9a742f}
    .mobileApprovedHero img{display:block;width:100%;height:auto}
    .mobileApprovedCopy{padding:26px 22px 34px;text-align:center}
    .mobileApprovedCopy h1{font:400 clamp(34px,10vw,50px)/1 Georgia,serif;margin:10px 0 14px}
    .mobileApprovedCopy>p:not(.goldKicker){color:#ddd;font-family:Georgia,serif;font-size:18px;margin-bottom:24px}
    @media(max-width:900px){
      .approvedHero{min-height:420px;background-size:cover;background-position:center top}
      .approvedHeroBookingHotspot{left:59%;top:45%;width:20%;height:18%}
    }
    @media(max-width:700px){
      .desktopApprovedHero{display:none}
      .mobileApprovedHero{display:block}
      .amenityRow{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .amenityRow article{min-height:145px;border-bottom:1px solid #49391f}
      .amenityRow article:nth-child(even){border-right:0!important}
      .imageStory{grid-template-columns:1fr!important;padding:8px!important}
      .storyCard{min-height:390px!important}
      .serviceRow.sixServices{grid-template-columns:1fr!important}
      .serviceRow.sixServices article{border-right:0!important;border-bottom:1px solid #56482d}
      .quoteStrip{display:block!important;text-align:center!important}
      .quoteStrip .goldButton{margin-top:18px;width:100%;text-align:center}
    }
  `}</style>
 </main>
}

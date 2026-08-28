import amenitiesPremium from '../../mbls-amenities-premium.png';

const amenities=[
['water','Still & Sparkling Water','Complimentary premium still and sparkling water to keep you refreshed throughout your journey. Our presentation can include recognised premium choices such as Evian and San Pellegrino, subject to vehicle stock.'],
['mints','Fresh Mints','Fresh mints are kept available for a quick refresh after a long flight, before a meeting or on the way to an important occasion.'],
['comfort','Premium Comfort','Spacious, beautifully presented seating and a quiet climate-controlled cabin help make every journey comfortable and relaxing.'],
['charging','Charging Ports','Convenient USB and USB-C charging options help keep your phone and other compatible devices powered while you travel.'],
['wifi','Unlimited Wi-Fi','Stay connected on the move for messages, work, entertainment and travel arrangements with onboard connectivity where available.'],
['holders','Phone Holders','Secure passenger phone holders allow comfortable hands-free viewing, including watching a movie or following your journey from the rear seat.'],
['sound','Premium Surround Sound','A premium cabin audio experience for music, podcasts and entertainment during your journey.'],
['tracking','Live Journey Tracking','Share your live journey with family, colleagues or a nominated contact for convenience and added peace of mind.']
];
export default function Amenities(){return <main className="innerPage"><section className="innerHero"><p className="goldKicker">PREMIUM AMENITIES</p><h1>Small details.<br/>A better journey.</h1><p>Select any amenity from the homepage to come directly to its full-size visual and short explanation.</p></section><section className="amenityDetailGrid">{amenities.map(([id,title,text],i)=><article id={id} key={id} className="amenityDetailCard"><div className="amenityCrop" style={{backgroundImage:`url(${amenitiesPremium.src})`,backgroundSize:'800% 100%',backgroundPosition:`${(i*100)/7}% center`}}/><div className="detailCopy"><h2>{title}</h2><p>{text}</p><a className="outlineButton" href="/quote" target="_blank" rel="noopener noreferrer">BOOK YOUR RIDE</a></div></article>)}</section></main>}
import amenitiesStrip from '../mbls-amenities-strip.png';
import { HERO_IMAGE } from './heroData';
import AddressAutocomplete from './components/AddressAutocomplete';
import PickerInput from './components/PickerInput';
const amenityHotspots=[
  ['water','/amenities#water','0%','16.86%',false],
  ['mints','/amenities#mints','16.86%','10.48%',false],
  ['comfort','/amenities#comfort','27.34%','12.5%',false],
  ['charging','/amenities#charging','39.84%','11.01%',false],
  ['wifi','/amenities#wifi','50.85%','11.26%',false],
  ['holders','/amenities#holders','62.11%','11.65%',false],
  ['sound','/amenities#sound','73.76%','12.37%',false],
  ['tracking','/amenities#tracking','86.13%','13.87%',false]
];
const services=[ ['Airport Transfers','/services#airport-transfers'],['VIP Transfers','/services#vip-transfers'],['Weddings','/services#weddings'],['Private Charter','/services#private-charter'],['Corporate Travel','/services#corporate-travel'],['Events & Occasions','/services#events'],['School Formals','/services#formal'],['As Directed','/services#as-directed'],['Women for Women','/services#women-for-women'] ];
export default function Home(){return <main className="home masterHomepage">
  <div className="masterTop">
    <img className="masterImage" src={HERO_IMAGE} alt="My Black Limo Service fleet — Mercedes-Benz and Audi vehicles on Sydney Harbour" width={1536} height={512} loading="eager" />
    <div className="heroFleetText">
      <p className="goldKicker">SYDNEY'S MOST TRUSTED</p>
      <h1>MY BLACK LIMO SERVICE</h1>
      <p className="heroFleetSub">Sophistication. Discretion. Excellence.</p>
      <p className="heroFleetCopy">Premium chauffeur travel with meticulous presentation, exceptional comfort and reliability you can depend on.</p>
      <a className="goldButton" href="/quote">BOOK YOUR RIDE →</a>
      <div className="heroFleetChecks"><span>✓ Professional Drivers</span><span>✓ Punctual</span><span>✓ Discreet</span></div>
    </div>
  </div>
  <section className="instantQuoteSection" aria-label="Get an instant quote">
    <form className="quotePanel quoteTeaserPanel" action="/quote">
      <h2>GET AN INSTANT QUOTE</h2>
      <div className="quoteTeaserLocations">
        <label>PICKUP LOCATION<AddressAutocomplete name="pickup" placeholder="Enter pickup location" /></label>
        <label>DROP-OFF LOCATION<AddressAutocomplete name="dropoff" placeholder="Enter drop-off location" /></label>
      </div>
      <div className="quoteTeaserDetails">
        <label>DATE<PickerInput type="date" name="date" /></label>
        <label>TIME<PickerInput type="time" name="time" /></label>
        <label>PASSENGERS<select name="passengers" defaultValue="1"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></label>
        <label>VEHICLE TYPE<select name="vehicle" defaultValue=""><option value="" disabled>Select Vehicle</option><option>V-Class</option><option>S-Class</option><option>Audi Q7</option><option>Sprinter</option></select></label>
      </div>
      <div className="quoteTeaserExtras">
        <p className="quoteTeaserExtrasLabel">EXTRA OPTIONS</p>
        <div className="quoteTeaserChecks">
          <label><input type="checkbox" name="babySeat" /> Baby Seat <span>$15</span></label>
          <label><input type="checkbox" name="boosterSeat" /> Booster Seat <span>$15</span></label>
        </div>
      </div>
      <button className="goldButton quoteTeaserButton" type="submit">CALCULATE FARE</button>
    </form>
    <div className="refreshmentsPanel">
      <img src="/mbls-refreshments.jpg" alt="Complimentary refreshments in every My Black Limo Service ride" className="refreshmentsImage" width={900} height={277} loading="lazy" />
      <div className="refreshmentsContent">
        <p>COMPLIMENTARY</p>
        <h2>REFRESHMENTS</h2>
        <p>IN EVERY RIDE</p>
      </div>
      <div className="refreshmentsCaption"><span>Luxury Experience</span><small>by My Black Limo Service</small></div>
    </div>
  </section>
  <section className="premiumServicesSection" aria-label="Our premium services">
    <h2>OUR PREMIUM SERVICES</h2>
    <div className="premiumServicesGrid">
      <a className="premiumServiceTile" href="/services#airport-transfers"><img src="/mbls-service-airport-transfers.jpg" alt="Airport transfers" width={360} height={308} loading="lazy"/><span>AIRPORT TRANSFERS</span></a>
      <a className="premiumServiceTile" href="/services#weddings"><img src="/mbls-service-weddings.jpg" alt="Weddings" width={360} height={308} loading="lazy"/><span>WEDDINGS</span></a>
      <a className="premiumServiceTile" href="/services#vip-transfers"><img src="/mbls-service-vip-services.jpg" alt="VIP services" width={360} height={308} loading="lazy"/><span>VIP SERVICES</span></a>
      <a className="premiumServiceTile" href="/services#corporate-travel"><img src="/mbls-service-corporate-travel.jpg" alt="Corporate travel" width={360} height={308} loading="lazy"/><span>CORPORATE TRAVEL</span></a>
      <a className="premiumServiceTile" href="/services#as-directed"><img src="/mbls-service-hourly-chauffeur.jpg" alt="Hourly chauffeur" width={360} height={308} loading="lazy"/><span>HOURLY CHAUFFEUR</span></a>
      <a className="premiumServiceTile" href="/services#events"><img src="/mbls-service-special-events.jpg" alt="Special events" width={360} height={308} loading="lazy"/><span>SPECIAL EVENTS</span></a>
    </div>
  </section>
  <section className="amenitiesStrip" aria-label="Complimentary amenities">
    <img src={amenitiesStrip.src} width={amenitiesStrip.width} height={amenitiesStrip.height} alt="Complimentary amenities — water, mints, comfort, charging, wifi, phone holders, sound, live tracking" className="amenitiesStripImage"/>
    {amenityHotspots.map(([name,href,left,width])=><a key={name} href={href} title={name.replaceAll('-',' ')} aria-label={name.replaceAll('-',' ')} className="hotspot" style={{left,top:'0%',width,height:'100%'}} />)}
  </section>
  <section className="homeLower">
    <div className="lowerServices">
      <h2>OUR SERVICES</h2>
      <p className="lowerServicesSub">Every journey, tailored to you.</p>
      <div className="serviceLinks">{services.map(([label,href])=><a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}</div>
      <a className="homeOutline" href="/services" target="_blank" rel="noopener noreferrer">VIEW ALL SERVICES</a>
    </div>
    <div className="lowerAbout">
      <h2>ABOUT US</h2>
      <p>My Black Limo Service is Sydney's premium chauffeur service, offering luxury vehicles and professional chauffeurs dedicated to a polished, discreet and dependable travel experience.</p>
      <ul><li>On time, every time</li><li>Immaculate presentation</li><li>Absolute discretion guaranteed</li></ul>
      <a className="homeOutline" href="/about">LEARN MORE</a>
    </div>
    <div className="lowerMap">
      <h2>LIVE MAP TRACKING</h2>
      <div className="mapFrame"><iframe src="https://www.google.com/maps?output=embed&saddr=SYD%20Terminal%201&daddr=Sydney%20NSW" title="Sydney Airport to Sydney route map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div>
      <a className="homeOutline mapQuote" href="/quote" target="_blank" rel="noopener noreferrer">GET AN INSTANT QUOTE</a>
    </div>
  </section>
</main>}

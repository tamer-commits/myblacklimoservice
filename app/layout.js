import './globals.css';
import Script from 'next/script';

export const metadata = {
  metadataBase: new URL('https://myblacklimoservice.com'),
  title: { default:'My Black Limo Service | Sydney Luxury Chauffeur', template:'%s | My Black Limo Service' },
  description:'Premium private chauffeur, airport, corporate, VIP, wedding and event transfers across Sydney and NSW.',
  keywords:['Sydney chauffeur','Sydney airport transfer','luxury chauffeur Sydney','private driver Sydney','Mercedes V-Class Sydney','corporate chauffeur Sydney'],
  alternates:{canonical:'/'},
  openGraph:{
    title:'My Black Limo Service | Sydney Luxury Chauffeur',
    description:'Private luxury chauffeur service across Sydney and NSW.',
    url:'https://myblacklimoservice.com',siteName:'My Black Limo Service',locale:'en_AU',type:'website'
  },
  twitter:{card:'summary_large_image',title:'My Black Limo Service',description:'Premium private chauffeur service across Sydney and NSW.'},
  robots:{index:true,follow:true},
};

export default function RootLayout({ children }) {
  const schema={
    '@context':'https://schema.org','@type':['LocalBusiness','TaxiService'],name:'My Black Limo Service',
    url:'https://myblacklimoservice.com',telephone:'+61420770707',email:'info@myblacklimoservice.com',
    description:'Premium private chauffeur, airport, corporate, VIP, wedding and event transfers across Sydney and NSW.',
    areaServed:[{'@type':'City','name':'Sydney'},{'@type':'AdministrativeArea','name':'New South Wales'}],
    priceRange:'$$$',currenciesAccepted:'AUD',paymentAccepted:'Credit Card, Electronic Transfer',
    openingHours:'Mo-Su 00:00-23:59'
  };
  const ga=process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return <html lang="en-AU"><body>
    {children}
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}} />
    {ga && <><Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive"/><Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});`}</Script></>}
  </body></html>;
}

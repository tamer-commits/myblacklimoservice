import './globals.css';
import SiteNav from './siteNav';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import { Analytics } from '@vercel/analytics/next';

const SITE_URL = 'https://www.myblacklimoservice.com';
const SITE_NAME = 'My Black Limo Service';
const SITE_TITLE = 'My Black Limo Service | Sydney Luxury Chauffeur';
const SITE_DESCRIPTION = 'Luxury chauffeur and private transfer service in Sydney. Airport transfers, corporate travel, events, weddings and private hire.';
const OG_IMAGE = '/mbls-homepage-master.webp';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s | My Black Limo Service' },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [OG_IMAGE],
    locale: 'en_AU',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE]
  }
};

const LOCAL_BUSINESS_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'TaxiService'],
  name: SITE_NAME,
  url: SITE_URL,
  image: `${SITE_URL}${OG_IMAGE}`,
  telephone: '+61420770707',
  email: 'info@myblacklimoservice.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Sydney',
    addressRegion: 'NSW',
    addressCountry: 'AU'
  },
  areaServed: 'Sydney, NSW',
  priceRange: '$115-$265',
  taxID: '14 106 640 832'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSON_LD) }}
        />
        <SiteNav />
        {children}
        <Footer />
        <WhatsAppButton />
        <Analytics />
      </body>
    </html>
  );
}

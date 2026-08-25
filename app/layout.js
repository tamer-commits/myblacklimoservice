import './globals.css';

export const metadata = {
  title: 'My Black Limo Service | Sydney Luxury Chauffeur',
  description: 'Premium private chauffeur, airport, corporate, VIP and event transfers across Sydney and NSW.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
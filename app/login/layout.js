// Defense-in-depth: keeps /login out of search results even if
// robots.txt is ever bypassed or ignored.
export const metadata = { robots: { index: false, follow: false } };

export default function LoginLayout({ children }) {
  return children;
}

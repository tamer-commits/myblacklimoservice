// Defense-in-depth: keeps /account out of search results even if
// robots.txt is ever bypassed or ignored. This is an auth-walled
// customer utility page, not public content.
export const metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }) {
  return children;
}

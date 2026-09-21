// Defense-in-depth: keeps the entire /admin section (and its sub-routes)
// out of search results even if robots.txt is ever bypassed or ignored.
export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return children;
}

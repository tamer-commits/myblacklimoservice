// Defense-in-depth: keeps /signup out of search results even if
// robots.txt is ever bypassed or ignored.
export const metadata = { robots: { index: false, follow: false } };

export default function SignupLayout({ children }) {
  return children;
}

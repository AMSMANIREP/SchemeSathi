'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from './providers';

/**
 * Routes a visitor to the right place before the app itself:
 *
 *   signed out            -> /welcome
 *   signed in, no profile -> /profile, the first thing after signing in
 *   otherwise             -> through
 *
 * Both redirects run in effects against real routes. The sign-in state lives
 * in localStorage, which the server cannot see, so deciding the *page
 * structure* from it would guarantee a hydration mismatch; deciding a
 * *navigation* from it after mount does not.
 *
 * The sign-in is simulated for the demo — a display name in this browser, no
 * credential. A hashed display-name key stores voice preferences within the browser session. It gates presentation only; every API
 * route still runs on the anonymous session cookie exactly as before.
 */
export function Gate({ children }: { children: React.ReactNode }) {
  const { t, loading, signedIn, onboarded } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const onWelcome = pathname === '/welcome';
  const needsWelcome = !loading && !signedIn && !onWelcome;
  const needsOnboarding =
    !loading && signedIn && !onboarded && pathname !== '/profile';

  useEffect(() => {
    if (needsWelcome) router.replace('/welcome');
    else if (needsOnboarding) router.replace('/profile');
    else if (signedIn && onWelcome) router.replace('/');
  }, [needsWelcome, needsOnboarding, signedIn, onWelcome, router]);

  if (loading || needsWelcome || needsOnboarding)
    return (
      <div className="loading">
        <Loader2 className="spin" size={17} />
        {t.loading}
      </div>
    );

  return <>{children}</>;
}

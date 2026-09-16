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
 * Demo sign-in selects an isolated session for a full email within this
 * browser. It is not password authentication; API ownership is enforced by
 * the HttpOnly session cookie, not this presentation gate.
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
    // End the old client workspace at logout as well as the server session.
    // A document navigation also clears pending route/component caches.
    if (needsWelcome) window.location.replace('/welcome');
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

'use client';
import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useApp } from './providers';

/**
 * Simulated sign-in for the demonstration build.
 *
 * Nothing here authenticates: no credential is stored,
 * and the password is never read out of the field or kept in state. Only a
 * display name and a hash of the full email select an isolated demo profile
 * in this browser. The dialog says so plainly, because a login
 * form that looks real and checks nothing should admit which one it is.
 */
export function LoginDialog({
  open,
  onOpenChange,
  onSignIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSignIn: (email: string) => void;
}) {
  const { t, busy, loading, error } = useApp();
  const [identifier, setIdentifier] = useState('');

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    onSignIn(identifier);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dlg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.loginTitle}</DialogTitle>
          <DialogDescription>{t.loginNote}</DialogDescription>
        </DialogHeader>

        <form className="loginform" onSubmit={submit}>
          <label className="field">
            <span>{t.email}</span>
            <input
              type="email"
              required
              maxLength={254}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span>{t.password}</span>
            {/* Uncontrolled on purpose: the value is never read or stored. */}
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          {error && <p role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={busy || loading}>
            {t.signIn}
            <ArrowRight size={15} />
          </button>

          <p className="landing-note">
            <ShieldCheck size={13} />
            {t.signInNote}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

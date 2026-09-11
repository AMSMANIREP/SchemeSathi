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
 * display name — derived from whatever is typed in the first field — is
 * remembered, in this browser. The dialog says so plainly, because a login
 * form that looks real and checks nothing should admit which one it is.
 */
export function LoginDialog({
  open,
  onOpenChange,
  onSignIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSignIn: (displayName: string) => void;
}) {
  const { t, busy, loading, error } = useApp();
  const [identifier, setIdentifier] = useState('');

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    // Use the part before "@" as something to greet them with, nothing more.
    const name = identifier.trim().split('@')[0].slice(0, 40);
    onSignIn(name);
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

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  MessageSquare,
  ClipboardList,
  SlidersHorizontal,
  ShieldCheck,
  Globe,
  Info,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from './providers';
import { SchemeDialog, ProfileDialog, Pick } from './dialogs';
import type { Language } from '@/lib/types';

const routes = [
  { href: '/', icon: MessageSquare, key: 'navChat' as const },
  { href: '/explore', icon: Compass, key: 'explore' as const },
  { href: '/applications', icon: ClipboardList, key: 'tracker' as const },
  { href: '/settings', icon: SlidersHorizontal, key: 'privacy' as const },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const {
    t,
    language,
    selectLanguage,
    applications,
    notice,
    setNotice,
    error,
    setError,
    load,
  } = useApp();
  const pathname = usePathname();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Compass />
          </span>
          <span>
            <b>Scheme Sathi</b>
            <small>{t.companion}</small>
          </span>
        </Link>
        <div className="topbar-right">
          <span className="privacy-pill">
            <ShieldCheck size={13} />
            {t.private}
          </span>
          <Pick
            value={language}
            label="Language / भाषा / ಭಾಷೆ"
            onChange={(v) => void selectLanguage(v as Language)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिन्दी' },
              { value: 'kn', label: 'ಕನ್ನಡ' },
            ]}
          />
        </div>
      </header>

      <nav className="mainnav" aria-label="Sections">
        {routes.map((r) => {
          const Icon = r.icon;
          const active = pathname === r.href;
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={active ? 'page' : undefined}
            >
              <Icon />
              {t[r.key]}
              {r.href === '/applications' && applications.length > 0 && (
                <span className="navcount data">{applications.length}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <main className="workspace" id="main">
        {notice && (
          <output className="notice">
            <CheckCircle2 size={16} />
            {notice}
            <button onClick={() => setNotice('')} aria-label={t.close}>
              <X size={15} />
            </button>
          </output>
        )}
        {error && (
          <div className="notice err" role="alert">
            <Info size={16} />
            <span>{error}</span>
            <button
              onClick={() => {
                setError('');
                void load();
              }}
            >
              <RefreshCw size={14} /> {t.retry}
            </button>
          </div>
        )}
        {language !== 'en' && (
          <div className="notice">
            <Globe size={16} />
            {t.sourceEnglish}
          </div>
        )}
        {children}
      </main>

      <footer className="site-footer">
        <ShieldCheck size={15} />
        <span className="measure">{t.disclaimer}</span>
        <span className="data">Scheme Sathi · 2026</span>
      </footer>

      <SchemeDialog />
      <ProfileDialog />
    </>
  );
}

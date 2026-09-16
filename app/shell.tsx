"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  MessageSquare,
  ClipboardList,
  UserRound,
  SlidersHorizontal,
  ShieldCheck,
  UserCircle2,
  LogOut,
  Globe,
  Info,
  RefreshCw,
  CheckCircle2,
  X,
} from "lucide-react";
import { useApp } from "./providers";
import { SchemeDialog, Pick } from "./dialogs";
import { Gate } from "./gate";
import type { Language } from "@/lib/types";
import { languageOptions } from "@/lib/languages";

const routes = [
  { href: "/", icon: MessageSquare, key: "navChat" as const },
  { href: "/profile", icon: UserRound, key: "profile" as const },
  { href: "/explore", icon: Compass, key: "explore" as const },
  { href: "/applications", icon: ClipboardList, key: "tracker" as const },
  { href: "/settings", icon: SlidersHorizontal, key: "privacy" as const },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const {
    t,
    language,
    selectLanguage,
    busy,
    visitor,
    onboarded,
    signOut,
    applications,
    notice,
    setNotice,
    error,
    setError,
    load,
  } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  // The landing surface is the whole page: no nav, no chrome, nothing to
  // navigate before there is anything to navigate to. Keyed off the pathname
  // rather than sign-in state, so the server and the client agree.
  if (pathname === "/welcome")
    return (
      <main className="workspace landing-workspace" id="main">
        {children}
      </main>
    );

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
          <Link className="accountbtn" href="/profile">
            <UserCircle2 size={15} />
            <span className="label">{visitor || t.profile}</span>
          </Link>
          <button
            className="accountbtn"
            onClick={() => {
              signOut();
              router.push("/welcome");
            }}
          >
            <LogOut size={14} />
            <span className="label">{t.signOut}</span>
          </button>
          <Pick
            value={language}
            label="Language / भाषा / ಭಾಷೆ / தமிழ் / മലയാളം"
            disabled={busy}
            onChange={(v) => void selectLanguage(v as Language)}
            options={languageOptions}
          />
        </div>
      </header>

      <nav className="mainnav" aria-label="Sections">
        {(onboarded ? routes : routes.filter((r) => r.href === "/profile")).map(
          (r) => {
            const Icon = r.icon;
            const active = pathname === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                {t[r.key]}
                {r.href === "/applications" && applications.length > 0 && (
                  <span className="navcount data">{applications.length}</span>
                )}
              </Link>
            );
          },
        )}
      </nav>

      <main className="workspace" id="main">
        {notice && (
          <output className="notice">
            <CheckCircle2 size={16} />
            {notice}
            <button onClick={() => setNotice("")} aria-label={t.close}>
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
                setError("");
                void load();
              }}
            >
              <RefreshCw size={14} /> {t.retry}
            </button>
          </div>
        )}
        {language !== "en" && (
          <div className="notice">
            <Globe size={16} />
            {t.sourceEnglish}
          </div>
        )}
        <Gate>{children}</Gate>
      </main>

      <footer className="site-footer">
        <ShieldCheck size={15} />
        <span className="measure">{t.disclaimer}</span>
        <span className="data">Scheme Sathi · 2026</span>
      </footer>

      <SchemeDialog />
    </>
  );
}

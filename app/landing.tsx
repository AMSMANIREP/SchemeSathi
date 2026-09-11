'use client';
import { useState } from 'react';
import { ArrowRight, Compass, LogIn, ShieldCheck } from 'lucide-react';
import { useApp } from './providers';
import { LoginDialog } from './login';

/**
 * The landing surface. Persuade mode, inside the established world: ink on
 * paper, hairlines, mono labels. The warmth is in scale, air and voice — not
 * in new colour or illustration, so the page the citizen signs into looks
 * like the page they signed in from.
 *
 * Lead claim: we will not waste your trip. That is the mechanism a
 * neighbouring product could not truthfully copy, and PRODUCT.md forbids the
 * alternatives — no testimonials, no counts, no accuracy statistics.
 */
export function Landing({ onEnter }: { onEnter: (name: string) => void }) {
  const { t, schemes } = useApp();
  const [loginOpen, setLoginOpen] = useState(false);

  const verdicts = [
    { cls: 'status-LIKELY_ELIGIBLE', label: t.statusGo },
    { cls: 'status-POSSIBLY_ELIGIBLE', label: t.statusHold },
    { cls: 'status-LIKELY_NOT_ELIGIBLE', label: t.statusStop },
    { cls: 'status-UNABLE_TO_DETERMINE', label: t.statusUnknown },
  ];

  return (
    <div className="landing">
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSignIn={onEnter}
      />
      <section className="landing-hero">
        <div className="landing-copy">
          <h1>{t.landingTitle}</h1>
          <p className="landing-lede">{t.landingLede}</p>

          <div className="landing-enter">
            <button className="btn btn-lg" onClick={() => setLoginOpen(true)}>
              <LogIn size={16} />
              {t.login}
              <ArrowRight size={15} />
            </button>
          </div>
          <p className="landing-note">
            <ShieldCheck size={13} />
            {t.signInNote}
          </p>
        </div>

        {/* The pass, oversized. The artifact the citizen leaves with, shown
            as the hero rather than described. */}
        <aside className="landing-pass" aria-hidden="true">
          <div className="pass">
            <div className="pass-head">
              <span className="label">{t.nextSteps}</span>
              <span className="status status-LIKELY_ELIGIBLE">{t.statusGo}</span>
            </div>
            <div className="pass-body">
              <h2>PM-KISAN</h2>
              <p className="muted">{t.landingPassLine}</p>
            </div>
            <div className="pass-seg">
              <div>
                <span className="label">{t.segDocs}</span>
                <b>3</b>
              </div>
              <div>
                <span className="label">{t.segSteps}</span>
                <b>6</b>
              </div>
              <div>
                <span className="label">{t.where}</span>
                <b>CSC</b>
              </div>
            </div>
            <div className="perforate" />
            <div className="pass-stub">
              <span className="label">{t.landingPassStub}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="landing-verdicts">
        <p className="landing-claim">{t.landingClaim}</p>
        <div className="landing-pills">
          {verdicts.map((v) => (
            <span className={'status ' + v.cls} key={v.cls}>
              {v.label}
            </span>
          ))}
        </div>
        <p className="landing-claim-sub measure">{t.landingClaimSub}</p>
      </section>

      <section className="landing-how">
        {[
          { t: t.introS1t, b: t.introS1b },
          { t: t.introS2t, b: t.introS2b },
          { t: t.introS3t, b: t.introS3b },
          { t: t.introS4t, b: t.introS4b },
        ].map((s) => (
          <div key={s.t}>
            <h3>{s.t}</h3>
            <p>{s.b}</p>
          </div>
        ))}
      </section>

      <footer className="landing-foot">
        <Compass size={15} />
        <span className="measure">{t.landingFoot}</span>
        <span className="label data">
          {schemes.length || 50} {t.references}
        </span>
      </footer>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, MessageSquare, PenLine, ArrowRight } from 'lucide-react';
import { useApp } from '../providers';
import { Pick } from '../dialogs';
import { fields } from '@/lib/rules';
import type { Profile as ProfileShape } from '@/lib/types';

/**
 * The profile is its own surface, not a step in the chat. The agent reads
 * from here and writes back; the citizen can correct anything at any moment.
 */
export default function Profile() {
  const {
    t,
    session,
    provenance,
    loading,
    busy,
    saveProfile,
    onboarded,
    completeOnboarding,
    visitor,
  } = useApp();
  // Derived, not synced: the saved profile is the source of truth until the
  // citizen edits, and clearing the edit re-derives from the fresh session.
  const [edited, setEdited] = useState<ProfileShape | null>(null);
  const draft = edited ?? session?.profile ?? {};
  const setDraft = (p: ProfileShape) => setEdited(p);
  const router = useRouter();

  if (loading)
    return (
      <div className="loading">
        <Loader2 className="spin" size={17} />
        {t.loading}
      </div>
    );

  const known = fields.filter((f) => draft[f.key] != null);
  const inferred = known.filter((f) => provenance[f.key] === 'inferred');

  const mark = (key: string) => {
    const p = provenance[key];
    if (!p || draft[key] == null) return null;
    if (p === 'inferred')
      return <span className="prov prov-inferred">{t.notConfirmed}</span>;
    return (
      <span className="prov">
        {p === 'answered' ? t.provAnswered : t.provEntered}
      </span>
    );
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>
            {onboarded
              ? t.profile
              : visitor
                ? `${t.greeting}, ${visitor}`
                : t.profileFirst}
          </h1>
          <p className="measure">
            {onboarded ? t.profileLede : t.profileFirstNote}
          </p>
        </div>
        {known.length > 0 && (
          <span className="count">
            <b>{known.length}</b>
            <span className="label">{t.complete}</span>
          </span>
        )}
      </div>

      {inferred.length > 0 && (
        <div className="notice">
          <PenLine size={16} />
          <span className="measure">{t.provInferred}</span>
        </div>
      )}

      {!known.length && onboarded && (
        <section className="pass pass-blank" style={{ marginBottom: 22 }}>
          <div className="pass-head">
            <span className="label">{t.profile}</span>
            <span className="label" style={{ marginLeft: 'auto' }}>
              — — — —
            </span>
          </div>
          <div className="pass-body">
            <h2>{t.profileEmpty}</h2>
            <p className="muted measure" style={{ marginTop: 6 }}>
              {t.profileNothing}
            </p>
          </div>
          <div className="perforate" />
          <div className="pass-stub">
            <button className="btn" onClick={() => router.push('/')}>
              <MessageSquare size={15} />
              {t.navChat}
            </button>
          </div>
        </section>
      )}

      <div className="formgrid profileform">
        {fields.map((f) => (
          <label
            className={
              'field profilefield' +
              (provenance[f.key] === 'inferred' && draft[f.key] != null
                ? ' unconfirmed'
                : '')
            }
            key={f.key}
          >
            <span>
              {t[f.key as keyof typeof t] || f.key}
              {mark(f.key)}
            </span>
            {f.type === 'number' ? (
              <input
                type="number"
                min="0"
                max={f.max}
                step={f.key === 'age' ? '1' : 'any'}
                value={String(draft[f.key] ?? '')}
                placeholder={t.unknown}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    [f.key]: e.target.value === '' ? null : +e.target.value,
                  });
                }}
              />
            ) : (
              <Pick
                value={String(draft[f.key] ?? '')}
                label={String(t[f.key as keyof typeof t] || f.key)}
                onChange={(v) => setDraft({ ...draft, [f.key]: v || null })}
                options={[
                  { value: '__unknown', label: t.unknown },
                  ...(f.values || []).map((v) => ({
                    value: v,
                    label:
                      v === 'yes' ? t.yes : v === 'no' ? t.no : v.replaceAll('_', ' '),
                  })),
                ]}
              />
            )}
          </label>
        ))}
      </div>

      <div className="profileactions">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            if (known.length) await saveProfile(draft);
            setEdited(null);
            if (!onboarded) {
              completeOnboarding();
              router.push('/');
            }
          }}
        >
          {busy ? (
            <Loader2 className="spin" size={15} />
          ) : onboarded ? (
            <Check size={15} />
          ) : (
            <ArrowRight size={15} />
          )}
          {onboarded ? t.confirm : t.next}
        </button>
        {!onboarded && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              completeOnboarding();
              router.push('/');
            }}
          >
            {t.skipForNow}
          </button>
        )}
        <span className="label measure">{t.confirmNote}</span>
      </div>

      <p className="retentionline measure">{t.retentionNote}</p>
    </>
  );
}

'use client';
import Link from 'next/link';
import { ArrowUpRight, Bookmark, Check, Info, PenLine } from 'lucide-react';
import { useApp } from './providers';
import { StatusTag } from './dialogs';
import { categoryText, statusNames } from '@/lib/i18n';
import type { Block } from '@/lib/types';

/**
 * One component per block kind. Blocks carry ids and values only — every
 * sentence here is resolved from lib/i18n.ts at render time, so a transcript
 * reads correctly in a language chosen after the turn was generated.
 */
export function Blocks({
  blocks,
  onAnswer,
}: {
  blocks: Block[];
  onAnswer: (text: string) => void;
}) {
  if (!blocks.length) return null;
  return (
    <div className="blocks">
      {blocks.map((b, i) => (
        <One key={i} block={b} onAnswer={onAnswer} />
      ))}
    </div>
  );
}

function One({
  block,
  onAnswer,
}: {
  block: Block;
  onAnswer: (text: string) => void;
}) {
  const { t, li, language, schemes, applications, saveScheme, setDetail, busy } =
    useApp();

  switch (block.kind) {
    case 'profile_updated': {
      const inferred = block.fields.some((f) => f.provenance === 'inferred');
      return (
        <div className="blk-profile">
          <PenLine size={13} />
          <span>
            {t.addedToProfile}:{' '}
            <b>
              {block.fields
                .map((f) => String(t[f.field as keyof typeof t] || f.field))
                .join(', ')}
            </b>
            {inferred && <em> — {t.notConfirmed}</em>}
          </span>
          <Link href="/profile">{t.reviewIt}</Link>
        </div>
      );
    }

    case 'answer_chips':
      return (
        <div className="blk-chips">
          {block.options.map((v) => (
            <button key={v} onClick={() => onAnswer(v)} disabled={busy}>
              {v === 'yes' ? t.yes : v === 'no' ? t.no : v.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      );

    case 'scheme_card': {
      const s = schemes.find((x) => x.id === block.schemeId);
      if (!s) return null;
      const saved =
        block.saved || applications.some((a) => a.schemeId === s.id);
      return (
        <article className="pass blk-card">
          <div className="pass-head">
            <span className="label">{categoryText(s.category, language)}</span>
            <span style={{ marginLeft: 'auto' }}>
              <StatusTag
                status={block.status}
                label={statusNames[block.status][li]}
              />
            </span>
          </div>
          <div className="pass-body">
            <h3>{s.shortName}</h3>
            <p className="muted">{block.whyThis}</p>
            {block.failing.slice(0, 2).map((r) => (
              <div className="rulerow" key={r.id}>
                <i className="rulemark mark-stop" />
                <span>{r.label}</span>
              </div>
            ))}
          </div>
          <div className="pass-seg">
            <div>
              <span className="label">{t.segDocs}</span>
              <b>{s.documents.length}</b>
            </div>
            <div>
              <span className="label">{t.segSteps}</span>
              <b>{s.steps.length}</b>
            </div>
            <div>
              <span className="label">{t.colStatus}</span>
              <b>{block.missing.length ? block.missing.length : '—'}</b>
            </div>
          </div>
          <div className="perforate" />
          <div className="pass-stub blk-stub">
            <button
              className="btn btn-sm"
              disabled={busy || saved}
              onClick={() => void saveScheme(s)}
            >
              {saved ? <Check size={14} /> : <Bookmark size={14} />}
              {saved ? t.saved : t.save}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDetail(s)}>
              <Info size={13} />
              {t.details}
            </button>
          </div>
        </article>
      );
    }

    case 'sources':
      return (
        <div className="blk-sources">
          <span className="label">{t.officialSources}</span>
          {block.items.map((it) => {
            const s = schemes.find((x) => x.id === it.schemeId);
            return (
              <a key={it.schemeId} href={it.url} target="_blank" rel="noreferrer">
                {s?.shortName || it.schemeId}
                <ArrowUpRight size={12} />
              </a>
            );
          })}
        </div>
      );

    case 'notice':
      return (
        <div className={'notice' + (block.tone === 'error' ? ' err' : '')}>
          <Info size={16} />
          <span>{String(t[block.textKey as keyof typeof t] || block.textKey)}</span>
        </div>
      );

    default:
      return null;
  }
}

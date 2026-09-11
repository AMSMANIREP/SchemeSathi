'use client';
import { useState } from 'react';
import { Search, X, Bookmark, Loader2 } from 'lucide-react';
import { useApp } from '../providers';
import { StatusTag } from '../dialogs';
import { categoryText, statusNames } from '@/lib/i18n';

const RANK: Record<string, number> = {
  LIKELY_ELIGIBLE: 0,
  POSSIBLY_ELIGIBLE: 1,
  UNABLE_TO_DETERMINE: 2,
  LIKELY_NOT_ELIGIBLE: 3,
};

export default function Explore() {
  const {
    t,
    li,
    language,
    schemes,
    decisions,
    applications,
    saveScheme,
    setDetail,
    loading,
    busy,
    session,
  } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All schemes');

  const filtered = schemes.filter(
    (s) =>
      (category === 'All schemes' || s.category === category) &&
      (
        s.name +
        ' ' +
        s.shortName +
        ' ' +
        s.summary +
        ' ' +
        s.category +
        ' ' +
        categoryText(s.category, language)
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const decided = !!session?.profileVersion;
  const statusOf = (id: string) =>
    decisions[id]?.status || 'UNABLE_TO_DETERMINE';

  // Ranked once a profile exists; a board's order is its argument.
  const rows = decided
    ? [...filtered].sort(
        (a, b) => RANK[statusOf(a.id)] - RANK[statusOf(b.id)],
      )
    : filtered;

  // When every row carries the same verdict, the board states it once at the
  // head instead of repeating it down fifty rows.
  const present = new Set(rows.map((s) => statusOf(s.id)));
  const uniform = rows.length > 0 && present.size === 1;
  const sharedStatus = uniform ? [...present][0] : null;

  if (loading)
    return (
      <div className="loading">
        <Loader2 className="spin" size={17} />
        {t.loading}
      </div>
    );

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{decided ? t.results : t.explore}</h1>
          <p>{decided ? t.subtitle : t.askIntro}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="searchbox">
          <Search size={16} />
          <input
            aria-label={t.search}
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="searchclear"
              onClick={() => setQuery('')}
              aria-label={t.clear}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        {['All schemes', ...new Set(schemes.map((s) => s.category))].map((c) => (
          <button
            key={c}
            className={category === c ? 'active' : ''}
            onClick={() => setCategory(c)}
          >
            {categoryText(c, language)}
          </button>
        ))}
      </div>

      {rows.length ? (
        <div className="board">
          <div className="board-bar">
            <span className="board-title">{t.boardTitle}</span>
            <span className="board-asof data">
              {rows.length} {t.references}
            </span>
          </div>

          {sharedStatus && (
            <div className="board-condition">
              <StatusTag
                status={sharedStatus}
                label={statusNames[sharedStatus][li]}
              />
              <span>{t.reviewInfo}</span>
            </div>
          )}

          <div className={'board-head' + (uniform ? ' uniform' : '')}>
            <span>{t.colProgramme}</span>
            <span>{t.colCategory}</span>
            <span>{t.colBenefit}</span>
            {!uniform && <span>{t.colStatus}</span>}
            <span>{t.colSave}</span>
          </div>

          {rows.map((s) => {
            const d = decisions[s.id];
            const status = statusOf(s.id);
            const saved = applications.some((a) => a.schemeId === s.id);
            const failed = d?.reasons.find((r) => r.result === 'FAIL');
            return (
              <div
                className={
                  'board-row' +
                  (uniform ? ' uniform' : '') +
                  (saved ? ' changed' : '')
                }
                key={s.id}
              >
                <button className="rowopen" onClick={() => setDetail(s)}>
                  {s.shortName}
                  <small>{s.ministry}</small>
                </button>
                <span className="rowcat">
                  {categoryText(s.category, language)}
                </span>
                <span className="rowbenefit">
                  {failed ? failed.label : s.benefit}
                </span>
                {!uniform && (
                  <span>
                    <StatusTag
                      status={status}
                      label={statusNames[status][li]}
                    />
                  </span>
                )}
                <span>
                  <button
                    className={'iconbtn' + (saved ? ' on' : '')}
                    aria-label={t.save + ' ' + s.name}
                    disabled={busy || saved}
                    onClick={() => void saveScheme(s)}
                  >
                    <Bookmark size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="emptystate">
          <Search size={30} />
          <h2>{t.empty}</h2>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setQuery('');
              setCategory('All schemes');
            }}
          >
            {t.clear}
          </button>
        </div>
      )}
    </>
  );
}

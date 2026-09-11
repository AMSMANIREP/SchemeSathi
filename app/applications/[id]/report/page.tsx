'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Printer,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { api, useApp } from '../../../providers';
import { StatusTag } from '../../../dialogs';
import { statusNames } from '@/lib/i18n';
import type { Report } from '@/lib/report/build';

export default function ReportPage() {
  const { t, li } = useApp();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const r = await api<{ report: Report; stale: boolean }>(
          'applications/' + id + '/report',
        );
        if (!live) return;
        setReport(r.report);
        setStale(r.stale);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  const regenerate = async () => {
    setBusy(true);
    try {
      const r = await api<{ report: Report; stale: boolean }>(
        'applications/' + id + '/report',
        'POST',
      );
      setReport(r.report);
      setStale(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="notice err">{error}</div>;
  if (!report)
    return (
      <div className="loading">
        <Loader2 className="spin" size={17} />
        {t.loading}
      </div>
    );

  const date = new Date(report.generatedAt).toISOString().slice(0, 10);

  return (
    <article className="report">
      <div className="reportbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>
          <ArrowLeft size={14} />
          {t.tracker}
        </button>
        <button className="btn btn-sm" onClick={() => window.print()}>
          <Printer size={14} />
          {t.print}
        </button>
      </div>

      {stale && (
        <div className="notice no-print">
          <RefreshCw size={16} />
          <span className="measure">{t.reportStale}</span>
          <button onClick={() => void regenerate()} disabled={busy}>
            {busy ? <Loader2 className="spin" size={13} /> : <RefreshCw size={13} />}
            {t.regenerate}
          </button>
        </div>
      )}

      {report.scheme.authoredForDemo && (
        <p className="demomark">{t.demoData}</p>
      )}

      <header className="report-masthead">
        <div>
          <span className="label">{t.next}</span>
          <h1>{report.scheme.shortName}</h1>
          <p>{report.scheme.ministry}</p>
        </div>
        <StatusTag
          status={report.status}
          label={statusNames[report.status][li]}
        />
      </header>

      <section className="report-sit">
        <div className="pass-seg">
          {report.yourSituation.confirmed.slice(0, 5).map((c) => (
            <div key={c.field}>
              <span className="label">
                {String(t[c.field as keyof typeof t] || c.field)}
              </span>
              <b>{c.value === 'yes' ? t.yes : c.value === 'no' ? t.no : c.value}</b>
            </div>
          ))}
        </div>
        {report.yourSituation.recap && (
          <blockquote>{report.yourSituation.recap}</blockquote>
        )}
      </section>

      <section className="report-sec">
        <h2>{t.benefit}</h2>
        <p className="measure">{report.whatThisIs}</p>
        {report.fees && (
          <p className="measure reportfees">
            <span className="label">{t.fees}</span>
            {report.fees}
          </p>
        )}
      </section>

      <div className="report-cols">
        <section className="report-sec">
          <h2>{t.whyYou}</h2>
          {report.whyYou.length ? (
            report.whyYou.map((w) => (
              <div className="rulerow" key={w.id}>
                <i className="rulemark mark-go" />
                <span>{w.label}</span>
              </div>
            ))
          ) : (
            <p className="muted">{t.noneYet}</p>
          )}
        </section>

        <section className="report-sec">
          <h2>{t.stillUnknown}</h2>
          {report.stillUnknown.length ? (
            report.stillUnknown.map((u) => (
              <div className="rulerow" key={u.field}>
                <i className="rulemark mark-unknown" />
                <span>
                  {u.ruleLabel}
                  {u.provingDocument && (
                    <small className="docnote">{u.provingDocument}</small>
                  )}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">{t.noneYet}</p>
          )}
        </section>
      </div>

      <section className="report-sec">
        <h2>{t.documents}</h2>
        <ul className="doclist">
          {report.documents.map((d) => (
            <li key={d.item}>
              <span className={'docbox' + (d.held ? ' held' : '')} aria-hidden />
              <span>
                {d.item}
                {d.note && <small className="docnote">{d.note}</small>}
                {d.requiredBecause && (
                  <small className="docnote">→ {d.requiredBecause}</small>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="report-sec">
        <h2>{t.steps}</h2>
        <ol className="reportsteps">
          {report.steps.map((s) => (
            <li
              key={s.n}
              className={s.relevance === 'for_you' ? 'for-you' : undefined}
            >
              <span className="data reportstep-n">{s.n}</span>
              <div>
                <h3>{s.title}</h3>
                {s.becauseYou && (
                  <p className="becauseyou">
                    {t.becauseYou}: {s.becauseYou}
                  </p>
                )}
                {s.detail && <p className="measure">{s.detail}</p>}
                {(s.where || s.who || s.typicalWait) && (
                  <div className="pass-seg">
                    <div>
                      <span className="label">{t.where}</span>
                      <b>{s.where || '—'}</b>
                    </div>
                    <div>
                      <span className="label">{t.who}</span>
                      <b>{s.who || '—'}</b>
                    </div>
                    <div>
                      <span className="label">{t.typicalWait}</span>
                      <b>{s.typicalWait || '—'}</b>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="report-foot">
        <div className="sourcebox">
          <ShieldCheck size={17} />
          <div>
            {report.officialLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                {l.title}
                <ArrowUpRight size={12} />
              </a>
            ))}
            <p className="measure">{t.disclaimer}</p>
          </div>
        </div>
        <p className="label reportmeta">
          {t.sourceDate} {report.scheme.sourceCheckedAt?.slice(0, 10) || '—'} ·{' '}
          {t.segVersion} {report.scheme.version} · {date}
        </p>
      </footer>
    </article>
  );
}

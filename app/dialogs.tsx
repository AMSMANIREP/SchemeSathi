'use client';
import {
  ArrowUpRight,
  Check,
  FileCheck2,
  ShieldCheck,
  Printer,
  Bookmark,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { categoryText, statusNames } from '@/lib/i18n';
import { useApp } from './providers';

export function StatusTag({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return <span className={'status status-' + status}>{label}</span>;
}

/** Select that renders the chosen option's label rather than its raw value. */
export function Pick({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      disabled={disabled}
      value={value || '__unknown'}
      onValueChange={(v) => onChange(v === '__unknown' ? '' : String(v || ''))}
    >
      <SelectTrigger className="pick" aria-label={label}>
        <SelectValue>
          {options.find((x) => x.value === (value || '__unknown'))?.label ||
            value ||
            label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SchemeDialog() {
  const {
    t,
    li,
    language,
    detail,
    setDetail,
    decisions,
    applications,
    saveScheme,
    busy,
  } = useApp();
  const decision = detail ? decisions[detail.id] : null;
  const status = decision?.status || 'UNABLE_TO_DETERMINE';
  const saved = detail
    ? applications.some((a) => a.schemeId === detail.id)
    : false;

  return (
    <Dialog
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) setDetail(null);
      }}
    >
      <DialogContent className="dlg sm:max-w-3xl">
        {detail && (
          <>
            <DialogHeader>
              <DialogTitle>{detail.name}</DialogTitle>
              <DialogDescription>
                {detail.ministry} · {categoryText(detail.category, language)}
              </DialogDescription>
            </DialogHeader>

            <div className="pass">
              <div className="pass-head">
                <span className="label">{t.reason}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <StatusTag status={status} label={statusNames[status][li]} />
                </span>
              </div>
              <div className="pass-seg">
                <div>
                  <span className="label">{t.segDocs}</span>
                  <b>{detail.documents.length}</b>
                </div>
                <div>
                  <span className="label">{t.segSteps}</span>
                  <b>{detail.steps.length}</b>
                </div>
                <div>
                  <span className="label">{t.segVersion}</span>
                  <b>{detail.version}</b>
                </div>
                <div>
                  <span className="label">{t.segReview}</span>
                  <b>{detail.reviewStatus}</b>
                </div>
              </div>
            </div>

            <div className="dialog-scroll">
              <section className="dialog-section">
                <h3>{t.benefit}</h3>
                <p className="measure">{detail.benefit}</p>
              </section>

              <section className="dialog-section">
                <h3>{t.reason}</h3>
                {decision?.reasons.length ? (
                  decision.reasons.map((r) => (
                    <div className="rulerow" key={r.id}>
                      <span className={'rulemark ' + r.result}>
                        {r.result === 'PASS' ? (
                          <Check size={12} />
                        ) : r.result === 'FAIL' ? (
                          '×'
                        ) : (
                          '?'
                        )}
                      </span>
                      <span>{r.label}</span>
                      <a
                        href={r.source}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.source}
                      >
                        <ArrowUpRight size={15} />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="muted">{t.review}</p>
                )}
              </section>

              <section className="dialog-section">
                <h3>{t.documents}</h3>
                <ul className="doclist">
                  {detail.documents.map((d, i) => (
                    <li key={i}>
                      <FileCheck2 size={15} />
                      <span>
                        {d.item}
                        {d.note && <small className="docnote">{d.note}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="dialog-section">
                <h3>{t.steps}</h3>
                <ol className="steplist">
                  {detail.steps.map((step, i) => (
                    <li key={i}>
                      <span className="data">{i + 1}</span>
                      <span>
                        {step.title}
                        {step.detail && <small>{step.detail}</small>}
                        {(step.where || step.who || step.typicalWait) && (
                          <span className="stepfacts">
                            {[step.where, step.who, step.typicalWait]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="sourcebox">
                <ShieldCheck size={17} />
                <div>
                  <a href={detail.source} target="_blank" rel="noreferrer">
                    {detail.sourceTitle || t.source}
                  </a>
                  <p>{t.reviewInfo}</p>
                </div>
              </div>
            </div>

            <div
              className="no-print"
              style={{ display: 'flex', gap: 10, paddingTop: 4 }}
            >
              <button
                className="btn"
                disabled={busy || saved}
                onClick={() => void saveScheme(detail)}
              >
                <Bookmark size={15} />
                {saved ? t.saved : t.save}
              </button>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={15} />
                {t.print}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

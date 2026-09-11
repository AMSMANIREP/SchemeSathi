'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Printer,
  Trash2,
  Info,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useApp } from '../providers';
import { StatusTag, Pick } from '../dialogs';
import { categoryText, statusNames } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { ApplicationRecord } from '@/lib/types';

const steps = [
  'Interested',
  'Preparing documents',
  'Submitted',
  'Under review',
  'Action required',
  'Approved',
  'Closed',
];

export default function Applications() {
  const {
    t,
    li,
    language,
    schemes,
    applications,
    decisions,
    loading,
    busy,
    updateApplication,
    removeApplication,
    setDetail,
  } = useApp();
  const [editing, setEditing] = useState<ApplicationRecord | null>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (loading)
    return (
      <div className="loading">
        <Loader2 className="spin" size={17} />
        {t.loading}
      </div>
    );

  const editingScheme = editing
    ? schemes.find((s) => s.id === editing.schemeId)
    : null;

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t.tracker}</h1>
          <p>{t.manual}</p>
        </div>
        {applications.length > 0 && (
          <span className="count">
            <b>{applications.length}</b>
            <span className="label">{t.tracker}</span>
          </span>
        )}
      </div>

      {!applications.length ? (
        // An unissued pass rather than a centred card: the empty state is the
        // document you have not been given yet.
        <section className="pass pass-blank">
          <div className="pass-head">
            <span className="label">{t.tracker}</span>
            <span className="label" style={{ marginLeft: 'auto' }}>
              — — — —
            </span>
          </div>
          <div className="pass-body">
            <h2>{t.noApps}</h2>
            <p className="muted measure" style={{ marginTop: 6 }}>
              {t.noAppsText}
            </p>
          </div>
          <div className="pass-seg">
            <div>
              <span className="label">{t.segDocs}</span>
              <b>—</b>
            </div>
            <div>
              <span className="label">{t.segSteps}</span>
              <b>—</b>
            </div>
            <div>
              <span className="label">{t.segRef}</span>
              <b>—</b>
            </div>
          </div>
          <div className="perforate" />
          <div className="pass-stub">
            <button className="btn" onClick={() => router.push('/explore')}>
              {t.explore}
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="notice no-print">
            <Printer size={16} />
            <span className="measure">{t.printNotice}</span>
            <button onClick={() => window.print()}>
              <Printer size={14} /> {t.print}
            </button>
          </div>

          <div className="appgrid">
            {applications.map((a) => {
              const s = schemes.find((x) => x.id === a.schemeId);
              if (!s) return null;
              const d = decisions[s.id];
              const status = d?.status || 'UNABLE_TO_DETERMINE';
              const done = a.checklist.length;
              const total = Math.max(1, s.documents.length);
              return (
                <article className="pass" key={a.id}>
                  <div className="pass-head">
                    <span className="label">{a.status}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <StatusTag
                        status={status}
                        label={statusNames[status][li]}
                      />
                    </span>
                  </div>
                  <div className="pass-body">
                    <h2>{s.shortName}</h2>
                    <p className="muted" style={{ fontSize: 13 }}>
                      {categoryText(s.category, language)} · {s.ministry}
                    </p>
                    <div style={{ marginTop: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span className="label">{t.progress}</span>
                        <span className="label data">
                          {done}/{s.documents.length}
                        </span>
                      </div>
                      <div className="progressline">
                        <i style={{ transform: `scaleX(${done / total})` }} />
                      </div>
                    </div>
                  </div>
                  <div className="pass-seg">
                    <div>
                      <span className="label">{t.segDocs}</span>
                      <b>
                        {done}/{s.documents.length}
                      </b>
                    </div>
                    <div>
                      <span className="label">{t.segSteps}</span>
                      <b>{s.steps.length}</b>
                    </div>
                    <div>
                      <span className="label">{t.segRef}</span>
                      <b>{a.reference ? '····' + a.reference : '—'}</b>
                    </div>
                  </div>
                  <div
                    className="no-print"
                    style={{
                      display: 'flex',
                      gap: 8,
                      padding: 14,
                      borderTop: '1px solid var(--rule)',
                    }}
                  >
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setEditing({
                          ...a,
                          reference: a.reference.replace(/^(?:••••|\.{4}) /, ''),
                        })
                      }
                    >
                      {t.update}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => router.push(`/applications/${a.id}/report`)}
                    >
                      <FileText size={13} />
                      {t.openReport}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDetail(s)}
                    >
                      <Info size={13} />
                      {t.details}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="dlg sm:max-w-xl">
          {editing && editingScheme && (
            <>
              <DialogHeader>
                <DialogTitle>{editingScheme.shortName}</DialogTitle>
                <DialogDescription>{t.manual}</DialogDescription>
              </DialogHeader>

              <div className="dialog-scroll">
                <label className="field" style={{ marginBottom: 14 }}>
                  <span>{t.status}</span>
                  <Pick
                    value={editing.status}
                    label={t.update}
                    onChange={(v) => setEditing({ ...editing, status: v })}
                    options={steps.map((s) => ({ value: s, label: s }))}
                  />
                </label>

                <span className="label">{t.segDocs}</span>
                <div style={{ marginTop: 8, marginBottom: 14 }}>
                  {editingScheme.documents.map((doc) => (
                    <label className="checkline" key={doc.item}>
                      <Checkbox
                        checked={editing.checklist.includes(doc.item)}
                        onCheckedChange={(v) =>
                          setEditing({
                            ...editing,
                            checklist: v
                              ? [...editing.checklist, doc.item]
                              : editing.checklist.filter((x) => x !== doc.item),
                          })
                        }
                      />
                      <span>{doc.item}</span>
                      {doc.note && <small className="docnote">{doc.note}</small>}
                    </label>
                  ))}
                </div>

                <label className="field" style={{ marginBottom: 14 }}>
                  <span>{t.reference}</span>
                  <input
                    ref={referenceInput}
                    value={editing.reference}
                    minLength={4}
                    maxLength={4}
                    pattern=".{4}"
                    onInvalid={(e) =>
                      e.currentTarget.setCustomValidity(t.referenceLength)
                    }
                    onChange={(e) => {
                      e.currentTarget.setCustomValidity('');
                      setEditing({ ...editing, reference: e.target.value });
                    }}
                  />
                </label>

                <label className="field">
                  <span>{t.notes}</span>
                  <textarea
                    className="textfield"
                    value={editing.notes}
                    maxLength={600}
                    onChange={(e) =>
                      setEditing({ ...editing, notes: e.target.value })
                    }
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    if (!referenceInput.current?.reportValidity()) return;
                    await updateApplication(editing);
                    setEditing(null);
                  }}
                >
                  {busy ? <Loader2 className="spin" size={15} /> : null}
                  {t.submit}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    await removeApplication(editing.id);
                    setEditing(null);
                  }}
                >
                  <Trash2 size={13} />
                  {t.forget}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

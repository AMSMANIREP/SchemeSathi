'use client';
import { useState } from 'react';
import {
  LockKeyhole,
  ShieldCheck,
  MessageSquare,
  Trash2,
  Loader2,
  Send,
} from 'lucide-react';
import { useApp } from '../providers';
import { Pick } from '../dialogs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

export default function Settings() {
  const { t, session, caps, busy, loading, forget, sendFeedback, setMemoryConsent } =
    useApp();
  const [deleting, setDeleting] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState('5');

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
          <h1>{t.privacy}</h1>
          <p>{t.memoryNote}</p>
          <p className="retentionline">{t.retentionNote}</p>
        </div>
      </div>

      <div className="settingsgrid">
        <section className="panel">
          <div className="panel-head">
            <LockKeyhole size={16} />
            <h3>{t.private}</h3>
          </div>
          <div className="panel-body">
            <div className="checkline" style={{ paddingTop: 0 }}>
              <Checkbox
                id="memory-consent"
                aria-label={t.memory}
                checked={session?.memoryConsent || false}
                onCheckedChange={(v) => void setMemoryConsent(!!v)}
              />
              <label htmlFor="memory-consent">{t.memory}</label>
            </div>
            <p
              className="muted"
              style={{ fontSize: 12.5, margin: '4px 0 14px' }}
            >
              {t.forgetNote}
            </p>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={13} />
              {t.forget}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <ShieldCheck size={16} />
            <h3>{t.connection}</h3>
          </div>
          <div className="panel-body">
            <div className="svcrow">
              <span>{t.ai}</span>
              <span className={'svcstate' + (caps.ai ? ' on' : '')}>
                {caps.ai ? t.on : t.off}
              </span>
            </div>
            <div className="svcrow">
              <span>{t.voice}</span>
              <span className={'svcstate' + (caps.voice ? ' on' : '')}>
                {caps.voice ? t.on : t.off}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              {t.formMode}
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <MessageSquare size={16} />
            <h3>{t.feedback}</h3>
          </div>
          <div className="panel-body">
            <label className="field" style={{ marginBottom: 12 }}>
              <span>{t.rating}</span>
              <Pick
                value={rating}
                label={t.rating}
                onChange={setRating}
                options={['5', '4', '3', '2', '1'].map((v) => ({
                  value: v,
                  label: v + ' / 5',
                }))}
              />
            </label>
            <textarea
              className="textfield"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              maxLength={600}
              aria-label={t.feedback}
              placeholder={t.feedbackNote}
              style={{ minHeight: 96, marginBottom: 12 }}
            />
            <button
              className="btn"
              disabled={busy || !feedbackText.trim()}
              onClick={async () => {
                await sendFeedback(rating, feedbackText);
                setFeedbackText('');
              }}
            >
              <Send size={14} />
              {t.submit}
            </button>
          </div>
        </section>
      </div>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.forget}</AlertDialogTitle>
            <AlertDialogDescription>{t.memoryNote}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.close}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await forget();
                setDeleting(false);
              }}
            >
              {t.forget}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

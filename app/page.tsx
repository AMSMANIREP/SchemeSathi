'use client';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Loader2,
  LockKeyhole,
  PenLine,
  X,
  Mic,
  Square,
  Trash2,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { useApp } from './providers';

const SEEN_KEY = 'schemesathi.introSeen';

// The intro flag lives in localStorage, which does not exist during SSR.
// The server snapshot reports "already seen" so the panel never flashes
// into server markup and then disappears on hydration.
const introStore = {
  subscribe: () => () => {},
  seenOnClient: () => {
    try {
      return localStorage.getItem(SEEN_KEY) !== null;
    } catch {
      return true;
    }
  },
  seenOnServer: () => true,
};

function IntroPanel({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const steps = [
    { title: t.introS1t, body: t.introS1b },
    { title: t.introS2t, body: t.introS2b },
    { title: t.introS3t, body: t.introS3b },
    { title: t.introS4t, body: t.introS4b },
  ];
  return (
    <section className="intro" aria-labelledby="intro-title">
      <div className="intro-head">
        <h2 id="intro-title">{t.introTitle}</h2>
        <button
          className="iconbtn intro-close"
          onClick={onClose}
          aria-label={t.dismiss}
        >
          <X size={15} />
        </button>
      </div>
      <div className="intro-steps">
        {steps.map((s, i) => (
          <div className="intro-step" key={s.title}>
            <span className="intro-n data">{String(i + 1).padStart(2, '0')}</span>
            <b>{s.title}</b>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
      <div className="perforate" />
      <div className="intro-foot">
        <p>{t.introFoot}</p>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          {t.gotIt}
        </button>
      </div>
    </section>
  );
}

function HistoryRail({
  open,
  onToggle,
  onPick,
}: {
  open: boolean;
  onToggle: () => void;
  onPick: (text: string) => void;
}) {
  const { t, history, clearHistory } = useApp();
  return (
    <aside className={'histrail' + (open ? ' open' : '')}>
      <button
        className="histtoggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="history-column"
        title={t.historyTitle}
      >
        {open ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        <span className="histtoggle-text">{t.historyTitle}</span>
        {history.length > 0 && (
          <span className="histcount data">{history.length}</span>
        )}
      </button>

      <div className="histcol" id="history-column" hidden={!open}>
        {history.length ? (
          <>
            <ul className="histlist">
              {history.map((h) => (
                <li key={h.at}>
                  <button onClick={() => onPick(h.text)}>{h.text}</button>
                </li>
              ))}
            </ul>
            <div className="histcol-foot">
              <span className="label">{t.historyScope}</span>
              <button onClick={clearHistory}>
                <Trash2 size={12} />
                {t.historyClear}
              </button>
            </div>
          </>
        ) : (
          <p className="histempty">{t.historyEmpty}</p>
        )}
      </div>
    </aside>
  );
}

export default function ChatLanding() {
  const { t, ask, busy, loading, openProfile, record, recording } = useApp();
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const router = useRouter();

  const introSeen = useSyncExternalStore(
    introStore.subscribe,
    introStore.seenOnClient,
    introStore.seenOnServer,
  );
  const showIntro = !introSeen && !dismissed;

  const dismissIntro = () => {
    setDismissed(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* nothing to persist to */
    }
  };

  const submit = async () => {
    await ask(message);
    setMessage('');
  };

  return (
    <div className={'chatpage' + (histOpen ? ' hist-open' : '')}>
      <HistoryRail
        open={histOpen}
        onToggle={() => setHistOpen((v) => !v)}
        onPick={setMessage}
      />

      <div className="chatwrap">
        <h1>{t.chatTitle}</h1>
      <p className="lede">{t.chatLede}</p>

      {showIntro && <IntroPanel onClose={dismissIntro} />}

      <div className="composer">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.prompt}
          maxLength={1800}
          aria-label={t.ask}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          }}
        />
        <div className="composer-bar">
          <button
            className={'micbtn' + (recording ? ' recording' : '')}
            onClick={() => void record(setMessage)}
            disabled={busy && !recording}
            aria-pressed={recording}
            aria-label={recording ? t.stop : t.record}
          >
            {recording ? <Square size={15} /> : <Mic size={16} />}
            {recording ? t.stop : t.record}
          </button>

          <span className="label composer-count">{message.length}/1800</span>
          <button
            className="btn"
            onClick={() => void submit()}
            disabled={busy || loading || !message.trim()}
          >
            {busy && !recording ? (
              <Loader2 className="spin" size={15} />
            ) : (
              <ArrowRight size={15} />
            )}
            {t.send}
          </button>
        </div>
      </div>

      <div className="examples">
        <span className="label">{t.forExample}</span>
        <div className="examples-list">
          {[t.ex1, t.ex2, t.ex3].map((ex) => (
            <button key={ex} onClick={() => setMessage(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-foot">
        <button className="btn btn-ghost btn-sm" onClick={openProfile}>
          <PenLine size={14} />
          {t.or}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push('/explore')}
        >
          {t.explore}
        </button>
        <span className="label">
          <LockKeyhole size={12} style={{ display: 'inline', marginRight: 5 }} />
          {t.private} · 60 min
        </span>
        </div>
      </div>
    </div>
  );
}

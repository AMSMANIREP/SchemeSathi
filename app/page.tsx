'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowUp,
  Loader2,
  LockKeyhole,
  Plus,
  X,
  Mic,
  Square,
  Volume2,
} from 'lucide-react';
import { useApp } from './providers';
import { Blocks } from './blocks';
import { VoiceControls } from './voice-controls';
import { voiceCopy } from '@/lib/languages';
import type { Language } from '@/lib/types';

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
            <span className="intro-n data">
              {String(i + 1).padStart(2, '0')}
            </span>
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

export default function Chat() {
  const {
    t,
    ask,
    busy,
    loading,
    messages,
    newConversation,
    record,
    recording,
    caps,
    language,
    speakReply,
  } = useApp();
  const [message, setMessage] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState<Language | undefined>();
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [dismissed, setDismissed] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const introSeen = useSyncExternalStore(
    introStore.subscribe,
    introStore.seenOnClient,
    introStore.seenOnServer,
  );
  const started = messages.length > 0;
  const showIntro = !introSeen && !dismissed && !started;

  useEffect(() => {
    if (started) end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, started]);

  const dismissIntro = () => {
    setDismissed(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* nothing to persist to */
    }
  };

  const submit = async (text?: string) => {
    const value = text ?? message;
    if (!value.trim() || busy || loading || recording) return;
    setMessage('');
    await ask(
      value,
      text === undefined ? inputMode : 'text',
      text === undefined ? voiceLanguage : undefined,
    );
    setInputMode('text');
    setVoiceLanguage(undefined);
  };

  return (
    <div className="chatpage">
      <div className="chatwrap">
        {!started && (
          <>
            <h1>{t.chatTitle}</h1>
            <p className="lede">{t.chatLede}</p>
            {showIntro && <IntroPanel onClose={dismissIntro} />}
          </>
        )}

        {started && (
          <div className="transcript" aria-live="polite">
            {messages.map((m) => (
              <div className={'turn turn-' + m.role} key={m.id}>
                <span className="turn-who label">
                  {m.role === 'user' ? t.youLabel : t.sathiLabel}
                </span>
                <div className="turn-body">
                  {m.text && <p>{m.text}</p>}
                  <Blocks blocks={m.blocks} onAnswer={(v) => void submit(v)} />
                  {caps.voice &&
                    m.role === 'assistant' &&
                    m.language === language && (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy || recording}
                        onClick={() => speakReply(m)}
                      >
                        <Volume2 size={14} /> {voiceCopy[language].replay}
                      </button>
                    )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="turn turn-assistant">
                <span className="turn-who label">{t.sathiLabel}</span>
                <div className="turn-body thinking">
                  <Loader2 className="spin" size={14} />
                  {t.thinking}
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
        )}

        <div className="composer">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={started ? t.askAnything : t.prompt}
            maxLength={1800}
            aria-label={t.ask}
            rows={started ? 2 : 4}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="composer-bar">
            {caps.voice && (
              <button
                className={'micbtn' + (recording ? ' recording' : '')}
                onClick={() =>
                  void record((text, detected) => {
                    setMessage(text);
                    setVoiceLanguage(detected);
                    setInputMode('voice');
                  })
                }
                disabled={busy && !recording}
                aria-pressed={recording}
                aria-label={recording ? t.stop : t.record}
              >
                {recording ? <Square size={15} /> : <Mic size={16} />}
                {recording ? t.stop : t.record}
              </button>
            )}
            {started && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void newConversation()}
                disabled={busy}
              >
                <Plus size={14} />
                {t.newChat}
              </button>
            )}
            <span className="label composer-count">{message.length}/1800</span>
            <button
              className="btn"
              onClick={() => void submit()}
              disabled={busy || loading || recording || !message.trim()}
              aria-label={t.send}
            >
              {busy && !recording ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <ArrowUp size={15} />
              )}
            </button>
          </div>
        </div>

        <VoiceControls />

        {!started && (
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
        )}

        <div className="chat-foot">
          <span className="label">
            <LockKeyhole
              size={12}
              style={{ display: 'inline', marginRight: 5 }}
            />
            {t.retention}
          </span>
        </div>
      </div>
    </div>
  );
}

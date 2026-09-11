'use client';
import { Volume2, VolumeX, Square, Loader2 } from 'lucide-react';
import { useApp } from './providers';
import { voiceCopy } from '@/lib/languages';
import { handsFreeCopy } from '@/lib/hands-free-copy';

/** Optional controls within existing screens; no extra onboarding or chat steps. */
export function VoiceControls() {
  const { speech, language, session, caps, handsFree, busy } = useApp();
  const v = voiceCopy[language];
  if (!caps.voice) return <p className="voice-note">{v.unavailable}</p>;
  return (
    <section className="voice-controls" aria-label={v.title}>
      <div className="voice-buttons">
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy || !session}
          onClick={() => {
            handsFree.stop();
            void speech.play(
              {
                kind: 'welcome',
                language,
                multilingual: false,
              },
              true,
            );
          }}
        >
          <Volume2 size={14} /> {v.play}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          aria-pressed={speech.muted}
          onClick={speech.toggleMute}
        >
          {speech.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}{' '}
          {speech.muted ? v.unmute : v.mute}
        </button>
        {speech.status === 'blocked' && (
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={speech.replay}
          >
            <Volume2 size={14} /> {v.replay}
          </button>
        )}
        {['loading', 'playing', 'blocked'].includes(speech.status) && (
          <button className="btn btn-ghost btn-sm" onClick={speech.stop}>
            <Square size={14} /> {v.stop}
          </button>
        )}
        <output>
          {speech.status === 'loading' && (
            <>
              <Loader2 size={14} className="spin" /> {v.loading}
            </>
          )}
          {speech.status === 'playing' && v.playing}
          {speech.status === 'blocked' && v.blocked}
          {speech.status === 'unavailable' && (speech.error || v.unavailable)}
        </output>
      </div>
      <output aria-live="polite">
        {handsFree.phase === 'listening' && handsFreeCopy[language].listening}
        {handsFree.phase === 'permission' && handsFreeCopy[language].permission}
        {handsFree.phase === 'transcribing' &&
          handsFreeCopy[language].transcribing}
        {handsFree.suspended && handsFreeCopy[language].paused}
        {handsFree.error && <span role="alert">{handsFree.error}</span>}
      </output>
      <p className="voice-note">{handsFreeCopy[language].help}</p>
    </section>
  );
}

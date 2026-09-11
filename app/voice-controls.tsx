'use client';
import { Volume2, VolumeX, Square, Loader2 } from 'lucide-react';
import { useApp } from './providers';
import { voiceCopy } from '@/lib/languages';

/** Optional controls within existing screens; no extra onboarding or chat steps. */
export function VoiceControls() {
  const { speech, language, session, caps, recording, busy } = useApp();
  const v = voiceCopy[language];
  if (!caps.voice) return <p className="voice-note">{v.unavailable}</p>;
  return (
    <section className="voice-controls" aria-label={v.title}>
      <div className="voice-buttons">
        <button
          className="btn btn-ghost btn-sm"
          disabled={recording || busy || !session}
          onClick={() =>
            void speech.play(
              {
                kind: 'welcome',
                language,
                multilingual: !session?.languageSelected,
              },
              true,
            )
          }
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
            disabled={recording || busy}
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
          {speech.status === 'unavailable' && v.unavailable}
        </output>
      </div>
      <p className="voice-note">{v.disclosure}</p>
    </section>
  );
}

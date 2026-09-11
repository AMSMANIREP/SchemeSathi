'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from './types';
import type { SpeechKind } from './languages';

export type SpeechRequest = {
  kind: SpeechKind | 'message';
  language: Language;
  multilingual?: boolean;
  schemeId?: string;
  messageId?: string;
  conversationId?: string;
};
type VoiceStatus = 'idle' | 'loading' | 'playing' | 'blocked' | 'unavailable';

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const mutedRef = useRef(false);
  const request = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const last = useRef<SpeechRequest | null>(null);
  // Reuse the element unlocked by the sign-in gesture for subsequent replies.
  const unlock = useCallback(() => {
    if (player.current) return;
    const element = new Audio();
    player.current = element;
    const bytes = new Uint8Array(204);
    const view = new DataView(bytes.buffer);
    const label = (at: number, text: string) => {
      for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
    };
    label(0, 'RIFF');
    view.setUint32(4, 196, true);
    label(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    label(36, 'data');
    view.setUint32(40, 160, true);
    element.src =
      'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes));
    void element.play().catch(() => {});
  }, []);
  const release = useCallback(() => {
    request.current?.abort();
    request.current = null;
    if (audio.current) {
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.removeAttribute('src');
      audio.current.load();
      audio.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }, []);
  const stop = useCallback(() => {
    release();
    last.current = null;
    setStatus('idle');
  }, [release]);
  useEffect(() => {
    let mounted = true;
    try {
      const value = localStorage.getItem('sathi-voice-muted') === 'true';
      mutedRef.current = value;
      queueMicrotask(() => {
        if (mounted) setMuted(value);
      });
    } catch {
      /* Storage may be disabled. */
    }
    return () => {
      mounted = false;
      release();
    };
  }, [release]);
  const startAudio = useCallback(async (element: HTMLAudioElement) => {
    try {
      await element.play();
      if (audio.current === element) setStatus('playing');
    } catch (error) {
      if (audio.current !== element) return;
      setStatus(
        (error as Error).name === 'NotAllowedError' ? 'blocked' : 'unavailable',
      );
    }
  }, []);
  const play = useCallback(
    async (value: SpeechRequest, explicit = false) => {
      last.current = value;
      release();
      if (mutedRef.current && !explicit) {
        setStatus('idle');
        return;
      }
      const controller = new AbortController();
      setError('');
      request.current = controller;
      setStatus('loading');
      try {
        const result = await fetch('/api/v1/voice/synthesize', {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'SchemeSathi',
          },
          body: JSON.stringify(value),
        });
        if (!result.ok) {
          const problem = (await result.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          if (!controller.signal.aborted && typeof problem?.error === 'string')
            setError(problem.error);
          throw new Error('Speech unavailable');
        }
        const blob = await result.blob();
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const element = player.current || new Audio();
        player.current = element;
        element.setAttribute('src', url);
        audioUrl.current = url;
        audio.current = element;
        audio.current.onended = () => {
          if (audio.current === element) {
            release();
            setStatus('idle');
          }
        };
        audio.current.onerror = () => {
          if (audio.current === element) {
            release();
            setStatus('unavailable');
          }
        };
        await startAudio(element);
      } catch {
        if (!controller.signal.aborted) {
          release();
          setStatus('unavailable');
        }
      }
    },
    [release, startAudio],
  );
  const replay = useCallback(() => {
    if (audio.current) {
      audio.current.currentTime = 0;
      void startAudio(audio.current);
    } else if (last.current) void play(last.current, true);
  }, [play, startAudio]);
  const toggleMute = useCallback(() => {
    const value = !mutedRef.current;
    mutedRef.current = value;
    setMuted(value);
    if (value) stop();
    try {
      localStorage.setItem('sathi-voice-muted', String(value));
    } catch {
      /* Optional device preference. */
    }
  }, [stop]);
  return { status, muted, error, play, stop, replay, toggleMute, unlock };
}

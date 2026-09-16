'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UtteranceDetector } from './utterance';
import type { Language } from './types';
import { voiceCopy } from './languages';

type Phase = 'idle' | 'permission' | 'listening' | 'transcribing' | 'error';
type Options = {
  enabled: boolean;
  paused: boolean;
  language: Language;
  onTranscript: (text: string, language: Language) => Promise<void>;
};
export function useHandsFree(options: Options) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(true);
  const [typing, setTyping] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const failed = useRef(false);

  const stop = useCallback(() => {
    stopRef.current();
    setPhase('idle');
  }, []);
  const pause = useCallback(() => {
    stopRef.current();
    setSuspended(true);
    setPhase('idle');
  }, []);
  const resume = useCallback(() => {
    failed.current = false;
    setError('');
    setSuspended(false);
    setRetry((n) => n + 1);
  }, []);
  useEffect(() => {
    const update = () => {
      if (document.hidden) stopRef.current();
      setVisible(!document.hidden);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!options.enabled) {
      failed.current = false;
    }
    if (
      !options.enabled ||
      options.paused ||
      suspended ||
      typing ||
      !visible ||
      failed.current
    ) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        if (!options.enabled) {
          setSuspended(false);
          setTyping(false);
          setError('');
        }
        setPhase(failed.current ? 'error' : 'idle');
      });
      return () => {
        active = false;
      };
    }
    let live = true;
    let media: MediaStream | null = null;
    let context: AudioContext | null = null;
    let recorder: MediaRecorder | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();
    const cleanup = () => {
      live = false;
      controller.abort();
      if (timer) clearInterval(timer);
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      media?.getTracks().forEach((track) => track.stop());
      media = null;
      void context?.close().catch(() => {});
      context = null;
    };
    stopRef.current = cleanup;
    const fail = (message: string) => {
      if (!live) return;
      cleanup();
      failed.current = true;
      setError(message);
      setPhase('error');
    };
    async function start() {
      setPhase('permission');
      try {
        if (
          !navigator.mediaDevices?.getUserMedia ||
          typeof MediaRecorder === 'undefined' ||
          typeof AudioContext === 'undefined'
        )
          throw new Error(voiceCopy[latest.current.language].microphone);
        media = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (!live) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        context = new AudioContext();
        await context.resume();
        if (!live) return;
        if (context.state !== 'running')
          throw new Error(voiceCopy[latest.current.language].microphone);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const mimeType = [
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/webm',
        ].find((type) => MediaRecorder.isTypeSupported(type));
        function listen() {
          if (!live || !media) return;
          let chunks: Blob[] = [];
          let bytes = 0;
          let decision: 'send' | 'discard' | null = null;
          const detector = new UtteranceDetector(performance.now());
          const mr = new MediaRecorder(
            media,
            mimeType ? { mimeType } : undefined,
          );
          recorder = mr;
          mr.ondataavailable = (event) => {
            if (event.data.size) {
              chunks.push(event.data);
              bytes += event.data.size;
            }
            if (bytes > 4500000)
              fail(voiceCopy[latest.current.language].unavailable);
          };
          mr.onerror = () =>
            fail(voiceCopy[latest.current.language].microphone);
          mr.onstop = async () => {
            if (timer) clearInterval(timer);
            if (!live) return;
            if (decision !== 'send') {
              chunks = [];
              listen();
              return;
            }
            // Release the microphone before recognition or playback.
            media?.getTracks().forEach((track) => track.stop());
            media = null;
            void context?.close().catch(() => {});
            context = null;
            setPhase('transcribing');
            try {
              const blob = new Blob(chunks, {
                type: mr.mimeType || mimeType || 'audio/webm',
              });
              chunks = [];
              const form = new FormData();
              form.append(
                'file',
                blob,
                blob.type.includes('mp4') ? 'turn.m4a' : 'turn.webm',
              );
              const response = await fetch('/api/v1/voice/transcribe', {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: { 'X-Requested-With': 'SchemeSathi' },
                body: form,
              });
              const result = (await response.json()) as {
                error?: string;
                text?: string;
                language: Language;
              };
              if (!live) return;
              if (response.status === 422) {
                setRetry((n) => n + 1);
                return;
              }
              if (!response.ok)
                throw new Error(
                  result.error ||
                    voiceCopy[latest.current.language].unavailable,
                );
              if (!result.text?.trim()) {
                setRetry((n) => n + 1);
                return;
              }
              await latest.current.onTranscript(result.text, result.language);
              if (live) setRetry((n) => n + 1);
            } catch (error) {
              if (!controller.signal.aborted)
                fail(
                  error instanceof Error
                    ? error.message
                    : voiceCopy[latest.current.language].unavailable,
                );
            }
          };
          mr.start(250);
          setPhase('listening');
          timer = setInterval(() => {
            if (!live || mr.state !== 'recording') return;
            analyser.getFloatTimeDomainData(samples);
            const rms = Math.sqrt(
              samples.reduce((sum, x) => sum + x * x, 0) / samples.length,
            );
            decision = detector.sample(rms, performance.now());
            if (decision) {
              if (timer) clearInterval(timer);
              mr.stop();
            }
          }, 50);
        }
        listen();
      } catch (error) {
        fail(
          error instanceof Error &&
            error.message === voiceCopy[latest.current.language].unavailable
            ? error.message
            : voiceCopy[latest.current.language].microphone,
        );
      }
    }
    // A brief gap after playback prevents residual speaker audio becoming input.
    const delay = setTimeout(() => void start(), 350);
    return () => {
      clearTimeout(delay);
      cleanup();
    };
  }, [options.enabled, options.paused, suspended, typing, visible, retry]);
  return { phase, error, suspended, pause, resume, stop, setTyping };
}

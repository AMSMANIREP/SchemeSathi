'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { copy } from '@/lib/i18n';
import { usePathname } from 'next/navigation';
import { languageIndex, voiceCopy } from '@/lib/languages';
import { useVoice } from '@/lib/use-voice';
import type {
  Scheme,
  Profile,
  Decision,
  Language,
  ApplicationRecord,
  MessageRecord,
  Provenance,
} from '@/lib/types';

export type Session = {
  profile: Profile;
  confirmed: string[];
  provenance: Record<string, Provenance>;
  profileVersion: number;
  language: Language;
  languageSelected: boolean;
  memoryConsent: boolean;
};
export type Capabilities = {
  ai: boolean;
  voice: boolean;
  memory: boolean;
  retrieval: boolean;
};

const HISTORY_KEY = 'schemesathi.history';
/** Simulated sign-in for the demo: a display name and a flag, nothing more.
 *  No credential is exchanged and nothing is sent anywhere. */
const VISITOR_KEY = 'schemesathi.visitor';

/**
 * The simulated sign-in lives in localStorage, which does not exist during
 * SSR. Reading it into state would make the server render the signed-out
 * shell and the client render the signed-in one — a hydration mismatch that
 * tears the tree down. useSyncExternalStore is the sanctioned way to read a
 * client-only store: React hydrates with the server snapshot and re-renders
 * with the real value immediately after, without a mismatch.
 *
 * The snapshot is the raw string so its identity stays stable between calls.
 */
const visitorListeners = new Set<() => void>();

const visitorStore = {
  subscribe: (cb: () => void) => {
    visitorListeners.add(cb);
    window.addEventListener('storage', cb);
    return () => {
      visitorListeners.delete(cb);
      window.removeEventListener('storage', cb);
    };
  },
  snapshot: () => {
    try {
      return localStorage.getItem(VISITOR_KEY) ?? '';
    } catch {
      return '';
    }
  },
  serverSnapshot: () => '',
};

const emitVisitor = () => visitorListeners.forEach((cb) => cb());

function parseVisitor(raw: string): {
  name: string | null;
  onboarded: boolean;
} {
  if (!raw) return { name: null, onboarded: false };
  try {
    const v = JSON.parse(raw);
    return { name: v.name ?? '', onboarded: !!v.onboarded };
  } catch {
    return { name: null, onboarded: false };
  }
}

export type HistoryEntry = { at: number; text: string };

/** Session-scoped: survives a refresh, dies with the tab, cleared by
 *  "delete my data". Deliberately not localStorage — a citizen's described
 *  situation must not outlive the private session the product promises. */
function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 30)));
  } catch {
    /* storage unavailable: history is a convenience, not a requirement */
  }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  data?: unknown,
) {
  const r = await fetch('/api/v1/' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'SchemeSathi',
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const j = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j as T;
}

type Ctx = {
  language: Language;
  t: (typeof copy)['en'];
  li: number;
  schemes: Scheme[];
  session: Session | null;
  caps: Capabilities;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  decisions: Record<string, Decision>;
  applications: ApplicationRecord[];
  provenance: Record<string, Provenance>;
  messages: MessageRecord[];
  conversationId: string | null;
  checkpoint: string;
  detail: Scheme | null;
  setError: (s: string) => void;
  setNotice: (s: string) => void;
  setDetail: (s: Scheme | null) => void;
  load: () => Promise<void>;
  selectLanguage: (l: Language) => Promise<void>;
  ask: (
    message: string,
    inputMode?: 'text' | 'voice',
    detectedLanguage?: Language,
  ) => Promise<void>;
  speech: ReturnType<typeof useVoice>;
  speakReply: (message: MessageRecord) => void;
  saveProfile: (profile: Profile) => Promise<void>;
  newConversation: () => Promise<void>;
  saveScheme: (s: Scheme) => Promise<void>;
  updateApplication: (a: ApplicationRecord) => Promise<void>;
  removeApplication: (id: string) => Promise<void>;
  forget: () => Promise<void>;
  sendFeedback: (rating: string, comment: string) => Promise<void>;
  setMemoryConsent: (v: boolean) => Promise<void>;
  refreshApps: () => Promise<void>;
  recording: boolean;
  record: (
    onText: (text: string, language?: Language) => void,
  ) => Promise<void>;
  history: HistoryEntry[];
  clearHistory: () => void;
  visitor: string | null;
  signedIn: boolean;
  signIn: (name: string) => void;
  signOut: () => void;
  onboarded: boolean;
  completeOnboarding: () => void;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const speech = useVoice();
  const { play: playSpeech, stop: stopSpeech } = speech;
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>('en');
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [caps, setCaps] = useState<Capabilities>({
    ai: false,
    voice: false,
    memory: false,
    retrieval: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [detail, setDetail] = useState<Scheme | null>(null);
  const [recording, setRecording] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const visitorRaw = useSyncExternalStore(
    visitorStore.subscribe,
    visitorStore.snapshot,
    visitorStore.serverSnapshot,
  );
  const { name: visitor, onboarded } = parseVisitor(visitorRaw);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState('GATHERING');
  const initialized = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingEpoch = useRef(0);
  const recordingPending = useRef(false);
  const transcription = useRef<AbortController | null>(null);
  const greeted = useRef(false);

  const t = copy[language];
  const li = languageIndex(language);

  const refreshApps = useCallback(async () => {
    const r = await api<{ applications: ApplicationRecord[] }>('applications');
    setApplications(r.applications);
  }, []);

  const refreshDecisions = useCallback(async () => {
    const r = await api<{ results: { scheme: Scheme; decision: Decision }[] }>(
      'recommendations',
    );
    setDecisions(
      Object.fromEntries(r.results.map((x) => [x.scheme.id, x.decision])),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, all] = await Promise.all([
        api<Capabilities>('capabilities'),
        api<{ schemes: Scheme[] }>('schemes'),
      ]);
      setCaps(c);
      setSchemes(all.schemes);
      let s;
      try {
        s = await api<Session>('sessions');
      } catch {
        s = await api<Session>('sessions', 'POST', {});
      }
      setSession(s);
      setLanguage(s.language);
      await refreshApps();
      if (s.profileVersion > 0) await refreshDecisions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refreshApps, refreshDecisions]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setHistory(readHistory());
    void load();
  }, [load]);

  const cancelRecording = useCallback(() => {
    recordingEpoch.current++;
    recordingPending.current = false;
    transcription.current?.abort();
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state === 'recording') recorder.current.stop();
    }
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setRecording(false);
  }, []);
  useEffect(() => cancelRecording, [cancelRecording]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        cancelRecording();
        stopSpeech();
      }
    });
    return () => {
      active = false;
    };
  }, [pathname, cancelRecording, stopSpeech]);

  useEffect(() => {
    if (loading || !session || !caps.voice || greeted.current) return;
    greeted.current = true;
    void playSpeech({
      kind: 'welcome',
      language: session.language,
      multilingual: !session.languageSelected,
    });
  }, [loading, session, caps.voice, playSpeech]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectLanguage = async (l: Language) => {
    if (!session || busy || recording) return;
    speech.stop();
    setBusy(true);
    try {
      await api('privacy/consent', 'PUT', {
        enabled: session.memoryConsent,
        language: l,
      });
      setLanguage(l);
      setSession({ ...session, language: l, languageSelected: true });
      if (caps.voice) void speech.play({ kind: 'selected', language: l });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const c = await api<{ id: string }>('conversations', 'POST', {});
    setConversationId(c.id);
    return c.id;
  }, [conversationId]);

  const newConversation = async () => {
    speech.stop();
    cancelRecording();
    setMessages([]);
    setConversationId(null);
    setCheckpoint('GATHERING');
  };

  const ask = async (
    message: string,
    inputMode: 'text' | 'voice' = 'text',
    detectedLanguage?: Language,
  ) => {
    const text = message.trim();
    if (!text || busy || recording) return;
    speech.stop();
    const entries = [
      { at: Date.now(), text },
      ...history.filter((h) => h.text !== text),
    ].slice(0, 30);
    setHistory(entries);
    writeHistory(entries);

    // Show the citizen's own words immediately; the turn round-trips after.
    const pending: MessageRecord = {
      id: 'pending-' + Date.now(),
      role: 'user',
      text,
      inputMode,
      blocks: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, pending]);
    setBusy(true);
    setError('');
    try {
      const id = await ensureConversation();
      const r = await api<{
        userMessage: MessageRecord;
        message: MessageRecord;
        checkpoint: string;
        language: Language;
      }>('conversations/' + id + '/messages', 'POST', {
        message: text,
        inputMode,
        language: detectedLanguage,
      });
      setMessages((m) => [
        ...m.filter((x) => x.id !== pending.id),
        r.userMessage,
        r.message,
      ]);
      setCheckpoint(r.checkpoint);
      const s = await api<Session>('sessions');
      setSession(s);
      setLanguage(s.language);
      if (caps.voice && r.message.language === s.language)
        void speech.play({
          kind: 'message',
          language: s.language,
          messageId: r.message.id,
          conversationId: id,
        });
      if (s.profileVersion > 0) await refreshDecisions();
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** The /profile route's save. Everything reviewed here counts as entered. */
  const saveProfile = async (profile: Profile) => {
    setBusy(true);
    setError('');
    try {
      const current = await api<Session>('sessions');
      const r = await api<{ profileVersion: number }>(
        'profile/confirm',
        'PUT',
        { profile, version: current.profileVersion, confirmed: true },
      );
      setSession(await api<Session>('sessions'));
      if (r.profileVersion > 0) await refreshDecisions();
      setNotice(t.profileReady);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveScheme = async (s: Scheme) => {
    setBusy(true);
    try {
      await api('applications', 'POST', {
        schemeId: s.id,
        conversationId,
      });
      const r = await api<{ applications: ApplicationRecord[] }>(
        'applications',
      );
      setApplications(r.applications);
      setNotice(t.saved);

      // Saving from the transcript answers the offer, so the answer belongs
      // in the transcript: a receipt that leads straight to the next steps.
      const saved = r.applications.find((a) => a.schemeId === s.id);
      if (conversationId && saved)
        setMessages((m) => [
          ...m,
          {
            id: 'receipt-' + saved.id,
            role: 'assistant',
            text: '',
            inputMode: 'text',
            blocks: [
              {
                kind: 'saved_receipt',
                applicationId: saved.id,
                schemeId: s.id,
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateApplication = async (a: ApplicationRecord) => {
    setBusy(true);
    try {
      await api('applications/' + a.id, 'PATCH', a);
      await refreshApps();
      setNotice(t.updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeApplication = async (id: string) => {
    try {
      await api('applications/' + id, 'DELETE');
      await refreshApps();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const forget = async () => {
    speech.stop();
    cancelRecording();
    setBusy(true);
    try {
      await api('me/data', 'DELETE');
      setApplications([]);
      setDecisions({});
      setMessages([]);
      setConversationId(null);
      setCheckpoint('GATHERING');
      persistVisitor(null, false);
      setSession(null);
      setHistory([]);
      writeHistory([]);
      const s = await api<Session>('sessions', 'POST', { language });
      setSession(s);
      setNotice(t.deleted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendFeedback = async (rating: string, comment: string) => {
    setBusy(true);
    try {
      await api('feedback', 'POST', { rating: +rating, comment });
      setNotice(t.feedbackSaved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const persistVisitor = (name: string | null, done: boolean) => {
    try {
      if (name === null) localStorage.removeItem(VISITOR_KEY);
      else
        localStorage.setItem(
          VISITOR_KEY,
          JSON.stringify({ name, onboarded: done }),
        );
    } catch {
      /* storage unavailable: the session still works, it just forgets */
    }
    emitVisitor();
  };

  const signIn = (name: string) => persistVisitor(name, false);
  const signOut = () => {
    speech.stop();
    cancelRecording();
    persistVisitor(null, false);
  };
  const completeOnboarding = () => persistVisitor(visitor ?? '', true);

  const clearHistory = () => {
    setHistory([]);
    writeHistory([]);
  };

  const record = async (
    onText: (text: string, language?: Language) => void,
  ) => {
    if (recordingPending.current) {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      else cancelRecording();
      return;
    }
    if (busy) return;
    if (!caps.voice) {
      setNotice(t.voiceOff);
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(voiceCopy[language].microphone);
      return;
    }
    speech.stop();
    const epoch = ++recordingEpoch.current;
    recordingPending.current = true;
    setRecording(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (epoch !== recordingEpoch.current) {
        media.getTracks().forEach((tr) => tr.stop());
        return;
      }
      stream.current = media;
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/webm',
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = mr;
      const chunks: Blob[] = [];
      let bytes = 0;
      mr.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
        }
        if (bytes > 4500000 && mr.state === 'recording') mr.stop();
      };
      mr.onerror = () => {
        cancelRecording();
        setError(voiceCopy[language].microphone);
      };
      mr.onstop = async () => {
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        media.getTracks().forEach((tr) => tr.stop());
        stream.current = null;
        recordingPending.current = false;
        recorder.current = null;
        setRecording(false);
        if (epoch !== recordingEpoch.current) return;
        setBusy(true);
        const controller = new AbortController();
        transcription.current = controller;
        try {
          const blob = new Blob(chunks, {
            type: mr.mimeType || mimeType || 'audio/webm',
          });
          if (!blob.size) throw Error(voiceCopy[language].empty);
          const form = new FormData();
          form.append(
            'file',
            blob,
            blob.type.includes('mp4') ? 'voice.m4a' : 'voice.webm',
          );
          const r = await fetch('/api/v1/voice/transcribe', {
            method: 'POST',
            credentials: 'same-origin',
            signal: controller.signal,
            headers: { 'X-Requested-With': 'SchemeSathi' },
            body: form,
          });
          const b = (await r.json()) as {
            error?: string;
            text: string;
            language: Language;
          };
          if (!r.ok) throw Error(b.error || voiceCopy[language].unavailable);
          if (epoch !== recordingEpoch.current) return;
          onText(b.text, b.language);
          setNotice(voiceCopy[language].transcript);
        } catch (e) {
          if (!controller.signal.aborted) setError((e as Error).message);
        } finally {
          if (transcription.current === controller)
            transcription.current = null;
          setBusy(false);
        }
      };
      mr.start(250);
      recordingTimer.current = setTimeout(() => {
        if (mr.state === 'recording') mr.stop();
      }, 20000);
    } catch {
      cancelRecording();
      setError(voiceCopy[language].microphone);
    }
  };

  const setMemoryConsent = async (v: boolean) => {
    try {
      await api('privacy/consent', 'PUT', { enabled: v, language });
      setSession((s) => (s ? { ...s, memoryConsent: v } : s));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AppContext.Provider
      value={{
        language,
        t,
        li,
        schemes,
        session,
        caps,
        loading,
        busy,
        error,
        notice,
        decisions,
        applications,
        detail,
        setError,
        setNotice,
        setDetail,
        load,
        selectLanguage,
        ask,
        saveProfile,
        newConversation,
        provenance: session?.provenance || {},
        messages,
        conversationId,
        checkpoint,
        saveScheme,
        updateApplication,
        removeApplication,
        forget,
        sendFeedback,
        setMemoryConsent,
        refreshApps,
        recording,
        record,
        speech,
        speakReply: (message) => {
          if (!conversationId || message.language !== language || recording)
            return;
          void speech.play(
            {
              kind: 'message',
              language,
              messageId: message.id,
              conversationId,
            },
            true,
          );
        },
        history,
        clearHistory,
        visitor,
        signedIn: visitor !== null,
        signIn,
        signOut,
        onboarded,
        completeOnboarding,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

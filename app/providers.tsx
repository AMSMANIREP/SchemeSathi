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

function parseVisitor(raw: string): { name: string | null; onboarded: boolean } {
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
  /** What the turn is doing right now, while it is doing it. */
  stage: string;
  detail: Scheme | null;
  setError: (s: string) => void;
  setNotice: (s: string) => void;
  setDetail: (s: Scheme | null) => void;
  load: () => Promise<void>;
  selectLanguage: (l: Language) => Promise<void>;
  ask: (message: string) => Promise<void>;
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
  record: (onText: (text: string) => void) => Promise<void>;
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
  const [stage, setStage] = useState('');
  const initialized = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const t = copy[language];
  const li = language === 'en' ? 0 : language === 'hi' ? 1 : 2;

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
        s = await api<Session>('sessions', 'POST', { language: 'en' });
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

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectLanguage = async (l: Language) => {
    setLanguage(l);
    if (!session) return;
    try {
      await api('privacy/consent', 'PUT', {
        enabled: session.memoryConsent,
        language: l,
      });
      setSession({ ...session, language: l });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const c = await api<{ id: string }>('conversations', 'POST', {});
    setConversationId(c.id);
    return c.id;
  }, [conversationId]);

  const newConversation = async () => {
    setMessages([]);
    setConversationId(null);
    setCheckpoint('GATHERING');
  };

  const ask = async (message: string) => {
    const text = message.trim();
    if (!text || busy) return;
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
      inputMode: 'text',
      blocks: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, pending]);
    setBusy(true);
    setStage('');
    setError('');
    try {
      const id = await ensureConversation();
      const r = await fetch('/api/v1/conversations/' + id + '/messages', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'SchemeSathi',
          // Streaming is opt-in; without this the same endpoint returns JSON.
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message: text }),
      });
      if (!r.ok || !r.body) {
        const failure = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(failure.error || 'Request failed');
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let event = '';
      const streamId = 'streaming-' + Date.now();

      let streaming = true;
      while (streaming) {
        const chunk = await reader.read();
        if (chunk.done) {
          streaming = false;
          break;
        }
        buffer += decoder.decode(chunk.value, { stream: true });

        // SSE frames are separated by a blank line; anything after the last
        // one is a partial frame and waits for the next chunk.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (event === 'status') setStage(data.stage);
              else if (event === 'user')
                setMessages((m) => [
                  ...m.filter((x) => x.id !== pending.id),
                  data as MessageRecord,
                ]);
              else if (event === 'delta') {
                setStage('');
                setMessages((m) => {
                  const rest = m.filter((x) => x.id !== streamId);
                  return [
                    ...rest,
                    {
                      id: streamId,
                      role: 'assistant',
                      text: data.text,
                      inputMode: 'text',
                      blocks: [],
                      createdAt: new Date().toISOString(),
                    },
                  ];
                });
              } else if (event === 'message')
                setMessages((m) => [
                  ...m.filter((x) => x.id !== streamId),
                  data as MessageRecord,
                ]);
              else if (event === 'done') {
                setCheckpoint(data.checkpoint);
                const fresh = await api<Session>('sessions');
                setSession(fresh);
                if (fresh.profileVersion > 0) await refreshDecisions();
              } else if (event === 'failed') throw new Error(data.error);
            }
          }
        }
      }
    } catch (e) {
      setMessages((m) => m.filter((x) => !x.id.startsWith('pending-') && !x.id.startsWith('streaming-')));
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStage('');
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
      const r = await api<{ applications: ApplicationRecord[] }>('applications');
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
        localStorage.setItem(VISITOR_KEY, JSON.stringify({ name, onboarded: done }));
    } catch {
      /* storage unavailable: the session still works, it just forgets */
    }
    emitVisitor();
  };

  const signIn = (name: string) => persistVisitor(name, false);
  const signOut = () => persistVisitor(null, false);
  const completeOnboarding = () => persistVisitor(visitor ?? '', true);

  const clearHistory = () => {
    setHistory([]);
    writeHistory([]);
  };

  const record = async (onText: (text: string) => void) => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    if (!caps.voice) {
      setNotice(t.voiceOff);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mr = new MediaRecorder(media);
      recorder.current = mr;
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        media.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        setBusy(true);
        try {
          const form = new FormData();
          form.append(
            'file',
            new Blob(chunks, { type: mr.mimeType }),
            'voice.webm',
          );
          const r = await fetch('/api/v1/voice/transcribe', {
            method: 'POST',
            headers: { 'X-Requested-With': 'SchemeSathi' },
            body: form,
          });
          const b = (await r.json()) as { error: string; text: string };
          if (!r.ok) throw new Error(b.error);
          onText(b.text);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      setRecording(true);
      // hard stop so a forgotten recording cannot run on indefinitely
      setTimeout(() => {
        if (mr.state === 'recording') mr.stop();
      }, 20000);
    } catch (e) {
      setError((e as Error).message);
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
        stage,
        saveScheme,
        updateApplication,
        removeApplication,
        forget,
        sendFeedback,
        setMemoryConsent,
        refreshApps,
        recording,
        record,
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

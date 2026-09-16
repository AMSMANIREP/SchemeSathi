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
import { languageIndex } from '@/lib/languages';
import { useVoice } from '@/lib/use-voice';
import { useHandsFree } from '@/lib/use-hands-free';
import { demoProfileKey, normalizeDemoEmail } from '@/lib/demo-identity';
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
  sessionId: string;
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
/** Only a display name and email hash; never a password or raw email. */
const VISITOR_KEY = 'schemesathi.visitor';
let activeSessionId = '';

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
  profileKey: string | null;
  onboarded: boolean;
} {
  const empty = { name: null, profileKey: null, onboarded: false };
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw);
    // Legacy sign-ins only stored a display name: never assign their shared
    // profile to whichever full email happens to be entered next.
    if (
      v.version !== 2 ||
      typeof v.name !== 'string' ||
      !/^[a-f0-9]{64}$/.test(v.profileKey)
    )
      return empty;
    return { name: v.name, profileKey: v.profileKey, onboarded: !!v.onboarded };
  } catch {
    return empty;
  }
}

export type HistoryEntry = { at: number; text: string };

/** Session-scoped: survives a refresh, dies with the tab, cleared by
 *  "delete my data". Deliberately not localStorage — a citizen's described
 *  situation must not outlive the private session the product promises. */
function readHistory(): HistoryEntry[] {
  try {
    return activeSessionId
      ? JSON.parse(
          sessionStorage.getItem(HISTORY_KEY + '.' + activeSessionId) || '[]',
        )
      : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  try {
    if (activeSessionId)
      sessionStorage.setItem(
        HISTORY_KEY + '.' + activeSessionId,
        JSON.stringify(entries.slice(0, 30)),
      );
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
    signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'SchemeSathi',
      ...(activeSessionId ? { 'X-SchemeSathi-Session': activeSessionId } : {}),
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
  ask: (
    message: string,
    inputMode?: 'text' | 'voice',
    detectedLanguage?: Language,
  ) => Promise<void>;
  speech: ReturnType<typeof useVoice>;
  speakReply: (message: MessageRecord) => void;
  saveProfile: (profile: Profile) => Promise<boolean>;
  newConversation: () => Promise<void>;
  saveScheme: (s: Scheme) => Promise<void>;
  updateApplication: (a: ApplicationRecord) => Promise<boolean>;
  removeApplication: (id: string) => Promise<void>;
  forget: () => Promise<void>;
  sendFeedback: (rating: string, comment: string) => Promise<void>;
  setMemoryConsent: (v: boolean) => Promise<void>;
  refreshApps: () => Promise<void>;
  handsFree: ReturnType<typeof useHandsFree>;
  history: HistoryEntry[];
  clearHistory: () => void;
  visitor: string | null;
  signedIn: boolean;
  signIn: (name: string) => Promise<boolean>;
  signOut: () => Promise<boolean>;
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
  const stopListening = useRef<() => void>(() => {});
  const [welcomeReady, setWelcomeReady] = useState(false);
  const loginPending = useRef(false);
  const turnEpoch = useRef(0);
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
  const greeted = useRef(false);

  const clearPrivateState = useCallback(() => {
    activeSessionId = '';
    stopSpeech();
    stopListening.current();
    greeted.current = false;
    setWelcomeReady(false);
    setSession(null);
    setApplications([]);
    setDecisions({});
    setDetail(null);
    setMessages([]);
    setConversationId(null);
    setCheckpoint('GATHERING');
    setHistory([]);
    setLanguage('en');
    setNotice('');
    setStage('');
    setBusy(false);
  }, [stopSpeech]);

  const t = copy[visitor === null || pathname === '/welcome' ? 'en' : language];
  const li = languageIndex(language);

  const refreshApps = useCallback(async () => {
    const epoch = turnEpoch.current;
    const r = await api<{ applications: ApplicationRecord[] }>('applications');
    if (epoch === turnEpoch.current) setApplications(r.applications);
  }, []);

  const refreshDecisions = useCallback(async () => {
    const epoch = turnEpoch.current;
    const r = await api<{ results: { scheme: Scheme; decision: Decision }[] }>(
      'recommendations',
    );
    if (epoch === turnEpoch.current)
      setDecisions(
        Object.fromEntries(r.results.map((x) => [x.scheme.id, x.decision])),
      );
  }, []);

  const load = useCallback(async () => {
    const epoch = ++turnEpoch.current;
    clearPrivateState();
    setLoading(true);
    setError('');
    try {
      const [c, all] = await Promise.all([
        api<Capabilities>('capabilities'),
        api<{ schemes: Scheme[] }>('schemes'),
      ]);
      if (epoch !== turnEpoch.current) return;
      setCaps(c);
      setSchemes(all.schemes);
      const currentVisitor = parseVisitor(visitorStore.snapshot());
      if (!currentVisitor.profileKey) {
        // Also invalidate the old shared anonymous cookie during migration.
        await api('demo/logout', 'POST', {});
        return;
      }
      const s = await api<Session>('demo/login', 'PUT', {
        profileKey: currentVisitor.profileKey,
      });
      if (epoch !== turnEpoch.current) return;
      activeSessionId = s.sessionId;
      setSession(s);
      setLanguage(s.language);
      setHistory(readHistory());
      await refreshApps();
      if (s.profileVersion > 0) await refreshDecisions();
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === turnEpoch.current) setLoading(false);
    }
  }, [refreshApps, refreshDecisions, clearPrivateState]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      sessionStorage.removeItem(HISTORY_KEY);
    } catch {
      /* legacy shared history */
    }
    void load();
  }, [load]);

  useEffect(() => {
    const switched = (event: StorageEvent) => {
      if (event.key === VISITOR_KEY) void load();
    };
    window.addEventListener('storage', switched);
    return () => window.removeEventListener('storage', switched);
  }, [load]);

  const cancelRecording = useCallback(() => stopListening.current(), []);
  useEffect(() => cancelRecording, [cancelRecording]);
  useEffect(() => {
    return () => {
      cancelRecording();
      stopSpeech();
    };
  }, [pathname, cancelRecording, stopSpeech]);

  useEffect(() => {
    if (
      visitor === null ||
      pathname === '/welcome' ||
      (!onboarded && pathname !== '/profile') ||
      loading ||
      !session ||
      !caps.voice ||
      greeted.current
    )
      return;
    greeted.current = true;
    void playSpeech({
      kind: 'welcome',
      language: session.language,
      multilingual: false,
    });
    setWelcomeReady(true);
  }, [visitor, onboarded, pathname, loading, session, caps.voice, playSpeech]);

  useEffect(() => {
    document.documentElement.lang =
      visitor === null || pathname === '/welcome' ? 'en' : language;
  }, [language, visitor, pathname]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const selectLanguage = async (l: Language) => {
    if (!session || busy) return;
    const epoch = turnEpoch.current;
    cancelRecording();
    speech.stop();
    setBusy(true);
    try {
      await api('privacy/consent', 'PUT', {
        enabled: session.memoryConsent,
        language: l,
      });
      if (epoch !== turnEpoch.current) return;
      setLanguage(l);
      setSession({ ...session, language: l, languageSelected: true });
      if (caps.voice) void speech.play({ kind: 'selected', language: l });
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const epoch = turnEpoch.current;
    const c = await api<{ id: string }>('conversations', 'POST', {});
    if (epoch === turnEpoch.current) setConversationId(c.id);
    return c.id;
  }, [conversationId]);

  const newConversation = async () => {
    turnEpoch.current++;
    speech.stop();
    cancelRecording();
    setMessages([]);
    setConversationId(null);
    setCheckpoint('GATHERING');
    setBusy(false);
    setStage('');
    handsFree.resume();
  };

  const ask = async (
    message: string,
    inputMode: 'text' | 'voice' = 'text',
    detectedLanguage?: Language,
  ) => {
    const text = message.trim();
    if (!text || busy) return;
    const epoch = turnEpoch.current;
    cancelRecording();
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
    setStage('');
    setError('');
    const streamId = 'streaming-' + Date.now();
    try {
      const id = await ensureConversation();
      if (epoch !== turnEpoch.current) return;
      const r = await fetch('/api/v1/conversations/' + id + '/messages', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'SchemeSathi',
          'X-SchemeSathi-Session': activeSessionId,
          // Streaming is opt-in; without this the same endpoint returns JSON.
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: text,
          inputMode,
          language: detectedLanguage,
        }),
      });
      if (epoch !== turnEpoch.current) {
        await r.body?.cancel();
        return;
      }
      if (!r.ok || !r.body) {
        const failure = (await r.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(failure.error || 'Request failed');
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let event = '';
      let reply: MessageRecord | undefined;

      let streaming = true;
      while (streaming) {
        const chunk = await reader.read();
        if (epoch !== turnEpoch.current) {
          await reader.cancel();
          return;
        }
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
              } else if (event === 'message') {
                reply = data as MessageRecord;
                setMessages((m) => [
                  ...m.filter((x) => x.id !== streamId),
                  data as MessageRecord,
                ]);
              } else if (event === 'done') {
                setCheckpoint(data.checkpoint);
                const fresh = await api<Session>('sessions');
                if (epoch !== turnEpoch.current) {
                  await reader.cancel();
                  return;
                }
                setSession(fresh);
                setLanguage(fresh.language);
                if (caps.voice && reply?.language === fresh.language)
                  void speech.play({
                    kind: 'message',
                    language: fresh.language,
                    messageId: reply.id,
                    conversationId: id,
                  });
                if (fresh.profileVersion > 0) await refreshDecisions();
              } else if (event === 'failed') throw new Error(data.error);
            }
          }
        }
      }
    } catch (e) {
      if (epoch !== turnEpoch.current) return;
      setMessages((m) =>
        m.filter((x) => x.id !== pending.id && x.id !== streamId),
      );
      setError((e as Error).message);
    } finally {
      if (epoch === turnEpoch.current) {
        setBusy(false);
        setStage('');
      }
    }
  };

  /** The /profile route's save. Everything reviewed here counts as entered. */
  const saveProfile = async (profile: Profile) => {
    const epoch = turnEpoch.current;
    setBusy(true);
    setError('');
    try {
      const current = await api<Session>('sessions');
      if (epoch !== turnEpoch.current) return false;
      const r = await api<{ profileVersion: number }>(
        'profile/confirm',
        'PUT',
        { profile, version: current.profileVersion, confirmed: true },
      );
      if (epoch !== turnEpoch.current) return false;
      const fresh = await api<Session>('sessions');
      if (epoch !== turnEpoch.current) return false;
      setSession(fresh);
      if (r.profileVersion > 0) await refreshDecisions();
      if (epoch !== turnEpoch.current) return false;
      setNotice(t.profileReady);
      return true;
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
      return false;
    } finally {
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };

  const saveScheme = async (s: Scheme) => {
    const epoch = turnEpoch.current;
    setBusy(true);
    try {
      await api('applications', 'POST', {
        schemeId: s.id,
        conversationId,
      });
      if (epoch !== turnEpoch.current) return;
      const r = await api<{ applications: ApplicationRecord[] }>(
        'applications',
      );
      if (epoch !== turnEpoch.current) return;
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
      if (epoch === turnEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };

  const updateApplication = async (a: ApplicationRecord) => {
    const epoch = turnEpoch.current;
    setBusy(true);
    try {
      await api('applications/' + a.id, 'PATCH', a);
      if (epoch !== turnEpoch.current) return false;
      await refreshApps();
      if (epoch !== turnEpoch.current) return false;
      setNotice(t.updated);
      return true;
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
      return false;
    } finally {
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };

  const removeApplication = async (id: string) => {
    const epoch = turnEpoch.current;
    try {
      await api('applications/' + id, 'DELETE');
      if (epoch !== turnEpoch.current) return;
      await refreshApps();
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
    }
  };

  const forget = async () => {
    const epoch = ++turnEpoch.current;
    speech.stop();
    cancelRecording();
    setBusy(true);
    try {
      await api('me/data', 'DELETE');
      if (epoch !== turnEpoch.current) return;
      writeHistory([]);
      clearPrivateState();
      setApplications([]);
      setDecisions({});
      setMessages([]);
      setConversationId(null);
      setCheckpoint('GATHERING');
      persistVisitor(null, false);
      setLanguage('en');
      greeted.current = false;
      setWelcomeReady(false);
      setSession(null);
      setHistory([]);
      setNotice(t.deleted);
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };

  const sendFeedback = async (rating: string, comment: string) => {
    const epoch = turnEpoch.current;
    setBusy(true);
    try {
      await api('feedback', 'POST', { rating: +rating, comment });
      if (epoch !== turnEpoch.current) return;
      setNotice(t.feedbackSaved);
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };

  const persistVisitor = (
    name: string | null,
    done: boolean,
    profileKey?: string,
  ) => {
    try {
      if (name === null) localStorage.removeItem(VISITOR_KEY);
      else
        localStorage.setItem(
          VISITOR_KEY,
          JSON.stringify({
            version: 2,
            name,
            profileKey:
              profileKey ?? parseVisitor(visitorStore.snapshot()).profileKey,
            onboarded: done,
          }),
        );
    } catch {
      /* storage unavailable: the session still works, it just forgets */
    }
    emitVisitor();
  };

  const signIn = async (identifier: string) => {
    if (loginPending.current) return false;
    loginPending.current = true;
    const epoch = ++turnEpoch.current;
    clearPrivateState();
    speech.unlock();
    cancelRecording();
    setBusy(true);
    setError('');
    try {
      const email = normalizeDemoEmail(identifier);
      const profileKey = await demoProfileKey(email);
      const s = await api<Session>('demo/login', 'PUT', { profileKey });
      if (epoch !== turnEpoch.current) return false;
      activeSessionId = s.sessionId;
      setSession(s);
      setLanguage(s.language);
      setHistory(readHistory());
      await refreshApps();
      if (s.profileVersion > 0) await refreshDecisions();
      if (epoch !== turnEpoch.current) return false;
      greeted.current = false;
      setWelcomeReady(false);
      persistVisitor(email.split('@')[0].slice(0, 40), false, profileKey);
      return true;
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
      return false;
    } finally {
      loginPending.current = false;
      if (epoch === turnEpoch.current) setBusy(false);
    }
  };
  const signOut = async () => {
    if (loginPending.current) return false;
    loginPending.current = true;
    turnEpoch.current++;
    clearPrivateState();
    setError('');
    setBusy(true);
    setLoading(true);
    try {
      await api('demo/logout', 'POST', {});
      persistVisitor(null, false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      loginPending.current = false;
      setLoading(false);
      setBusy(false);
    }
  };
  const completeOnboarding = () => persistVisitor(visitor ?? '', true);

  const clearHistory = () => {
    setHistory([]);
    writeHistory([]);
  };

  const setMemoryConsent = async (v: boolean) => {
    const epoch = turnEpoch.current;
    try {
      await api('privacy/consent', 'PUT', { enabled: v, language });
      if (epoch !== turnEpoch.current) return;
      setSession((s) => (s ? { ...s, memoryConsent: v } : s));
    } catch (e) {
      if (epoch === turnEpoch.current) setError((e as Error).message);
    }
  };

  const handsFree = useHandsFree({
    enabled:
      visitor !== null &&
      onboarded &&
      pathname === '/' &&
      !loading &&
      !!session &&
      caps.voice &&
      welcomeReady,
    paused: busy || speech.status !== 'idle',
    language,
    onTranscript: (text, detected) => ask(text, 'voice', detected),
  });
  useEffect(() => {
    stopListening.current = handsFree.stop;
  }, [handsFree.stop]);

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
        busy: busy || handsFree.phase === 'transcribing',
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
        handsFree,
        speech,
        speakReply: (message) => {
          if (!conversationId || message.language !== language) return;
          cancelRecording();
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

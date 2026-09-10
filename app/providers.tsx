'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { copy } from '@/lib/i18n';
import type {
  Scheme,
  Profile,
  Decision,
  Language,
  ApplicationRecord,
} from '@/lib/types';

export type Session = {
  profile: Profile;
  confirmed: string[];
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
  draft: Profile;
  confirmed: boolean;
  chat: string;
  detail: Scheme | null;
  profileOpen: boolean;
  setError: (s: string) => void;
  setNotice: (s: string) => void;
  setDraft: (p: Profile) => void;
  setConfirmed: (b: boolean) => void;
  setDetail: (s: Scheme | null) => void;
  setProfileOpen: (b: boolean) => void;
  openProfile: () => void;
  load: () => Promise<void>;
  selectLanguage: (l: Language) => Promise<void>;
  confirmProfile: () => Promise<void>;
  ask: (message: string) => Promise<void>;
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
  const [draft, setDraft] = useState<Profile>({});
  const [confirmed, setConfirmed] = useState(false);
  const [chat, setChat] = useState('');
  const [detail, setDetail] = useState<Scheme | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
      setDraft(s.profile);
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

  const openProfile = () => {
    setDraft(session?.profile || {});
    setConfirmed(false);
    setProfileOpen(true);
  };

  const confirmProfile = async () => {
    if (!confirmed || !session) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{
        profile: Profile;
        confirmed: string[];
        profileVersion: number;
      }>('profile/confirm', 'PUT', {
        profile: draft,
        version: session.profileVersion,
        confirmed: true,
      });
      setSession({ ...session, ...r });
      await refreshDecisions();
      setProfileOpen(false);
      setNotice(t.profileReady);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ask = async (message: string) => {
    if (!message.trim()) return;
    const entries = [
      { at: Date.now(), text: message.trim() },
      ...history.filter((h) => h.text !== message.trim()),
    ].slice(0, 30);
    setHistory(entries);
    writeHistory(entries);
    setBusy(true);
    setError('');
    try {
      const r = await api<{ message: string; proposedProfile: Profile }>(
        'chat',
        'POST',
        { message },
      );
      setChat(r.message);
      setDraft({ ...session?.profile, ...r.proposedProfile });
      setConfirmed(false);
      setProfileOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveScheme = async (s: Scheme) => {
    setBusy(true);
    try {
      await api('applications', 'POST', { schemeId: s.id });
      await refreshApps();
      setNotice(t.saved);
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
      setDraft({});
      setChat('');
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
          setChat(t.transcript);
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
        draft,
        confirmed,
        chat,
        detail,
        profileOpen,
        setError,
        setNotice,
        setDraft,
        setConfirmed,
        setDetail,
        setProfileOpen,
        openProfile,
        load,
        selectLanguage,
        confirmProfile,
        ask,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Search,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  Sprout,
  HeartHandshake,
  Landmark,
  GraduationCap,
  House,
  BriefcaseBusiness,
  Accessibility,
  Utensils,
  HeartPulse,
  MessageCircle,
  Mic,
  Square,
  Check,
  CheckCircle2,
  Info,
  Bookmark,
  FileCheck2,
  UserRound,
  LockKeyhole,
  Globe,
  Volume2,
  Printer,
  Trash2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { copy, categoryText, statusNames } from '@/lib/i18n';
import { fields } from '@/lib/rules';
import type {
  Scheme,
  Profile,
  Decision,
  Language,
  ApplicationRecord,
} from '@/lib/types';
type Session = {
  profile: Profile;
  confirmed: string[];
  profileVersion: number;
  language: Language;
  memoryConsent: boolean;
};
type Capabilities = {
  ai: boolean;
  voice: boolean;
  memory: boolean;
  retrieval: boolean;
};
const icons: Record<string, typeof Sprout> = {
  Agriculture: Sprout,
  Health: HeartPulse,
  'Women & family': HeartHandshake,
  'Finance & pension': Landmark,
  'Housing & utilities': House,
  'Jobs & skills': BriefcaseBusiness,
  Business: BriefcaseBusiness,
  Education: GraduationCap,
  'Disability support': Accessibility,
  'Food & essentials': Utensils,
};
const steps = [
  'Interested',
  'Preparing documents',
  'Submitted',
  'Under review',
  'Action required',
  'Approved',
  'Closed',
];
async function api<T = Record<string, unknown>>(
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
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value || '__unknown'}
      onValueChange={(v) => onChange(v === '__unknown' ? '' : String(v || ''))}
    >
      <SelectTrigger className="pick" aria-label={label}>
        <SelectValue>
          {options.find((x) => x.value === (value || '__unknown'))?.label ||
            value ||
            label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Home() {
  const [language, setLanguage] = useState<Language>('en'),
    [tab, setTab] = useState('explore'),
    [schemes, setSchemes] = useState<Scheme[]>([]),
    [session, setSession] = useState<Session | null>(null),
    [caps, setCaps] = useState<Capabilities>({
      ai: false,
      voice: false,
      memory: false,
      retrieval: false,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All schemes'),
    [draft, setDraft] = useState<Profile>({}),
    [confirmed, setConfirmed] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [detail, setDetail] = useState<Scheme | null>(null),
    [decisions, setDecisions] = useState<Record<string, Decision>>({}),
    [applications, setApplications] = useState<ApplicationRecord[]>([]),
    [editing, setEditing] = useState<ApplicationRecord | null>(null),
    [message, setMessage] = useState(''),
    [chat, setChat] = useState(''),
    [deleting, setDeleting] = useState(false),
    [feedbackText, setFeedbackText] = useState(''),
    [rating, setRating] = useState('5'),
    [recording, setRecording] = useState(false);
  const t = copy[language],
    li = language === 'en' ? 0 : language === 'hi' ? 1 : 2;
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    initialized = useRef(false);
  const refreshApps = useCallback(async () => {
    const r = await api<{ applications: ApplicationRecord[] }>('applications');
    setApplications(r.applications);
  }, []);
  const refreshDecisions = useCallback(async () => {
    const r = await api<{ results: { scheme: Scheme; decision: Decision }[] }>(
      'recommendations',
    );
    setDecisions(
      Object.fromEntries(
        r.results.map((x: { scheme: Scheme; decision: Decision }) => [
          x.scheme.id,
          x.decision,
        ]),
      ),
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
    if (!initialized.current) {
      initialized.current = true;
      void load();
    }
    return () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
    };
  }, [load]);
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
    if (session) {
      try {
        await api('privacy/consent', 'PUT', {
          enabled: session.memoryConsent,
          language: l,
        });
        setSession({ ...session, language: l });
      } catch (e) {
        setError((e as Error).message);
      }
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
      const r = await api<
        Pick<Session, 'profile' | 'confirmed' | 'profileVersion'>
      >('profile/confirm', 'PUT', {
        profile: draft,
        version: session.profileVersion,
        confirmed: true,
      });
      setSession({ ...session, ...r });
      await refreshDecisions();
      setProfileOpen(false);
      setTab('explore');
      setNotice(t.profileReady);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ask = async () => {
    if (!message.trim()) return;
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
  const saveApplication = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api('applications/' + editing.id, 'PATCH', editing);
      await refreshApps();
      setEditing(null);
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
      setEditing(null);
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
      setMessage('');
      setChat('');
      setSession(null);
      setDeleting(false);
      const s = await api<Session>('sessions', 'POST', { language });
      setSession(s);
      setNotice(t.deleted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sendFeedback = async () => {
    setBusy(true);
    try {
      await api('feedback', 'POST', { rating: +rating, comment: feedbackText });
      setFeedbackText('');
      setNotice(t.feedbackSaved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const speak = async (s: Scheme) => {
    if (!caps.voice) {
      setNotice(t.listenOff);
      return;
    }
    setBusy(true);
    try {
      audio.current?.pause();
      const r = await fetch('/api/v1/voice/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'SchemeSathi',
        },
        body: JSON.stringify({ schemeId: s.id }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error: string }).error);
      const url = URL.createObjectURL(await r.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const record = async () => {
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
        media.getTracks().forEach((t) => t.stop());
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
          setMessage(b.text);
          setChat(t.transcript);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      };
      mr.start();
      setRecording(true);
      setTimeout(() => {
        if (mr.state === 'recording') mr.stop();
      }, 20000);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool(
        {
          name: 'search_schemes',
          description:
            'Search the visible official-reference catalogue by name or category. Does not confirm a profile or decide eligibility.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string', maxLength: 100 } },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input: unknown) => {
            const q = (input as { query?: unknown })?.query;
            if (typeof q !== 'string' || q.length > 100)
              throw new Error('A query under 100 characters is required');
            setQuery(q);
            setTab('explore');
            return {
              matching: schemes
                .filter((s) =>
                  (s.name + ' ' + s.category)
                    .toLowerCase()
                    .includes(q.toLowerCase()),
                )
                .map((s) => ({ id: s.id, name: s.name, source: s.source })),
            };
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {}
    return () => lifecycle.abort();
  }, [schemes]);
  const filtered = schemes.filter(
    (s) =>
      (category === 'All schemes' || s.category === category) &&
      (
        s.name +
        ' ' +
        s.shortName +
        ' ' +
        s.summary +
        ' ' +
        s.category +
        ' ' +
        categoryText(s.category, language)
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const decision = detail ? decisions[detail.id] : null;
  const totalConfirmed = session?.confirmed.length || 0;
  const fieldForm = (
    <>
      <div className="form-grid">
        {fields.map((f) => (
          <label className="field" key={f.key}>
            <span>{t[f.key as keyof typeof t] || f.key}</span>
            {f.type === 'number' ? (
              <input
                type="number"
                min="0"
                max={f.max}
                step={f.key === 'age' ? '1' : 'any'}
                value={String(draft[f.key] ?? '')}
                placeholder={t.unknown}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    [f.key]: e.target.value === '' ? null : +e.target.value,
                  });
                  setConfirmed(false);
                }}
              />
            ) : (
              <Pick
                value={String(draft[f.key] ?? '')}
                label={String(t[f.key as keyof typeof t] || f.key)}
                onChange={(v) => {
                  setDraft({ ...draft, [f.key]: v || null });
                  setConfirmed(false);
                }}
                options={[
                  { value: '__unknown', label: t.unknown },
                  ...(f.values || []).map((v) => ({
                    value: v,
                    label:
                      v === 'yes'
                        ? t.yes
                        : v === 'no'
                          ? t.no
                          : v.replaceAll('_', ' '),
                  })),
                ]}
              />
            )}
          </label>
        ))}
      </div>
      <label className="check-line">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(!!v)}
        />
        <span>{t.consent}</span>
      </label>
      <button
        className="primary"
        disabled={!confirmed || busy}
        onClick={confirmProfile}
      >
        {busy ? (
          <Loader2 className="spin" size={18} />
        ) : (
          <ShieldCheck size={18} />
        )}{' '}
        {t.confirm}
      </button>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Compass />
          </span>
          <span>
            Scheme Sathi<small>{t.companion}</small>
          </span>
        </Link>
        <div className="header-right">
          <span className="privacy-pill">
            <ShieldCheck size={17} />
            {t.private}
          </span>
          <div className="language-control">
            <Globe size={17} />
            <Pick
              value={language}
              label="Language / भाषा / ಭಾಷೆ"
              onChange={(v) => void selectLanguage(v as Language)}
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'हिन्दी' },
                { value: 'kn', label: 'ಕನ್ನಡ' },
              ]}
            />
          </div>
        </div>
      </header>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="nav-wrap">
          <TabsList variant="line" className="main-nav">
            <TabsTrigger value="explore">
              <Compass />
              {t.explore}
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              onClick={() => {
                setDraft(session?.profile || {});
                setConfirmed(false);
              }}
            >
              <UserRound />
              {t.profile}
            </TabsTrigger>
            <TabsTrigger value="tracker">
              <Bookmark />
              {t.tracker}
              <span className="count">{applications.length}</span>
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <LockKeyhole />
              {t.privacy}
            </TabsTrigger>
          </TabsList>
        </div>
        <main className="workspace" id="main">
          {notice && (
            <output className="toast">
              <CheckCircle2 size={19} />
              {notice}
              <button onClick={() => setNotice('')} aria-label={t.close}>
                ×
              </button>
            </output>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <Info size={20} />
              <span>{error}</span>
              <button
                onClick={() => {
                  setError('');
                  void load();
                }}
              >
                <RefreshCw size={16} /> {t.retry}
              </button>
            </div>
          )}
          {language !== 'en' && (
            <div className="language-note">
              <Globe size={16} />
              {t.sourceEnglish}
            </div>
          )}
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" />
              {t.loading}
            </div>
          ) : (
            <>
              <TabsContent value="explore">
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">CENTRAL GOVERNMENT BENEFITS</div>
                    <h1>{t.title}</h1>
                    <p className="intro">{t.subtitle}</p>
                  </div>
                  <span className="reference-count">
                    <span>{schemes.length}</span>
                    {t.references}
                  </span>
                </div>
                <div className="explore-layout">
                  <aside className="assistant-column">
                    <section className="assistant-card">
                      <div className="assistant-avatar">
                        <MessageCircle size={25} />
                        <span />
                      </div>
                      <h2>{t.ask}</h2>
                      <p>{t.askIntro}</p>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t.prompt}
                        maxLength={1800}
                        aria-label={t.ask}
                      />
                      <div className="composer-actions">
                        <button
                          className={'mic ' + (recording ? 'recording' : '')}
                          aria-label={recording ? t.stop : t.record}
                          title={recording ? t.stop : t.record}
                          onClick={record}
                        >
                          {recording ? <Square size={19} /> : <Mic size={19} />}
                        </button>
                        <span>{recording ? t.stop : 'EN · HI · KN'}</span>
                        <button
                          className="send"
                          onClick={ask}
                          disabled={busy || !message.trim()}
                          aria-label={t.send}
                        >
                          {busy ? (
                            <Loader2 className="spin" size={18} />
                          ) : (
                            <ArrowRight size={21} />
                          )}
                        </button>
                      </div>
                      {chat && <output className="chat-reply">{chat}</output>}
                      <button className="text-button" onClick={openProfile}>
                        {t.or}
                        <ChevronRight size={17} />
                      </button>
                      <div className="privacy-micro">
                        <LockKeyhole size={14} />
                        {t.private} · 60 min
                      </div>
                    </section>
                    <section className="profile-summary">
                      <span className="round-icon">
                        <UserRound size={20} />
                      </span>
                      <h3>
                        {totalConfirmed ? t.profileReady : t.profileEmpty}
                      </h3>
                      <p>
                        {totalConfirmed
                          ? totalConfirmed + ' ' + t.complete
                          : t.profileEmptyText}
                      </p>
                      {totalConfirmed > 0 && (
                        <div className="profile-chips">
                          {session?.confirmed.slice(0, 4).map((k) => (
                            <span key={k}>
                              {k === 'age'
                                ? session.profile[k] + ' yrs'
                                : String(session.profile[k]).replaceAll(
                                    '_',
                                    ' ',
                                  )}
                            </span>
                          ))}
                        </div>
                      )}
                      <button className="outline-button" onClick={openProfile}>
                        {t.edit}
                        <ArrowRight size={16} />
                      </button>
                    </section>
                    <div className="next-step">
                      <ShieldCheck size={22} />
                      <div>
                        <strong>{t.next}</strong>
                        <p>{t.nextText}</p>
                      </div>
                    </div>
                  </aside>
                  <section className="catalogue">
                    <div className="searchbar">
                      <Search size={20} />
                      <input
                        aria-label={t.search}
                        placeholder={t.search}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          onClick={() => setQuery('')}
                          aria-label={t.clear}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="filter-row">
                      {[
                        'All schemes',
                        ...new Set(schemes.map((s) => s.category)),
                      ].map((c) => (
                        <button
                          key={c}
                          className={category === c ? 'active' : ''}
                          onClick={() => setCategory(c)}
                        >
                          {categoryText(c, language)}
                        </button>
                      ))}
                    </div>
                    <div className="results-heading">
                      <h2>{session?.profileVersion ? t.results : t.explore}</h2>
                      <span>
                        {filtered.length} {t.references}
                      </span>
                    </div>
                    <div className="review-notice">
                      <Info size={17} />
                      <p>{t.reviewInfo}</p>
                    </div>
                    <div className="catalogue-grid">
                      {filtered.map((s) => {
                        const Icon = icons[s.category] || Landmark;
                        const d = decisions[s.id];
                        return (
                          <article key={s.id} className="scheme-card">
                            <div className="card-top">
                              <span
                                className={
                                  'scheme-icon icon-' +
                                  s.category.split(' ')[0].toLowerCase()
                                }
                              >
                                <Icon size={24} />
                              </span>
                              <button
                                className={
                                  'bookmark ' +
                                  (applications.some((a) => a.schemeId === s.id)
                                    ? 'bookmarked'
                                    : '')
                                }
                                aria-label={t.save + ' ' + s.name}
                                onClick={() => saveScheme(s)}
                                disabled={busy}
                              >
                                <Bookmark size={20} />
                              </button>
                            </div>
                            <span className="category">
                              {categoryText(s.category, language)}
                            </span>
                            <h2>{s.shortName}</h2>
                            <p>{s.summary}</p>
                            <div
                              className={
                                'eligibility-badge ' +
                                (d?.status || 'UNABLE_TO_DETERMINE')
                              }
                            >
                              <span />
                              {d ? statusNames[d.status][li] : t.review}
                            </div>
                            <button
                              className="card-action"
                              onClick={() => setDetail(s)}
                            >
                              {t.details}
                              <ArrowRight size={18} />
                            </button>
                          </article>
                        );
                      })}
                    </div>
                    {!filtered.length && (
                      <div className="empty-state">
                        <Search size={35} />
                        <h2>{t.empty}</h2>
                        <button
                          className="outline-button"
                          onClick={() => {
                            setQuery('');
                            setCategory('All schemes');
                          }}
                        >
                          {t.clear}
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              </TabsContent>
              <TabsContent value="profile">
                <div className="section-heading">
                  <span className="eyebrow">YOUR INFORMATION</span>
                  <h1>{t.profile}</h1>
                  <p>{t.confirmNote}</p>
                </div>
                <section className="panel profile-panel">{fieldForm}</section>
              </TabsContent>
              <TabsContent value="tracker">
                <div className="section-heading">
                  <span className="eyebrow">YOUR NEXT STEPS</span>
                  <h1>{t.tracker}</h1>
                  <p>{t.manual}</p>
                </div>
                {!applications.length ? (
                  <div className="empty-state panel">
                    <FileCheck2 size={45} />
                    <h2>{t.noApps}</h2>
                    <p>{t.noAppsText}</p>
                    <button
                      className="primary"
                      onClick={() => setTab('explore')}
                    >
                      {t.explore}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="tracker-grid">
                    {applications.map((a) => {
                      const s = schemes.find((s) => s.id === a.schemeId);
                      if (!s) return null;
                      const Icon = icons[s.category] || Landmark;
                      return (
                        <article className="tracker-card panel" key={a.id}>
                          <div className="card-top">
                            <span className="scheme-icon">
                              <Icon />
                            </span>
                            <span className="status-pill">{a.status}</span>
                          </div>
                          <h2>{s.shortName}</h2>
                          <p className="muted">
                            {categoryText(s.category, language)}
                          </p>
                          <div className="progress-label">
                            <span>{t.progress}</span>
                            <span>
                              {a.checklist.length}/{s.documents.length}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(
                              100,
                              (a.checklist.length / s.documents.length) * 100,
                            )}
                          />
                          <p className="reference-text">{a.reference || '—'}</p>
                          <div className="button-row">
                            <button
                              className="outline-button"
                              onClick={() => setEditing({ ...a })}
                            >
                              {t.update}
                              <ArrowRight size={16} />
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => setDetail(s)}
                              aria-label={t.details}
                            >
                              <Info size={19} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="privacy">
                <div className="section-heading">
                  <span className="eyebrow">YOU ARE IN CONTROL</span>
                  <h1>{t.privacy}</h1>
                  <p>{t.profileEmptyText}</p>
                </div>
                <div className="settings-grid">
                  <section className="panel">
                    <LockKeyhole className="teal" />
                    <h2>{t.private}</h2>
                    <label className="check-line">
                      <Checkbox
                        checked={session?.memoryConsent || false}
                        onCheckedChange={async (v) => {
                          try {
                            await api('privacy/consent', 'PUT', {
                              enabled: !!v,
                              language,
                            });
                            setSession((s) =>
                              s ? { ...s, memoryConsent: !!v } : s,
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      />
                      <strong>{t.memory}</strong>
                    </label>
                    <p className="muted">{t.memoryNote}</p>
                    <button
                      className="danger-button"
                      onClick={() => setDeleting(true)}
                    >
                      <Trash2 size={17} />
                      {t.forget}
                    </button>
                  </section>
                  <section className="panel">
                    <ShieldCheck className="teal" />
                    <h2>{t.connection}</h2>
                    <div className="service-row">
                      <span>{t.ai}</span>
                      <span className={caps.ai ? 'connected' : 'not-connected'}>
                        {caps.ai ? t.on : t.off}
                      </span>
                    </div>
                    <p className="muted">{t.formMode}</p>
                    <div className="service-row">
                      <span>{t.voice}</span>
                      <span
                        className={caps.voice ? 'connected' : 'not-connected'}
                      >
                        {caps.voice ? t.on : t.off}
                      </span>
                    </div>
                    <p className="muted">{t.reviewInfo}</p>
                  </section>
                  <section className="panel feedback-panel">
                    <MessageCircle className="teal" />
                    <h2>{t.feedback}</h2>
                    <p className="muted">{t.feedbackNote}</p>
                    <label className="field">
                      <span>{t.rating}</span>
                      <Pick
                        value={rating}
                        onChange={setRating}
                        label={t.rating}
                        options={['5', '4', '3', '2', '1'].map((v) => ({
                          value: v,
                          label: v + ' / 5',
                        }))}
                      />
                    </label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      maxLength={600}
                      aria-label={t.feedback}
                      placeholder={t.feedbackNote}
                    />
                    <button
                      className="primary"
                      onClick={sendFeedback}
                      disabled={busy || !feedbackText.trim()}
                    >
                      <Send size={17} />
                      {t.submit}
                    </button>
                  </section>
                </div>
              </TabsContent>
            </>
          )}
          <footer className="site-footer">
            <span>
              <ShieldCheck size={17} />
              {t.disclaimer}
            </span>
            <span>Scheme Sathi · 2026</span>
          </footer>
        </main>
      </Tabs>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{t.profile}</DialogTitle>
            <DialogDescription>{t.confirmNote}</DialogDescription>
          </DialogHeader>
          {fieldForm}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="wide-dialog detail-dialog print-area">
          {detail && (
            <>
              <DialogHeader>
                <span className="category">
                  {categoryText(detail.category, language)}
                </span>
                <DialogTitle>{detail.name}</DialogTitle>
                <DialogDescription>{detail.ministry}</DialogDescription>
              </DialogHeader>
              <div className="detail-status">
                <Info size={21} />
                <div>
                  <strong>
                    {statusNames[decision?.status || 'UNABLE_TO_DETERMINE'][li]}
                  </strong>
                  <p>{t.reviewInfo}</p>
                </div>
              </div>
              <section>
                <h3>{t.benefit}</h3>
                <p>{detail.benefit}</p>
              </section>
              <section>
                <h3>{t.reason}</h3>
                <p className="muted">{t.draft}</p>
                {decision?.reasons.length ? (
                  decision.reasons.map((r) => (
                    <div className="rule-row" key={r.id}>
                      <span className={'rule-symbol ' + r.result}>
                        {r.result === 'PASS' ? (
                          <Check size={16} />
                        ) : r.result === 'FAIL' ? (
                          '×'
                        ) : (
                          '?'
                        )}
                      </span>
                      <span>{r.label}</span>
                      <a
                        href={r.source}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.source}
                      >
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="muted">{t.review}</p>
                )}
              </section>
              <section>
                <h3>{t.documents}</h3>
                <ul className="document-list">
                  {detail.documents.map((d, i) => (
                    <li key={i}>
                      <FileCheck2 size={17} />
                      {d}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>{t.steps}</h3>
                <ol className="step-list">
                  {detail.steps.map((s, i) => (
                    <li key={i}>
                      <span>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </section>
              <div className="source-box">
                <ShieldCheck size={20} />
                <div>
                  <a href={detail.source} target="_blank" rel="noreferrer">
                    {t.source}
                    <ArrowUpRight size={17} />
                  </a>
                  <small>{new URL(detail.source).hostname}</small>
                  <small>
                    {detail.sourceCheckedAt
                      ? t.sourceDate +
                        ': ' +
                        detail.sourceCheckedAt.slice(0, 10)
                      : t.notChecked}
                  </small>
                </div>
              </div>
              <div className="button-row no-print">
                <button
                  className="primary"
                  onClick={() => saveScheme(detail)}
                  disabled={busy}
                >
                  <Bookmark size={17} />
                  {t.save}
                </button>
                <button
                  className="outline-button"
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                  {t.print}
                </button>
                <button
                  className="icon-button"
                  onClick={() => speak(detail)}
                  aria-label={t.listen}
                >
                  <Volume2 size={20} />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="wide-dialog">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {schemes.find((s) => s.id === editing.schemeId)?.shortName}
                </DialogTitle>
                <DialogDescription>{t.manual}</DialogDescription>
              </DialogHeader>
              <label className="field">
                <span>{t.status}</span>
                <Pick
                  value={editing.status}
                  onChange={(v) => setEditing({ ...editing, status: v })}
                  label={t.status}
                  options={steps.map((v) => ({ value: v, label: v }))}
                />
              </label>
              <label className="field">
                <span>{t.reference}</span>
                <input
                  maxLength={4}
                  value={editing.reference.replace('•••• ', '')}
                  onChange={(e) =>
                    setEditing({ ...editing, reference: e.target.value })
                  }
                />
              </label>
              <div>
                <h3>{t.documents}</h3>
                {schemes
                  .find((s) => s.id === editing.schemeId)
                  ?.documents.map((d) => (
                    <label className="check-line" key={d}>
                      <Checkbox
                        checked={editing.checklist.includes(d)}
                        onCheckedChange={(v) =>
                          setEditing({
                            ...editing,
                            checklist: v
                              ? [...editing.checklist, d]
                              : editing.checklist.filter((x) => x !== d),
                          })
                        }
                      />
                      <span>{d}</span>
                    </label>
                  ))}
              </div>
              <label className="field">
                <span>{t.notes}</span>
                <textarea
                  value={editing.notes}
                  maxLength={600}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                />
              </label>
              <div className="button-row">
                <button
                  className="primary"
                  onClick={saveApplication}
                  disabled={busy}
                >
                  {t.update}
                </button>
                <button
                  className="danger-button"
                  onClick={() => removeApplication(editing.id)}
                >
                  <Trash2 size={16} />
                  {t.remove}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.forgetTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.forgetNote}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={forget} disabled={busy}>
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

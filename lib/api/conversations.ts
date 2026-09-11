import { body, db, HttpError, json, limit } from '../http';
import { planTurn } from '../agent/turn';
import { detectFocus, isDecline } from '../agent/focus.ts';
import { extract } from './chat';
import { retrieve } from '../retrieval';
import { fields, redact, validateProfile } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';
import { languageStatements } from '../voice-preference';
import type { Profile, Provenance } from '../types';
import {
  isLanguage,
  languageCommand,
  sessionLanguage,
  voiceCopy,
} from '../languages';

type Row = Record<string, unknown>;

const shape = (c: Row) => ({
  id: c.id as string,
  title: c.title as string,
  checkpoint: c.checkpoint as string,
  focusSchemeId: (c.focus_scheme_id as string) || null,
  questionsAsked: c.questions_asked as number,
  updatedAt: c.updated_at as string,
});

const message = (m: Row) => ({
  id: m.id as string,
  role: m.role as 'user' | 'assistant',
  text: m.text as string,
  inputMode: m.input_mode as 'text' | 'voice',
  language: m.language as string | undefined,
  blocks: JSON.parse(m.blocks as string),
  createdAt: m.created_at as string,
});

async function owned(id: string, owner: string) {
  const c = await db()
    .prepare('SELECT * FROM conversations WHERE id=? AND owner=?')
    .bind(id, owner)
    .first<Row>();
  if (!c) throw new HttpError(404, 'Conversation not found.');
  return c;
}

export const conversations: SessionRoute = async ({
  req,
  p,
  path,
  method,
  s,
  trace,
}) => {
  if (p === 'conversations' && method === 'POST') {
    await limit('conv:' + s.id, 10);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db()
      .prepare(
        'INSERT INTO conversations(id,owner,language,created_at,updated_at) VALUES(?,?,?,?,?)',
      )
      .bind(id, s.id, s.language, now, now)
      .run();
    return json(
      {
        id,
        title: '',
        checkpoint: 'GATHERING',
        focusSchemeId: null,
        questionsAsked: 0,
        updatedAt: now,
      },
      201,
    );
  }

  if (p === 'conversations' && method === 'GET') {
    const r = await db()
      .prepare(
        'SELECT * FROM conversations WHERE owner=? ORDER BY updated_at DESC LIMIT 30',
      )
      .bind(s.id)
      .all<Row>();
    return json({ conversations: r.results.map(shape) });
  }

  if (p.startsWith('conversations/') && path[2] === 'messages') {
    const conversation = await owned(path[1], s.id);

    if (method === 'GET') {
      const r = await db()
        .prepare(
          'SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC, rowid ASC',
        )
        .bind(conversation.id)
        .all<Row>();
      return json({
        conversation: shape(conversation),
        messages: r.results.map(message),
      });
    }

    if (method === 'POST') {
      await limit('turn:' + s.id, 30);
      const b = await body(req);
      if (
        typeof b.message !== 'string' ||
        b.message.length > 1800 ||
        !b.message.trim()
      )
        throw new HttpError(
          400,
          'Please enter a message of up to 1,800 characters.',
        );
      const inputMode = b.inputMode === 'voice' ? 'voice' : 'text';
      const text = redact(b.message.trim());
      const now = new Date().toISOString();
      const selected = !!s.language_selected || s.language !== 'en';
      const initial =
        !selected && inputMode === 'voice' && isLanguage(b.language)
          ? b.language
          : s.language;
      s.language = sessionLanguage(text, initial, selected);
      await db().batch([
        ...languageStatements(s, s.language),
        db()
          .prepare('UPDATE conversations SET language=? WHERE id=?')
          .bind(s.language, conversation.id),
      ]);

      // A language instruction is not a profile answer and must not consume
      // the question budget or turn "Tamil" into an occupation/location.
      if (languageCommand(text)) {
        const userMessage = {
          id: crypto.randomUUID(),
          role: 'user' as const,
          text,
          inputMode,
          language: s.language,
          blocks: [],
          createdAt: now,
        };
        const assistant = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          text: voiceCopy[s.language].selected,
          inputMode: 'text' as const,
          language: s.language,
          blocks: [],
          createdAt: now,
        };
        await db().batch(
          [userMessage, assistant].map((m) =>
            db()
              .prepare(
                'INSERT INTO messages(id,conversation_id,role,text,input_mode,language,blocks,created_at) VALUES(?,?,?,?,?,?,?,?)',
              )
              .bind(
                m.id,
                conversation.id,
                m.role,
                m.text,
                m.inputMode,
                s.language,
                '[]',
                now,
              ),
          ),
        );
        return json(
          {
            userMessage,
            message: assistant,
            checkpoint: conversation.checkpoint,
            profileVersion: s.version,
            language: s.language,
            traceId: trace,
          },
          201,
        );
      }

      const userMessage = {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        role: 'user' as const,
        text,
        inputMode,
        language: s.language,
        blocks: [],
        createdAt: now,
      };
      await db()
        .prepare(
          'INSERT INTO messages(id,conversation_id,role,text,input_mode,language,blocks,created_at) VALUES(?,?,?,?,?,?,?,?)',
        )
        .bind(
          userMessage.id,
          conversation.id,
          'user',
          text,
          inputMode,
          s.language,
          '[]',
          now,
        )
        .run();

      const turn = (conversation.turns as number) + 1;
      const offered = conversation.checkpoint === 'SAVE_OFFERED';
      const declining = offered && isDecline(text);

      // "No thanks" answers the save offer, not the profile. Reading it as a
      // field value would record a refusal as a fact about the citizen.
      const askedField = declining
        ? ''
        : (conversation.asked_field as string) || '';
      const profile = JSON.parse(s.profile) as Profile;
      const provenance = JSON.parse(s.provenance) as Record<string, Provenance>;
      const changed: { field: string; provenance: Provenance }[] = [];
      let merged: Profile = { ...profile };

      const answered = askedField ? coerce(askedField, text) : null;
      if (answered !== null) {
        merged = validateProfile({ ...merged, [askedField]: answered });
        provenance[askedField] = 'answered';
        changed.push({ field: askedField, provenance: 'answered' });
      } else {
        const found = await extract(text, s.language);
        for (const [field, value] of Object.entries(found.profile)) {
          if (value === null || provenance[field] === 'answered') continue;
          // One unusable value must not fail the whole turn — the citizen
          // said something, and the agent should reply, not error.
          try {
            merged = validateProfile({ ...merged, [field]: value });
            provenance[field] = 'inferred';
            changed.push({ field, provenance: 'inferred' });
          } catch {
            continue;
          }
        }
      }

      const confirmed = Object.keys(merged).filter(
        (k) =>
          merged[k] !== null && provenance[k] && provenance[k] !== 'inferred',
      );

      const live = await schemes();
      const saved = await db()
        .prepare('SELECT scheme_id FROM applications WHERE owner=?')
        .bind(s.id)
        .all<{ scheme_id: string }>();

      // Retrieve against the opening description plus this message. A bare
      // answer like "44" matches nothing on its own, and the citizen should
      // not lose the thread of what they came in saying.
      const query = [conversation.title as string, text]
        .filter(Boolean)
        .join(' ');
      const candidates = retrieve(query, live).map((c) => c.schemeId);

      const previous = await db()
        .prepare(
          "SELECT blocks FROM messages WHERE conversation_id=? AND role='assistant' ORDER BY created_at DESC, rowid DESC LIMIT 1",
        )
        .bind(conversation.id)
        .first<{ blocks: string }>();
      const lastPresented = (
        JSON.parse(previous?.blocks || '[]') as {
          kind: string;
          schemeId?: string;
        }[]
      )
        .filter((b) => b.kind === 'scheme_card' && b.schemeId)
        .map((b) => b.schemeId as string);

      const focus = declining
        ? null
        : detectFocus({
            schemes: live,
            lastPresented,
            previousFocus: (conversation.focus_scheme_id as string) || null,
            text,
          });

      const plan = planTurn({
        schemes: live,
        candidates,
        focus,
        declinedSchemeId: declining
          ? (conversation.focus_scheme_id as string) || null
          : (conversation.declined_scheme_id as string) || null,
        declinedAtTurn: declining
          ? turn
          : (conversation.declined_at_turn as number),
        turn,
        profile: merged,
        confirmed,
        changed,
        savedSchemeIds: saved.results.map((r) => r.scheme_id),
        unreadAnswer: !!askedField && answered === null,
        questionsAsked: conversation.questions_asked as number,
        language: s.language,
      });

      const assistant = {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        role: 'assistant' as const,
        text: plan.text,
        inputMode: 'text' as const,
        language: s.language,
        blocks: plan.blocks,
        createdAt: new Date().toISOString(),
      };

      await db().batch([
        db()
          .prepare(
            'INSERT INTO messages(id,conversation_id,role,text,input_mode,language,blocks,created_at) VALUES(?,?,?,?,?,?,?,?)',
          )
          .bind(
            assistant.id,
            conversation.id,
            'assistant',
            plan.text,
            'text',
            s.language,
            JSON.stringify(plan.blocks),
            assistant.createdAt,
          ),
        db()
          .prepare(
            "UPDATE conversations SET checkpoint=?,questions_asked=?,asked_field=?,focus_scheme_id=?,turns=?,declined_scheme_id=?,declined_at_turn=?,title=CASE WHEN title='' THEN ? ELSE title END,updated_at=? WHERE id=?",
          )
          .bind(
            plan.checkpoint,
            plan.questionsAsked,
            plan.askedField || '',
            plan.offeredSchemeId ?? focus,
            turn,
            declining
              ? (conversation.focus_scheme_id as string) || null
              : (conversation.declined_scheme_id as string) || null,
            declining ? turn : (conversation.declined_at_turn as number),
            text.slice(0, 60),
            assistant.createdAt,
            conversation.id,
          ),
        db()
          .prepare(
            'UPDATE sessions SET profile=?,confirmed=?,provenance=?,version=version+1 WHERE id=?',
          )
          .bind(
            JSON.stringify(merged),
            JSON.stringify(confirmed),
            JSON.stringify(provenance),
            s.id,
          ),
      ]);

      return json(
        {
          userMessage,
          message: assistant,
          checkpoint: plan.checkpoint,
          profileVersion: s.version + 1,
          traceId: trace,
          language: s.language,
        },
        201,
      );
    }
  }

  if (p.startsWith('conversations/') && !path[2] && method === 'DELETE') {
    await owned(path[1], s.id);
    await db()
      .prepare('DELETE FROM conversations WHERE id=? AND owner=?')
      .bind(path[1], s.id)
      .run();
    return json({ deleted: true });
  }

  return null;
};

/**
 * Reads a direct answer to the field we asked about. Returns null when the
 * reply is not a usable value, so the turn falls back to extraction and the
 * agent can ask again rather than recording a guess as a statement.
 */
function coerce(field: string, text: string): string | number | null {
  const spec = fields.find((f) => f.key === field);
  if (!spec) return null;
  const value = text.trim().toLowerCase();

  if (spec.type === 'number') {
    const digits = value
      .replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - 2406))
      .replace(/[೦-೯]/g, (c) => String(c.charCodeAt(0) - 3302))
      .replace(/[௦-௯]/g, (c) => String(c.charCodeAt(0) - 3046))
      .replace(/[൦-൯]/g, (c) => String(c.charCodeAt(0) - 3430))
      .match(/\d+(?:\.\d+)?/);
    if (!digits) return null;
    return ok(field, Number(digits[0]));
  }

  const exact = (spec.values || []).find((v) => v === value);
  if (exact) return exact;
  if (
    /^(yes|y|haan|हाँ|हां|ಹೌದು|ஆம்|ஆமாம்|അതെ)$/i.test(value) &&
    spec.values?.includes('yes')
  )
    return 'yes';
  if (
    /^(no|n|nahi|नहीं|ಇಲ್ಲ|இல்லை|ഇല്ല)$/i.test(value) &&
    spec.values?.includes('no')
  )
    return 'no';
  return (
    (spec.values || []).find((v) => value.includes(v.replace('_', ' '))) ?? null
  );
}

/** Lets the profile validator be the single judge of what a field accepts. */
function ok(field: string, value: string | number) {
  try {
    validateProfile({ [field]: value });
    return value;
  } catch {
    return null;
  }
}

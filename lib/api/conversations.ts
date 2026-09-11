import { body, db, HttpError, json, limit } from '../http';
import type { SessionCtx } from '../session';
import { planTurn } from '../agent/turn';
import { detectFocus, isDecline, wantsEverything } from '../agent/focus.ts';
import { runAgent } from '../agent/loop';
import { validateProse } from '../agent/validate.ts';
import { extract } from './chat';
import { retrieve } from '../retrieval';
import { fields, redact, validateProfile } from '../rules';
import { schemes } from '../schemes';
import type { SessionRoute } from '../session';
import type { Profile, Provenance } from '../types';

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
      const conversation2 = conversation;
      // Streaming is opt-in by Accept header, so the JSON contract the API
      // tests and any non-streaming client rely on is untouched.
      const wantsStream = (req.headers.get('accept') || '').includes(
        'text/event-stream',
      );
      if (!wantsStream) {
        const payload = await runTurn({ req, s, trace } as SessionCtx, conversation2, () => {});
        return json(payload, 201);
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encode = new TextEncoder();
      const send = (event: string, data: unknown) =>
        writer.write(encode.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      void (async () => {
        try {
          const payload = await runTurn(
            { req, s, trace } as SessionCtx,
            conversation2,
            (stage) => void send('status', { stage }),
          );
          await send('user', payload.userMessage);
          // The text is revealed a few words at a time rather than streamed
          // from the model. Model tokens cannot be shown before validation,
          // and roughly one reply in three is currently rejected and replaced
          // by the deterministic sentence — text appearing and then vanishing
          // would be worse than text arriving a moment later. The wait this
          // removes is the tool round trips, which the status events cover.
          const words = payload.message.text.split(/(\s+)/);
          let sent = '';
          for (let i = 0; i < words.length; i += 3) {
            sent += words.slice(i, i + 3).join('');
            await send('delta', { text: sent });
          }
          await send('message', payload.message);
          await send('done', {
            checkpoint: payload.checkpoint,
            profileVersion: payload.profileVersion,
          });
        } catch (error) {
          await send('failed', {
            error:
              error instanceof HttpError
                ? error.message
                : 'The service is temporarily unavailable. Please try again.',
          });
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
        },
      });
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
      .match(/\d+(?:\.\d+)?/);
    if (!digits) return null;
    return ok(field, Number(digits[0]));
  }

  const exact = (spec.values || []).find((v) => v === value);
  if (exact) return exact;
  if (/^(yes|y|haan|हाँ|हां|ಹೌದು)$/i.test(value) && spec.values?.includes('yes'))
    return 'yes';
  if (/^(no|n|nahi|नहीं|ಇಲ್ಲ)$/i.test(value) && spec.values?.includes('no'))
    return 'no';
  return (spec.values || []).find((v) => value.includes(v.replace('_', ' '))) ?? null;
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

async function runTurn(
  { req, s, trace }: SessionCtx,
  conversation: Row,
  onStatus: (stage: string) => void,
) {
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

      const userMessage = {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        role: 'user' as const,
        text,
        inputMode,
        blocks: [],
        createdAt: now,
      };
      await db()
        .prepare(
          'INSERT INTO messages(id,conversation_id,role,text,input_mode,blocks,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          userMessage.id,
          conversation.id,
          'user',
          text,
          inputMode,
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
        onStatus('reading');
        const found = await extract(text, s.language);
        for (const [field, value] of Object.entries(found.profile)) {
          if (value === null) continue;
          // Never let a model's reading overwrite something the citizen
          // stated themselves. Downgrading an entered or answered field to
          // "inferred" drops it out of `confirmed`, which silently changes a
          // verdict — the citizen's own entry outranks an extraction.
          const held = provenance[field];
          if (held === 'answered' || held === 'entered') continue;
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
        (k) => merged[k] !== null && provenance[k] && provenance[k] !== 'inferred',
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
      onStatus('searching');
      const candidates = (await retrieve(query, live)).map((c) => c.schemeId);

      const previous = await db()
        .prepare(
          "SELECT blocks FROM messages WHERE conversation_id=? AND role='assistant' ORDER BY created_at DESC, rowid DESC LIMIT 1",
        )
        .bind(conversation.id)
        .first<{ blocks: string }>();
      const lastPresented = (
        JSON.parse(previous?.blocks || '[]') as { kind: string; schemeId?: string }[]
      )
        .filter((b) => b.kind === 'scheme_card' && b.schemeId)
        .map((b) => b.schemeId as string);

      const detected = declining
        ? { schemeId: null, named: false }
        : detectFocus({
            schemes: live,
            lastPresented,
            previousFocus: (conversation.focus_scheme_id as string) || null,
            text,
          });
      const focus = detected.schemeId;

      const plan = planTurn({
        schemes: live,
        candidates,
        focus,
        focusNamed: detected.named,
        showEverything: wantsEverything(text),
        declinedSchemeId: declining
          ? (conversation.focus_scheme_id as string) || null
          : (conversation.declined_scheme_id as string) || null,
        declinedAtTurn: declining ? turn : (conversation.declined_at_turn as number),
        turn,
        profile: merged,
        confirmed,
        changed,
        savedSchemeIds: saved.results.map((r) => r.scheme_id),
        unreadAnswer: !!askedField && answered === null,
        questionsAsked: conversation.questions_asked as number,
        language: s.language,
      });

      // The planner decides first, then the model speaks — never the reverse.
      //
      // A question is left to the planner: it asks about exactly one field and
      // ships the chips that answer it, whereas a model asked to phrase the
      // same thing rambles across three and contradicts the chips beneath it.
      // The model is worth having when there is something to explain, so it is
      // called only then, and told which programmes are on screen so its words
      // and the cards cannot disagree.
      let assistantText = plan.text;
      let modelAsked: { field: string; options: string[] } | null = null;
      {
        const cards = plan.blocks.filter((b) => b.kind === 'scheme_card') as {
          schemeId: string;
          status: string;
          missing: string[];
        }[];
        const onScreen = cards.map((c) => c.schemeId);
        try {
          const recent = await db()
            .prepare(
              'SELECT role,text FROM messages WHERE conversation_id=? ORDER BY created_at DESC, rowid DESC LIMIT 7',
            )
            .bind(conversation.id)
            .all<{ role: string; text: string }>();
          onStatus('thinking');
          const spoken = await runAgent({
            schemes: live,
            profile: merged,
            confirmed,
            language: s.language,
            onScreen: cards.map((c) => ({
              schemeId: c.schemeId,
              status: c.status,
              missing: c.missing,
            })),
            history: recent.results
              .reverse()
              .slice(0, -1)
              .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text })),
            message: text,
          });
          modelAsked = spoken?.asking ?? null;
          if (spoken?.text) {
            const verdict = validateProse(spoken.text, {
              onScreen,
              seen: spoken.seen,
              schemes: live,
              decisions: plan.decisions,
            });
            // The model's words are used only when they cannot contradict the
            // blocks beneath them. If the planner is asking and the model did
            // not call ask_about, its prose asks about whatever it chose while
            // the chips answer a different field — so the planner speaks.
            const wouldContradict = !spoken.asking && plan.checkpoint === 'ASKED';
            if (!verdict.ok)
              console.log(
                JSON.stringify({
                  traceId: trace,
                  event: 'prose_rejected',
                  reason: verdict.reason,
                }),
              );
            else if (wouldContradict)
              console.log(
                JSON.stringify({
                  traceId: trace,
                  event: 'prose_unused',
                  reason: 'the planner is asking and the model did not',
                }),
              );
            else assistantText = spoken.text;
          }
        } catch (error) {
          console.log(
            JSON.stringify({
              traceId: trace,
              event: 'agent_failed',
              cause: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      // A question the model asked replaces the planner's: the wording is its
      // own, the chips and the field are ours, and the answer is coerced
      // against that field exactly as before. The planner's own question is
      // the fallback for when no model is configured.
      const blocks = modelAsked
        ? [
            ...plan.blocks.filter(
              (b) => b.kind === 'profile_updated' || b.kind === 'notice',
            ),
            ...(modelAsked.options.length
              ? [
                  {
                    kind: 'answer_chips' as const,
                    field: modelAsked.field,
                    options: modelAsked.options,
                  },
                ]
              : []),
          ]
        : plan.blocks;
      const askedFieldOut = modelAsked ? modelAsked.field : plan.askedField;

      const assistant = {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        role: 'assistant' as const,
        text: assistantText,
        inputMode: 'text' as const,
        blocks,
        createdAt: new Date().toISOString(),
      };

      await db().batch([
        db()
          .prepare(
            'INSERT INTO messages(id,conversation_id,role,text,input_mode,blocks,created_at) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(
            assistant.id,
            conversation.id,
            'assistant',
            assistantText,
            'text',
            JSON.stringify(blocks),
            assistant.createdAt,
          ),
        db()
          .prepare(
            'UPDATE conversations SET checkpoint=?,questions_asked=?,asked_field=?,focus_scheme_id=?,turns=?,declined_scheme_id=?,declined_at_turn=?,title=CASE WHEN title=\'\' THEN ? ELSE title END,updated_at=? WHERE id=?',
          )
          .bind(
            plan.checkpoint,
            plan.questionsAsked,
            askedFieldOut || '',
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

      return {
        userMessage,
        message: assistant,
        checkpoint: plan.checkpoint,
        profileVersion: s.version + 1,
        traceId: trace,
      };
}

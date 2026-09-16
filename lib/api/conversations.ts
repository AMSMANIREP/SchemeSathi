import { body, db, HttpError, json, limit } from '../http';
import type { SessionCtx } from '../session';
import { planTurn, QUESTION_BUDGET } from '../agent/turn';
import { coerceAnswer, mergeExtractedProfile } from '../agent/profile';
import { questionFor } from '../questions';
import {
  detectFocus,
  isDecline,
  isUnsure,
  wantsEverything,
} from '../agent/focus.ts';
import { runAgent } from '../agent/loop';
import { validateProse, schemesMentioned } from '../agent/validate.ts';
import { judgeProse } from '../agent/judge';
import { extract } from './chat';
import { retrieve } from '../retrieval';
import { redact, validateProfile } from '../rules';
import { schemes } from '../schemes';
import { applicationRepository } from '../storage';
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
    // Consume the JSON body before returning. Leaving it unread can reset a
    // reused connection in the Worker proxy and lose the first chat message.
    await body(req);
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
        const payload = await runTurn(
          { req, s, trace } as SessionCtx,
          conversation2,
          () => {},
        );
        return json(payload, 201);
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encode = new TextEncoder();
      const send = (event: string, data: unknown) =>
        writer.write(
          encode.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );

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
            language: payload.language,
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
    return {
      userMessage,
      message: assistant,
      checkpoint: conversation.checkpoint,
      profileVersion: s.version,
      language: s.language,
      traceId: trace,
    };
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
  let provenance = JSON.parse(s.provenance) as Record<string, Provenance>;
  const changed: { field: string; provenance: Provenance }[] = [];
  let merged: Profile = { ...profile };

  const previous = await db()
    .prepare(
      "SELECT text,blocks FROM messages WHERE conversation_id=? AND role='assistant' ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .bind(conversation.id)
    .first<{ text: string; blocks: string }>();
  const answered = askedField
    ? coerceAnswer(askedField, text, previous?.text || '')
    : null;
  if (answered !== null) {
    merged = validateProfile({ ...merged, [askedField]: answered });
    provenance[askedField] = 'answered';
    changed.push({ field: askedField, provenance: 'answered' });
  }
  // A long answer may also correct occupation, age or other details. Short
  // chip/numeric replies do not need an additional model call.
  if (answered === null || text.length > 40) {
    onStatus('reading');
    const found = await extract(text, s.language);
    if (answered !== null) delete found.profile[askedField];
    const update = mergeExtractedProfile(merged, provenance, found.profile);
    merged = update.profile;
    provenance = update.provenance;
    changed.push(...update.changed);
  }

  const confirmed = Object.keys(merged).filter(
    (k) => merged[k] !== null && provenance[k] && provenance[k] !== 'inferred',
  );

  const live = await schemes();
  const saved = await applicationRepository().list(s.id);

  const recent = await db()
    .prepare(
      'SELECT role,text FROM messages WHERE conversation_id=? ORDER BY created_at DESC, rowid DESC LIMIT 13',
    )
    .bind(conversation.id)
    .all<{ role: string; text: string }>();
  const history = recent.results.reverse();
  // Direct answers retain their context; a new request searches its own topic.
  // Combining every past request kept disability results ahead of new skills.
  const query =
    answered !== null
      ? history
          .filter((m) => m.role === 'user')
          .map((m) => m.text)
          .join(' ')
      : text;

  const lastPresented = (
    JSON.parse(previous?.blocks || '[]') as {
      kind: string;
      schemeId?: string;
    }[]
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
  let focus = detected.schemeId;

  // The agent searches for the current request. The deterministic planner
  // then owns cards, eligibility verdicts and permitted profile questions.
  // Without a model, keyword retrieval supplies the same planner directly.
  let spoken: Awaited<ReturnType<typeof runAgent>> = null;
  try {
    onStatus('thinking');
    spoken = await runAgent({
      schemes: live,
      profile: merged,
      confirmed,
      language: s.language,
      history: history
        .slice(0, -1)
        .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text })),
      message: text,
      questionsAsked: conversation.questions_asked as number,
    });
  } catch (error) {
    console.log(
      JSON.stringify({
        traceId: trace,
        event: 'agent_failed',
        cause: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  const unsure = isUnsure(text);

  let candidates: string[];
  if (spoken) {
    // A model skipping eligibility checks must not hide retrieved records.
    // The planner evaluates every card and still restricts profile questions.
    candidates = spoken.checked.length ? spoken.checked : spoken.seen;
  } else {
    onStatus('searching');
    candidates = (await retrieve(query, live)).map((c) => c.schemeId);
  }
  // "I don't know what I need" is the one case where asking again is the
  // least useful thing we can do. If the model asked instead of searching,
  // search on whatever is already known — the opening description and the
  // confirmed facts — so they get something concrete to react to.
  if (unsure && !candidates.length) {
    onStatus('searching');
    const known = Object.entries(merged)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k} ${v}`)
      .join(' ');
    const fallbackQuery = [conversation.title as string, known]
      .filter(Boolean)
      .join(' ');
    if (fallbackQuery.trim())
      candidates = (await retrieve(fallbackQuery, live)).map((c) => c.schemeId);
  }

  if (!detected.named && focus && !candidates.includes(focus)) focus = null;
  const plan = planTurn({
    schemes: live,
    candidates,
    focus,
    focusNamed: detected.named,
    // Not knowing what you need is a reason to be shown what exists.
    showEverything: wantsEverything(text) || unsure,
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
    savedSchemeIds: saved.map((r) => r.schemeId),
    unreadAnswer: !!askedField && answered === null,
    questionsAsked: conversation.questions_asked as number,
    language: s.language,
  });

  const catalogueChecked =
    !spoken ||
    spoken.searched ||
    spoken.checked.length > 0 ||
    spoken.blockedQuestion ||
    !!spoken.asking;
  const terminal = plan.noSupportedSchemes && catalogueChecked;
  // A rejected model reply must never leave its chips/asked field behind.
  let acceptedModel = false;
  const modelAsked =
    !terminal &&
    !plan.discoveryOnly &&
    spoken?.asking &&
    (conversation.questions_asked as number) < QUESTION_BUDGET
      ? spoken.asking
      : null;

  // Validation happens here rather than at generation, because it needs
  // the verdicts the planner just computed. Prose that overreaches is
  // replaced by the deterministic sentence, and prose that asks about a
  // different field than the chips beneath it is set aside entirely.
  let assistantText = plan.text;
  if (spoken?.text && !terminal && !plan.discoveryOnly) {
    const verdict = validateProse(spoken.text, {
      onScreen: plan.blocks
        .filter((b) => b.kind === 'scheme_card')
        .map((b) => (b as { schemeId: string }).schemeId),
      seen: spoken.seen,
      schemes: live,
      decisions: plan.decisions,
    });
    // After a lookup, every profile question must be justified by a relevant
    // rule. A plain clarification before searching may still be conversational.
    const wouldContradict =
      catalogueChecked && /[?？]/.test(spoken.text) && !modelAsked;
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
          reason:
            'question has no relevant supported field or exceeds the budget',
        }),
      );
    else {
      // The regex checks passed. Now read it beside the catalogue text,
      // which is the only way to catch elaboration that sounds right.
      let judged: Awaited<ReturnType<typeof judgeProse>> = { ok: true };
      try {
        onStatus('checking');
        judged = await judgeProse(
          spoken.text,
          live,
          schemesMentioned(spoken.text, live),
        );
      } catch (error) {
        // A judge that cannot answer must not cost the citizen their
        // reply; the checkable claims were already ruled out.
        console.log(
          JSON.stringify({
            traceId: trace,
            event: 'judge_unavailable',
            cause: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      if (judged.ok) {
        assistantText = modelAsked
          ? questionFor(modelAsked.field, s.language).text
          : spoken.text;
        acceptedModel = true;
      } else
        console.log(
          JSON.stringify({
            traceId: trace,
            event: 'prose_rejected',
            reason: judged.reason,
          }),
        );
    }
  }

  // Only an accepted question can supply chips or an answer field. Its
  // canonical wording preserves the unit and scope the profile stores.
  const blocks =
    (acceptedModel && modelAsked) ||
    (acceptedModel && plan.checkpoint === 'ASKED')
      ? [
          ...plan.blocks.filter(
            (b) => b.kind === 'profile_updated' || b.kind === 'notice',
          ),
          // Chips only when the model actually asked through the tool.
          ...(modelAsked && modelAsked.options.length
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
  const askedFieldOut =
    acceptedModel && modelAsked
      ? modelAsked.field
      : acceptedModel && plan.checkpoint === 'ASKED'
        ? '' // its question, our field: never coerce against the mismatch
        : plan.askedField;

  // A terminal result is a complete answer. Never append a catalogue-wide
  // question to it, and never revive a rejected model question.
  const finalText = assistantText;
  const finalBlocks = blocks;
  const finalAskedField = askedFieldOut;
  const finalQuestionsAsked = finalAskedField
    ? Math.min(QUESTION_BUDGET, (conversation.questions_asked as number) + 1)
    : plan.questionsAsked;

  const assistant = {
    id: crypto.randomUUID(),
    conversationId: conversation.id,
    role: 'assistant' as const,
    text: finalText,
    inputMode: 'text' as const,
    language: s.language,
    blocks: finalBlocks,
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
        finalText,
        'text',
        s.language,
        JSON.stringify(finalBlocks),
        assistant.createdAt,
      ),
    db()
      .prepare(
        "UPDATE conversations SET checkpoint=?,questions_asked=?,asked_field=?,focus_scheme_id=?,turns=?,declined_scheme_id=?,declined_at_turn=?,title=CASE WHEN title='' THEN ? ELSE title END,updated_at=? WHERE id=?",
      )
      .bind(
        plan.checkpoint,
        finalQuestionsAsked,
        finalAskedField || '',
        terminal ? null : (plan.offeredSchemeId ?? focus),
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
    language: s.language,
  };
}

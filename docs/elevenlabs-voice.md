# ElevenLabs voice for the existing chatbot

The existing chat flow, question budget, profile confirmation, rules, application tracking and reports are retained. Voice adds hands-free conversation to the same composer and playback of the same assistant replies. After microphone permission, a pause of about 1.2 seconds submits a spoken turn automatically. The original profile review and confirmation steps remain in place.

Supported conversation languages: English, Hindi, Kannada, Tamil and Malayalam. Choose a language in the existing selector, type a language command, or start speaking in one of these languages. The first submitted input selects the session language. Later short answers and mixed-script text preserve it; explicit language commands or the selector can change it. Preferences are saved in D1 per demo display-name key, scoped to the existing browser session. First login welcomes in English; later logins with the same demo name restore the chosen language. Signed-out welcome and login screens always display English without overwriting the saved preference. This is not authenticated, cross-device account storage: clearing browser data or expiry of the 30-day rolling session removes access to these preferences. Older messages written in another language are not synthesized under a misleading language code.

## ElevenLabs values

```dotenv
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
```

- **ELEVENLABS_API_KEY**: create your own key in ElevenLabs → Developers → API Keys, with Text to Speech and Speech to Text access. Keep it secret.
- **ELEVENLABS_VOICE_ID**: optional; copy the ID of a voice your account can use. The default is George, shown above. A voice ID is not an API key.
- The code uses **scribe_v2** for transcription and **eleven_v3** for speech, which supports Tamil and Malayalam. These model IDs are already set in `lib/elevenlabs.ts`; no model environment variables are required.
- **No ElevenLabs Agent ID is required**. ElevenLabs handles audio; the existing Scheme Sathi chatbot still handles the conversation.

For local Cloudflare development, put these values in the ignored `.dev.vars` file in the repository root. Do not use a public `NEXT_PUBLIC_` or `VITE_` prefix. Keep any real `.env` file out of Git as well. For the deployed site, add `ELEVENLABS_API_KEY` as an encrypted secret in Cloudflare → Workers & Pages → india → Settings → Variables and Secrets. A local env file is not uploaded by GitHub Actions. The voice ID may be a runtime variable or secret.

## GitHub deployment

The `Deploy Scheme Sathi to Cloudflare` workflow is manually triggered:
1. In repository Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`: your Cloudflare CI token with Workers Scripts Edit and D1 Edit scoped to this account. Use a custom API token, not your Global API Key.
   - `CLOUDFLARE_ACCOUNT_ID`: `b5d1b6fd9d8c0e1763f6c364d7b92e2a`.
2. Open Actions → Deploy Scheme Sathi to Cloudflare → Run workflow.
3. Keep the workflow branch as `main`; enter `feature/layer2_implementation` in **Branch to deploy** (or another branch that contains the compatible deployment scripts/config).
4. Run the workflow and inspect its checks. It deploys to https://india.scheme-sathi.workers.dev/.

The workflow must also exist on the repository's default branch to expose Run workflow. It installs locked dependencies, preserves the existing public policy for unreviewed demo schemes, runs release validation, TypeScript and tests, builds, applies additive D1 migrations, deploys and checks database health. The new migration stores the language selection and message language; it does not replace tables or delete existing records.

ElevenLabs secrets belong in the Worker runtime, not the frontend build. The deployment workflow preserves existing Worker secrets. Cloudflare's existing Git integration remains independent; pushing its production branch may also start its normal build.

## Audio behavior

- After login, the app speaks one welcome in English for a new demo name or its saved language for a returning name. The sign-in gesture unlocks a reusable audio player. Browser autoplay restrictions can still require Play; no browser permission is bypassed.
- On the chat page, listening starts automatically after the welcome and microphone permission. Speech is detected locally; idle audio is discarded, and utterances are capped at 20 seconds / 5 MB. Spoken turns go to ElevenLabs Scribe, then the existing chat route. Listening pauses during transcription, replies, typing, hidden tabs and navigation; it resumes after the reply. Pause listening stops capture and cancels pending transcription. Permission/provider failures require an explicit retry rather than a repeated request loop.
- Replies play automatically unless muted. Play reply, Stop audio and mute controls remain available.
- Speech synthesis accepts server-owned guided text, scheme references or a session-owned assistant message ID, never arbitrary client text. Audio responses are private and not cached.
- Recorded audio is sent to ElevenLabs for transcription and is not stored by Scheme Sathi. The interface discloses that transfer. ElevenLabs account retention and usage limits still apply.
- The voice layer speaks the localized reply and verdicts. Official scheme names remain proper names. Detailed official evidence and scheme-specific prose keep their existing source language; this feature does not claim to translate or independently review those records.
- Missing key, exhausted credits, denied microphone permission or provider failure leave typing and existing forms available.

## Validation

`pnpm test` includes adapter tests plus real API route tests backed by an isolated SQLite database and a mocked ElevenLabs provider. These cover ownership, arbitrary-text rejection, saved-login language isolation, transcription, missing-provider behavior and the existing question flow. Utterance tests cover silence, brief noise, automatic end-of-turn detection and recording limits. They consume no provider credits. Real voice quality, permissions, credits and pronunciation need a configured account and listening checks; model mocks cannot verify them.

References: [ElevenLabs models](https://elevenlabs.io/docs/overview/models), [TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [STT API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [GitHub manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

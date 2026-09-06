# Cloudflare deployment

Public endpoint: https://scheme-sathi.contactamsmani.workers.dev

The app is deployed directly on Cloudflare Workers, using the account's workers.dev subdomain. No custom domain registration is needed. The Worker and D1 database use Cloudflare's Free plan subject to its usage limits. No paid subscription was selected.

## Resources

- Worker: `scheme-sathi`
- D1 database: `scheme-sathi-db`, location hint APAC (not an India-only data-residency guarantee)
- D1 binding: `DB`
- Static asset binding: `ASSETS`
- Production configuration: `wrangler.cloudflare.jsonc`
- The account and database IDs in this configuration are resource identifiers, not credentials.

## Deploy an update

Use Node 24 and pnpm 11. Install with `pnpm install --frozen-lockfile`.

```sh
pnpm exec wrangler login --scopes account:read user:read workers_scripts:write d1:write
pnpm typecheck
pnpm lint
pnpm test
pnpm deploy:cloudflare
```

The login flow also requests offline access for token refresh. Cloudflare may warn that unrelated default Wrangler scopes are absent; the selected scopes were sufficient to create D1, upload assets, publish the Worker, and register workers.dev. OAuth credentials stay in Wrangler's user configuration outside this repository. Never commit them. Revoke the grant under Cloudflare profile settings if you no longer need this machine to deploy.

`deploy:cloudflare` validates reviewed manifests, builds, applies tracked D1 schema migrations, and uploads the Worker and assets. Schema changes should always be generated with `pnpm db:generate` before deployment. The deployment uses the generated `dist/server/index.js` and `dist/client` directly. The optional Sites packaging metadata is not published as a static asset.

## Verify

```sh
curl https://scheme-sathi.contactamsmani.workers.dev/health/ready
curl https://scheme-sathi.contactamsmani.workers.dev/api/v1/capabilities
```

The capabilities response reports `Cloudflare Workers`. HTTP page/API requests redirect to HTTPS, and HTTPS responses set HSTS. Sessions use Secure, HttpOnly cookies on this hostname. No sign-in gate is configured for the public site; application and profile data remain isolated by session.

For a disposable test deployment, set `TEST_BASE_URL` to its URL and run `pnpm test:api`. The test creates synthetic sessions and deletes them. Existing production data must not be reused as test data.

## Data and optional services

This is a new D1 database. Previous Sites session/tracker records stay in the old deployment and were not copied. All 50 scheme references remain DRAFT until independently reviewed. AI, voice and external retrieval services are not enabled merely by changing hosting.

Configure provider values as Cloudflare secrets with `wrangler secret put KEY --config wrangler.cloudflare.jsonc`. Do not put API keys into `vars`, GitHub files, chat messages, or public client code. Azure OpenAI and ElevenLabs usage may incur their own fees; they are separate from free website hosting.

## Operations

The account-level subdomain is `contactamsmani.workers.dev`; the Worker name supplies the `scheme-sathi` prefix. The Worker deployment has preview URLs disabled and no paid plan or custom domain is required. Observability logging is disabled in this configuration to avoid collecting unnecessary request metadata. Rate limits and one-hour session retention behavior are documented in the main README.

Official references:
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

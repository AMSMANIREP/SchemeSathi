# Demo profile isolation

The demonstration login does not verify passwords, email ownership, or identity. It must not be presented as production account authentication.

Each normalized full email selects a separate profile within the current browser. The client sends a SHA-256 selector instead of the email. The server combines it with a random HttpOnly browser cookie to derive an independent session owner. Two emails with the same part before `@` remain distinct. The same email in another browser starts a separate profile.

The profile, confirmation/provenance, language, consent, conversations and applications belong to that session owner. Login rotates the active session token when switching identity; logout revokes it and clears the session cookie. The browser selector cookie remains so returning to the same demo email can restore its profile within the 30-day retention window. Deleting the active profile removes only that identity's data.

Client state is cleared during switching, local history is keyed by session owner, and asynchronous responses from an earlier workspace are ignored. Requests carrying an outdated `X-SchemeSathi-Session` owner are rejected before accessing profile data. Other tabs reload their workspace when the selected demo identity changes.

Old display-name-only logins cannot be assigned to a full email reliably because multiple identities previously shared them. They require a fresh sign-in and start with an empty profile. Their old shared data is not copied to any new identity.

Real accounts across browsers/devices require a verified identity provider or another authentication flow; knowing an email is insufficient authentication. No new API key is required for this demo isolation fix.

Regression coverage in `tests/voice-api.test.mjs` checks distinct domains, restored data, cross-owner access, browser separation, token revocation, stale tabs, deletion and expiry. UI smoke checks use disposable local demo emails with different saved ages.

# Authentication Admin Guide

This app supports three authentication modes (one per deployment):

| Mode | When to use |
|------|-------------|
| **Local (email + password)** | Development, small teams, or deployments without an identity provider |
| **OIDC / SSO** | Organizations that support OpenID Connect (Okta, Microsoft Entra ID) |
| **SAML / SSO** | Google Workspace and other IdPs that require SAML (e.g. custom SAML apps in Google Admin) |

Set `AUTH_PROTOCOL=local`, `oidc`, or `saml`. Only one SSO protocol can be active at a time.

> **Google Workspace:** Full organization SSO uses **SAML custom apps** in Google Admin, not OIDC/OAuth. Google Cloud OAuth clients are for consumer Google accounts or limited API access — they are not the correct integration path for Workspace as your IdP. See [Google Workspace SAML](#google-workspace-saml).

---

## Environment variables reference

Copy `.env.example` to `.env` and configure the variables below.

### Core auth

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret used to sign session tokens. Use a long random string in production. |
| `APP_URL` | Recommended | Public URL of the frontend SPA (e.g. `https://your-app.example.com`). Used for post-login redirects and SAML SP defaults. |
| `API_URL` | Optional | Public URL of the API when it differs from `APP_URL`. Defaults to `http://localhost:{PORT}`. |
| `PORT` | Optional | API server port (default `3001`). |

### Auth protocol

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_PROTOCOL` | No | `local` (default), `oidc`, or `saml`. Selects the authentication mode for this deployment. |

### Local auth only

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_EMAIL` | Optional | Seed an admin account on database init. |
| `ADMIN_PASSWORD` | Optional | Password for the seeded admin. Must be set together with `ADMIN_EMAIL`. |

### OIDC / SSO

Requires `AUTH_PROTOCOL=oidc`.

| Variable | Required | Description |
|----------|----------|-------------|
| `OIDC_CLIENT_ID` | Yes | OAuth client ID from your identity provider. |
| `OIDC_CLIENT_SECRET` | Yes | OAuth client secret from your identity provider. |
| `OIDC_ISSUER_URL` | Yes | OIDC issuer URL (see provider sections below). |
| `OIDC_PROVIDER_NAME` | No | Display name on the login button (default: `SSO`). Use `Okta` or `Microsoft` to show the matching icon. |
| `OIDC_SCOPES` | No | Space-separated scopes (default: `openid email profile`). |
| `OIDC_REDIRECT_URI` | Recommended | Callback URL registered with your IdP. If omitted, defaults to `{APP_URL}/api/auth/oidc/callback`. |

### SAML / SSO

Requires `AUTH_PROTOCOL=saml`.

| Variable | Required | Description |
|----------|----------|-------------|
| `SAML_PROVIDER_NAME` | No | Display name on the login button (default: `SSO`). Use `Google` to show the Google icon. |
| `SAML_IDP_METADATA` | Yes | IdP metadata XML from your identity provider (base64-encoded single line). Contains the Google SSO URL, Google entity ID, and signing certificate — there is no separate env var for the Google login URL. |
| `SAML_SP_ENTITY_ID` | No | **Your app's** entity ID (default: `{APP_URL}/api/auth/saml/metadata`). Must match Google Admin exactly. |
| `SAML_ACS_URL` | No | **Your app's** Assertion Consumer URL (default: `{APP_URL}/api/auth/saml/acs`). Must match Google Admin exactly. |
| `SAML_SP_CERT_DIR` | No | Directory for auto-generated SP signing certificate (default: `data/saml` under the server folder). |


## Local authentication setup

Use this for development or when you do not have an identity provider.

### 1. Configure `.env`

```bash
JWT_SECRET=your-long-random-secret
AUTH_PROTOCOL=local
APP_URL=http://localhost:5173
```

### 2. Initialize the database

```bash
npm run db:init
```

### 3. Create the first admin

Choose one of:

**Option A — First-run setup UI (recommended for local dev)**

1. Start the app: `npm run dev`
2. Open `http://localhost:5173/login`
3. Complete the administrator setup form

**Option B — Seed admin from environment**

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourSecurePassword123
```

Restart the server after setting these. The admin is created on init. Seeded admins must change their password on first login.

### 4. User registration

With `AUTH_PROTOCOL=local`, learners can self-register at `/register`. New users are assigned the **learner** role. Admins are created via setup or seeding only.

---

## OIDC / SSO overview

When `AUTH_PROTOCOL=oidc`:

- The login page shows a **Sign in with {provider}** button.
- Email/password registration is **disabled**.
- Existing local-password users can still sign in with email/password unless their account is linked to SSO.
- New SSO users are **just-in-time (JIT) provisioned** with the **learner** role.
- If an SSO user's email matches an existing local account, the accounts are **merged** and future sign-ins use SSO.

### Sign-in flow

```
User clicks "Sign in with SSO"
  → GET /api/auth/oidc/login
  → Redirect to identity provider
  → User authenticates
  → Redirect to /api/auth/oidc/callback (registered redirect URI)
  → Server exchanges code for tokens
  → Redirect to /login/oidc/callback (SPA)
  → SPA completes session via POST /api/auth/sso/complete
  → User is logged in
```

### Redirect URI

The redirect URI must be registered **exactly** with your identity provider.

| Environment | Redirect URI |
|-------------|--------------|
| Local dev (Vite proxy) | `http://localhost:5173/api/auth/oidc/callback` |
| Production | `https://<your-app-domain>/api/auth/oidc/callback` |

In local development, the Vite dev server proxies `/api` to the backend on port `3001`. Register port **5173**, not 3001.

Set explicitly in `.env` when needed:

```bash
OIDC_REDIRECT_URI=http://localhost:5173/api/auth/oidc/callback
```

### Required token claims

The IdP must return these claims in the ID token:

- `sub` — unique user identifier
- `email` — user's email address
- `email_verified` — must not be `false` (missing/`true` is accepted)

Optional: `name` or `given_name` for display name on JIT-provisioned accounts.

### Verify configuration

After restarting the server, check startup logs for:

```
OIDC enabled | issuer:... redirectUri:... providerName:... scopes:...
```

If OIDC is enabled but misconfigured, you will see:

```
OIDC enabled but incomplete — check OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER_URL
```

Set `LOG_LEVEL=DEBUG` for detailed OIDC logs during troubleshooting.

---

## SAML / SSO overview

When `AUTH_PROTOCOL=saml`:

- The login page shows a **Sign in with {provider}** button (e.g. Google).
- Email/password registration is **disabled** (same as OIDC).
- The Google SSO login URL is **not** a separate env var — it is parsed from `SAML_IDP_METADATA`.
- `SAML_SP_ENTITY_ID` and `SAML_ACS_URL` are **your app's URLs**, not Google's.
- The app auto-generates a self-signed SP signing certificate on first startup (`server/data/saml/`).

### Sign-in flow

```
User clicks "Sign in with Google"
  → GET /api/auth/saml/login
  → Redirect to Google (URL from SAML_IDP_METADATA)
  → User authenticates at Google
  → Google POSTs SAMLResponse to /api/auth/saml/acs
  → Server validates assertion, provisions/links user
  → Redirect to /login/saml/callback (SPA)
  → SPA completes session via POST /api/auth/sso/complete
  → User is logged in
```

IdP-initiated login (Google app launcher) skips the login button and POSTs directly to `/api/auth/saml/acs`.

### Verify configuration

After restarting the server, check startup logs for:

```
SAML enabled | entityId:... acsUrl:... providerName:Google spCertFingerprint:...
```

Open `{APP_URL}/api/auth/saml/metadata` to confirm Entity ID and ACS URL in the SP metadata XML match Google Admin.

Set `LOG_LEVEL=DEBUG` for detailed SAML logs during troubleshooting.

---

## Microsoft Entra ID (Azure AD)

### 1. Create an app registration

1. Open [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name the application (e.g. `Roleplay App`)
3. Supported account types: choose based on who should sign in (single tenant, any org, or any Microsoft account)
4. Redirect URI: platform **Web**, URI:

   ```
   http://localhost:5173/api/auth/oidc/callback
   ```

   Add your production URI when deploying.

### 2. Create a client secret

1. **Certificates & secrets** → **New client secret**
2. Copy the **Value** immediately — it is only shown once
3. Do **not** use the **Secret ID** (a GUID). The Secret ID will cause token exchange failures.

### 3. Configure token claims (recommended)

1. **Token configuration** → **Add optional claim** → Token type: **ID**
2. Add: `email`, `given_name`, `family_name`

This ensures the app receives an email address for user provisioning.

### 4. Configure `.env`

```bash
AUTH_PROTOCOL=oidc
OIDC_CLIENT_ID=<Application (client) ID from Overview>
OIDC_CLIENT_SECRET=<Secret Value — not Secret ID>
OIDC_ISSUER_URL=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_PROVIDER_NAME=Microsoft
OIDC_SCOPES=openid email profile
APP_URL=http://localhost:5173
OIDC_REDIRECT_URI=http://localhost:5173/api/auth/oidc/callback
```

**Issuer URL options:**

| Audience | `OIDC_ISSUER_URL` |
|----------|-------------------|
| Single tenant | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| Any work/school account | `https://login.microsoftonline.com/organizations/v2.0` |
| Any Microsoft account | `https://login.microsoftonline.com/common/v2.0` |

Find your tenant ID under **Microsoft Entra ID** → **Overview** → **Tenant ID**.

---

## Okta

### 1. Create an application

1. Okta Admin Console → **Applications** → **Create App Integration**
2. Sign-in method: **OIDC - OpenID Connect**
3. Application type: **Web Application**
4. Sign-in redirect URI:

   ```
   http://localhost:5173/api/auth/oidc/callback
   ```

5. Sign-out redirect URI (optional): your app login URL
6. Assign the application to users or groups who should have access

### 2. Note credentials

From the application's **General** tab:

- **Client ID**
- **Client secret** (under **Client Credentials**)

### 3. Choose an authorization server

Most Okta orgs use the default authorization server. The issuer URL format is:

```
https://<your-okta-domain>/oauth2/default
```

For a custom authorization server, use:

```
https://<your-okta-domain>/oauth2/<auth-server-id>
```

You can confirm the issuer in **Security** → **API** → your authorization server → **Metadata URI** (strip `/.well-known/openid-configuration` for `OIDC_ISSUER_URL`).

### 4. Configure `.env`

```bash
AUTH_PROTOCOL=oidc
OIDC_CLIENT_ID=<Okta Client ID>
OIDC_CLIENT_SECRET=<Okta Client secret>
OIDC_ISSUER_URL=https://<your-okta-domain>/oauth2/default
OIDC_PROVIDER_NAME=Okta
OIDC_SCOPES=openid email profile
APP_URL=http://localhost:5173
OIDC_REDIRECT_URI=http://localhost:5173/api/auth/oidc/callback
```

### Okta checklist

- [ ] Application type is **Web** (not SPA-only for this redirect pattern)
- [ ] Redirect URI matches `OIDC_REDIRECT_URI` exactly
- [ ] Users/groups are assigned to the application
- [ ] Authorization server is **Active**

---

## Google Workspace SAML

Google Workspace organization SSO uses **SAML custom apps** in Google Admin. This is separate from Google Cloud OAuth/OIDC credentials, which do not provide full Workspace IdP integration for third-party apps.

### Prerequisites

Google Admin requires **public HTTPS URLs** for SAML ACS and Entity ID. `localhost` and `https://localhost` are rejected.

For local development, use a tunnel (e.g. [ngrok](https://ngrok.com/)):

```bash
ngrok http 5173
```

Use the ngrok HTTPS URL as your `APP_URL` (e.g. `https://abc123.ngrok-free.app`).

The Vite dev server proxies `/api` to the backend, so register URLs on port **5173** (the tunnel target), not 3001.

### 1. Configure `.env` and start the app

Set `AUTH_PROTOCOL=saml` first. You can use a placeholder for `SAML_IDP_METADATA` until step 4, or configure metadata after creating the Google app.

```bash
AUTH_PROTOCOL=saml
SAML_PROVIDER_NAME=Google
APP_URL=https://abc123.ngrok-free.app
SAML_SP_ENTITY_ID=https://abc123.ngrok-free.app/api/auth/saml/metadata
SAML_ACS_URL=https://abc123.ngrok-free.app/api/auth/saml/acs
```

Start the server and confirm SP details:

- Open `https://abc123.ngrok-free.app/api/auth/saml/metadata`
- Or check startup logs: `SAML enabled | entityId:... acsUrl:...`

The app auto-generates a self-signed SP signing certificate on first startup (stored in `server/data/saml/`).

### 2. Create a custom SAML app in Google Admin

1. [Google Admin Console](https://admin.google.com/) → **Apps** → **Web and mobile apps** → **Add app** → **Add custom SAML app**
2. On **Service provider details**, configure:

   | Google Admin field | Your value |
   |--------------------|------------|
   | **ACS URL** | `https://abc123.ngrok-free.app/api/auth/saml/acs` |
   | **Entity ID** | `https://abc123.ngrok-free.app/api/auth/saml/metadata` |
   | **Name ID format** | `EMAIL` |
   | **Name ID** | Basic Information → **Primary email** |
   | **Signed response** | On |
   | **Signed assertion** | On |

   These must match `SAML_ACS_URL` and `SAML_SP_ENTITY_ID` in `.env` **exactly** (including `https://`, no typos like `.devapi` instead of `.dev/api`).

3. On **Attribute mapping** (optional but recommended for display names):

   | App attribute | Google directory attribute |
   |---------------|----------------------------|
   | `email` | Primary email |
   | `firstName` | First name |
   | `lastName` | Last name |

   No custom attributes are required if Name ID is set to primary email — that is sufficient for login.

4. Download **IdP metadata** (XML file or copy the XML).

5. On **User access**, assign the app to users or organizational units (enables IdP-initiated login from the Google app launcher).

### 3. Encode IdP metadata for `.env`

The IdP metadata contains Google's SSO URL (`https://accounts.google.com/o/saml2/idp?idpid=...`), Google's entity ID, and Google's signing certificate. There is no separate env var for the Google login URL.

Base64-encode the metadata XML as a single line:

```bash
base64 -i GoogleIDPMetadata.xml | tr -d '\n'
```

### 4. Complete `.env`

```bash
AUTH_PROTOCOL=saml
SAML_PROVIDER_NAME=Google
SAML_IDP_METADATA=<base64-encoded IdP metadata XML>
APP_URL=https://abc123.ngrok-free.app
SAML_SP_ENTITY_ID=https://abc123.ngrok-free.app/api/auth/saml/metadata
SAML_ACS_URL=https://abc123.ngrok-free.app/api/auth/saml/acs
```

Restart the server after updating `.env`.

### 5. Test sign-in

- **SP-initiated:** Click **Sign in with Google** on the login page
- **IdP-initiated:** Open the app from the Google Workspace app launcher

Both flows redirect through `/login/saml/callback` and complete via `POST /api/auth/sso/complete`.

If sign-in fails, check the login page for an error message (from `?error=` in the URL) and server logs at `LOG_LEVEL=DEBUG`.

### Google Workspace SAML checklist

- [ ] Using a public **HTTPS** URL (tunnel or deployed host) — not `localhost`
- [ ] `SAML_ACS_URL` matches Google Admin **ACS URL** exactly
- [ ] `SAML_SP_ENTITY_ID` matches Google Admin **Entity ID** exactly (your app URL, **not** `accounts.google.com/...`)
- [ ] Name ID is **Primary email**
- [ ] `SAML_IDP_METADATA` is complete, valid base64 of Google's IdP metadata XML (one line, no truncation)
- [ ] App is assigned to the correct users/OUs in Google Admin
- [ ] Server restarted after `.env` changes

### What goes where (common mistakes)

| Value | Belongs in | Example |
|-------|------------|---------|
| Google SSO login URL | Inside `SAML_IDP_METADATA` (parsed automatically) | `https://accounts.google.com/o/saml2/idp?idpid=...` |
| Google entity ID | Inside `SAML_IDP_METADATA` (parsed automatically) | `https://accounts.google.com/o/saml2?idpid=...` |
| **Your** ACS URL | `SAML_ACS_URL` + Google Admin | `https://your-host/api/auth/saml/acs` |
| **Your** entity ID | `SAML_SP_ENTITY_ID` + Google Admin | `https://your-host/api/auth/saml/metadata` |

---

## Production deployment

### OIDC environment checklist

```bash
JWT_SECRET=<strong-random-secret>
AUTH_PROTOCOL=oidc
APP_URL=https://app.example.com
API_URL=https://api.example.com          # if API is on a separate host
OIDC_REDIRECT_URI=https://app.example.com/api/auth/oidc/callback
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_ISSUER_URL=...
OIDC_PROVIDER_NAME=Microsoft|Okta
LOG_LEVEL=INFO
```

### SAML environment checklist (Google Workspace)

```bash
JWT_SECRET=<strong-random-secret>
AUTH_PROTOCOL=saml
SAML_PROVIDER_NAME=Google
SAML_IDP_METADATA=<base64-encoded Google IdP metadata>
APP_URL=https://app.example.com
SAML_SP_ENTITY_ID=https://app.example.com/api/auth/saml/metadata
SAML_ACS_URL=https://app.example.com/api/auth/saml/acs
LOG_LEVEL=INFO
```

Update Google Admin ACS URL and Entity ID to match production before go-live.

### Admin access with SSO enabled

SSO JIT provisioning creates **learner** accounts. To bootstrap an admin:

1. Seed an admin before enabling SSO:

   ```bash
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=...
   ```

   Then set `AUTH_PROTOCOL=oidc` or `AUTH_PROTOCOL=saml` and restart.

2. Or create a local admin via first-run setup **before** enabling SSO. The admin can later sign in via SSO if their email matches (account merge).

3. Promote a user to admin in the database if needed (assign the `admin` role).

---

## Roles and account behavior

| Role | How created | Capabilities |
|------|-------------|------------|
| **admin** | First-run setup, `ADMIN_EMAIL`/`ADMIN_PASSWORD` seed, or manual DB assignment | Full roleplay management |
| **learner** | Self-registration (local mode) or SSO JIT provisioning | Take roleplays |

### SSO account linking

| Scenario | Behavior |
|----------|----------|
| First SSO sign-in, email not in system | New learner account created |
| SSO sign-in, email matches existing user | Accounts merged; SSO identity linked |
| SSO sign-in, same identity as before | Existing user logged in |
| Local login, user has no password (SSO-only) | Rejected with "This account uses SSO sign-in" |
| Change password | Not available for SSO-only accounts |

---

## Troubleshooting

### SSO button does not appear

- Confirm `AUTH_PROTOCOL` is `oidc` or `saml` and required vars are set (`OIDC_*` or `SAML_IDP_METADATA`).
- Restart the server after changing `.env`.
- Check `GET /api/auth/config` — `sso.enabled` should be `true`.

### OIDC: `OIDC provider discovery failed` / `unexpected response content-type`

- `OIDC_ISSUER_URL` is wrong. Common mistake: leaving a placeholder like `<your-tenant-id>` instead of the real tenant GUID.
- Verify the issuer by opening `{issuer}/.well-known/openid-configuration` in a browser — it should return JSON.

### OIDC: `OIDC token exchange failed`

Usually occurs at the callback step after Microsoft/Okta redirects back.

| Cause | Fix |
|-------|-----|
| Wrong client secret | Use the secret **Value**, not an ID. Microsoft Entra Secret IDs are GUIDs and will not work. |
| Redirect URI mismatch | Ensure IdP registration matches `OIDC_REDIRECT_URI` exactly (scheme, host, port, path). |
| Expired client secret | Create a new secret in the IdP and update `.env`. |

### OIDC: `OIDC provider did not return an email address`

- Add optional email claims in the IdP (Microsoft: Token configuration; Okta: usually included by default).
- Confirm `OIDC_SCOPES` includes `email`.

### SAML: `Invalid signature` at ACS

The most common cause is **corrupted base64** in the POST body: form parsers turn `+` into spaces inside `SAMLResponse`, which breaks signature validation. The server normalizes this automatically.

| Cause | Fix |
|-------|-----|
| Corrupted `SAMLResponse` (spaces instead of `+`) | Fixed server-side — restart and retry |
| Stale IdP metadata | Re-download IdP metadata from Google Admin and update `SAML_IDP_METADATA` |
| Google signing options | The app accepts a signed response **or** signed assertion from Google |
| State cookie missing (`hasStateCookie:false`) | Not blocking — login still works for single-tenant; cookie uses `SameSite=None; Secure` over HTTPS |

### SAML: Google `403 app_not_configured_for_user`

This error is shown **by Google** before your app receives the SAML response. It is **not** the same as turning user access on in Admin — that fixes `app_not_enabled_for_user` instead.

| Cause | Fix |
|-------|-----|
| Signed into a **personal @gmail.com** account (or wrong Google account) | Use an incognito window, sign out of personal Gmail, or pick your **Workspace** account on the account chooser. The app redirects via Google's Account Chooser by default when `SAML_PROVIDER_NAME=Google`. |
| **Entity ID mismatch** | Google compares the `saml:Issuer` in the SAML request with **Entity ID** on the SAML app's Service provider details page. It must match `SAML_SP_ENTITY_ID` **exactly** (case-sensitive), e.g. `https://your-host/api/auth/saml/metadata`. Check server startup logs or `GET /api/auth/saml/metadata`. |
| **Metadata from a different Google app** | Re-download IdP metadata from the same SAML custom app where you set ACS URL / Entity ID. The `idpid` in metadata must match that app. |
| **ngrok URL changed** | Free ngrok URLs change when the tunnel restarts. Update `APP_URL`, `SAML_SP_ENTITY_ID`, `SAML_ACS_URL`, **and** Google Admin ACS URL / Entity ID to the new host. |
| User access still off | In Admin → Apps → Web and mobile apps → your SAML app → **User access** → **ON for everyone**. Allow a few minutes for propagation. |

Optional `.env` for Google Workspace domains:

```bash
# Restrict account chooser to your Workspace domain (e.g. heybray.com)
SAML_GOOGLE_HD=heybray.com
# Set to false to skip Account Chooser redirect (not recommended for Google)
# SAML_GOOGLE_ACCOUNT_CHOOSER=false
```

To verify the Entity ID Google receives: capture a HAR file during sign-in, base64-decode the `SAMLRequest` query parameter, and confirm `saml:Issuer` matches Google Admin **Entity ID**. See [Google's SAML error reference](https://support.google.com/a/answer/6301076).

### SAML: Redirected back to login immediately after clicking "Sign in with Google"

Check the login page error message (`?error=` in the URL) and server logs.

| Cause | Fix |
|-------|-----|
| `SAML_IDP_METADATA` missing or truncated | Re-encode the full IdP metadata XML as base64 on a single line |
| Startup error before redirect | Check logs for `SAML configuration invalid` |

### SAML: `Invalid document signature` after Google login

Usually means Entity ID or ACS URL mismatch between Google Admin and your `.env`.

| Cause | Fix |
|-------|-----|
| Wrong `SAML_SP_ENTITY_ID` | Must be **your** metadata URL (e.g. `https://host/api/auth/saml/metadata`), not Google's `accounts.google.com/...` |
| Typo in URLs | Check for missing slashes (e.g. `.dev/api` not `.devapi`) |
| Google Admin out of sync | Update Google Admin Entity ID and ACS URL to match `.env` exactly, then retry |
| Stale IdP metadata | Re-download IdP metadata from Google Admin and update `SAML_IDP_METADATA` |

### SAML: Google rejects ACS URL as invalid format

- Google requires **public HTTPS** — `localhost` and `https://localhost` are not accepted.
- Use ngrok or a deployed host with a valid TLS certificate.

### SAML: `SAML provider did not return an email address`

- Set Name ID to **Primary email** on Google's Service provider details page.
- Optionally map `email` → Primary email on the Attributes page.

### Local registration disabled

Expected when `AUTH_PROTOCOL` is `oidc` or `saml`. Users must sign in via SSO.

---

## Quick reference — `.env` templates

### Local development (no SSO)

```bash
JWT_SECRET=change-me-in-production
AUTH_PROTOCOL=local
APP_URL=http://localhost:5173
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=Admin@123456
```

### Microsoft Entra ID

```bash
AUTH_PROTOCOL=oidc
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_ISSUER_URL=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_PROVIDER_NAME=Microsoft
OIDC_SCOPES=openid email profile
APP_URL=http://localhost:5173
OIDC_REDIRECT_URI=http://localhost:5173/api/auth/oidc/callback
```

### Okta

```bash
AUTH_PROTOCOL=oidc
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_ISSUER_URL=https://<your-okta-domain>/oauth2/default
OIDC_PROVIDER_NAME=Okta
OIDC_SCOPES=openid email profile
APP_URL=http://localhost:5173
OIDC_REDIRECT_URI=http://localhost:5173/api/auth/oidc/callback
```

### Google Workspace (SAML)

```bash
AUTH_PROTOCOL=saml
SAML_PROVIDER_NAME=Google
SAML_IDP_METADATA=<base64-encoded Google IdP metadata XML>
APP_URL=https://your-tunnel-or-host.example.com
SAML_SP_ENTITY_ID=https://your-tunnel-or-host.example.com/api/auth/saml/metadata
SAML_ACS_URL=https://your-tunnel-or-host.example.com/api/auth/saml/acs
```

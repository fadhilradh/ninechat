# Nine AI

**Free Forever AI Chat** — a fast, private chat window for every model your gateway can reach.

Nine AI is a single-deploy fullstack app: a React frontend and a handful of Netlify
Functions, with no separate backend to host. Conversations live in your own browser,
completions go to a [9Router](https://9router.com) gateway, and signing in is optional
everywhere.

```
Browser (React + IndexedDB)
   |
   |-- /api/chat ------> Netlify streaming function --> 9Router /v1 --> 40+ providers
   |-- /api/models ----> Netlify function
   |-- /api/auth/* ----> Better Auth  -----------------> Postgres (optional)
   |
   `-- Direct mode: browser --> http://localhost:20128/v1 (bypasses the functions)
```

## Why it is shaped this way

**Chats are stored client-side.** The deploy holds no transcripts. That is what makes a
public URL safe to hand out without building per-user auth, quotas, or a privacy policy
you would have to mean.

**Completions run on a streaming function.** Netlify allows a streaming response 60
seconds on every plan; a plain synchronous function gets 10 on the free tier. Anything
that talks to an LLM has to be the former.

**There are two transports.** The deployed function runs in Netlify's cloud, which cannot
reach a 9Router on your laptop. Direct mode makes the browser call the gateway itself, so
local development against a local gateway works without tunnelling anything.

## Running it locally

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env      # then fill in GATEWAY_API_KEY
npm run dev               # netlify dev on http://localhost:8888
```

`netlify dev` serves Vite and the functions on one origin, so `/api/*` behaves exactly as
it does in production. `npm run dev:vite` runs the frontend alone, but the `/api` routes
will 404.

If your 9Router is local, open **Settings → Direct from browser** and paste its API key.
Nothing else is needed.

### Other scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | Type-checks the frontend and the functions separately |
| `npm run lint` | ESLint, warnings treated as errors |
| `npm run format` | Prettier over the repo |
| `npm run icons` | Regenerates the PWA icons in `public/` |
| `npm run auth:generate` | Regenerates the Better Auth SQL schema |

## Deploying to Netlify

1. Push this repo and create a Netlify site from it. `netlify.toml` already sets the build
   command, publish directory, and functions directory.
2. Set the environment variables below under **Site configuration → Environment
   variables**.
3. Deploy. There is no second service to stand up.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GATEWAY_BASE_URL` | yes | OpenAI-compatible base URL, e.g. `https://your-9router.example.com/v1`. Must be reachable from the internet. |
| `GATEWAY_API_KEY` | yes | Key from the 9Router dashboard. |
| `DEFAULT_MODEL` | no | Model for brand-new chats. |
| `MAX_TOKENS` | no | Reply cap; keeps long answers inside the 60s streaming budget. |
| `ALLOW_CLIENT_KEY` | no | Let visitors use their own key. Default `true`. |
| `ALLOW_CLIENT_BASE_URL` | no | Default `false`. Turning it on makes the function an open proxy. |
| `DATABASE_URL` | no | Pooled Postgres URL. Blank disables accounts; everything else keeps working. |
| `BETTER_AUTH_SECRET` | with auth | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | no | Netlify's `URL` is used when unset. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables the Google button. |

> Hosting a gateway on the public internet exposes your provider credentials to whoever
> can reach it. Put it behind a key you rotate, or skip the proxy entirely and let each
> visitor bring their own in Direct mode.

### Turning on accounts

1. Provision Postgres — **Netlify DB** (Neon) is the path of least resistance and has a
   free tier. Copy the *pooled* connection string.
2. Set `DATABASE_URL` and `BETTER_AUTH_SECRET`.
3. Create the tables: `npx @better-auth/cli@latest migrate`, or paste
   `netlify/lib/auth-schema.sql` into a SQL console.
4. For Google, add an OAuth client with redirect URI
   `https://<your-site>/api/auth/callback/google`, then set the two Google variables.

Accounts are cosmetic today — they put a name in the nav. Chat history stays local and is
not synced to an account.

## Using it

| Action | How |
| --- | --- |
| Send | `Enter` (or `Ctrl+Enter` if you turn Enter-to-send off) |
| Newline | `Shift+Enter` |
| Attach an image | Click the image button, drop a file, or just paste a screenshot |
| Stop a reply | The stop button replaces send while streaming |
| Regenerate | Hover an assistant message → circular arrow |
| Edit and resend | Hover your own message → pencil. Everything after it is replaced. |
| Branch a chat | Hover any message → branch icon. Copies the thread up to that point. |
| Rename / pin / delete | The `...` menu on any chat in the sidebar |

Images are resized to fit within 1568px and re-encoded in the browser before they are
sent, which keeps requests inside the function payload limit and costs fewer vision
tokens.

## Installing it as an app

Nine AI is a PWA. In Chrome or Edge, use the install icon in the address bar; on iOS,
**Share → Add to Home Screen**. It opens in its own window and the shell is cached, so it
starts instantly. When a new version deploys you get a toast offering to reload rather
than being interrupted mid-sentence.

## Project layout

```
netlify/
  functions/     chat.mts (streaming), models.mts, health.mts, auth.mts, auth-status.mts
  lib/           settings, error mapping, SSE helpers, Better Auth setup + SQL
src/
  components/    UI, with shadcn primitives under components/ui
  hooks/         use-chat (the streaming engine), use-sessions, use-models, use-settings
  lib/           api (both transports), db (IndexedDB), image (resizing), auth-client
  pages/         landing, about, auth, chat
scripts/         generate-icons.mjs — dependency-free PNG rasteriser for the PWA icons
```

## Known limits

- A single reply must finish within 60 seconds. Very long outputs get a clear timeout
  message rather than a severed connection.
- Chats do not sync between devices or browsers. That is the trade for not storing them.
- Token usage is only shown when the upstream provider reports it; several do not.

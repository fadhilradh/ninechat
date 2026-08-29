# Open Chat

**Free Forever AI Chat** — a fast, private chatbot that anyone can use.

No sign-up, no API key, no model to choose. Open it and type. Conversations are stored
in your own browser, not on a server, which is what makes an open URL safe to hand out:
there is nothing per-user to store, gate, or leak.

Open Chat is a single-deploy fullstack app — a React frontend and two Netlify Functions,
with no separate backend to host.

```
Browser (React + IndexedDB)
   |
   |-- /api/chat ------> Netlify streaming function --> gateway --> a model
   |-- /api/auth/* ----> Better Auth  ----------------> Postgres (optional)
   |
   `-- conversations never leave the browser
```

## Why it is shaped this way

**Chats are stored client-side.** The deploy holds no transcripts. That is what makes a
public URL safe without building per-user auth, quotas, or a privacy policy you would
have to mean.

**Replies run on a streaming function.** Netlify allows a streaming response 60 seconds
on every plan; a plain synchronous function gets 10 on the free tier. Anything that talks
to an LLM has to be the former.

**Visitors configure nothing.** There is no model picker and no place to paste a key. The
server holds one credential and lets the gateway route each request, so there is no
surface for a visitor to misconfigure and no support burden when they do.

**Errors are written for visitors.** "Set GATEWAY_API_KEY" is useless advice to someone
who just wants an answer, and it leaks how the thing is wired. Operator detail goes to
the function logs; the chat window gets a plain sentence and some idea of whether to
retry.

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

### Other scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | Type-checks the frontend and the functions separately |
| `npm run lint` | ESLint, warnings treated as errors |
| `npm run format` | Prettier over the repo |
| `npm run icons` | Regenerates the PWA icons in `public/` |
| `npm run auth:generate` | Regenerates the Better Auth SQL schema |
| `npm run auth:migrate` | Creates the Better Auth tables (safe to re-run) |

## Deploying to Netlify

1. Push this repo and create a Netlify site from it. `netlify.toml` already sets the build
   command, publish directory, and functions directory.
2. Set the environment variables below under **Site configuration → Environment
   variables**.
3. Deploy. There is no second service to stand up.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `GATEWAY_BASE_URL` | yes | OpenAI-compatible base URL, e.g. `https://openrouter.ai/api/v1`. |
| `GATEWAY_API_KEY` | yes | A key for that gateway. **Put a spend limit on it** — see below. |
| `DEFAULT_MODEL` | no | `openrouter/auto` routes per prompt; a concrete id pins one model. |
| `FALLBACK_MODELS` | no | Comma-separated chain tried on error or rate limit. Free models last. |
| `MAX_TOKENS` | no | Reply cap; keeps long answers inside the 60s streaming budget. |
| `DATABASE_URL` | no | Pooled Postgres URL. Blank disables accounts; everything else keeps working. |
| `BETTER_AUTH_SECRET` | with auth | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | no | Netlify's `URL` is used when unset. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables the Google button. |

> **One key pays for everyone.** Chat has no sign-in gate, by design — that is the
> product. So every visitor spends the credit on `GATEWAY_API_KEY`. Set a hard spend
> limit on that key with your provider before the URL goes anywhere public; it turns the
> worst case into a capped number instead of an open tab. Ending `FALLBACK_MODELS` in
> free models helps too.

### Turning on accounts

1. In the Netlify UI, go to **Extensions → Neon** and enable it. It provisions a free
   Postgres and injects `NETLIFY_DATABASE_URL` into the site environment, so no
   connection string ever has to be copied by hand. (Any other Postgres works too —
   set `DATABASE_URL` yourself and it takes precedence.)
2. Set `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
3. Create the tables: `npm run auth:migrate`. It applies `netlify/lib/auth-schema.sql`
   in one transaction and is safe to re-run.
4. Redeploy. `/api/auth-status` flips to `{"enabled":true}` once the database is live.
5. For Google, add an OAuth client with redirect URI
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

Open Chat is a PWA. In Chrome or Edge, use the install icon in the address bar; on iOS,
**Share → Add to Home Screen**. It opens in its own window and the shell is cached, so it
starts instantly. When a new version deploys you get a toast offering to reload rather
than being interrupted mid-sentence.

## Project layout

```
netlify/
  functions/     chat.mts (streaming), health.mts, auth.mts, auth-status.mts
  lib/           settings, error mapping, SSE helpers, Better Auth setup + SQL
src/
  components/    UI, with shadcn primitives under components/ui
  hooks/         use-chat (the streaming engine), use-sessions, use-settings
  lib/           api, db (IndexedDB), image (resizing), auth-client
  pages/         landing, about, auth, chat
scripts/         generate-icons.mjs — dependency-free PNG rasteriser for the PWA icons
```

## Known limits

- A single reply must finish within 60 seconds. Very long outputs get a clear timeout
  message rather than a severed connection.
- Chats do not sync between devices or browsers. That is the trade for not storing them.
- Token usage is only shown when the upstream provider reports it; several do not.
- There is no model picker. Which model answered is reported per reply, but it is not
  yours to choose — that is deliberate, not missing.
- The UI components come from shadcn's `radix-nova` registry. Two files carry local
  modifications marked `LOCAL MODIFICATION` — `ui/scroll-area.tsx` (a viewport ref the
  streaming auto-scroll needs) and `ui/sonner.tsx` (no `next-themes` dependency). Re-apply
  them if you ever `shadcn add` those two.

# DukaanMitra - backend setup (optional)

The site is fully functional without any backend. Chat uses scripted replies
and the waitlist saves to `localStorage`. Do these steps when you want real AI
replies and real lead storage.

**Cost:** Supabase free tier + Gemini free tier. No credit card needed for
either at the time of writing.

---

## What you need

- A free [Supabase](https://supabase.com) account
- A free [Google AI Studio](https://aistudio.google.com/apikey) API key
- The Supabase CLI (installed below)

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> -> **New project**.
2. Pick a region close to your users (Mumbai for India).
3. Wait for the database to finish provisioning.
4. Copy these from **Project Settings -> API**:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key

> The anon key is safe to ship in the browser **only because** RLS is enabled.
> The `service_role` key must never be used in `index.html`.

---

## 2. Create the tables

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql).
3. Click **Run**.

This creates:

| Table | Purpose | Public access |
| --- | --- | --- |
| `waitlist` | Beta signups | insert only |
| `ai_chats` | Optional chat transcripts | none (service role only) |
| `waitlist_summary` | Daily leads by city/type | follows table RLS |

Re-running the file is safe.

---

## 3. Install and link the Supabase CLI

```powershell
npm install -g supabase
supabase login
cd C:\Users\18\dukaanmitra-site
supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the part before `.supabase.co` in your project URL.

---

## 4. Deploy the chat function

```powershell
supabase functions deploy chat
```

The function lives at
[`supabase/functions/chat/index.ts`](supabase/functions/chat/index.ts).
`verify_jwt = true` is set in [`supabase/config.toml`](supabase/config.toml),
so requests must include a valid anon key. The browser already does this.

---

## 5. Add the Gemini key as a secret

```powershell
supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
```

Optional - pick a different model (default is `gemini-2.5-flash`):

```powershell
supabase secrets set GEMINI_MODEL=gemini-2.0-flash
```

Check what is set:

```powershell
supabase secrets list
```

> The key is stored encrypted by Supabase and is only readable inside the
> edge function. It never reaches the browser bundle.

---

## 6. Connect the website

Open [`index.html`](index.html) and find the `CONFIG` block (around line 843):

```js
var CONFIG = {
  supabaseUrl: "https://YOUR_REF.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
  useRealAI: true
};
```

- Set `useRealAI: true` **only after** step 4 succeeds. If you leave it `false`,
  the chat keeps using scripted replies even though the waitlist is live.
- The waitlist starts saving to Supabase as soon as the URL and anon key are
  filled in.

Reload the site. Done.

---

## 7. Test it

**Chat function** (PowerShell):

```powershell
$uri = "https://YOUR_REF.supabase.co/functions/v1/chat"
$key = "YOUR_ANON_KEY"
$body = '{"city":"kanpur","messages":[{"role":"user","content":"5kg atta ka rate batao"}]}'

Invoke-RestMethod -Method Post -Uri $uri `
  -Headers @{ apikey = $key; Authorization = "Bearer $key"; "Content-Type" = "application/json" } `
  -Body $body
```

Expected: `reply` with a price answer in Hinglish.

**Waitlist:**

1. Submit the form on the site.
2. In Supabase, open **Table Editor -> waitlist**.
3. The row should appear within a second.

If the insert fails, the site still shows success and keeps the lead in
`localStorage`, so a broken backend never blocks a visitor.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `401` from the function | Wrong anon key, or the function was deployed with JWT verification off/on incorrectly. Redeploy with `supabase functions deploy chat`. |
| `500 AI is not configured yet` | `GEMINI_API_KEY` secret is missing. Run step 5 again. |
| `502 AI is temporarily unavailable` | Invalid/expired Gemini key, model name unavailable, or quota exhausted. Check `supabase functions logs chat`. |
| `429 Too many requests` | Built-in limit of 20 requests/minute per IP. Wait a minute. |
| Chat still scripted | `useRealAI` is `false`, or the URL/key in `CONFIG` is empty. |
| Waitlist row missing | RLS insert policy not applied - re-run `schema.sql`. |

View logs:

```powershell
supabase functions logs chat
```

---

## Security notes

- **Never** put `GEMINI_API_KEY` or `service_role` in `index.html`.
- The anon key is public by design; RLS is what protects your data.
- `waitlist` allows inserts but not reads. Only the dashboard/service role can
  read phone numbers.
- The edge function validates the city, caps message count/length, rate-limits
  per IP, and logs only the last 12 messages.
- Add a CAPTCHA or Turnstile before a paid launch if spam becomes a problem.

---

## Removing the backend

Set `CONFIG` back to empty strings and `useRealAI: false`. The site falls back
to the scripted demo and `localStorage` instantly. You can pause the Supabase
project instead of deleting it.

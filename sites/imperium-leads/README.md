# Imperium Leads

The lead tracker for Imperium Detailing: Morning chase list, Evening log, Add, Leads and
Numbers. A phone app (add it to the home screen) shared by Angus and Ananth.

- **The page** is `imperium-leads.html`: the original design, plus "Add a job done today" on the
  Evening tab for work that never came in as a lead (repeat customers, referrals). How it stores
  things all lives in `public/claude-shim.js`, so the page only changes when what it shows does.
- **Storage** is one Supabase table of JSON documents (`supabase/schema.sql`). The shim gives the
  page the `claude.use("db")` API it was written for (doc/collection, get/set/update/delete,
  onSnapshot) on top of it, with live updates between the two phones.
- **Sign-in** is a 4-digit team PIN, asked once per phone. `/api/unlock` checks it and signs the
  phone in as the one shared login (`team@imperiumdetailing.com.au`). Five wrong PINs in a row
  lock it for 15 minutes, then longer.
- **New enquiries** arrive at `POST /api/lead` from the website's booking and fleet forms and
  from Make.com (Facebook instant forms). One lead per phone number per day.
- **Reminders** go by email at about 07:25 (chase list and today's jobs) and 17:20 (leads not
  logged yet), Canberra time.

## Files

| | |
|---|---|
| `imperium-leads.html` | The page. |
| `public/claude-shim.js` | The storage layer and the PIN screen. |
| `public/sw.js`, `public/manifest.json`, icons | Home-screen app; opens with no signal (the list needs one). |
| `api/unlock.js` | PIN check and sign-in. |
| `api/lead.js` | New enquiries in. |
| `api/remind.js` | The morning and evening emails (Vercel cron, `vercel.json`). |
| `lib/` | Lead mapping, the reminder lists, Canberra dates, Supabase helpers. |
| `supabase/schema.sql` | The table, its team-only rule, live updates. |
| `build.mjs` | Makes `public/index.html` (the page plus the phone-app tags), copies supabase-js, writes `public/config.js`. |

## Set up (once)

1. **Supabase** (free): New project `imperium-leads`, region Sydney. SQL Editor → New query →
   paste all of `supabase/schema.sql` → Run. From Project Settings → API keys, copy the Project
   URL, the publishable (anon) key and the secret (service_role) key.
2. **Resend** (free): add and verify the domain `imperiumdetailing.com.au` (it gives you DNS
   records to add), then create an API key. Until the domain is verified Resend only delivers
   to your own address.
3. **Vercel**: Add New → Project → import `frontline-websites` → Root Directory
   `sites/imperium-leads` → Framework Preset "Other". Add these environment variables, then Deploy:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_ANON_KEY` | publishable (anon) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | secret (service_role) key. Server only. |
   | `LEADS_PIN` | the 4-digit team PIN |
   | `LEAD_SECRET` | a long random string; Make.com sends it |
   | `CRON_SECRET` | a long random string; Vercel sends it to the reminder job |
   | `RESEND_API_KEY` | from Resend |
   | `REMIND_FROM` | `Imperium Leads <leads@imperiumdetailing.com.au>` |
   | `REMIND_ANGUS` | Angus's email |
   | `REMIND_ANANTH` | Ananth's email |

   Optional: `LEAD_ORIGINS` (the website addresses allowed to post leads without the secret;
   defaults to `https://imperiumdetailing.com.au,https://www.imperiumdetailing.com.au`),
   `APP_URL` (the link in the emails; defaults to the production address).
4. **The website** (`sites/imperium-detailing` on Vercel): add `NEXT_PUBLIC_LEADS_API` =
   `https://<this app>/api/lead`, then redeploy. Until it's set the forms work as before and
   simply don't copy leads across.

The team login is created the first time someone enters the right PIN. To change the PIN,
change `LEADS_PIN` and redeploy; phones already signed in stay signed in.

## New enquiries: `POST /api/lead`

Headers: `Content-Type: application/json` and `x-lead-secret: <LEAD_SECRET>`.

```json
{ "name": "Jo Smith", "phone": "0400 123 456", "email": "jo@example.com",
  "service": "Ceramic coating", "vehicle": "Kluger", "suburb": "Gungahlin",
  "when": "As soon as possible", "notes": "Dog hair", "source": "Meta ad · Brand film", "form": "facebook" }
```

- `source`: anything with meta, facebook or instagram → Meta ad; google → Google; tiktok →
  TikTok; else Website. The ad's name is whatever comes after `·`.
- `service`: full, interior, exterior, correction, ceramic, maintenance or pre-sale in the text
  picks that service; anything else is Not sure.
- `when`, `email`, `notes` and `form` go into the lead's notes.
- Answers `{"ok":true,"duplicate":false,"id":"…"}`, or `"duplicate":true` when that phone
  number already has a lead today.

The website's forms post from the visitor's browser, where a secret can't be kept, so those
are let in by their address (`LEAD_ORIGINS`) instead of the secret.

### Make.com (Facebook instant forms)

Scenario: **Facebook Lead Ads → Watch New Leads**, then **HTTP → Make a request**:

- URL: `https://<this app>/api/lead`
- Method: `POST`
- Headers: `Content-Type` = `application/json`, `x-lead-secret` = your `LEAD_SECRET`
- Body type: Raw, content type JSON (application/json)
- Request content (map the fields from the Facebook module):

```json
{
  "name": "{{1.full_name}}",
  "phone": "{{1.phone_number}}",
  "email": "{{1.email}}",
  "service": "{{1.which_service}}",
  "vehicle": "{{1.what_car}}",
  "suburb": "{{1.suburb}}",
  "when": "{{1.when}}",
  "notes": "",
  "source": "Meta ad · {{1.ad_name}}",
  "form": "Facebook instant"
}
```

The `{{1.…}}` names depend on the questions in the instant form; pick them from Make's list.

## Reminders

Vercel's clock is UTC and Canberra moves an hour for daylight saving, so the cron calls
`/api/remind` at both the summer and the winter time; only the call in the right Canberra hour
sends, once a day. On Vercel's free plan a job runs some time within its hour, so the morning
email lands between about 07:00 and 08:00 and the evening one between 17:00 and 18:00.

The evening email is only sent when something still needs logging.

To test by hand (needs the cron secret):

```
curl "https://<this app>/api/remind?slot=morning&dry=1" -H "Authorization: Bearer <CRON_SECRET>"    # show, don't send
curl "https://<this app>/api/remind?slot=morning&force=1" -H "Authorization: Bearer <CRON_SECRET>"  # send now
```

## Develop

```
npm install
npm test          # lead mapping, the reminder lists, Canberra dates
node build.mjs    # needs SUPABASE_URL and SUPABASE_ANON_KEY to point at a project
```

# Imperium Leads

The lead tracker for Imperium Detailing: Morning chase list, Evening log, Add, Leads and
Numbers. A phone app (add it to the home screen) shared by Angus and Ananth.

- **The page** is `imperium-leads.html`. Adding a lead or booking asks for the essentials only
  (service, car, suburb, and for a booking the date and price). Morning shows **Payments due**:
  jobs done and not paid, oldest first, with a Paid button and "Add someone who owes you". Evening
  has "Add a job done today" for work that never came in as a lead (repeat customers,
  referrals). How it stores things all lives in `public/claude-shim.js`, so the page only changes
  when what it shows does.
- **Storage** is one Supabase table of JSON documents (`supabase/schema.sql`). The shim gives the
  page the `claude.use("db")` API it was written for (doc/collection, get/set/update/delete,
  onSnapshot) on top of it, with live updates between the two phones.
- **Sign-in** is a 4-digit team PIN, asked once per phone. `/api/unlock` checks it and signs the
  phone in as the one shared login (`team@imperiumdetailing.com.au`). Five wrong PINs in a row
  lock it for 15 minutes, then longer.
- **New enquiries** arrive at `POST /api/lead` from the website's booking and fleet forms and
  from Make.com (Facebook instant forms). One lead per phone number per day.
- **Job checklists**: every booked job gets a checklist built from the SOPs. The crew works down
  it on site, a second person signs it off, and only then can the job be marked done (see below).
- **Reviews**: tap **Job done** on a job and the app walks you through asking for a Google review
  (see below). Morning shows the review texts and nudges due today, and the last 30 days.
- **Reminders** go by email at about 07:25 (chase list and today's jobs) and 17:20 (leads not
  logged yet), Canberra time.

## Files

| | |
|---|---|
| `imperium-leads.html` | The page. |
| `public/claude-shim.js` | The storage layer and the PIN screen. |
| `seed/sops.json` | The job SOPs, word for word from the Appendix, plus which ones each service gets. |
| `public/jobs.js` | The checklist rules: which SOPs a job gets, progress, sign-off, paint flags, the dashboard numbers, the markdown export (plain script, shared with the tests). |
| `public/reviews.js` | The review steps, the texts, what's due and the 30-day counts (plain script, shared with the tests). |
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

## Job checklists

**Records** (all in the one `docs` table, so no database change):

| Record | What's in it |
|---|---|
| `sops/<key>` | One SOP template (`every_job`, `exterior`, `interior`, `correction`, `ceramic`, `handover`, `signoff`): sections, and items with a fixed id, type (`step`, `rule`, `clip`, `signoff`, `script`), title (the bold words), detail, sub-points, required, and when / length / what it's for on clips. |
| `settings/sop` | Which templates each service gets, `stopAfter` (correction and ceramic stop the exterior steps after the rinse), which pitch to show, the paint thresholds (80 and 30 microns) and who the admins are (Angus). |
| `checklists/<leadId>` | The job's frozen copy of its SOPs, made when it's booked. Editing an SOP later doesn't change it. |
| `jobs/<leadId>` | Progress: one key per tick (`s:<itemId>`: done, skipped and why, note, by, at), paint readings per panel (`p:<panel>`), `correction`, `warranty`, `ceramicPitched`, `planPitched`, `signoff`, `override`. Each tick saves on its own, so two phones never undo each other. |
| `audit` | Sign-off overrides: who, when, why. |

The first time the app runs it writes `seed/sops.json` into the database. After that, edit the SOPs
in the app: **Numbers › Job SOPs › Edit SOPs** (admins only), which also exports them as markdown in
the Appendix's layout. A test rebuilds the Appendix from the seed and checks it matches exactly.

**On site.** **Start job** on a booked job (Morning or the lead) opens the checklist: Steps (one
block per SOP, tap anywhere on a row to tick it, ••• for a note or to skip with a reason), Clips
(Before / During / After, tick when filmed), Paint (correction and ceramic: 5 readings per panel,
red under 80 or a gap over 30, and the pad and polish record), Warranty (ceramic: filled in from the
job, annual check a year on) and Sign-off. The handover block has the right pitch for the service,
the referral line and the review ask, each with Copy, and Ceramic pitched / Plan pitched.

**Sign-off** opens when every step is done or skipped. Whoever ticked the most steps can't sign; the
other person switches to their name (the name button at the top of the checklist) and checks it.
Then **Mark job done** sets `completedAt` and `reviewStatus: "not_asked"` and the review steps start.
An admin can override the sign-off with a written reason, which is logged. "Add a job done today"
and "Add someone who owes you" are records of work already finished, so they have no checklist.

**Saves.** Ticks show straight away. If the signal drops they wait on the phone (even through a
reload) and save when it's back; the top of the checklist says "Not saved yet" until they have.

**Dashboard (Morning).** Today's jobs show checklist progress. "Not signed off this week" lists jobs
from earlier in the week that still aren't signed off. The 30-day tiles show steps skipped per job,
clips filmed of those expected, and how often the ceramic and plan pitches were made.

**Services.** Exterior, Interior, Full detail, Correction and Ceramic get the lists in the brief.
Pre-sale and Not sure get the Full detail lists; Maintenance plan gets the Exterior lists. Change
these in the editor.

## Reviews

Tap **Job done** on a job card (Morning or Evening), or **Job done: ask for a review** when you
open a booked job. That sets `completedAt` and `reviewStatus: "not_asked"`, and the Review card
walks through it:

| Status | The card says | Buttons |
|---|---|---|
| `not_asked` | At handover, walk them round the car, then say this (the in-person script) | Asked in person, Skip |
| `asked_in_person` | Send this text tonight (with their first name, the car and the settings) | Copy text, Text sent |
| `text_sent` | Before 3 days: when to nudge. From 3 days: the one nudge text | Copy text, Nudged, They reviewed, Declined |
| `nudged` | Leave it now. Never a second nudge | They reviewed, Declined |
| `reviewed` | Reply within 24 hours (reply template) | Copy text |
| `declined`, `skip` | Nothing more to do | |

Each step stamps its time on the lead: `reviewAskedAt`, `reviewTextSentAt`, `reviewNudgedAt`,
`reviewLeftAt`. `reviewNotes` is a short note. The older `reviewAsked` / `reviewLeft` Yes/No fields
are kept in step for the Numbers tab. A wrong tap can be fixed with **Review status** in the lead's
edit sheet. Leads are JSON documents, so no database change was needed.

**Make a review text** (top of the Reviews card on Morning) is for anyone, lead or not: type their
name, the car if you like, and your name, and it writes the review text with the link, ready to
copy and paste into a text.

**Review settings** (Morning, under the review counts) holds the review link, who the texts are
signed by and the business name. Both phones share them (`settings/reviews`); empty ones fall
back to `https://g.page/r/CSwRG2iKFelCEAE/review`, Angus and Imperium Detailing.

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
npm test          # lead mapping, the reminder lists, Canberra dates, the review steps, the job checklists
node build.mjs    # needs SUPABASE_URL and SUPABASE_ANON_KEY to point at a project
```

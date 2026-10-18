# Imperium Leads

The lead tracker for Imperium Detailing: Today, Add, Leads, Board and Numbers. A phone app (add
it to the home screen) shared by Angus and Ananth. Built for one-handed use on a phone: big
buttons, one list to work through, everything rare behind a "…" menu.

- **The page** is `imperium-leads.html`. How it stores things all lives in
  `public/claude-shim.js`; the rules (stages, touches, Today, the numbers) are in `public/model.js`
  and the words of every text are in `public/texts.js`.
- **Storage** is one Supabase table of JSON documents (`supabase/schema.sql`). The shim gives the
  page the `claude.use("db")` API it was written for (doc/collection, get/set/update/delete,
  onSnapshot) on top of it, with live updates between the two phones.
- **Previews never change real leads.** Any build that isn't the live site (a Vercel preview, or a
  build on a computer) is a preview: it reads the real list, but every save stays on that phone
  (localStorage) and is shown on top of the real list. A bar at the top says PREVIEW, with Reset
  to throw the changes away (`config.js` → `preview`, set in `build.mjs` from `VERCEL_ENV`).
- **Sign-in** is a 4-digit team PIN, asked once per phone. `/api/unlock` checks it and signs the
  phone in as the one shared login (`team@imperiumdetailing.com.au`). Five wrong PINs in a row
  lock it for 15 minutes, then longer.
- **New enquiries** arrive at `POST /api/lead` from the website's booking and fleet forms and
  from Make.com (Facebook instant forms). The same phone number goes on the lead that's already
  there (see below).
- **No AI and no texting service.** Nothing needs an API key. Every text is sent by one of you
  from your own phone; the app only fills in the words. Leads are never deleted.

## Files

| | |
|---|---|
| `imperium-leads.html` | The page. |
| `public/claude-shim.js` | The storage layer and the PIN screen. |
| `public/reviews.js` | The review steps, the texts, what's due and the 30-day counts (plain script, shared with the tests). |
| `public/texts.js` | The texts and the price sheet (plain script, shared with the tests). |
| `public/model.js` | The lead model: the five stages, call hours, the four touches, Today's list, the numbers and the upgrade (plain script, shared with the server and the tests through `lib/model.js`). |
| `public/sw.js`, `public/manifest.json`, icons | Home-screen app; opens with no signal (the list needs one). |
| `api/unlock.js` | PIN check and sign-in. |
| `api/lead.js` | New enquiries in. |
| `lib/` | Lead mapping, the shared model for the server, Supabase helpers. |
| `supabase/schema.sql` | The table, its team-only rule, live updates. |
| `build.mjs` | Makes `public/index.html` (the page plus the phone-app tags), copies supabase-js, writes `public/config.js`. |

## Set up (once)

1. **Supabase** (free): New project `imperium-leads`, region Sydney. SQL Editor → New query →
   paste all of `supabase/schema.sql` → Run. From Project Settings → API keys, copy the Project
   URL, the publishable (anon) key and the secret (service_role) key.
2. **Vercel**: Add New → Project → import `frontline-websites` → Root Directory
   `sites/imperium-leads` → Framework Preset "Other". Add these environment variables, then Deploy:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_ANON_KEY` | publishable (anon) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | secret (service_role) key. Server only. |
   | `LEADS_PIN` | the 4-digit team PIN |
   | `LEAD_SECRET` | a long random string; Make.com sends it |

   Optional: `LEAD_ORIGINS` (the website addresses allowed to post leads without the secret;
   defaults to `https://imperiumdetailing.com.au,https://www.imperiumdetailing.com.au`).

   The reminder emails are gone, so `CRON_SECRET`, `RESEND_API_KEY`, `REMIND_FROM`,
   `REMIND_ANGUS`, `REMIND_ANANTH` and `APP_URL` aren't used any more; they can be deleted.
3. **The website** (`sites/imperium-detailing` on Vercel): add `NEXT_PUBLIC_LEADS_API` =
   `https://<this app>/api/lead`, then redeploy. Until it's set the forms work as before and
   simply don't copy leads across.

The team login is created the first time someone enters the right PIN. To change the PIN,
change `LEADS_PIN` and redeploy; phones already signed in stay signed in.

## New enquiries: `POST /api/lead`

Headers: `Content-Type: application/json` and `x-lead-secret: <LEAD_SECRET>`.

```json
{ "name": "Jo Smith", "phone": "0400 123 456", "email": "jo@example.com",
  "service": "Ceramic coating", "vehicle": "Kluger", "suburb": "Gungahlin",
  "when": "asap", "notes": "Dog hair", "source": "Meta ad · Brand film", "form": "facebook" }
```

- `name` or `phone`: at least one is needed. The rest are optional.
- `when` (or `timeline`): the timeline answer, as the form's key (`asap`, `within_1_2_weeks`,
  `just_browsing`) or its words ("Within 1 to 2 weeks"). It sets the lead's score: ASAP is Hot,
  1 to 2 weeks is Warm, Just browsing is Browsing.
- `owner`: `Angus` or `Ananth` when the source knows who it's for. Without one, leads are shared
  out in turn (`_system/owner-turn` remembers whose go is next).
- `email` and `formId` (or `form_id`, `leadgen_id`) are kept on the lead, shown only in Open.
- `source`: anything with meta, facebook or instagram → Meta ad; google → Google; tiktok →
  TikTok; else Website. The ad's name is whatever comes after `·`.
- `service`: full, interior, exterior, correction, ceramic, maintenance or pre-sale in the text
  picks that service; anything else is Not sure.
- `when`, `email`, `notes` and `form` also go into the lead's notes.
- **The same phone number** (however it's written) goes on the lead that's already there when
  that lead is still open (New, Chasing, Waiting) or came in within the last 30 days and
  its job isn't done yet: the enquiry is added to its list, empty fields are filled in, and it
  shows at the top of Today marked "Enquired again" (a Waiting lead starts its four touches
  again). Someone from longer ago, or a customer whose job is done, gets a new lead marked Repeat
  (`repeatOf` is the old lead), so the old job and its takings stay as they were. The Add tab
  does the same. Leads marked Not real are never matched. Only the changed fields are written,
  so a phone saving the same lead at that moment loses nothing.
- Answers `{"ok":true,"duplicate":false,"id":"…"}`, or `{"ok":true,"duplicate":true,"merged":true,"id":"…"}`
  when it went on an existing lead.

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

## Five stages

**New → Chasing → Booked → Done**, and **Waiting** (with a reason: No reply, Lost or Not real).
Not real leads (`junk: true`) stay in the app but are kept off Today and out of every number.

**The upgrade** from the old twelve statuses runs by itself the first time the app opens: it
saves a copy of every lead to `backups/` first, then merges the new fields into each lead. Each
lead's old status is kept in `old_status`, and every field it changed is kept in `v4Was`.

| Old | New |
|---|---|
| New | New |
| Chasing, Quoted | Chasing (the quote stays in `quoted`, and counts as a touch) |
| Booked | Booked |
| Done, Review asked, Owes money | Done, with two ticks: Review asked and Owes money |
| Waiting, Lost, Not real | Waiting, reason No reply, Lost or Not real |

## The four touches

Touch 1 straight away, touch 2 the next day, touch 3 on day 3, touch 4 on day 7 (counted from
touch 1). A touch done late still waits the planned gap before the next (2 days, then 4), so
nobody is texted two days running. After touch 4 with no booking, the lead moves to Waiting (No
reply) by itself.

**Call hours** are 8:00am to 7:00pm every day, weekends too (Settings; `settings/hours`). A lead
that comes in outside them doesn't start its timer until 8:00am.

## Today: "Do these now"

One list: only leads with a touch due today or overdue. Brand-new leads first, then Hot, then
Warm, then the rest, oldest first in each. At most 10; the rest roll to tomorrow (the note says
"+3 tomorrow"). When the list is empty: **All done for today**.

- **Reply timer** on new leads, from when they came in: green under 5 minutes, orange 5 to 15,
  red over 15. Overnight leads say "Starts 8:00am".
- **2 days overdue**: a lead whose touch is 2 or more days overdue moves to Waiting (No reply) by
  itself instead of piling up.
- **The old backlog**: leads that were already 2 or more days overdue on the day this version
  went live (`settings/simple.since`) aren't moved by themselves and aren't on the list. A banner
  links to **Clear old backlog** instead.
- **Mine or Both**: each of you sees your own leads by default (Today, Leads and Board). The
  toggle is remembered on the phone. Numbers is both of you unless you pick one.
- **End of day** and **Running low** stay at the bottom of Today.

## The lead card

Name · car · price (or quote, or "from" the price sheet) on the first line; service · how long
since it came in · which touch is next ("Touch 2 of 4") on the second. Three buttons:

| Button | Does |
|---|---|
| TEXT | opens the messages app (`sms:`, works on iPhone) to their number with the right touch's words filled in |
| CALL | rings them (`tel:`) |
| ✓ DONE | logs that this touch was sent and books in the next one. On a booking it's **✓ Job done** |

Booked jobs have two ticks: **Offered ceramic** and **Offered maint. plan**. Done jobs also have
**Review asked** and **Owes money** (ticked when it isn't paid; unticking marks it paid).

**…** opens the rest: change status (Booked asks the day and price; Waiting asks the reason),
the tag (Hot, Warm, Browsing), add a note, the full notes and history, Edit details, and Review
steps for done jobs.

## Texts

`public/texts.js` holds the words. [name], [car] and [owner] fill in by themselves; [day] is
left for you to change before sending. No emojis.

1. "Hey [name], it's [owner] from Imperium Detailing. Got your request for the [car]. Full details start from $250 and we come to you. I've got [day] or [day] free. Which suits?"
2. "Hey [name], just checking you got my message about the [car]. Happy to sort a price and lock in a time. What day suits?"
3. "Hey [name], still keen on getting the [car] done? I've got spots this week if you want one."
4. "Hey [name], last one from me. If you'd still like the [car] detailed, just reply and I'll sort a time. If not, no worries at all."

Waiting leads get the "still keen?" text. After a job: the payment text, then the review ask
once it's paid. All five can be changed in **Settings → Messages** (`settings/templates`); a
blank one goes back to the original.

## Add

Four things are needed: name, phone, car and **Which ad?** (the ad names from Settings, plus Not
from an ad and Referral / repeat). Everything else (service, suburb, when, quoted or booked,
notes) is folded under **More details**. Below the form: "+ Job already done" and "+ Someone owes
you" for work that never came in as a lead.

## Settings (the ⚙ at the top)

Clear old backlog, Messages, Ad names, Weekly target (default $5,000), Call hours, Review texts,
and Backup (download every lead as CSV or JSON). All saved for both phones.

**Clear old backlog**: pick a day; it lists every Chasing lead that came in before it, with a
Text button each (their name and car filled in) and **Copy message** for the words. Then **Move
all to Waiting** asks you to confirm, and moves them to Waiting (No reply).

## Numbers

**This week** (Monday to Sunday, both of you): money from this week's jobs against the target
(a progress bar), jobs done, ceramics sold, new maintenance plans, the share of new leads replied
to within 5 minutes, and the share of this week's jobs offered a ceramic and a plan.

Then, for the period and person picked: Leads, Booked, Close rate, Replied within 5 minutes,
Booked $, Cash collected, Still to collect, Ad spend, Cost per booked job, Quotes out. **By ad**:
leads, booked, booked $ and close rate for each ad (leads from before the ad was kept show as
Unknown). Ad spend (one total a week), the End of day forms, and **More** (lost reasons, reviews,
by source, by service, next service due) are as before. Tap any figure or row to see who's in it.

## Reviews

**Review steps** (in the … menu of a done job) walks through asking for a Google review:
in-person script, the text once they've paid, one nudge after 3 days, then leave it. Each step
stamps its time on the lead (`reviewAskedAt`, `reviewTextSentAt`, `reviewNudgedAt`,
`reviewLeftAt`). Ticking Review asked on the card counts as asked in person. Review settings are
in Settings (`settings/reviews`).

## Develop

```
npm install
npm test          # stages, the four touches, Today, the upgrade, duplicates, the texts, the numbers, reviews
node build.mjs    # needs SUPABASE_URL and SUPABASE_ANON_KEY to point at a project; a preview unless VERCEL_ENV=production
```

# Imperium Leads

The lead tracker for Imperium Detailing: Today, Add, Leads and Numbers. A phone app (add it to
the home screen) shared by Angus and Ananth.

- **The page** is `imperium-leads.html`. Adding a lead or booking asks for the essentials only
  (service, car, suburb, and for a booking the date and price). **Today** is the one list to work
  through (below), with Jobs today, **Payments due** (jobs done and not paid, oldest first, with a
  Paid button and "Add someone who owes you"), "Add a job done today" for work that never came in
  as a lead, the review texts and the reels counter underneath. How it stores things all lives
  in `public/claude-shim.js`, so the page only changes when what it shows does.
- **Storage** is one Supabase table of JSON documents (`supabase/schema.sql`). The shim gives the
  page the `claude.use("db")` API it was written for (doc/collection, get/set/update/delete,
  onSnapshot) on top of it, with live updates between the two phones.
- **Sign-in** is a 4-digit team PIN, asked once per phone. `/api/unlock` checks it and signs the
  phone in as the one shared login (`team@imperiumdetailing.com.au`). Five wrong PINs in a row
  lock it for 15 minutes, then longer.
- **New enquiries** arrive at `POST /api/lead` from the website's booking and fleet forms and
  from Make.com (Facebook instant forms). The same phone number goes on the lead that's already
  there (see below).
- **Reviews**: tap **Job done** on a job and the app walks you through asking for a Google review
  (see below). Today shows the review texts and nudges due today; Numbers has the last 30 days.
- **No AI and no texting service.** Nothing needs an API key. Every text is sent by one of you
  from your own phone; the app only fills in the words. Leads are never deleted.

## Files

| | |
|---|---|
| `imperium-leads.html` | The page. |
| `public/claude-shim.js` | The storage layer and the PIN screen. |
| `public/reviews.js` | The review steps, the texts, what's due and the 30-day counts (plain script, shared with the tests). |
| `public/texts.js` | The texts and the price sheet (plain script, shared with the tests). |
| `public/model.js` | The lead model: stages, call hours, the schedule, Today's lists and the upgrade (plain script, shared with the server and the tests through `lib/model.js`). |
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
  that lead is still open (New, Chasing, Quoted, Waiting) or came in within the last 30 days and
  its job isn't done yet: the enquiry is added to its list, empty fields are filled in, and it
  shows under New on Today marked "Enquired again" (a Waiting or Lost lead starts its schedule
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

## Follow-ups and call hours

**Call hours** are 8:00am to 7:00pm every day, Canberra time (**Call hours** on Today changes
them; `settings/hours`). A lead that comes in outside them isn't shown until they start;
then it's first on the list with a moon, and its 5-minute reply clock starts then too. The
Numbers tab counts reply times from that adjusted start (`replyMins` itself is still saved
counting from when the lead came in).

**The schedule**, counted from the first touch. A call and a text on the same day are one touch.

| Lead | Touches | Then |
|---|---|---|
| Hot, Warm or no tag | day 0, 1, 3, 7 | Waiting |
| Just browsing | day 0, 3 | Waiting |
| Quoted | day 2, 5, 9 after the quote | Waiting |

Logging Texted, No answer or a call sets the next due day. A missed day doesn't pile up: the lead
just shows as due today. **Waiting** (it was going to be called Cold) keeps the lead: it comes
up once every 30 days for a check-in text, then waits again. **Not now** takes a lead off the
list until a day you pick, then its schedule carries on with the same gaps. **Answered** stops
the schedule and asks one question (quoted, booked, not now or lost). A note on a lead being
chased pauses it: it comes back the next day it's due, at the soonest tomorrow, marked Paused.

Each lead keeps: `stage`, `schedule`, `chaseFrom`, `touches`, `lastTouchOn`, `quotedOn`,
`nextFollowUp`, `snoozeUntil`, `paused`, `timeline`, `score`, `lostReason`, `junk`, and
`modelVersion: 3` (`public/model.js` describes each). Nothing older is removed; `status` is kept
in step with the stage.

**The upgrade** runs by itself when the app opens and a lead needs it: it saves a copy of every
lead to `backups/` first, then merges the new fields into each lead. Leads already past their
last touch go to Waiting with their first check-in 30 days on (no catch-up texts are sent or
queued). Each lead's changes are worked out again just before it's written, and anything done
to a lead before the upgrade reaches it is worked out from its upgraded fields, so nothing
logged in the meantime is undone. What it changed is kept on each lead in `v3Was`. It never deletes a lead, and a lead
it can't read is left as it is.

## Today

One list, in this order. Each section only shows when it has someone in it, and the whole list
shrinks as you log things. The count left is on the tab.

1. **Call first**: leads that came in out of call hours (the moon), from the start of call hours.
2. **New**: not called or texted yet.
3. **Hot, due today**: tagged Hot, or Quoted.
4. **Due today**: everything else due, including Waiting leads due their monthly check-in.
5. **Waiting (17)**: folded shut; tap to open.

Inside each: Quoted, then Hot, Warm, Browsing; oldest first. Today shows your own leads; **All**
shows both of you. A lead nobody has touched for 24 hours past when it was due shows on both
lists, marked with whose it is. Close the day, the "Today so far" tiles and the "Leads to log"
list are gone.

## The lead card

Closed, a lead shows only its name and car, then service · timeline · stage and touches ("Chasing
2 of 4") · the quote · the owner, its tag (Hot, Warm or Browsing) and one short note. Email,
form ID and the full notes are behind **Open**. About twice as many fit on a screen as before.

Eight buttons, nothing else:

| Button | Does |
|---|---|
| Call | rings them |
| Text | opens the phone's messages app with the right text filled in (`public/texts.js`) |
| Copy | copies the phone number |
| Open | everything else: email, form ID, notes, history, add a note, edit |
| Texted | logs a text; the schedule sets the next day |
| No answer | logs the call, then offers the missed-call text, one tap |
| Answered | one question: Quoted (how much), Booked (which day; the price is filled from the quote), Not now (which day) or Lost (why) |
| Not now | pick a day; it's off Today till then |

After a quote, the quote text is ready to send, with the hours and two days to fill in.

**Texts.** Nothing is sent by the app: every text is sent by one of you from your own phone.
`public/texts.js` holds the wording and the price sheet ("from" prices, hatch/sedan): Full detail
$225, Exterior $110, Interior $140, Paint correction $397, Ceramic $997. Maintenance plan and
Pre-sale have no price, so their texts say "I'll confirm the price". A quote you typed in is
used instead of the sheet. The Text button picks: the first text for a new lead (the missed-call
text if the call today wasn't answered), then the day 1, day 3 and day 7 texts (browsing: day 3),
the quote text on the day of the quote then the same three, a check-in for Waiting leads, and
after a job the payment text ([link] left for you to paste), then the review ask once it's paid.

## Tags, Not real, the Numbers and Friday

**Tags** come from the timeline answer: ASAP is Hot, 1 to 2 weeks is Warm, Just browsing is
Browsing. One tap on the tag changes it (Hot, Warm, Browsing, round again); a lead being chased
moves to that tag's schedule straight away (Browsing: day 0 and 3).

**The Leads tab** keeps every lead, whatever its stage (nothing is archived or deleted): filter
by stage, owner, "Owes money" or "Not real", and search by name, car, suburb, phone or email. It
shows a hundred at a time, with **Show more** for the rest.

**Not real** (in Open) is for test and fake leads: the lead stays on the Leads tab, marked Not
real, but is left off Today and out of the Numbers. "It's real after all" undoes it.

**Numbers** shows: Leads, Booked, Close rate, Replied within 5 minutes (from the start of call
hours for overnight leads), the money (**Booked $**: the price of every booked job, done or not;
**Cash collected**: the ones ticked Paid; **Still to collect**: the rest), and Cost per booked
job from ads: the total
ad spend in the period divided by the leads from ads (source Meta ad, or with an ad's name) that
booked. **Add this week's ad spend** takes one total a week from Ads Manager and saves it for both
phones (`spend/<Monday>`); per-ad figures are left to Ads Manager. A week counts in a period by
its Monday. Ad figures count both of you. **More** has the rest: average job, per
lead, still open, touches per lead, on a plan, upsells, lost reasons, reviews asked vs left, the
last 30 days of reviews, by source, by service, and who's due for their next service. The
period filters and the person filter are as before.

**Friday from 5:00pm** Today shows a wrap-up for both of you: how many are in each section, how
many quoted leads have had no reply for 14 days or more, and how many are still New. It moves
nothing.

## Reviews

Tap **Job done** on a job card (Jobs today), or **Job done: ask for a review** when you
open a booked job. That sets `completedAt` and `reviewStatus: "not_asked"`, and the Review card
walks through it:

| Status | The card says | Buttons |
|---|---|---|
| `not_asked` | At handover, walk them round the car, then say this (the in-person script) | Asked in person, Skip |
| `asked_in_person` | Not paid yet: tick Paid first. Once paid, the review ask ("Thanks [name], payment received…") | Copy text, Text sent |
| `text_sent` | Before 3 days: when to nudge. From 3 days: the one nudge text | Copy text, Nudged, They reviewed, Declined |
| `nudged` | Leave it now. Never a second nudge | They reviewed, Declined |
| `reviewed` | Reply within 24 hours (reply template) | Copy text |
| `declined`, `skip` | Nothing more to do | |

Each step stamps its time on the lead: `reviewAskedAt`, `reviewTextSentAt`, `reviewNudgedAt`,
`reviewLeftAt`. `reviewNotes` is a short note. The older `reviewAsked` / `reviewLeft` Yes/No fields
are kept in step for the Numbers tab. A wrong tap can be fixed with **Review status** in the lead's
edit sheet. Leads are JSON documents, so no database change was needed.

**Make a review text** (in the Reviews card on Today) is for anyone who's paid, lead or not: type
their name and it writes the review ask with the link, ready to copy and paste into a text.

**Review settings** (Today, in the Reviews card) holds the review link, who the nudge and reply
texts are signed by and the business name. Both phones share them (`settings/reviews`); empty ones fall
back to `https://g.page/r/CSwRG2iKFelCEAE/review`, Angus and Imperium Detailing.

## Develop

```
npm install
npm test          # lead mapping, the schedule, call hours, Today's lists, duplicates, the texts, the review steps
node build.mjs    # needs SUPABASE_URL and SUPABASE_ANON_KEY to point at a project
```

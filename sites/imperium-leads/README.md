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
| `public/jobs.js` | The calendar's logic: jobs and events, numbers, lengths, prices, the agenda (plain script, shared with the tests). |
| `public/model.js` | The lead model: the five stages, call hours, the four touches, Today's list, the numbers and the upgrade (plain script, shared with the server and the tests through `lib/model.js`). |
| `public/sw.js`, `public/manifest.json`, icons | Home-screen app; opens with no signal (the list needs one). |
| `api/unlock.js` | PIN check and sign-in. |
| `api/lead.js` | New enquiries in. |
| `api/deposit.js` | Makes the $50 Stripe deposit link, and says whether one's paid (team only). |
| `api/ghl-import.js` | Brings in the past GHL appointments (a practice run first). |
| `api/ghl-sync.js` | Makes the calendar match GHL: every hour, when the calendar is open, and from Settings (GHL wins). |
| `api/ad-spend.js` | Brings in the ad spend from Meta, each day and on the button (the reading is in `lib/meta.js`). |
| `api/ghl-webhook.js` | GoHighLevel bookings in: the lead booked, its job made, moved or cancelled (the rules are in `lib/ghl.js`). |
| `api/stripe-webhook.js` | Stripe tells it a deposit is paid: the lead shows Deposit paid and moves to Booked. |
| `public/deposit.html` | The "Deposit paid" page customers land on after paying. |
| `lib/` | Lead mapping, the shared model for the server, Supabase and Stripe helpers. |
| `supabase/schema.sql` | The table, its team-only rule, live updates. |
| `build.mjs` | Makes `public/index.html` (the page plus the phone-app tags), copies supabase-js, writes `public/config.js`. |

Vercel builds this app only when something in this folder changed (`ignoreCommand` in
`vercel.json`), so a change to another site in the repo doesn't use up a build.

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
| Done, Review asked, Owes money | Done, with Review asked ticked, and Did they pay? answered |
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
**Review asked**, and **Did they pay? Yes / No**: Yes puts the job in **Payments done**
(`paid: "Yes"`, `paidAt`, `paidBy`), No in **Waiting for payment** (`paid: "No"`). Not answered
yet counts as waiting. The question pops up big straight after **✓ Job done** (and after Done in
the … menu, or a job saved as Completed on the calendar). The same Yes / No is at the top of a
booking's … menu and of its job on the calendar (it saves on the tap), and calendar cards say
**Paid** or **Not paid**. The Board has a column for each (Payments done shows the last 30
days), and the Leads tab can show either.

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

## First contact (how fast we really replied)

Calls and texts often happen before they're logged here, so each lead has a **First contact**
picker in its … menu: Within 5 min, 5–30 min, 30 min+, Next day (tap one to set or change it,
the same one again to clear it). It pops up by itself the moment a lead's first touch is logged
(✓ Done on touch 1, booking a lead nobody has touched, or adding one already quoted or booked).
It's saved as `firstContact`, with who and when (`firstContactBy`, `firstContactAt`), and shows
on the card as a small tag ("⚡ 5 min"). Nothing is filled in for older leads.

"Replied ≤5 min" in Numbers uses First contact where it's been picked, else the app's own reply
time as before (`M.replySpeed`, `M.repliedFast`). This week shows the share of new leads in each
bucket, plus "Not known yet"; tap a row to see who.

## Call notes

**Notes** on every card opens quick-tap chips for what people say (Price, Timing, Pet hair,
Stains, Smell, Scratches / swirls, Wants ceramic info, Selling the car, Needs to check with
partner, Work ute, Garage / no garage, Water or power issue) and a box for anything else. Each note
is saved in the lead's history with the date, time and who wrote it. The newest shows as one
line on the card ("Pet hair, wants Saturday"); the … menu has them all. Numbers has **What people
say**: how often each chip was used in the period, and on how many leads (`M.chipCounts`).

## Booked jobs

Moving a lead to Booked asks for the day, time, address and price (a range like 250-300 is fine:
it's kept in `priceRange`, and its low end counts as the price until the End of day form says
what they paid). **Today's jobs** sit at the top of Today, in time order, each address a
tap-to-open Google Maps link. A booking for today has **On my way**: it opens messages with
"Hey [name], it's Ananth from Imperium Detailing. On our way now, see you soon!" and logs the
time it was sent (`onMyWayAt`, `onMyWayBy`).

## Calendar (jobs and events)

The **Calendar** tab has its own top bar: the menu (the other tabs, Settings, Switch person),
search (job number, name, phone, car, suburb), the logo, and the bell (open jobs with no day, and
jobs in the next 7 days with no crew or no time). Under it: Agenda | Day | Week | Month, then (on Agenda) the month, a crew filter and a service filter (remembered on the
phone), and a week strip, Sunday to Saturday: today circled, a dot under each day with a job.
Swipe the strip (or tap ‹ ›) to change week. The list is that week's jobs and events by day,
each a card in its status colour (Scheduled blue, In Progress yellow, Completed green, Cancelled
grey; Team Meeting pink, Time Off grey with a plane): "1001 - Full Detail - Mazda CX-5", a map pin
when there's an address (tap for Google Maps), the customer, the time, the status, the crew's
initials and the assign-crew button (each tap saves). **+ ADD** makes a job or an event, on the
day picked in the strip.

**Day, Week and Month** have ‹ TODAY ›, the Assigned filter (a person, a kit, or No crew yet),
the service filter, and **Overall | List** (List is the same days as cards).
- **Week**: a row for each kit and person (and No crew yet, and Everyone for team events), a
  column a day ("20 Tue"); jobs are chips "1004 - Kluger" in their status colour. Tap one to open
  it, tap an empty spot to add a job there. On a computer, drag a chip to another day or row.
- **Day**: a column a person, ALL-DAY on top, 7am to 7pm in half hours. Jobs are blocks as long as
  they take (service, number, car, suburb, crew, time). Hold and drag a block to move it to
  another time or person; drag its bottom edge to make it longer or shorter. It saves straight
  away, and the lead's day and time follow. Swipe left or right (at the edge) for the next day.
- **Month**: up to 3 a day, then "+2 more". Tap a day for its Day view.
- **Clashes**: one person or kit on two jobs at once (or on a job while on time off) shows red on
  both jobs, a line above the calendar (tap it for the list), and in the bell.
- **Booked - no date yet**: a panel beside the calendar on a computer (drag one onto a day), a
  button on a phone (tap one to pick its day).

A **job** (collection `jobs`) is linked to its lead: the customer's name, phone, car, address and
suburb stay on the lead, and editing them on a job changes the lead. A job has its number (1001
up), service, add-ons, price (or a range) and final price, day, start and end or all day, crew,
kit, notes and status. Its end time comes from the service's default length (Settings: Full
Detail 3.5 hrs, Interior 2, Exterior 1.5, Maintenance Plan 2.5, Paint Correction and Ceramic
Coating all day). New customers on **+ ADD** get a lead too (Which ad? as on Add; the same phone
goes on the lead that's there).

The lead and its job stay in step: a lead booked anywhere gets a job (the same id from either
phone, `lead-<lead id>`); moving the job moves the lead's day, time and price; a lead moved off
Booked cancels its job; ✓ Job done completes it; cancelling the job asks whether to move the lead
back to Chasing. The first time the new version opens it backs up every lead, then makes a job
for each booked lead and each done one with a job day (`settings/calendar` → `jobsMigratedAt`);
no lead is changed. **Events** (collection `events`): Team Meeting, Time Off or Other, a day, a
time or all day, and who it's for (none picked: everyone). Removing one marks it `deleted`.

## GoHighLevel bookings: `POST /api/ghl-webhook`

GHL sends each booking, and each change to one, to
`https://frontline-websites-6mjg.vercel.app/api/ghl-webhook?key=<GHL_WEBHOOK_SECRET>` (the key can
also go in an `x-ghl-secret` header). Anything without the key is turned away (401).

- **A new booking**: the lead is found by phone (written +61 first, so 0400 111 222 and
  +61400111222 match), then by email. Found: it's Booked for the appointment's day and time, and
  its job is made (or, if it's already booked here, its job takes the appointment). Not found: a
  new lead, source "GHL booking", Booked, with its job. Someone whose job is done gets a new lead
  marked as a repeat, so the old job stays as it was. The job keeps GHL's appointment ID
  (`ghlAppointmentId`), so the same booking is never added twice, and shows **From GHL**.
- **Service** comes from the calendar's name, else the appointment's title ("Ceramic Coating",
  "Interior Detail"…), else the contact's form answer ("What Service"). If none says, it's Other
  and the job shows **Check service** until someone picks one on the job.
- **Filled in from GHL**: the car ("Type Of Vehicle"), how soon ("How Soon?"), suburb, address,
  email, and which ad (GHL's utm content). On a lead already here only the empty ones are filled;
  nothing it has is changed. A lead is matched by its GHL contact first, then phone, then email, then the same full name
  booked within 3 days (often typed in here first, from a call).
- **The same appointment again**: a new time moves the job (and the lead's day and time);
  cancelled cancels the job and moves the lead back to Chasing; no-show flags the job
  **No-show**; showed leaves it as it is.
- Every request is logged (collection `ghl_log`: when, what came in, what happened), kept for
  60 days. Settings → **GHL bookings** → Show what GHL sent.
- Only the live site writes. A preview, or `&dry=1` on the end, answers what it would do and
  changes nothing. A GET with the key answers `{"ok":true,"ready":true}`.

- **Price**: read from the appointment's description (a stated total, "quote 320", else the
  biggest dollar amount, so a $50 deposit isn't taken for the job), else the title.

### The past appointments: `POST /api/ghl-import?key=<GHL_WEBHOOK_SECRET>`

Brings in every GHL appointment from two years back to a year ahead (`&from=` and `&to=` to
change it), with a private integration token in `GHL_API_TOKEN` (GHL → Settings → Private
Integrations: view calendars, calendar events, contacts and opportunities). The sub-account is
`GHL_LOCATION_ID`, else the one the last booking came from.
- Already here (the same person, by GHL contact, phone, email or full name, with a job within 3
  days): that job takes the appointment ID, and the job and lead get the price if they have none.
  Its day isn't moved (the answer says when GHL's differs). Nothing else on the lead changes.
- Still open here (New, Chasing or Waiting, no job day) but GHL says the job happened within two
  months of them coming in: that lead is Done and paid, with this job.
- Someone new: a lead (from the day GHL first had them), Done and paid, with its job Completed.
  A customer from before is marked as a repeat. Still to come: a normal booking.
- Cancelled and no-shows are left out. The price is the description's, else the contact's
  latest opportunity value.
- It's a practice run (what it would do, nothing saved) unless `&go=1`, which backs up every
  lead and job first. A run does up to `&max=` appointments (120) from `&start=`; `next` in the
  answer is where the next run starts. Running it again changes nothing already brought in.

Set up: Vercel → Settings → Environment Variables → `GHL_WEBHOOK_SECRET` = any long random
string, then redeploy. In GHL: Automation → Workflows → new workflow, triggers **Appointment
Status** and **Customer Booked Appointment**, action **Webhook**, method POST, the URL above.

### Matching the calendar to GHL: `/api/ghl-sync`

GHL doesn't send the webhook for everything: nothing comes when a booking is deleted, and not
always when one is moved in GHL's phone app. So every hour (the cron in `vercel.json`, once
`CRON_SECRET` is set), when the calendar is open and it's been 15 minutes, and on **Match the
calendar to GHL now** in Settings, the app reads every appointment from a week ago to six months
ahead and puts each through the webhook's rules (`planBooking`). GHL wins:

- a booking that isn't here is booked in (as the webhook would);
- a moved one moves its job (and the lead's day and time);
- a cancelled one cancels its job, and a job whose GHL booking was deleted is cancelled too
  (the lead goes back to Chasing);
- a job deleted in the app is left alone, and a job that's done stays done (it only moves to
  GHL's day);
- a job with two GHL appointments goes by its first one.

A job's end is GHL's when the booking is an hour or more. A shorter one is GHL's default slot
(30 minutes), so the job gets its service's usual length instead (Settings → Calendar).

Anything it changes is in the GHL log (Settings → Show what GHL sent), and `settings/ghlsync`
says when it last ran. `?dry=1` (and any preview) answers what it would change and saves nothing.
It takes the webhook's key, the app's sign-in, or Vercel's `CRON_SECRET`.

## Deleting

**Delete this lead** (bottom of a lead's … menu) and **Delete this job** (bottom of a job) ask
first, then take it off the app for both phones; deleting a lead takes its jobs too, and deleting
a booked lead's job asks whether to move the lead back to Chasing. Nothing is wiped: the lead or
job is kept marked `deleted` (a lead also not real), so it's in the JSON backup and can be brought
back. A deleted job's number isn't given out again, GHL leaves a deleted job alone, and a new GHL
booking from the same person makes a new lead.

## The $50 deposit (Stripe)

**Send $50 deposit** is on Chasing and Booked leads. Pick the day and time, tap **Make deposit
link**: `/api/deposit` makes a short Stripe Payment Link (`https://book.stripe.com/…`, with a Book
button) for $50 AUD, with the lead's name, car and job day on the payment and on the page, then
**Open messages** has the text ready ("Hey [name], to lock in [day] at [time] for the [car], here's
the $50 deposit link: [link]. It comes off the final price and is fully refundable with 24 hours'
notice."). Each link can be paid once and stays open until it is; making a new link for the same
lead turns the old one off. Every link uses one shared $50 price (lookup key
`imperium_leads_deposit_50`, made the first time), so Stripe's product list holds one Deposit. If
Stripe ever won't make a Payment Link, a (much longer) Checkout link is made instead.

When they pay, Stripe calls `/api/stripe-webhook`: the lead shows **Deposit paid ✓** and moves to
Booked (taking the day and time the link was made for, if it had none). The phone also checks
open links itself about once a minute, so a preview (which Stripe can't reach, and which never
writes to the real list) shows it too, kept on that phone only.

Set up in Vercel → the leads project → Settings → Environment Variables (never in the code):

| Name | Value | Where from |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` to test, later `sk_live_…` | Stripe → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Stripe → Developers → Webhooks → your endpoint → Signing secret |

The webhook endpoint is `https://frontline-websites-6mjg.vercel.app/api/stripe-webhook`, event
`checkout.session.completed` (add `checkout.session.async_payment_succeeded` too). Only the live
site writes from the webhook. Test cards: 4242 4242 4242 4242, any future date, any CVC.

## Settings (the ⚙ at the top)

Clear old backlog, Calendar (crew, kits and vans, default job lengths, add-ons), Messages (the four touches, still keen, deposit and on my way), Ad names, Weekly target (default $5,000), Call hours, Review texts,
and Backup (download every lead as CSV, or everything, jobs and events too, as JSON). All saved for both phones.

**Clear old backlog**: pick a day; it lists every Chasing lead that came in before it, with a
Text button each (their name and car filled in) and **Copy message** for the words. Then **Move
all to Waiting** asks you to confirm, and moves them to Waiting (No reply).

## Numbers

**This week** (Monday to Sunday, both of you): money from this week's jobs on the calendar
against the target (a progress bar; a lead with two jobs this week counts both), jobs done,
ceramics sold, new maintenance plans (a plan visit for someone already on a plan isn't new), the
share of new leads replied to within 5 minutes, and the share of this week's jobs offered a
ceramic and a plan.

Then, for the period and person picked: Leads, Booked, Close rate, Replied within 5 minutes,
Booked $, Payments done, Waiting for payment, Coming up, Ad spend, Cost per booked job, Quotes out.
Leads count by the day they came in. The past jobs brought in from GHL (`importedFrom: "ghl"`)
count in the money but not as leads, since they're all booked. The money is the calendar's jobs
by job day (`ILJobs.money`): Booked $ is every job in the period, Payments done the ones paid,
Waiting for payment the done ones not paid yet, Coming up the ones not done yet. Jobs with
no price count as $0; the line under the tiles says how many and lists them. **By ad**:
leads, booked, booked $ and close rate for each ad (leads from before the ad was kept show as
Unknown); tap an ad to see what it cost, once the spend comes from Meta. Ad spend (one total a
week), the End of day forms, and **More** (lost reasons, reviews, by source, by service, next
service due) are as before. Tap any figure or row to see who's in it.

## The price list

Settings → Calendar → **Price list**: each service's price by car size (Sedan, SUV or ute, 4WD
or van, Bike), from the website to start with (`ILJobs.DEFAULTS.prices`); ceramic coating has a
row for 3, 5 and 7 years, the maintenance plan one for outside and one for inside and out. A
price left blank is quoted for the car. Saved in `settings/calendar.prices`.

Under every price box (a job, a booking, the Add tab, editing a lead) there's a button for each
size with its price for the service picked. Tap one to fill the box. The size the car looks like
(`ILJobs.sizeOf`: "Kluger" is an SUV, "LandCruiser" a 4WD, "Corolla" a sedan) is outlined. A
lead's "from" price on its card and its worth on the Board come from the list too.

## Ad spend from Meta: `/api/ad-spend`

Brings in each ad's spend from Meta (Facebook and Instagram), a day at a time, adds it up into
weeks (Monday to Sunday) and saves `spend/<Monday>` with the week's `total` and each ad's
(`byAd`), marked `from: "meta"`. A total typed in by hand is kept as `handTotal`. It runs:

- every morning (about 6:20am Canberra; the cron in `vercel.json`), once `CRON_SECRET` is set;
- when Numbers is open and it's been 6 hours;
- on **Get from Meta** (Numbers → Ad spend).

`settings/meta` says when it last ran and how it went (Numbers shows it). Only the live site
saves; a preview, or `?dry=1`, answers what it would save. `?weeks=N` goes back N weeks (3 unless
said).

To link it, in Vercel (project → Settings → Environment Variables, Production):

| | |
|---|---|
| `META_ACCESS_TOKEN` | A token that can read the ad account (`ads_read`). Best is a system user's (Meta Business Settings → Users → System users → Add, give it the ad account with "View performance", then Generate new token with `ads_read`): it doesn't run out. |
| `META_AD_ACCOUNT_ID` | The number after `act=` in Ads Manager's address. More than one: a comma between. |
| `CRON_SECRET` | Any long random words, so only Vercel can start the morning run. |
| `META_APP_SECRET` | Only if the Meta app asks for "app secret proof". |
| `META_API_VERSION` | Leave it: `v23.0` unless set. |

Then redeploy. Never paste the token into a chat or the repo.

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

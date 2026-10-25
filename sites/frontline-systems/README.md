# Frontline Systems — landing page

One static page. No build step, no framework, no npm install. Open `index.html`
and it works; drag the folder onto any host and it works there too.

    index.html          the page
    privacy/index.html  privacy policy
    detailers/          the detailer offer page (see "Detailer offer page" below)
    styles.css          all styling, tokens at the top
    app.js              tier switcher, sticky bar, form
    assets/             logo, favicons, fonts, the Imperium reel, share card
    assets/trace-logo.py  regenerates the logo SVGs from logo-orig.png

First load is about **85 KB** over the wire, and 62 KB of that is the two fonts.
`imperium-reel.webp` (172 KB) is lazy-loaded well below the fold.

## The look

Deep charcoal, navy as structure, hi-vis as the only thing that acts — a night
job site rather than another dark SaaS page. Two fixed layers do the lighting: a
soft navy key light and a fine grain at 3.5% on overlay. The grain is what stops
a dark page reading flat; remove it and the whole thing goes plastic.

Hi-vis is rationed hard. It is the primary button, the rail on the one log row
the business rests on, the tick marks, and nothing else. The two non-recommended
pricing tiers deliberately carry the same words on a lighter button, so the solid
yellow always means "this one".

Two handsets carry the argument. The hero one is built in CSS and plays the
product happening — lock screen, 7:42, the notification dropping in, one kick.
The second, in the proof section, runs a real screenshot of
imperiumdetailing.com.au that scrolls as the page scrolls.

Regenerating that reel: serve a production build of the Imperium site locally and
run `scratchpad/imperium/fl-reel.mjs`. It captures band by band on purpose — that
site pauses its videos off-screen, so a single full-page grab catches them as
black holes, and every off-box request has to be blocked or the sandbox proxy's
TLS retries take the browser down.

---

## Before this goes live

Four things need a decision or an action. Nothing on the page is untrue as it
stands, but three of these change what it is allowed to say.

### 1. The form does not fire the automation yet

`app.js` has `FORM_KEY = ''`, so the form currently composes an email instead of
posting anywhere. That is honest today: the page says *"I'll text and email you
about your enquiry"* and does not claim a live demo.

The moment Make.com and ClickSend are wired up, two things change together:

1. In `app.js`, set `FORM_ENDPOINT` to the Make webhook URL and `FORM_KEY` to any
   non-empty string.
2. Only then, change the form section's opening lines to the demo version:

   > **Send this and watch what happens on your own phone.**
   > This form runs on the exact system I'm selling. Fill it in and my phone
   > buzzes, and yours gets a reply. That's the product — try it before you pay
   > for it.

   and change the success panel heading to *"Sent. My phone just buzzed. Check
   yours — your reply's on its way."*

**Do not make change 2 without change 1.** This is the one page whose entire
argument is that every claim on it is checkable, and the form is where a sceptic
checks.

### 2. "Frontline Systems" is not a registered business name

ABN Lookup on 14 Sep 2026 shows ABN 21 468 745 370 as **PENDERGAST, PATRICK
CHARLES**, individual/sole trader, active from 4 Sep 2025, ACT 2617, not
registered for GST, **with no registered business names**.

Trading under a name that isn't your own legal name generally requires an ASIC
business name registration. The footer is worded to be true either way — it says
"Patrick Pendergast, sole trader" and never claims a registered business name —
but the registration is worth doing, and it applies to *Imperium Detailing* too.

### 3. The GST line

The page states "not registered for GST, so the prices are the total." True as at
14 Sep 2026. It lives in exactly two places — the pricing section and the footer.
Change both the day you register.

### 4. There is no photo of Pat

The "I'm Pat" section reads fine without one, but a real photo in that section is
worth more than anything else you could add to this page. A plain one, on the
job, in the van, works better than a studio portrait. Drop it in
`assets/pat.jpg` and add it to that section.

---

## The claims on this page, and where they came from

Everything checkable was verified on 14 Sep 2026 against the primary source:

| Claim | Source |
| --- | --- |
| ABN, entity name, GST status | [ABN Lookup](https://abr.business.gov.au/ABN/View?abn=21468745370) |
| Sender ID Register mandatory 1 Jul 2026; unregistered IDs labelled "Unverified" | [ACMA](https://www.acma.gov.au/sms-sender-id-register) |
| A .com.au holder may not rent, lease or sub-licence; a developer registering for you must list *you* as registrant | [auDA](https://www.auda.org.au/au-domain-names/policies-and-compliance/au-licensing-rules/monetisation-and-new-au-licensing-rules) |
| Automated messages must identify the sender and offer a working opt-out | [ACMA, Spam Act](https://www.acma.gov.au/avoid-sending-spam) |

The Imperium figures (32 pages, 33,597 words, 2 calculators, 13 clips, 28 photos,
72 structured-data blocks) were counted from a fresh production build on
14 Sep 2026, not estimated. **Re-count them before publishing if that site has
changed** — they are the exact numbers a sceptic will check, and being wrong on
one costs more than all six are worth.

There are no testimonials, client names, case studies or performance statistics
anywhere on this page, because Frontline has none yet. Don't add any that aren't
real.

---

## Detailer offer page (`/detailers/`)

A page for one offer: **3 detailers get 4 weeks of free marketing and setup.**
It sells by Imperium's own month (28 Sep to 25 Oct 2026: $2,000 on Meta ads,
99 leads at $20.17, $41.7K of work) and ends at one action: book a call.

    detailers/index.html         the page
    detailers/booked/index.html  where people land after booking (noindex)
    detailers/styles.css         its own styles, tokens at the top
    detailers/app.js             CONFIG, spots, video, calculators, booking, pixel
    detailers/assets/            font, proof screens, app screens, share image

### How it is built to convert

- **The first screen does the work.** Who it's for, the result, the offer, the
  price ($0 to us, you pay for ads), one button, and the proof (the docket) all
  sit above the fold on a phone and on a laptop.
- **Video, then booking, straight away.** Like the Goh Consulting and Syncova
  funnels: Step 1 is the video, Step 2 is the booking box right under it. The
  box asks 4 quick questions (details, business, jobs a week, ad budget; the
  last two are big tap buttons), then the calendar opens with their name, email
  and phone filled in. Until then the calendar shows greyed out and locked.
- **One action, repeated.** Every button says *Book your free strategy call* and
  goes to the booking box. Everything below it (proof, the teaching, the offer,
  the FAQ) is for people who need more, and it ends with one more button. On
  phones a bar with the button and spots left shows once the first button
  scrolls away, and hides at the booking box.
- **Proof before the pitch.** The two real screens (Meta Ads Manager and the
  $41.7K graphic) sit side by side, not in a carousel.
- **Teach, then sell.** The problem (slow replies, no follow-up, no numbers),
  then a calculator so they see their own cost, then the system, then 4 steps,
  then a second calculator for ads, then the offer with a reason it's free and a
  reason it's only 3.
- **Risk taken away.** No setup fee, $0 for 4 weeks, you only pay for ads, you
  decide after. A fit list says who it isn't for, so the calls are better.

The look: navy and white, one typeface (Archivo) at three widths. The docket (a
job sheet with a torn top) is the one bold thing; the calculators print their
answers on the same docket. Bright blue only ever means *book a call*.

### Fill these in (top of `detailers/app.js`)

| `CONFIG` key | What it does when empty | What to put in |
|---|---|---|
| `bookingUrl` | The 4 questions still run, then Patrick gets the answers and texts back | The GHL booking widget link (Calendars, Share, the `https://api.leadconnectorhq.com/widget/booking/...` link). The page adds `first_name`, `last_name`, `email`, `phone` and any `utm_` tags from the ad |
| `vslUrl` | Previews show an empty frame marking the spot; the live site leaves the video section out | A YouTube (Unlisted or Public, embedding allowed), Vimeo or Loom link, or an `.mp4`. It shows in the host's own player |
| `vslPoster` | None | For an `.mp4` only: the picture shown before it plays |
| `pixelId` | No tracking | The Meta Pixel ID. It sends PageView, Lead (form), ViewContent (video play) and Schedule (booked page) |
| `spots`, `spotsTaken` | 3 and 0 | Add one to `spotsTaken` each time a detailer signs up. Every "spots" line and the boxes follow it |
| `formEndpoint` | Answers aren't saved anywhere (with no calendar, they open an email to Patrick) | A webhook that takes JSON (a GHL inbound webhook works). It gets `stage: "started"` once they give name, email and mobile, so you can text people who stop halfway, and `stage: "answered"` at the end with jobs and budget |

In GHL, set the booking calendar's thank-you page to
`https://frontlinesystems.com.au/detailers/booked/`, so a booking lands there
and counts as Schedule.

### Check before it goes live

Every line on the page has to be true. These came from the brief or are my best
guess, so please confirm or change them:

1. **What the $41.7K is.** The page says "We did $41.7K of detailing in 4 weeks"
   and "Work done from Imperium's job records". It doesn't say all of it came
   from ads. If it did, it can say so; if it's booked not done, change "did".
2. **The $2,000 was in the same 4 weeks.** The Meta card shows the campaign's
   spend; the page puts it in the 28 Sep to 25 Oct box.
3. **What happens after 4 weeks.** The page says you decide, the monthly price
   is given on the call, and if you stop "there's nothing to cancel and nothing
   owed". If there's a contract or a minimum, change the FAQ and step 4.
4. **What's in the setup.** Ads planned and run, a text within a minute, day 1,
   3 and 7 follow-up, online booking, the tracker app, weekly numbers. Remove
   anything you won't do for all 3.
5. **Time and dates.** "Built in about a week", "a couple of hours in the first
   week", "Patrick will text you to set a time".
6. **Meta lead forms.** The FAQ says you don't need a website because leads come
   through Meta's forms. Imperium's main campaign is a Leads campaign; check
   that's how you'd run theirs.
7. **Patrick's photo.** The founder section shows "PP". To use a photo, add
   `detailers/assets/patrick.webp` (square, 320 px or more) and in
   `detailers/index.html` change `<div class="face" aria-hidden="true">PP</div>`
   to `<img class="face" src="/detailers/assets/patrick.webp" width="160" height="160" alt="Patrick Pendergast">`.

The app screens use made-up customers and numbers, and say so under them. The
speed-to-lead line cites Harvard Business Review (2011, 1.25 million leads):
firms that tried to reach a lead within an hour were nearly 7 times as likely to
qualify it as firms that waited longer.

## Deploying

**The home page goes to the detailer page.** `vercel.json` sends `/` to
`/detailers/` with a temporary redirect, because the detailer offer is what's
being sold now. The old tradie page is still in `index.html`; to show it again,
delete the `redirects` entry.


The domain `frontlinesystems.com.au` already resolves (Cloudflare) and currently
returns 404, so it is free to point wherever you like.

**Vercel** — `vercel.json` is already here (clean URLs, week-long cache on
`/assets`, no cache on HTML). Import the folder, add the domain, done.

**Anything else** — it is plain static files. Upload the folder. The only server
requirement is that `/privacy/` serves `privacy/index.html`.

After it is live: take down or redirect `plug-the-leaks.lovable.app`. It still
sells a different offer (an HVAC AI receptionist) to a different audience, and
two live pitches from one business undercuts both.

---

## Reusing this as a client template

This is also the template for the $897 and $1,897 builds. To rebuild it as a
client's site:

1. Copy the folder.
2. Change the token values at the top of `styles.css`. That is the whole
   palette. The `theme-factory` skill in `.claude/skills/` has ten ready-made
   colour and font pairings — use a different one per client so no two builds
   look like the same site recoloured.
3. Swap the two font files in `assets/fonts/` and the two `@font-face` rules.
4. Replace the copy. Keep the structure: mechanism, ownership, running costs,
   proof, price, exclusions, fit, limits, who you are, objections, form.
5. Point `FORM_ENDPOINT` at *their* Make webhook, on *their* account.

The parts worth keeping every time are the ones that cost nothing and build
trust: published prices, a stated list of what is excluded, a section that turns
the wrong customers away, and a limits section that says what the thing cannot do.

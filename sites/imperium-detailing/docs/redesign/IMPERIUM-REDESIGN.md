# Imperium Detailing redesign: build brief for Claude Code

You are rebuilding the Imperium Detailing website (`sites/imperium-detailing`, Next.js 16 static export, Tailwind v4, GSAP) to match an approved redesign. The design lives in this folder as 10 static HTML mockups. Your job is to change the real site so it looks and behaves like them, using the site's existing data and components.

Read this whole file before touching code. Then read `sites/imperium-detailing/AGENTS.md`, and the Next docs it points to, before writing Next code.

## 0. Ground rules

1. **The mockups are the visual truth. The repo is the content truth.** Take layout, sizes, spacing and look from the mockups. Take every price, service, review, suburb, FAQ and sentence from the repo's data (`lib/site.ts`, `lib/pricing.ts`, `lib/services.ts`, `lib/areas.ts`, `lib/reviews.json`, `lib/detail-steps.ts`). If the two disagree, the repo wins. Tell me about it in your final summary.
2. **Never invent** prices, reviews, stats, awards, suburbs or claims. If something is missing, leave a clear `TODO(pat)` comment and list it in your summary.
3. **Do not paste the mockup HTML into the app.** It's a design-tool file, not production code. Rebuild with the site's React components and Tailwind classes on the existing tokens in `app/globals.css`.
4. **Keep what already works:** SEO metadata, JSON-LD, sitemap, analytics, the quote form's submit logic (Web3Forms), the `sms:`/`tel:` links, `QuoteCta` (form on desktop, SMS on phone), reduced-motion handling, and `npm run check`.
5. Work on a new branch called `redesign-2026`. Commit in small steps, one per section below. **Don't merge to main or deploy.** Pat will review first.
6. Stop and ask Pat if a step would delete a page, change a URL, or change a price.

## 1. How to look at the mockups

Files are in this folder (`docs/redesign/`). Open them in a browser straight from the repo. Images point at `../../public/...`, so they load. The `{{...}}` bits are placeholders the design tool filled at runtime. Take their real values from `lib/pricing.ts`.

| File | What it shows |
| --- | --- |
| `01-home-desktop-part1.html` | Home 1440px: header, hero, proof, services list, price guide, before/after |
| `02-home-desktop-part2.html` | Home 1440px (continued): work, the 5-step wash, how it works, reviews, quote form, areas, footer |
| `03-home-phone-part1.html` / `04-home-phone-part2.html` | The same home page at 390px, with the sticky bottom bar |
| `05-ceramic-desktop.html` / `06-ceramic-phone.html` | Service page template (ceramic coating) |
| `07-maintenance-desktop.html` / `08-maintenance-phone.html` | `/maintenance/` |
| `09-inner-north-desktop.html` / `10-inner-north-phone.html` | Area page template (`/service-areas/[slug]/`) |

## 2. Design system changes (do these first)

The colours and fonts stay exactly as in `app/globals.css`: Big Shoulders 800 uppercase for headlines, Instrument Sans for body, one blue. Change only these:

- **Buttons become pills.** `LinkButton`, `QuoteCta`, the price guide's buttons and the booking form's submit button all go to `rounded-full`, min height 52px, padding x 28px.
  - **Primary:** `bg-accent text-accent-foreground`, hover `#5aa6f0`, plus a soft glow: `box-shadow: 0 0 0 1px rgba(58,143,224,.35), 0 10px 36px rgba(58,143,224,.32)`. Keep the `.lift` hover.
  - **Ghost:** transparent, `border: 1px solid rgba(194,200,208,.28)`, text `foreground`.
  - Add the glow as a utility or class in `globals.css` (for example `.cta-glow`) rather than repeating it.
- **Headline sizes** (desktop max): hero ~104px, section headings ~92px, inner-page H1 ~104–120px. Phone: hero ~47px, section headings ~54px. Keep `display-caps` (line-height .88) and use `clamp()` so they scale.
- **Section rhythm:** 112px top/bottom padding on desktop, 72px on phones. Hairline `border-t border-border` between sections. Content max width about 1200px with 120px side padding at 1440.
- **Cards:** `bg-card`, `border-border`, 12–14px radius. Put the blue `panel-glow` only behind the hero media and the price panel.

## 3. Home page (`app/page.tsx`)

New section order:

1. **Header.** Same as now: mark + "Imperium Detailing" wordmark, 5 nav links, phone number, "Get a quote" pill.
2. **Hero** (`components/site/hero.tsx`), rebuilt:
   - **Desktop:** two columns. Left: the H1 "Not the cheapest detailer in Canberra. The most careful one.", a one-line sub about mobile service with no call-out fee, then a 3-cell price strip (Ceramic coating from $997 | Paint correction from $397 | Full detail from $225, taken from `prices`), then `QuoteCta` + ghost "Call 0426 661 820", then `site.quotePromise`. Right: **one tall 9:16 video panel** (about 420×746, rounded 14px, `panel-glow`) playing ONE calm continuous clip.
   - **Remove** the fast-cut reel and any multi-clip sequencing. Use `LoopVideo`.
   - **Keep the bottom-right corner clear** at every size. A LeadConnector chat bubble sits there.
   - **Phone:** the video sits at the TOP (full width, about 280px tall, `object-position` so the car's face is in the top third, with a fade into the background at the bottom). The headline, sub and price strip sit below it. Everything must fit above the sticky bottom bar on a 390×844 screen. The phone hero has no buttons of its own; the sticky bar is the call to action.
   - **Placeholder clip:** use `/media/m3-gtr-720` (poster `/media/m3-gtr-poster.webp`) with `TODO(pat): swap for one calm continuous shot of a finished car`. If that clip is fast-cut, pick the calmest single-car clip in `public/media` instead and say which one you picked.
3. **Proof band.** Same 4 numbers from `site.stats`. Change the warranty label to **"top-tier written warranty on ceramic coatings"**. The 7 years is the top tier, not every coating.
4. **Services list.** This REPLACES `ServicesCoverflow` on the home page. Don't delete the component file.
   - Heading "What we do, and what it costs." with a note that prices are for a hatch or sedan.
   - One full-width row per service in `lib/services.ts`: a small portrait thumbnail (96×128 desktop, 64×84 phone), the name in display caps, a one-line summary, the time, "from $X" big on the right, and an arrow. The whole row links to the service page.
   - Thumbnails play the service's own `video` (muted loop via `LoopVideo`), with the poster as fallback. Order: Ceramic, Paint correction, Full detail, Interior, Exterior.
   - Under the list: "Keep it that way: maintenance plans from $90 a month."
   - The list must be keyboard-friendly and easy to scan. That's why the carousel is going.
5. **Price guide** (`price-guide.tsx`). Keep all the logic. Restyle to the mockup: chips in a 4 / 3 / 3 grid on desktop and 2 columns on phone, sticky price panel on the right. Buttons become pills. Chips stay real radio inputs (they are now).
6. **Before/after.** Keep `BeforeAfter` with the Raptor tailgate (`correction-before` / `correction-after-2`). Heading "Paint correction. Swirls, scratches, gone." Add the honest line: "Can you remove every scratch? No, and any detailer promising that isn't being straight with you. Scratches through the clear coat can't be polished out." Add a ghost button "Paint correction from $397".
7. **Our work** ("Finishes that speak for themselves."). A 4-up grid on desktop (tall cards, 12px radius, caption under each) and a swipe row on phone.
   - Use the frames in `work.tsx`. **Frames with a `video` play as `LoopVideo`**: Audi R8, M3 CS and GT-R, BMW M3 Competition, BMW X6. Frames without one (McLaren 650S, Huracán) stay photos.
   - Add a link "More on Instagram, @imperiumdetailing_".
   - **Remove `RecentWork`** (the Instagram strip) from the home page. The link replaces it.
8. **The wash** ("What's included in a detail."). The 5 steps from `lib/detail-steps.ts` as a 5-column grid of tall cards on desktop (number in blue, label in caps, the `short` line) and a swipe row on phone.
   - Keep the current interactive behaviour of `DetailSteps` (tap to play, the wash widget) if it fits this layout.
   - **Iron decon and clay bar have no footage in the repo** (`/media/steps/` doesn't exist). Keep the existing placeholder handling. Don't use unrelated photos.
9. **How it works** ("We come to you."). The 3 steps from `process.tsx`, as 3 columns with a big blue number. Stacked on phone.
10. **Reviews** ("Trusted by Canberra's most particular owners."). This REPLACES `ReviewsMarquee` on the home page.
    - A static grid of these 5 reviews from `lib/reviews.json`, matched by name: Bradley, Simon Wilson, SoyBean Sensei, Hammad Kamal, Matt Yannopoulos. The mockups show shortened quotes. You may shorten, but only by dropping whole sentences, never by rewording.
    - Plus a 6th card: "45 reviews on Google, every one from a real customer." with a "See all reviews" button to `/reviews/`. Show "4.9 · 45 Google reviews" beside the heading.
    - Phone: the first 3 reviews + the button.
    - If any of those 5 names aren't in `reviews.json`, stop and tell Pat.
11. **Quote form** ("Book your detail."). This MOVES here from position 5. Keep `BookingForm` and its logic.
    - Desktop: two columns. Left: phone, hours, notice and "On the day, we need" (tap + 240V power; a garage or covered space for correction and coating). Right: the form in a card.
    - Phone: the sub-line says texting is quicker, with an SMS link.
    - The sticky mobile bar must still hide while this form is on screen. Check `mobile-bar.tsx` still finds it after the move.
12. **Areas strip** ("Canberra and Queanbeyan."). The 9 districts from `lib/areas.ts` as a 3-column link list (2 columns on phone), linking to each area page.
13. **Footer.** Logo, "Showroom finish. Every time.", hours, link columns, ABN, and the giant faded "IMPERIUM" wordmark (it already exists).

**Phone sticky bar** (`mobile-bar.tsx`): "Text us your car" (primary pill, about 60% width) + "Call" (ghost pill). The chat bubble must sit ABOVE the bar, never on top of it. If the LeadConnector widget can't be moved with CSS, add a bottom offset for it on phones and say what you did.

## 4. Service pages (`app/services/[slug]/page.tsx`)

Use the ceramic mockup (`05` / `06`) as the template for all 5 services:

- **Hero:** breadcrumb, H1 (`service.h1`), `intro`, `forWho`, a price strip ("from $X" big + `duration`), `QuoteCta` + call button, the promise. Right side: the service's 9:16 `video` in a glow panel. On phone the video sits under the price strip.
- **Price table:** ceramic shows a warranty × vehicle-size table from `ceramicTiers`. The other services show one row across the 4 sizes from the pricing table in `lib/pricing.ts` ("Quoted" where it's null), plus the $75 condition note for full and interior.
  - The heading "Three tiers. One method." is **new copy**. Mark it `TODO(pat): confirm heading`.
  - On phone, each tier becomes a card with the 4 sizes listed.
- **Showcase:** keep `showcase` ("One lap. Nothing touched up.") as a wide video.
- **"How we do it":** the `why` paragraphs on the left. On the right, a card "Every job, every time" (the `included` list with blue ticks) and a card "On the day, we need" (the `needs` list).
- **Keep `compare`** (the before/after) where a service has it.
- **Warranty band** (ceramic only): heading "Local competitors don't publish theirs. We do." Three columns: what it covers / keeping it valid / making a claim, taken from `app/warranty/page.tsx` wording. Add a link to `/warranty/`.
- **FAQ** in a 4/8 split (heading left, questions right), then the booking section with the service pre-selected.

## 5. Maintenance page (`app/maintenance/page.tsx`)

Match `07` / `08`:

- **Hero:** "Detailed once. Kept that way." with the existing intro and the `m4-mitt` photo (or the `maintenance-wash-720` video) in a glow panel.
- **"Pick a plan.":** 3 cards from the existing `plans` array. The middle card (Inside and out, monthly, from $150) gets the accent border, the glow and the primary button. The other two get ghost buttons.
  - The labels "Get it quoted" and "Text us the car" are **new copy**. Mark them `TODO(pat)`.
- **"What a visit covers":** two lists (`outside` / `inside`). On the right, the "Why not a car wash?" card and the "On the day, we need" card.
- Keep the existing video section.
- Then the FAQ, a CTA band ("Ready when you are."), and the footer.

## 6. Area pages (`app/service-areas/[slug]/page.tsx`)

Match `09` / `10` (Inner North shown; apply to all 9):

- **Hero:** H1 "Mobile car detailing in {name}.", `blurb`, the first `intro` paragraph, and CTAs. On the right: a "Suburbs we cover in {name}" card (2 columns) and the existing "Most booked in {name}" card with the accent border.
- **Each `sections` item:** heading left (display caps, about 64px), paragraphs right, hairline between them.
- **"Every service, at your door":** 6 small price cards (5 services + the maintenance plan from $90/mo).
- **Booking:** "Book a detail in {name}."
- **Phone:** the suburbs become one comma-separated line in a card.

## 7. Video rules (all pages)

Every spot that has footage must play the real video, not the poster:

- Use `LoopVideo` everywhere: muted, `loop`, `playsInline`, `autoPlay`, poster first, WebM then MP4. It already pauses off-screen and shows only the poster for reduced motion. Keep that.
- Hero video: load the 720 file on phones and the 1080 file (if it exists for that clip) on desktop, like `hero.tsx` does now.
- Service-list thumbnails: use the smallest file. Pause when off-screen. Don't let the home page start 10 videos at once. Only play what's in view.
- Budget: the home page's first screen should load no more than one video.

Where each video goes:

| Spot | Video (`public/media/`) |
| --- | --- |
| Home hero (placeholder) | `m3-gtr-720` |
| Ceramic (list thumbnail, service hero) | `beading-720` |
| Ceramic showcase | `m4-360` (mp4 only) |
| Paint correction | `paint-correction-720` |
| Full detail | `full-detail-720` |
| Interior | `interior-mclaren-720` |
| Exterior | `exterior-huracan-720` |
| Maintenance | `maintenance-wash-720` |
| Work grid | `r8-detail-720`, `m3-gtr-720`, `m3-comp-720`, `x6-detail-360` |

## 8. Check before you say you're done

1. `npm run build` passes and `npm run check` passes.
2. Screenshot the home page, one service page, `/maintenance/` and one area page at 1440×900 and 390×844 (use Playwright if it's there). Compare each against its mockup and fix big differences.
3. **Phone hero:** the headline and price strip are fully visible above the sticky bar on 390×844, and the chat bubble covers nothing.
4. Tab through the home page. Every control is reachable and shows the blue focus ring. Chips, the slider and the services list all work by keyboard.
5. Turn on reduced motion. No autoplaying video, no count-ups, no marquee.
6. Every price on the page matches `lib/pricing.ts` / `lib/site.ts`.
7. **Final summary for Pat:** what changed, which files, anything that differed from the mockups and why, and every `TODO(pat)`.

## 9. Known open items (leave them as TODO(pat))

- The hero clip: Pat needs to film or pick one calm continuous shot of a finished car.
- The iron decon and clay bar step clips don't exist yet.
- New copy to confirm: "Three tiers. One method.", "Get it quoted", "Text us the car".
- Guides pages are out of scope. Leave `/learn/` as it is, apart from the global button and heading styles.

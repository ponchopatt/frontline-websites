# Morning report

Overnight run started 22 Sep 2026. One client at a time, in QUEUE.csv order.
Each client gets a fresh builder agent and a separate fresh reviewer agent
scoring against the QUALITY.md scorecard.

A final summary goes at the top of this file when the queue is empty.

---

## arizona-roofing — NEEDS PAT

**Arizona Roofing Canberra** · Oscar (Asghar Khan) · 5.0 from 20 reviews · 0421 149 431
Blocked after 12 minutes. Not built — no reviewer run.

**Why:** they have no photographs of their own work. Not one. All 40 images on
their site are stock or WordPress theme demo content, so there is no hero and no
gallery, and the floor is four.

This was checked properly rather than taken on trust from the earlier attempt.
The builder pulled their whole media library through `wp-json` (222 entries, 90
unique files), walked the sitemap including all 11 project pages, and opened 40
images at full resolution rather than judging by filename. What the "Our
Projects" gallery actually contains: a Japanese Buddhist temple roof in Kyoto, a
North American log cabin, US asphalt shingles, a Baltic red-metal cottage, and a
South-East Asian steel-frame commercial build. The page titled **"Asghar Khan,
CEO"** carries a stock studio photo of a young woman in a hard hat.

The clincher: all eleven `roof_*.jpg` files share identical XMP metadata — Adobe
Photoshop CC 2015 (Windows), document IDs in one timestamp block, every one
exported at exactly 1200×700. That is a theme author preparing demo content.
Newest upload of any kind in their library is June 2023. Nothing has been added.

The 10 stock files were deleted from `clients/arizona-roofing/assets/` so nothing
can accidentally be built on somebody else's roof. Filenames and contents are
preserved as evidence in `BRIEF.md`.

**Your opener:**
> I noticed the project gallery on your site — the one meant to show your work —
> has a Japanese temple roof and a North American log cabin in it, and the page
> with your name on it, "Asghar Khan, CEO", has a photo of a young woman in a
> hard hat who isn't you.

**The angle, for when the photos arrive:** Oscar quotes it himself, photographs
what is wrong, gives the options, then does the job he quoted. One customer got
over six quotes before picking him; another had him back a second time; all 20
reviews are five stars. Intended headline: *"Six quotes. She picked Oscar."*

**What you need to get from Oscar:**
- **6+ photos of his own finished Canberra roofs.** Phone photos are fine. At least one landscape frame 1600px or wider. This is the blocker; nothing else unblocks it.
- A mix matching what the reviews talk about: a repointed ridge, new gutters and fascia, a valley with clips, a dektite or collar, a full restoration before/after.
- A photo of Oscar himself, to replace the stock woman on his own CEO page.
- Years in business — their site only says "years of industry experience", so it was left out rather than guessed.
- The suburbs he actually covers — no review names one, so any list would be invented.
- Any licence or insurance he can name.
- Every calculator price: restoration, repairs, gutter replacement, gutter guards, roof painting, metal roof repairs. Nothing was invented; `calculator.jobs` is empty.
- Whether he genuinely does commercial work. His site claims it; not one review evidences it.

**More for the call.** Their site is a bought "Roofix" theme with the demo content
left in: four fake staff are still live (Mark Willy, Mark Rocket, Samantha Riley,
Alfred Gilbert), ten blog posts all titled *"10 reason why roofing are factmake
easier"*, and his phone printed wrong on every page as "042 1149431". His 5.0
from 20 reviews appears nowhere on the site — the testimonials shown are theme
demo quotes from stock avatars. He has the best proof a Canberra roofer can have
and is using none of it. An interstitial bot-check also delays every page load.

**Requeue this the moment the photos exist.** `config.json` and `BRIEF.md` are
ready: verified reviews, rating, owner name and phone are all in place.

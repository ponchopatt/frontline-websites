# YouVersion / Bible.com teardown for a simple Orthodox Bible app (as of Oct 2026)

Method note: these findings come from web search, official YouVersion pages (developers.youversion.com, the App Store listing, the Life.Church blog), press coverage, and a direct look at public bible.com HTML on 2026-10-16. The first request for `/bible/111/JHN.3.NIV` and `/verse-of-the-day` returned fully server-rendered HTML. Every later request (`/reading-plans/17478`, `/reading-plans`, `/versions?search=`, `/bible/compare/...`, `/audio-bible/...`) returned a "Client Challenge" bot-protection page, so I stopped and did not try to get around it. Reading Plan page internals therefore come from secondary sources, not from inspection. help.youversion.com article URLs I tried returned 404, and no official help-center pages showed up in search. Claims marked "(unverified, background knowledge)" are not source-backed. Treat them as hypotheses to check in the app.

## 1. Main tabs/screens and core user flows

### Takeaway
YouVersion is a feed-first app. The home screen ("Today" / Daily Refresh) chains Verse of the Day, Guided Scripture and Guided Prayer, with streaks on top. Bible reader, Plans, Prayer and community/friends features sit around that home screen. The core loop is: open the app, do today's content or plan day, finish it, and the streak grows. An Orthodox clone could keep that loop and drop most of the surrounding features.

### Cited Findings
- App Store listing (Oct 2026): rated 4.9/5 from about 14M ratings, free, developer Life.Church, #3 Free in Reference, 182.3 MB, requires iOS 18. It claims 3,500+ Bible versions in 2,300+ languages and an interface in English plus 63 other languages. The latest version is 11.34.0, whose notes cover accessible red-letter colors, larger verse numbers, VoiceOver improvements and password confirmation for email changes — [App Store](https://apps.apple.com/us/app/bible/id282935706)
- Features in the store description: thousands of reading plans (devotionals, Bible in One Year), audio Bibles for some versions (skip, playback speed, sleep timer), offline downloads for some versions, highlights in custom colors, bookmarks, notes, verse images, prayer cards and lists (private or shared with friends), sharing verses and prayers, and seeing friends' Bible activity — [App Store](https://apps.apple.com/us/app/bible/id282935706)
- Kids: "Bible App for Kids" is a separate Life.Church app, not a tab in the main app — [App Store](https://apps.apple.com/us/app/bible/id282935706)
- A Dec 2023 release note says the "Daily Refresh" home screen links Verse of the Day, Guided Scripture and Guided Prayer into one sequence. Completing a Guided Scripture session extends a "Guided Scripture streak" — [bible.com/refresh via search summary](https://www.bible.com/refresh); [faith.tools](https://faith.tools/app/youversion-bible-app)
- Recent additions (third-party report, dates unverified): an immersive Guided Scripture/Prayer viewer, tappable cross-references, QR-code sharing of Bible versions, an embeddable Bible reader for developers (Mar 2026), and a 39-day Mid-Year Bible Challenge tied to the World Cup (Jun 2026) — [faith.tools](https://faith.tools/app/youversion-bible-app)
- Church "Events": churches can publish sermon outlines, Scripture references, announcements and giving links inside the app — [Life.Church Open blog](https://openblog.life.church/3-best-features-in-the-bible-app-for-pastors-to-know-about/)
- Web site navigation seen in bible.com chapter HTML: `/bible`, `/reading-plans`, `/verse-of-the-day`, `/videos`, `/versions`, `/languages`, `/app`, `/organizations/{uuid}` (publisher/partner pages), plus links out to youversion.com `/giving`, `/churches`, `/platform` and `/newsroom` — [bible.com JHN 3 NIV](https://www.bible.com/bible/111/JHN.3.NIV)

### Inferences
- Core flow for a clone: open the app → Today card (today's plan day, or the Orthodox daily lectionary epistle and gospel) → read → tap "Complete" → small celebration and streak +1 → optional reflection or prayer. In YouVersion this flow is spread across a home feed, Plans tab and Guided Scripture. A simple Orthodox app could put it on one "Today" screen.
- Likely mobile tab bar (unverified, background knowledge; check in the current app): Home/Today, Bible, Plans, Discover/Search, More/Profile, with Prayer and Friends nested under them.

### Gaps
- No official, dated screenshots of the 2026 tab bar were found. The help center could not be reached.

## 2. How a Reading Plan is structured and how publishers create plans

### Takeaway
A plan is N days. Each day has an optional devotional text ("devotional" segment) plus one or more Scripture references, and sometimes a video. A day is complete when every item is checked off. Plans can be done alone or "with friends" from a chosen start date. Publishing is partner-gated: content partners (churches, ministries, publishers) submit plans through YouVersion, but the official criteria are not public.

### Cited Findings
- Plans are daily devotional content rooted in Scripture. Guidance from an author-training course: one central message per plan, a day-by-day outline of at least 3 days, Scripture passages for each day, 3 YouVersion categories and 5 keywords, and no self-promotion of the author's book. This is advice, not an official spec — [Kenya CLC writing guide](https://writing.kenyaclc.org/?p=24533)
- A Church of England partner says plans are meant to be read daily and average 5–7 days — [Agapé UK](https://arc.agape.org.uk/youversion-bible-plans/)
- The Evangelical Covenant Church was invited to be YouVersion's first denominational publisher, so its pastors and leaders can release original plans — [Covenant Church](https://covchurch.org/youversion/)
- A commercial devotional-writing firm says YouVersion accepts devotionals from many sources (treat with caution) — [Frontgate Media](https://www.frontgatemedia.com/tag/youversion-bible-plan/)
- Partner admin portal: church admins sign in at login.youversion.com and use "Featured Plan" to feature an existing partner plan for their church. That source does not describe how to get publishing rights — [search summary of partner instructions](https://covchurch.org/youversion/)
- Plans with Friends: start a plan → choose "With Friends" → pick a start date → invite friends. Participants see each other's progress, and each day has a "Talk It Over" discussion. The feature launched in Nov 2017 — [Christianity Explored](https://christianityexplored.us/Publisher/Article.aspx?ID=598970); [Life.Church Open blog](https://openblog.life.church/3-best-features-in-the-bible-app-for-pastors-to-know-about/)
- A plan can be started as "Private" so that activity doesn't show in friends' feeds — [Life.Church Open](https://openblog.life.church/?p=5768)
- One secondary review mentions automatic catch-up days in plans — [learnofchrist.com](https://learnofchrist.com/resources/youversion)
- BibleProject (a large partner) publishes its plans with videos on YouVersion. Its help article covers starting plans in the app — [BibleProject help](https://help.bibleproject.com/hc/en-us/articles/5586207821847-Bible-reading-plans)
- Observed URL pattern: `https://www.bible.com/reading-plans/{numericId}` (17478 resolved, then hit bot protection). Videos are at `/videos/{id}-{slug}`, for example `/videos/48019-john-overview-explainer` — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV)

### Inferences
- A suggested data model for the clone (my design, not YouVersion's schema): `Plan {id, title, description, image, days[], category[], source/attribution}`, `Day {n, devotional_md?, refs[] (USFM like "MAT.5.1-12"), video_url?}`, and `UserPlan {plan_id, start_date, completed_days{n: date}, mode: solo|group, private: bool}`. Day completion = every segment checked. Plan completion = every day completed.
- From what I remember of the current app (unverified, background knowledge): each day shows a checklist of segments. Users can catch up or "start over" when behind, and plan reminders are set per plan at a chosen time. Check in the app before relying on this.
- For an Orthodox app, the best "plans" are calendar-bound rather than start-date-bound: the daily Epistle and Gospel lectionary, the Great Lent Old Testament readings (Genesis, Proverbs, Isaiah), a Psalter kathisma cycle, and Feast-day readings. A small set of self-authored or public-domain plans (for example Church Fathers commentary in public-domain translations) avoids licensing problems. Do not copy YouVersion plan text.

### Gaps
- No public official partner/publisher documentation was found: the submission form, review time, content rules, and whether the program is open or invite-only are all unknown.
- I could not inspect plan pages (bot challenge), so plan JSON fields are unconfirmed.

## 3. Engagement and retention features, and usage stats

### Takeaway
Streaks (since Aug 2017), Verse of the Day, Plans with Friends, push reminders and the yearly "Verse of the Year" and January/Easter spikes drive engagement. YouVersion reports 1B+ installs across its app family (Nov 2025) and record daily engagement around Easter and New Year. It does not publish plan-completion numbers.

### Cited Findings
- Streaks count consecutive days of opening the app and engaging with Scripture. They show on the home feed and trigger mini-celebrations at milestones (7 days, beating your record). Announced Aug 2017 — [Life.Church Open blog](https://openblog.life.church/3-best-features-in-the-bible-app-for-pastors-to-know-about/)
- A YouVersion promotional email describes reminders sent when a streak is about to be missed (undated) — [search summary](https://imageserver.redfishgroup.co.uk/streaks-build-your-bible-habit.html)
- 1 billion downloads across the YouVersion app family on Nov 17, 2025 — [ChurchLeaders, Dec 4 2025](https://churchleaders.com/news/2209898-youversion-2025-verse-of-the-year-bobby-gruenewald.html); [Fox News](https://foxnews.com/media/bible-app-shatters-milestone-one-billion-downloads-faith-revival-surges-worldwide)
- 19 million people engaged on Easter Sunday 2025. Nov 2, 2025 was described as the largest day for Bible engagement in YouVersion history. Engagement grew in every region in 2025. Isaiah 41:10 was the most-engaged verse in 4 of the last 6 years (2025 Verse of the Year) — [ChurchLeaders](https://churchleaders.com/news/2209898-youversion-2025-verse-of-the-year-bobby-gruenewald.html)
- About 798k installs on Jan 5, 2025 (first Sunday of the year), a daily record — [ChurchLeaders](https://churchleaders.com/news/503794-youversion-bible-app-breaks-download-record.html); [Christian Today JP](https://www.christiantoday.co.jp/articles/34408/20250121/youversion-bible-app-hits-record-798k-installations.htm)
- More than 2.6M people took the 30-Day Bible Challenge during Global Bible Month (Nov 2025), and daily Bible use was up 19% year on year (from a search summary of the YouVersion press release) — [Webull/press wire](https://www.webull.com/news/13969012967908352)
- Verse of the Day on the web: the `/verse-of-the-day` page title carries the reference ("Verse of the Day - John 6:35 - Bible App" on 2026-10-16). It links recent past VOTDs as `/bible/111/{USFM}` and `/bible/compare/{USFM}`. The embedded data uses `usfm: ["COL.3.13"]` arrays — [bible.com VOTD](https://www.bible.com/verse-of-the-day)

### Inferences
- For a minimal Orthodox app, good retention features at low cost: a daily reading tied to the Church calendar (built-in reason to come back every day), one local push reminder at a time the user picks, a gentle streak that forgives fasting/feast days and has a grace day, and a verse-image share. Friends and group plans can wait for a later version, or use parish "shared plan" links instead of a social graph.
- Streaks can feel guilt-inducing. Make them optional, or show "days read this month" instead.

### Gaps
- No official published numbers found for MAU/DAU, plan starts or completions, average streak length, or reminder opt-in rates. The YouVersion newsroom URL I tried (youversion.com/news) returned 404. youversion.com/newsroom is linked from bible.com but was not fetched.

## 4. YouVersion Platform/API and content-licensing constraints

### Takeaway
YouVersion Platform (developers.youversion.com, platform.youversion.com) is a free official REST API and SDK set (JS/TS, React, React Native, Swift, Kotlin) giving licensed access to 1,000+ Bible versions, including the NIV. Each version needs per-version license acceptance and attribution, and public docs don't confirm plans endpoints. Translations keep their own copyrights (for example, the NIV belongs to Biblica), so a clone can't just scrape bible.com text. For Orthodox content in particular, YouVersion doesn't appear to carry the Orthodox Study Bible (OSB).

### Cited Findings
- The Platform offers "licensed and official access to more than a thousand Bible versions in many languages, including the NIV", with SDKs for JavaScript, Swift, React and React Native (Kotlin also listed). Register at the Platform Portal to get an App Key — [developers.youversion.com](https://developers.youversion.com/)
- Auth: `X-YVP-App-Key` header. Passages: `/v1/bibles/{id}/passages/{USFM}` (for example `/v1/bibles/3034/passages/JHN.3.16`). Bible collection, book/chapter/verse metadata, and pagination via `page_size` (≤100) / `page_token` / `next_page_token`. You must accept license agreements before a version appears in your collection. Web display must follow the "Display Bible HTML" guide, which covers CSS, the Fonts API and required attribution — [API usage](https://developers.youversion.com/api-usage)
- Secondary sources say the Platform also exposes YouVersion sign-in, highlights and verse-of-the-day data. App keys are not secrets, and available versions depend on accepted licenses, with rate-limit and caching rules — [learnofchrist.com review](https://learnofchrist.com/resources/youversion-platform-services); [React SDK docs (Mintlify)](https://www.mintlify.com/youversion/platform-sdk-react/quickstart)
- Copyright metadata is shipped with each version in bible.com page data, for example NIV: `publisher: {name: "Biblica"}`, `publisher_link: http://www.Biblica.com`, `copyright_short`/`copyright_long`, and a `reader_footer_url` (biblica.com/yv-learn-more). Audio has its own copyright (for example "The Listener's Bible: NIV Edition, Audio ℗ 2011 Max McLean, used by permission") — [bible.com JHN 3 NIV](https://www.bible.com/bible/111/JHN.3.NIV)
- Alternative API: API.Bible (American Bible Society) — [get.bible data sets list](https://get.bible/bible-data-sets/)
- A third-party comparison says some popular translations are paywalled or unavailable in some regions — [unstar.app](https://unstar.app/blog/youversion-bible-gateway-olive-tree-logos-blue-letter-bible-apps-ranked-2026)
- Orthodox-specific apps exist: Orthodox Study Bible (VDUB Software; OSB Septuagint OT + NKJV NT, full content via one in-app purchase), "Septuagint – Orthodox Bible" (iPhone only, subscription), and "Orthodox Bible" (OT/NT + daily readings + calendar). Searching found nothing showing the OSB or Brenton on YouVersion — [OSB App Store](https://apps.apple.com/us/app/-/id6738711125); [Septuagint app](https://apps.apple.com/app/id6744964797); [Orthodox Bible app](https://apps.apple.com/app/orthodox-bible/id6446212792)

### Inferences
- For an Orthodox clone, the cleanest licensing path is public-domain texts bundled offline: Brenton's English Septuagint (1851), KJV/Douay or the World English Bible (public domain; WEB includes deuterocanon/LXX-based books in some editions), and Church Slavonic, Greek (for example Patriarchal Text 1904, NT) and other liturgical texts where public domain. Licensing the OSB (Thomas Nelson / St. Athanasius Academy) or NKJV would need a direct deal. Use the YouVersion Platform only if a needed licensed version is offered there, and then follow its attribution rules.
- Orthodox canon note: the book list must include the Septuagint books (Tobit, Judith, 1–3 Maccabees, Wisdom, Sirach, Baruch, Letter of Jeremiah, 1 Esdras, Prayer of Manasseh, Psalm 151, Odes in some traditions) and Septuagint Psalm numbering. USFM has codes for these (TOB, JDT, 1MA, 2MA, 3MA, WIS, SIR, BAR, LJE, 1ES, MAN, PS2, ODA), so YouVersion-style USFM references work for Orthodox canon too.

### Gaps
- Exact Platform rate limits, caching terms, pricing, and whether Plans or Reading Plan content is in the API are not confirmed in official docs.
- I could not check whether any Orthodox translation (EOB, OSB, Brenton) is in the YouVersion catalog (`/versions?search=` hit the bot challenge).

## 5. Reader features and the observable bible.com URL/data structure

### Takeaway
The reader uses USFM book codes everywhere (URL, DOM, API). Each verse is a `span[data-usfm="BOOK.C.V"]` holding a label and content. Parallel/compare, audio, verse images and video all branch from the same reference key. Copy this design: one canonical reference string drives everything.

### Cited Findings
- URL scheme: `/bible/{versionId}/{BOOK}.{chapter}.{VERSIONABBR}`, for example `/bible/111/JHN.3.NIV` (canonical link equals this). Verse-level: `/bible/111/JHN.6.35.NIV`. Prev/next chapter links: `/bible/111/JHN.2.NIV`, `/bible/111/JHN.4.NIV` — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV)
- Sibling routes for a reference: parallel `?parallel={versionId}`, `/audio-bible/{versionId}/{BOOK.C.ABBR}`, `/bible-verses/{versionId}/{BOOK.C.ABBR}` (verse image/topic pages), `/bible/compare/{USFM}` (all versions), `/versions/{id}` and `/versions/{id}?returnTo=JHN.3` (version picker), `/languages/{iso639-3}` (for example `eng`) — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV); [bible.com VOTD](https://www.bible.com/verse-of-the-day)
- Verse DOM: `<span class="ChapterContent-module__..._verse" data-usfm="JHN.3.16"><span class="..._label">16</span><span class="..._content">For God so loved…</span></span>`. Chapter wrapper `data-usfm="JHN.3"`. A verse split across paragraphs repeats the same `data-usfm` (JHN.3.2 appeared twice) — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV)
- Stack: Next.js (`/_next/static/chunks/...`, React server-component payload) with Tailwind-style classes and RTL support (`rtl:flex-row-reverse`, dark mode classes). Images go through `imageproxy.youversionapi.com/{w}x{h}/{source}` from Google Cloud Storage buckets. Static assets come from `web-assets.youversion.com` — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV)
- Embedded version metadata includes `local_abbreviation`, `language_tag`, `audio: true`, `canonical: true`, publisher object, copyright HTML, and reader footer. The UI string set includes "Audio Versions ({{count}})" and "{{playback_speed}}x" — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV)
- Chapter pages cross-link related videos (for example BibleProject "John overview explainer") and partner organization pages — [bible.com](https://www.bible.com/bible/111/JHN.3.NIV)
- Reader features listed on the store page: highlights in colors, bookmarks, notes, verse images, audio (speed, timer), offline downloads for some versions, sharing — [App Store](https://apps.apple.com/us/app/bible/id282935706)
- A user complaint says notes and highlights don't carry over between translations or languages — [App Store review, Sep 2025](https://apps.apple.com/us/app/bible/id282935706)
- Sync: reports that highlights, notes or plan progress sometimes take days to appear on a second device — [unstar.app](https://unstar.app/blog/youversion-bible-gateway-olive-tree-logos-blue-letter-bible-apps-ranked-2026)
- Bot protection: repeated plain HTTP requests to bible.com quickly get a "Client Challenge" JS interstitial (observed 2026-10-16) — direct observation

### Inferences
- Store user annotations against a version-independent key (USFM verse such as `MAT.5.3`) with a versification mapping (LXX↔Masoretic Psalms), so highlights and notes carry over between translations. That fixes a known YouVersion complaint and matters for Orthodox users who switch between Septuagint and NT texts.
- An offline-first bundle (SQLite/JSON per version) avoids login walls and sync complaints. Make an account optional, used only for backup and sync.
- Search: no first-hand data. Implement reference parsing ("Jn 3:16", "Ps 50" with LXX numbering) plus full-text search over local text.

### Gaps
- Could not observe bible.com search URLs, the plan day page, audio file URLs (no .mp3 in page HTML), or the highlight/notes API (login-only, not attempted).

## 6. Common user complaints and most-loved features

### Takeaway
Users love the free price, huge version and language choice, reading plans, audio and the daily verse. They complain about feature creep and clutter (community posts, constant new features), navigation and gesture changes, sync problems, notes not carrying across versions, and review/promotional prompts. This supports the "keep it simple" brief.

### Cited Findings
- 2025 Trustpilot reviews: "why do the developers keep adding functionality and complexity… something new every week… getting so cluttered that I'm starting to look at other Bible apps". Another reviewer (Feb 2025) calls it "cluttered with plans, confusing UI, random people talking that distracts from the Bible". A Jan 2025 reviewer objects to bracketed descriptive "enhancers" added to daily verses — [Trustpilot](https://au.trustpilot.com/review/bible.com)
- Aggregator report (May 2026): recent navigation-gesture changes disrupt reading flow for long-time users (low authority) — [marlvel.ai](https://marlvel.ai/apps/bible)
- Review prompts appearing at launch annoy users ("should pop up after each use") — [App Store review, 2022](https://apps.apple.com/us/app/bible/id282935706)
- "The app doesn't seem to stick to what you read last time" (lost reading position) — [App Store review, 2022](https://apps.apple.com/us/app/bible/id282935706)
- Requests: reading statistics per chapter, achievements, and notes and highlights that carry across translations — [App Store review, 2025](https://apps.apple.com/us/app/bible/id282935706)
- Sync delays across devices, and some translations paywalled or region-locked — [unstar.app 2026](https://unstar.app/blog/youversion-bible-gateway-olive-tree-logos-blue-letter-bible-apps-ranked-2026)
- Accessibility: the 2014 v5 update broke VoiceOver (old, since improved; the Oct 2026 release notes mention VoiceOver fixes) — [AppleVis](https://applevis.com/comment/24656); [App Store](https://apps.apple.com/us/app/bible/id282935706)
- Loved: rated 4.9 from 14M ratings, free with no ads stated, thousands of plans, audio, offline — [App Store](https://apps.apple.com/us/app/bible/id282935706). Streaks and Plans with Friends are featured by Life.Church as top features for pastors and groups — [Life.Church Open](https://openblog.life.church/3-best-features-in-the-bible-app-for-pastors-to-know-about/)

### Inferences
- YouVersion has no ads (it is donation-funded through youversion.com/giving, linked in site navigation). Reddit-style complaints are more about donation and social prompts than ads, but I found no direct Reddit threads to cite. Orthodox users are likely to object to non-Orthodox devotional content in plans and feeds, and to Protestant canon or versification. An Orthodox app should default to Orthodox content and never show cross-denominational community posts.
- Keep: VOTD (or "Saint/Reading of the Day"), plans with a day checklist, highlights/notes/bookmarks, offline text, audio where licensed, verse-image share, resume-where-you-left-off. Drop: community feed, events, giving prompts, the separate guided-prayer flow (replace with fixed Orthodox prayers such as Morning/Evening Prayers and the Jesus Prayer), mandatory login.

### Gaps
- Reddit threads (r/OrthodoxChristianity, r/Christianity) about YouVersion were not surfaced by search, so there are no direct Reddit citations. No Google Play review data was gathered.
- No first-hand data on the Kids app, or on Guided Prayer content structure beyond the existence of the Daily Refresh sequence.

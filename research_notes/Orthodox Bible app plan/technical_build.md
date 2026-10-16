# Technical build: a simple, free Orthodox Bible app (web + phone) with reading plans and verse-to-Fathers links

Research date: 2026-10-16. Some pages could not be fetched in full (CCEL terms, New Advent permissions, orthocal.info API docs, the STEPBible TVTMS folder); these are listed under Gaps. Anything not tied to a source is under Inferences and should be treated as the researcher's judgement.

## Q1. Which open-source libraries and datasets make this fast, and what are their licences?

### Takeaway
A Bible text plus reference parsing plus versification plus a starter patristic commentary set can be put together almost entirely from permissively licensed sources: bcv_parser (MIT, v4.0.0 July 2026, has a `vulgate` psalm-numbering mode but no `lxx` mode), scrollmapper/bible_databases (MIT code, 140 translations in SQLite/JSON/CSV/Parquet, check each translation's licence), Brenton's 1851 English Septuagint (public domain, USFM/USFX on eBible.org), STEPBible data (CC BY 4.0, includes TVTMS versification mapping), and HistoricalChristianFaith/Commentaries-Database (public-domain compilation of Fathers' comments keyed by verse). The hard part is the English Orthodox *translation*: the OSB (NKJV-based) and EOB are copyrighted, so a free app should use public-domain texts (Brenton LXX, KJV/WEB NT) unless it gets permission.

### Cited Findings
**Reference parsing**
- openbibleinfo/Bible-Passage-Reference-Parser (bcv_parser) is MIT-licensed. Version 4.0.0 was released 31 July 2026 on GitHub and npm (`bible-passage-reference-parser`, Node 17+). The author calls it "feature-complete at its core job" and expects no major changes. It ships with TypeScript types and zero `tsc` errors. — [GitHub README](https://github.com/openbibleinfo/Bible-Passage-Reference-Parser)
- Supported versification systems: `default` (ESV), `ceb`, `csb`, `kjv` (also NIV/NKJV), `nab` (NABRE, "generally follows the Septuagint"), `nlt`, `nrsv`, `nrsvue`, `vulgate` (Vulgate psalm numbering). There is **no `lxx` option**. `ps151_strategy` sets Psalm 151 to a chapter (`c`, the default) or a separate book (`b`). Output is OSIS (`osis()`, `osis_and_translations()`, `osis_and_indices()`), with Greek Esther as `GkEsth` and six compaction levels. It covers 50 languages, plus a companion repo with data for more than 2,000. — [GitHub README](https://github.com/openbibleinfo/Bible-Passage-Reference-Parser)
- The README does not list Roman-numeral chapter/verse parsing ("Ps. xxii", "iii. 16") as a feature. The only Roman numerals it mentions are book ordinals ("II Kings"). — [GitHub README](https://github.com/openbibleinfo/Bible-Passage-Reference-Parser)

**Bible text datasets**
- scrollmapper/bible_databases has 140 translations in MySQL, SQLite, CSV, JSON, YAML, TXT, MD and Parquet. The project is MIT; each translation has its own `license` field in the `translations` table. It includes the openbible.info cross-references table (source and target verses with a `votes` relevance score). The 2025 branch is current and the 2024 branch is legacy, with schema changes between them. It has about 1.7k stars. Orthodox-relevant texts include the Church Slavonic Elizabeth Bible, Russian Synodal, French LXX (FreLXX, Giguet), the Vulgate, the Peshitta and Sahidic Coptic. **No Brenton LXX is listed.** — [GitHub](https://github.com/scrollmapper/bible_databases)
- thiagobodruk/bible: code and data are MIT, but the README says "All the Bible versions are property of their respective owners." JSON is an array of books `{abbrev, name, chapters}`, where chapters are arrays of verse strings (verse numbers come from position). It has 51 commits, and the Russian Synodal file lacks Esther and Daniel. — [GitHub](https://github.com/thiagobodruk/bible)
- Brenton's English Septuagint (1851) is public domain on eBible.org. Formats: USFM, USFX, VPL/SQL, HTML, ePub, PDF and plain text. OSIS and SWORD are not listed on that page. — [eBible.org eng-Brenton](https://ebible.org/find/details.php?id=eng-Brenton)
- STEPBible-Data is CC BY 4.0 (stated for the repository). It holds tab-separated UTF-8 data: TVTMS versification, TAHOT/TAGNT tagged Hebrew and Greek, lexicons (TBESH, TBESG, TFLSJ), proper names (TIPNR), and OSIS SWORD modules. TAGOT (Greek OT) is still in progress. — [STEPBible-Data GitHub](https://github.com/STEPBible/STEPBible-Data)

**Commentary dataset (big shortcut)**
- HistoricalChristianFaith/Commentaries-Database stores one TOML file per Father per verse or range. Filenames look like `Augustine/Matthew 23_35.toml` or `Chapter_Verse-Verse`. Each entry has `quote`, `source_title`, and optional `source_url`/`time`. Each author has a `metadata.toml` (`default_year`, `wiki`, `father_category`). A build script (`compile_data.py`) checks book names against `book_names.json` and produces SQLite releases. The repo has 1,358 commits and takes PRs, and it recommends CCEL, New Advent and Tertullian.org as sources. — [GitHub](https://github.com/HistoricalChristianFaith/Commentaries-Database)
- Its LICENSE has a "PUBLIC DOMAIN DEDICATION" for the compilation (structure, filenames, metadata, build script) and a "FAIR USE NOTICE": excerpts from copyrighted translations remain their owners' property. — [LICENSE](https://raw.githubusercontent.com/HistoricalChristianFaith/Commentaries-Database/master/LICENSE)
- The repo describes Catena Bible (catenabible.com) as a closed database: the most polished app, with a wider range of sources, but it links commentary to single verses and names authors, not works. — [Commentaries-Database README](https://github.com/HistoricalChristianFaith/Commentaries-Database)

**Lectionary / calendar**
- brianglass/orthocal-python (MIT) is the Python rewrite of Orthocal; the older Go version is no longer developed. It has modules for the calendar, commemorations and Bible, plus an `ingest_antiochian.py` script. It powers orthocal.info, which offers an API, feeds, Alexa and an AI-assistant integration, and follows OCA rubrics. — [orthocal-python GitHub](https://github.com/brianglass/orthocal-python); [pkg.go.dev orthocal](https://pkg.go.dev/github.com/brianglass/orthocal); [orthocal.info/api](https://orthocal.info/api/); [Oh My Posh orthodoxcal segment](https://ohmyposh.dev/docs/segments/health/orthodoxcal)
- The Go client's `Day` struct has a JSON `Readings` field next to feast, fast and saint data. — [pkg.go.dev orthocal](https://pkg.go.dev/github.com/brianglass/orthocal)
- Lives of the Saints Calendar offers a read-only JSON API for saints, hymnography and the daily feast. Its docs don't mention scripture readings. — [livesofthesaintscalendar.com developers](https://www.livesofthesaintscalendar.com/developers)

**Orthodox English translations (licensing caution)**
- The EOB (Eastern/Greek Orthodox Bible) NT is based on the 1904 Patriarchal text. Its permission notice allows non-commercial, liturgical or scholarly reuse by certain Orthodox jurisdictions, covering the text and footnotes only. Other uses are capped at 1,500 verses in print. Contact: eobeditor@easternorthodoxbible.org. Logos sells it as a licensed resource. — [EOB PDF](https://www.mauimission.org/static/bibles/EOBBible/EOBBible.pdf); [Logos](https://www.logos.com/resource/LLS$EOBNT)

### Inferences
- ID scheme: use **OSIS IDs** (`John.3.16`, `Ps.22`, ranges `John.3.16-John.3.18`) as the canonical key, because bcv_parser emits them and SWORD/CrossWire use them. USFM 3-letter codes (`JHN`, `PSA`) appear in eBible USFM files and need a fixed 80-row mapping table. Store verses as integer keys too (for example `book_index*1e6 + chapter*1e3 + verse`) for fast range queries.
- Format conversion: eBible USFM → JSON/SQLite is a few hundred lines of script, and USFM parser libraries exist (e.g. usfm-grammar, Python usfm parsers). USX (XML USFM), Zefania XML and SWORD modules are also importable. For a solo builder the fastest route is USFM from eBible for Brenton, plus scrollmapper's SQLite for KJV/WEB.
- Suggested text set for a free app: Brenton LXX (OT, public domain) + KJV or WEB (NT, public domain). Offer the OSB/NKJV, EOB or other modern Orthodox translations only if a licence is obtained.
- For 19th-century patristic references like "St. John iii. 16" and "Ps. xxii.", write a small pre-normaliser (regex: Roman numerals → Arabic, "St." and "S." prefixes removed, old abbreviations like "Matt.", "Apoc."→Rev, "Cant."→Song, "Ecclus."→Sir, "1 Kings"→1Sam when the work uses LXX/Vulgate book naming), then pass the result to bcv_parser.

### Gaps
- getbible.net API/licence and ebible.org's overall terms were not fetched. The WEB is generally known to be public domain, but this was not checked here.
- The thiagobodruk README has no per-translation licence details.
- Thomas Nelson's OSB/NKJV permission terms were not found.
- No Python port of bcv_parser was confirmed (it is JS/TS only, so running it from a Python pipeline means calling Node).
- The CCEL ThML element list (e.g. `<scripRef passage="...">` tags) was not confirmed from a primary source.

## Q2. What is the most reliable way to link verses to patristic passages at scale?

### Takeaway
Start with what is already structured: import the Commentaries-Database SQLite (already verse-keyed and sourced), then add explicit citations parsed from ANF/NPNF texts. ThML markup provides some reference tags, and the rest is regex + bcv_parser with a Roman-numeral/abbreviation pre-normaliser and a per-work versification flag (LXX/Vulgate psalm numbering). Treat embedding/LLM detection of uncited allusions as a separate, clearly labelled "suggested" layer with expert review. Published research shows LLMs find allusions but also make false links, so they should not be trusted unreviewed.

### Cited Findings
- CCEL stores texts in ThML, an XML format it created in 1998. Its texts are mostly public domain, but **CCEL claims copyright on its formatting**, and downloads of the formatted versions require logging in. — [Wikipedia: CCEL](https://en.wikipedia.org/wiki/Christian_Classics_Ethereal_Library); [Wikipedia: ThML](https://en.wikipedia.org/wiki/Theological_Markup_Language)
- New Advent pages credit the 1880s–90s ANF/NPNF translations, say they were "revised and edited for New Advent by Kevin Knight", and carry a copyright notice for New Advent LLC. — [New Advent example page](https://www.newadvent.org/fathers/0808.htm)
- Commentaries-Database already maps quotes to verses with source titles and URLs (often CCEL or New Advent) and builds SQLite. It is public domain as a compilation, with excerpts from copyrighted translations kept under fair use. — [GitHub](https://github.com/HistoricalChristianFaith/Commentaries-Database); [LICENSE](https://raw.githubusercontent.com/HistoricalChristianFaith/Commentaries-Database/master/LICENSE)
- Catena Bible's limitation, for comparison: it ties comments to single verses and names authors but not works. — [Commentaries-Database README](https://github.com/HistoricalChristianFaith/Commentaries-Database)
- SWORD versification: the `LXX` and `Orthodox` schemes have existed since SWORD 1.7.2. `Orthodox` uses LXX versification with a different book order and fewer books. Mapping between versifications is described as planned rather than built. During import, verses outside the chosen scheme are appended to the previous verse. — [CrossWire wiki: Alternate Versification](https://wiki.crosswire.org/Alternate_Versification)
- STEPBible TVTMS documents Hebrew, Latin and Greek OT versification against an English (NRSV/KJV) standard. It uses rules such as "if this chapter has 29 verses, it is using Greek versification", which can be used to detect which numbering a source uses. — [STEPBible-Data](https://github.com/STEPBible/STEPBible-Data)
- bcv_parser's `vulgate` mode handles Vulgate psalm numbering, which matches LXX psalm numbering. It has no LXX mode. — [bcv_parser README](https://github.com/openbibleinfo/Bible-Passage-Reference-Parser)
- LLM intertextuality research: in tests on Koine Greek, LLMs detected quotations, allusions and echoes but "struggle with long query passages and the inclusion of false intertextual dependences, emphasizing the importance of expert evaluation." — [Umphrey et al., NLP4DH 2024 / arXiv 2409.01882](https://arxiv.org/abs/2409.01882)
- An automated pipeline recovered 62 of 115 known biblical allusions in McCarthy's novels (54% recall), and recall varied by type of connection. — [arXiv 2604.19447 (via papers.cool)](https://papers.cool/arxiv/2604.19447)
- For Latin patristic text (Augustine, *De Genesi ad litteram*), fine-tuned BERT models with contrastive learning and hard-negative mining beat baselines at detecting biblical reuse. — [Mambelli et al., Umanistica Digitale 2026 (IRIS UniPa)](https://iris.unipa.it/handle/10447/699097)

### Inferences
Recommended pipeline (solo-dev friendly):
1. **Seed:** import the Commentaries-Database SQLite. Record each father, work (`source_title`), URL and verse range under `confidence = curated`.
2. **Explicit citations:** take ANF/NPNF from a public-domain source. Options are CCEL ThML (log in, respect their formatting copyright: store your own extracted plain text and link back to CCEL), the 19th-century scans, or New Advent (link to it rather than republish, since the edited text is claimed by New Advent LLC; ask Kevin Knight for permission if republishing). Split texts into sections (book/chapter/homily/paragraph), find citation patterns in footnotes and in the text, normalise them, and parse with bcv_parser. Set the versification per work: Vulgate/LXX psalm numbering for most Fathers, so "Ps. xxii" in Augustine usually means MT/English Ps 23. Convert to English/KJV numbering with a TVTMS-derived table so lookups match the displayed Bible.
3. **Store:** `commentary_link(id, osis_start, osis_end, start_key, end_key, father_id, work_id, section_ref, snippet, source_url, link_type[quote|comment|allusion], confidence[curated|explicit|suggested], reviewed_by, reviewed_at)`. Index `start_key`/`end_key` so overlapping ranges can be found quickly.
4. **Rank per verse:** curated > explicit commentary-genre works (homilies on a book, e.g. Chrysostom on John) > explicit citations in other works > suggested. Within each tier, favour an exact single-verse match over a broad range, then Eastern Fathers and feast relevance. Show 3–5 entries with "see all".
5. **Suggested layer:** embed paragraph-sized chunks of patristic text and each verse with any modern embedding model. Take the top-k candidates per verse and have an LLM classify the link (quote, allusion, discussion, none) with a short reason. Store everything as `suggested`, hidden by default or shown with a "suggested, not yet reviewed" label. Build a simple review queue (approve/reject) so a volunteer, ideally someone with theological training, can promote links.
6. **Accuracy controls:** a gold set of about 200 hand-checked verse↔passage pairs to measure precision before and after each pipeline change; spot checks of psalm-numbering conversion; always show the source and the original wording ("Ps. xxii") next to the converted reference.
- Expect explicit citation extraction to have high precision but miss uncited discussion. Embeddings/LLMs add recall but bring false positives, per the cited papers.

### Gaps
- CCEL's precise terms of use, and whether bulk ThML downloads are allowed, could not be retrieved (ccel.org/about/terms returned 404).
- New Advent's reuse/permissions page could not be retrieved (404). Only the copyright notice on its pages was seen.
- The number of entries and fathers in Commentaries-Database was not stated.
- No ready-made LXX↔KJV psalm mapping file was confirmed. TVTMS may contain it, but its file layout was not fetched (folder URL returned 404).

## Q3. What stack best fits "simple, helpful, works on phone, cheap to run"?

### Takeaway
For one developer with AI tools: **Expo (React Native) with expo-sqlite, shipping a prebuilt Bible + commentary SQLite file (FTS5 on native)**, with the same codebase built for web (expo-sqlite web works through wasm). Make it offline-first and account-free, with optional Supabase sync later. Hosting can be close to free: a static site, the free tiers, and the Apple and Google developer fees. A PWA alone is cheaper still but weaker on iOS push notifications and store presence. Flutter is equally capable but means writing Dart, with less overlap with web tooling.

### Cited Findings
- expo-sqlite (SDK 58) supports web; deployment needs a wasm Metro config and COEP/COOP headers. FTS5 is on by default on Android/iOS through `enableFTS`. On web the default build has no FTS, so a custom wa-sqlite wasm build is needed. A prebuilt DB loads with `SQLiteProvider assetSource={{assetId: require('./assets/x.db')}}`. It also has a kv-store (AsyncStorage replacement), a Drizzle ORM integration, and SQLCipher on native only. — [Expo SQLite docs](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- Supabase free tier: 500 MB Postgres, 50,000 MAU, two free projects, and a pause after 7 days with no activity. Pro is $25/month (8 GB database, 250 GB egress, 100 GB storage). Sources disagree on free bandwidth and storage (2 vs 5 GB, 500 MB vs 1 GB). — [MakerKit](https://makerkit.dev/blog/saas/supabase-pricing); [automationatlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/); [toolradar](https://toolradar.com/blog/supabase-pricing-2026) (secondary sources; confirm on supabase.com/pricing)
- Apple 4.2: the app must offer more than "a repackaged website"; apps that are "simply a book" should go to Apple Books. — [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 4.3(b): don't submit apps "indistinguishable from what's already widely available". 4.3(a): don't create multiple bundle IDs for variants. — [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 5.1.1: a privacy policy link is required in App Store Connect metadata and inside the app. "If your app doesn't include significant account-based features, let people use it without a login." "If your app supports account creation, you must also offer account deletion within the app." Analytics need consent and disclosure. — [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 4.8: if third-party social login (e.g. Google) is used for the main account, an equivalent privacy-preserving option must also be offered. Apps using only their own sign-in are exempt. — [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple 1.1.5 bans "inaccurate or misleading quotations of religious texts". 5.2.1 requires permission for copyrighted works (i.e. modern translations). 5.2.2 requires permission to use third-party APIs. In-app donations generally require nonprofit status; otherwise the app must be free and collect funds outside the app. — [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Google Play: new **personal** developer accounts must run a closed test with at least 12 testers for 14 days before production access. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). Third-party guides say organisation accounts are exempt and that testers must actually opt in or install. — [ExtendsClass](https://extendsclass.com/blog/?p=2302); [RapidNative](https://www.rapidnative.com/deploy/google-play-12-tester-requirement)

### Inferences
- **Recommended stack:** Expo + expo-router + TypeScript + expo-sqlite (+ Drizzle) + bcv_parser (runs on device for search-box references like "jn 3 16") + expo-notifications for local daily reminders (no server needed) + EAS Build/Submit. Deploy web to Cloudflare Pages, Netlify or Vercel free tiers with COOP/COEP headers set.
- **Data size:** Brenton + KJV/WEB + commentary, compressed, is likely tens of MB. Ship it in the app bundle or download it on first run, then everything works offline.
- **Search:** SQLite FTS5 on native. On web, either the custom wa-sqlite FTS build or MiniSearch/Lunr over a JSON index loaded lazily per testament. Meilisearch is unnecessary for an offline app.
- **Sync:** v1 has no accounts (local only), so no account-deletion or login obligations. v2 adds Supabase auth (email magic link + Sign in with Apple) to sync highlights, notes and plan progress through a simple last-write-wins table. Account deletion must ship with it. The free tier's 7-day pause matters little once there are daily users. Firebase is an alternative with similar free limits (not researched here).
- **Audio:** v1 uses on-device TTS (expo-speech, free, offline). Later, public-domain recordings if any exist for Brenton/KJV (LibriVox-style). Commercial TTS costs money and is unnecessary at first.
- **Costs:** Apple Developer Program $99/year and Google Play $25 one-off (well-known figures, not re-verified here). Hosting is $0–25/month.
- **PWA-only** would cost nothing beyond hosting and avoid store review, but discovery and reminders on iOS are weaker. Expo can produce both from one codebase, so it is the better default. Flutter is a reasonable alternative but makes AI-assisted web and React reuse harder.
- **Store risk:** a Bible app counts as a crowded category. Orthodox focus, LXX text, Fathers links and lectionary plans clearly set it apart for 4.3(b). Avoid a webview-only wrapper (4.2).

### Gaps
- Firebase pricing, Expo EAS free-tier build limits, and the current Apple/Google fee figures were not fetched.
- PWA push on iOS and MiniSearch/Lunr maintenance status were not checked against current docs.

## Q4. What is a sensible MVP, reading-plan design, and phased roadmap (with effort)?

### Takeaway
MVP is three parts: Read (Brenton OT + public-domain NT, offline), "What the Fathers said" per verse (seeded from Commentaries-Database), and Plans (2–3 start-date plans plus today's lectionary readings). No accounts. For one person using AI coding tools, roughly 4–8 weeks part-time to a store-ready v1. Patristic citation extraction from ANF/NPNF, sync and audio come in later phases.

### Cited Findings
- Daily Orthodox readings can come from Orthocal (MIT Python code; orthocal.info API following OCA rubrics; `Day` objects carry Readings, feast, fast and saints). — [orthocal-python](https://github.com/brianglass/orthocal-python); [pkg.go.dev orthocal](https://pkg.go.dev/github.com/brianglass/orthocal); [Oh My Posh orthodoxcal](https://ohmyposh.dev/docs/segments/health/orthodoxcal)
- The Coptic Katameros API returns readings by calendar and date (`/readings/gregorian/DD-MM-YYYY`), an example of a pattern for other jurisdictions. — [orthocal search result / katameros-api](https://github-redirect.dependabot.com/pierresaid/katameros-api)
- Commentaries-Database publishes ready-made SQLite releases, which allows a working Fathers panel on day one. — [GitHub](https://github.com/HistoricalChristianFaith/Commentaries-Database)

### Inferences
**Plan engine data model (SQLite, same on device and in Supabase):**
- `plan(id, slug, title, description, kind[relative|fixed_date|calendar], calendar[julian|revised_julian|null], total_days, source, version)`
- `plan_day(plan_id, day_index | fixed_date | calendar_rule, title, reflection_md)`
- `plan_item(plan_day_id, ord, type[scripture|father|reflection], osis_range, commentary_link_id?, work_ref?, est_minutes)`
- `user_plan(id, plan_id, start_date, timezone, reminder_time, paused_at, catchup_mode[strict|flex])`
- `user_progress(user_plan_id, day_index, item_ord, completed_at)`. Streak = consecutive calendar days with at least one completion, computed when needed rather than stored.
- **Relative plans** ("start any day"): day N = start_date + N. **Fixed-date plans** (e.g. a Nativity Fast plan from Nov 15/28): the date maps to a day, and missed days show as "behind". **Calendar plans** (lectionary): no stored days; fetch or compute readings by date and jurisdiction calendar. Cache orthocal results for a year ahead so the app works offline, or self-host orthocal-python. Pascha-dependent seasons (Triodion, Pentecostarion) mean computing from the Paschalion rather than storing fixed dates.
- **Reminders:** schedule local notifications for the next ~30 days on device and reschedule when the app opens. No push server needed in v1.
- **Starter plans:** (1) Daily lectionary (Epistle + Gospel + one Father comment on the Gospel); (2) Gospels in 90 days with a daily Father reading (e.g. Chrysostom's homilies); (3) Psalter on the LXX kathisma cycle (20 kathismata, read weekly or monthly); (4) Great Lent plan (fixed-date, computed from Pascha).

**Phased roadmap and rough effort (one developer + AI tools, part-time):**
- **Phase 0 – data (1–2 weeks):** USFM→SQLite import for Brenton + KJV/WEB, OSIS key scheme, versification table (LXX↔KJV psalms, Daniel/Esther additions, deuterocanon), Commentaries-Database import and conversion of its verse keys to OSIS.
- **Phase 1 – MVP app (3–5 weeks):** Expo app with book/chapter reader, verse tap → Fathers sheet (source link), FTS search + reference jump through bcv_parser, today's readings, 2–3 plans with progress, streak and local reminders, settings (font size, dark mode, calendar style), privacy policy, web build. Submit to both stores (allow 14+ days for the Google 12-tester closed test).
- **Phase 2 (4–8 weeks):** ANF/NPNF explicit-citation extraction with review UI, highlights/notes/bookmarks, optional Supabase sync with in-app account deletion, on-device TTS.
- **Phase 3:** embedding/LLM "suggested" links with volunteer review, more translations (licensed OSB/EOB if obtained, Church Slavonic/other languages from scrollmapper), saints of the day, shareable verse images, more jurisdictions.
- **Keep it simple:** one translation pair, no social features, no ads, no login in v1, and Fathers comments always shown with work, section and link.

### Gaps
- orthocal.info's API endpoint paths, JSON schema, rate limits and terms could not be read (the docs page returned only a title). Confirm before relying on it, or self-host the MIT code.
- Which translation orthocal returns for reading texts, and whether reading references (not texts) are enough, is unknown.
- No published case study of a solo-built Bible app with real effort figures was found. The estimates above are the researcher's judgement.

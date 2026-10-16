# Orthodox daily content, learning content, competitor apps, and data/APIs (as of Oct 2026)

Research method note: about 20 searches/fetches. Reddit threads did not show up in search results (two attempts), so community sentiment comes from app-store listings, Orthodox blogs (orthodoxroad.com, learnofchrist.com) and one vendor-written roundup (livesofthesaintscalendar.com, which ranks its own app first, so treat it as biased). The orthocal.info API was called live (2026-10-16) to check its fields.

## Q1. What daily features would an Orthodox user expect in a Bible app?

### Takeaway
The baseline every Orthodox calendar app ships is: the day's Epistle and Gospel by the church lectionary, the saints and feasts of the day (often with troparion/kontakion), a fasting indicator, and morning and evening prayers. A choice between New (Revised Julian) and Old (Julian) calendar is expected, and the better apps also let you pick a jurisdiction or typikon (Greek, Antiochian, Russian, Serbian, OCA). Pascha is computed on the Julian basis by nearly everyone, including New Calendar churches.

### Cited Findings
**What competitors treat as the baseline**
- GOARCH "Daily Readings" app: New Calendar by default. Covers saints' lives, fasting rules, troparia/kontakia and daily Scriptures, shows prayers for the current time of day, and includes pre- and post-communion prayers. Free, with a paid version that adds a liturgical glossary. — [orthodoxroad.com](https://www.orthodoxroad.com/?p=1467)
- "Orthodox Calendar" app: Julian calendar by default. Saints' lives, fasting rules, daily troparia/kontakia in Thee/Thou language, daily Scriptures, and any date can be picked. A noted weakness is several saints per day, each with a long biography. — [orthodoxroad.com](https://www.orthodoxroad.com/?p=1467)
- Orthodox Daily Companion: daily saint, appointed readings, morning/evening prayers, fasting rule, Home Screen widget, prayer reminders, on-device journal, and feasts under both Julian and Revised Julian. iPhone/iPad only, with a web app for Android. — [livesofthesaintscalendar.com (vendor-written)](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps)
- OrthoPrax: Julian or Revised Julian calendar, adjustable to Greek, Antiochian, Serbian, Russian and American typicons, with 3,500+ icon images. Downside: users must answer questions about their tradition before getting much value. — [livesofthesaintscalendar.com](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps)
- Athon: daily readings, feast and fasting calendars, audio Bible studies, 900+ saints' lives, a full offline Orthodox Bible, and AI-powered Orthodox Q&A. — [App Store](https://apps.apple.com/us/app/athon-orthodox-bible/id6748612588)
- A blogger's wish for one popular prayer app: add a "Daily Prayers" category holding morning and evening rules. This suggests users expect the prayer rule to be easy to reach, not buried in a big library. — [orthodoxroad.com](https://www.orthodoxroad.com/?p=1467)

**How the calendars work and where practice differs**
- Orthodox churches use three calendars: Julian ("Old"), Revised Julian ("New") and Gregorian. Most Orthodox Christians by population follow the Julian calendar, but most autocephalous and autonomous church bodies use a New Calendar. Some parishes differ from their national church. — [OrthodoxWiki: Church Calendar](https://orthodoxwiki.org/Church_calendar)
- Churches using the Revised Julian calendar for fixed feasts (e.g., Greek, Romanian, Antiochian) still compute Pascha on the Julian/Alexandrian basis. The OCU and UGCC in Ukraine also keep the Alexandrian paschal cycle while using the new calendar for other feasts. — [OrthodoxWiki](https://orthodoxwiki.org/Church_calendar); [Komersant (UA)](https://komersant.ua/en/5-chy-12-kvitnia-koly-naspravdi-ukraintsi-sviatkuvatymut-paskhu-u-2026-rotsi-roz-iasnennia/)
- Orthodox Pascha 2026 was 12 April (Western Easter was 5 April). One site (universaltimedate.com) wrongly gives 5 April for both. — [Good Shepherd](https://www.thegoodshepherd.org.au/date-orthodox-easter-2021); [Komersant](https://komersant.ua/en/5-chy-12-kvitnia-koly-naspravdi-ukraintsi-sviatkuvatymut-paskhu-u-2026-rotsi-roz-iasnennia/)
- The orthocal.info API's day object has `pascha_distance` (days from Pascha), `tone`, `titles` (e.g., "Friday of the 20th week after Pentecost"), feast level, `fast_level`/`fast_level_desc`, `fast_exception`, a list of `fast_abstentions` (meat, fish, dairy, eggs, wine, oil), saints, service notes, and readings with full verse text. Live call for 2026-10-16: [orthocal.info/api/gregorian/2026/10/16/](https://orthocal.info/api/gregorian/2026/10/16/)
  - This shows the movable cycle (Paschalion) is computed from distance to Pascha. The lectionary, tone and fasting all depend on it.
- Fasting accuracy is a known pain point: users flag wrong fasting days in "Orthodox Calendar †". — [search summary of App Store reviews, via livesofthesaintscalendar/app listings](https://apps.apple.com/app/id1437751976)

### Inferences
- Minimum feature set for a "simple" app: (1) today's readings with full text, (2) the saint or feast of the day with a short life (one paragraph, not several long biographies), (3) a fast indicator showing what is allowed and why, e.g. "Wednesday" or "Nativity Fast", (4) morning and evening prayers one tap away, (5) a New/Old calendar toggle set once at onboarding. A jurisdiction picker can wait until v2. Asking too many tradition questions up front is a known friction (OrthoPrax).
- Practice differs by jurisdiction:
  - Readings can differ, e.g. the Lukan jump after the Elevation of the Cross differs between Greek and Slavic practice.
  - Saints lists differ: Slavic, Greek and Serbian saints are emphasised differently.
  - Fasting rules differ: the Greek "fish allowed" days during the Nativity fast differ from the Russian ones, and how strict Wednesdays and Fridays are varies.
  - The app should show a disclaimer to "follow your priest's guidance", which is standard Orthodox pastoral practice.
- Pascha computation is simple and well documented (Julian computus, i.e. the Meeus Julian algorithm, then convert to the civil Gregorian date). For Revised Julian users, fixed feasts shift +13 days but movable feasts do not. Edge case: Old Calendar users see Nativity on Jan 7 (civil). For the Apostles' Fast, length depends on Pascha and the calendar, and in New Calendar years with a late Pascha it can vanish entirely.

### Gaps
- No direct primary documentation (OCA/GOARCH typikon pages) on jurisdictional reading and fasting differences was fetched in this pass.
- No Reddit threads were retrieved, so complaints from community users about features are thin.

## Q2. Which data sources/APIs provide this, and can they be reused?

### Takeaway
orthocal.info is the best open option: its code is MIT-licensed, it has a free JSON API (Gregorian and Julian) with readings, saints, fasting, tone and Pascha distance, and scripture text is KJV, which is public domain in the US. The content underneath it (OCA lives, commemorations) is not clearly licensed. OCA.org saint lives are "All rights reserved". Lives of the Saints Calendar has a keyed API whose terms weren't readable. Most prayer-book, Philokalia and Prologue English translations are in copyright, so the safest free corpus is public-domain 19th-century translations (NPNF, KJV, and older prayer translations) plus self-computed calendar logic.

### Cited Findings
**orthocal.info**
- Free API "Website administrators can use ... on either the front-end or back-end to embed the daily readings." Documentation lives at /api/docs/. — [orthocal.info/api](https://orthocal.info/api/)
- Example endpoint: `https://orthocal.info/api/gregorian/YYYY/MM/DD/` returns full JSON including verse text. A Julian variant also exists, reflected in the path naming and the Go-era docs. — [live call](https://orthocal.info/api/gregorian/2026/10/16/); [orthocal-service on pkg.go.dev](https://beta.pkg.go.dev/github.com/brianglass/orthocal-service)
- The scripture text returned is KJV, e.g. Phil 3:8 "Yea doubtless, and I count all things but loss...". — [live call](https://orthocal.info/api/gregorian/2026/10/16/)
- The Python rewrite at github.com/brianglass/orthocal-python is MIT-licensed. Built with Django, it has modules for bible, calendarium and commemorations, `ingest_antiochian.py` scripts, an Alexa skill and an MCP service, and runs on Google Cloud Run. — [GitHub orthocal-python](https://github.com/brianglass/orthocal-python)
- The older Go library (brianglass/orthocal) is MIT-licensed and deprecated in favour of the Python version. — [pkg.go.dev](https://pkg.go.dev/github.com/brianglass/orthocal)
- No explicit content licence, rate limits or terms of use were found on the API pages. — [orthocal.info/api/docs](https://orthocal.info/api/docs/)

**OCA.org**
- OCA saints' lives pages carry "Copyright The Orthodox Church in America (OCA) © 1996–2026. All rights reserved." No reuse permission was found. — [oca.org saint life example](https://www.oca.org/saints/id/lives/108047)
- An Orthodox blogger notes OCA.org has the most in-depth lives, readings and printable variable service texts, but is less mobile-friendly. — [orthodoxroad.com](https://www.orthodoxroad.com/?p=1467)

**Lives of the Saints Calendar API**
- Endpoints at `https://livesofthesaintscalendar.com/api/v1`: `/calendar/today`, `/calendar/{date}`, `/saints`, `/saints/{slug}`, `/saints/{slug}/hymnography`, `/countries`, `/search`.
- It takes a bearer token, a `calendar` parameter of gregorian or julian, open CORS, `X-RateLimit-*` headers, and has an OpenAPI 3.1 spec.
- The terms, acceptable use and quota pages exist but their contents weren't retrieved. The owner is a commercial app publisher.
- Source: [developers/docs](https://www.livesofthesaintscalendar.com/developers/docs)

**GOARCH/AGES Digital Chant Stand**
- All content and functionality are free, "as is". The translations and texts are "for the purposes of worship only" and may change.
- Users wanting other texts must contact AGES Initiatives. Its privacy label says no data is collected.
- No reuse licence was found, so assume all rights are reserved.
- Source: [App Store](https://apps.apple.com/us/app/-/id891132857)

**Copyright status of key texts**
- Prologue of Ohrid: St Nikolai died in 1956.
  - The English translations are separate works under their own copyrights: Mother Maria's (Lazarica Press), and Sebastian Press's 2-volume complete edition (2nd edition 2008, by clergy of the Serbian Diocese of Western America).
  - No public-domain or licence statement was found, so treat it as copyrighted.
  - Sources: [Lazarica](https://lazarica.co.uk/?p=1834); [Sebastian Press/eSerbia](https://eserbia.org/culture/publishing/sebastian-press/the-prologue-of-ohrid.html); [OrthodoxWiki](https://orthodoxwiki.org/Prologue_of_Ohrid)
- Jordanville Prayer Book (Holy Trinity Publications, 4th revised edition 2003): a commercial in-print product, and no licence was found. Treat it as copyrighted. OrthodoxWiki links an online 1986 edition, but whether that copy is authorised is unknown. — [Holy Trinity Publications](https://holytrinitypublications.com/product/prayer-book-9780884651758/); [OrthodoxWiki Online books](https://orthodoxwiki.org/Online_books)
- Philokalia:
  - Kadloubovsky and Palmer's "Writings from the Philokalia on Prayer of the Heart" (Faber 1951) and "Early Fathers from the Philokalia" (1954) are still reprinted by Faber, so they are likely in copyright.
  - The complete Palmer/Sherrard/Ware translation (Faber, 1979 onward) is in copyright.
  - The original Greek (1782) and Theophan's Russian Dobrotolubiye are public domain.
  - Sources: [Princeton catalog](https://catalog.princeton.edu/catalog/SCSB-8037259); [search summary](https://fortnightlyreview.co.uk/?p=34987)
- Philaret's Longer Catechism was written in 1822–23 and revised in 1827 and 1839. The 19th-century English translation (R.W. Blackmore, 1845) is generally treated as public domain and is widely hosted, though the specific translation used must be verified. — [HSE paper on history](https://publications.hse.ru/pubs/share/direct/967729892.pdf); [OrthodoxWiki online books](https://orthodoxwiki.org/Online_books)
- Nicene and Post-Nicene Fathers (Schaff/Wace, 1886–1900): two series of 14 volumes each, hosted at CCEL. The original texts are public domain, but some modern reprints claim "All Rights Reserved", so source from the original or CCEL scans. — [Wikipedia NPNF](https://en.wikipedia.org/wiki/Nicene_and_Post-Nicene_Fathers); [CCEL NPNF1-09 (Chrysostom)](https://www.ccel.org/ccel/schaff/npnf109.i.html)
- Catena Bible says its commentaries are drawn from public-domain works of the Fathers. This shows a patristic-commentary corpus can be built legally. — [learnofchrist.com review](https://learnofchrist.com/resources/catena-bible)

### Inferences
- **Recommended stack:**
  - Compute the calendar locally. Port the Paschalion (Julian computus) and the reading tables in-app, using orthocal-python's MIT-licensed code as a reference or port, with attribution and an MIT notice.
  - Optionally call orthocal.info's API as a fallback. Ask Brian Glass before any heavy production use, since no rate limits or terms are published.
  - Use KJV or another public-domain text for the scriptures.
- **NKJV/OSB risk:** NKJV (the Orthodox Study Bible's NT) and the OSB's own Septuagint OT translation are copyrighted by Thomas Nelson / St Athanasius Academy. A free app cannot use them without a licence.
  - Public-domain Septuagint option: Brenton's 1844 English LXX.
  - Free NT option: the Eastern Orthodox Bible (EOB) NT may have a permissive licence, but this needs checking.
- **Saints:** don't scrape OCA lives. Instead, write short original one-paragraph lives, use public-domain sources (e.g., Baring-Gould, the 19th-century "Menology"), or seek permission from OCA or the Lives of the Saints API owner.
- **Prayers:**
  - Many core prayers have 19th-century public-domain English translations, e.g. Isabel Hapgood's Service Book (1906) and Shann's Euchology (1891). They include the Divine Liturgy of St John Chrysostom, the Hours, many daily prayers and akathists.
  - Hapgood (1906) is US public domain by date. This is from general knowledge and should be verified against a primary source.
  - The Psalter divided into 20 kathismata can be built from a public-domain Psalter: Coverdale/KJV is Hebrew-numbered, and Brenton is LXX-numbered. The app would need LXX numbering.

### Gaps
- The orthocal.info data licence, terms and rate limits are not stated anywhere found. The project needs to contact the maintainer.
- The Lives of the Saints Calendar API ToS and quota content was not retrieved.
- The OCA "Documents & Policies" or reuse page was not found.
- Whether Hapgood, Shann, Blackmore, Waddell (Desert Fathers, 1936) and Lazarus Moore (Ladder, 1959) are public domain was not verified by a fetched source in this pass. Moore's translation is likely still in copyright.
- No GitHub Paschalion library besides orthocal was examined. The holytrinityorthodox.com calendar's terms were not checked.

## Q3. Competitor apps: what users praise/complain about, and the gap

### Takeaway
The market is crowded with calendar/prayer apps and a few Bible apps, but no free, simple app links the day's lectionary readings to patristic commentary. Catena has the commentary but no Orthodox calendar. The OSB app has Orthodox notes but no daily calendar link and is paid or tiered. The calendar apps have readings but no Fathers. The newer entrants (Athon, Eastern Orthodox Bible Prayer, Orthodox Christian Bible) are moving to subscriptions and AI features, which leaves room for an honest free, no-tracking app.

### Cited Findings
| App | Who / price | Praise | Complaints / gaps | Source |
|---|---|---|---|---|
| Catena Bible & Commentaries | Free. iOS, Android, web | Tens of thousands of verse-linked commentaries from 250+ authors. Translations include KJV, NKJV, RSV, NIV and Douay-Rheims. 76-book canon, reading plans, notes. "One of the best apps available." | Not Orthodox-specific. No church calendar. Medieval/post-patristic writers sit under the same heading as the Fathers. Thin Old Testament coverage. Some authors deemed heretical (Origen, Theodore of Mopsuestia) are hidden by default. One review says no updates in 3+ years, though a listing shows a July 2026 update, so maintenance status is unclear. | [learnofchrist](https://learnofchrist.com/resources/catena-bible); [orthodoxroad](https://www.orthodoxroad.com/?p=1467); [faith.tools](https://faith.tools/app/catena-bible-and-commentaries) |
| Orthodox Study Bible app | VDUB Software (not Ancient Faith). Seen as free (Android, 4.77/5 from 47 ratings) and as $10 (158 ratings) | LXX-based Orthodox OT plus NKJV. Good for converts. | Notes focus on Protestant–Orthodox differences and lack patristic breadth. Paid or variable pricing. | [AppBrain](https://www.appbrain.com/appstore/orthodox-study-bible/ios-6738711125); [AppGoblin](https://appgoblin.info/apps/583706254); [orthodoxroad](https://www.orthodoxroad.com/?p=1467) |
| OSB print (Ancient Faith ed., 2019) | $50 hardcover, $75–80 leathersoft | Binding and print quality | — | [Holy Cross](https://www.holycross.org/collections/books-media/products/the-orthodox-study-bible-ancient-faith-edition-hardcover); [STM Press](https://stmpress.com/products/the-orthodox-study-bible-soft-leather) |
| Athon: Orthodox Bible | Product Tech SRL. Free with in-app purchases. 4.9★ (261–309 ratings) | All-in-one: readings, 900+ saints, fasting, prayers with audio, guided studies, AI Q&A | "Heaviest to learn." Paywall tiers not published. AI Q&A is a doctrinal accuracy risk (inference). | [App Store](https://apps.apple.com/us/app/athon-orthodox-bible/id6748612588); [livesofthesaintscalendar](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps) |
| Eastern Orthodox Bible・Prayer | Subscription, $19.99/mo or $83.99/yr | — | Expensive subscription | [App Store](https://apps.apple.com/app/id6760005952) |
| Orthodox Christian Bible | $7.99/mo subscription | — | Subscription | [AppsHunter](https://appshunter.io/ios/app/orthodox-christian-bible/id6762108321) |
| GOARCH Daily Readings | Free, plus a paid glossary version. iOS, Android | Clean, fast, prayers by time of day | Modern "You" language. Deliberately narrow: not a prayer book or library. | [orthodoxroad](https://www.orthodoxroad.com/?p=1467); [livesofthesaintscalendar](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps) |
| GOA/AGES Digital Chant Stand | Free, collects no data | Each day's full services, tone audio, sheet music, clergy parts. Great for chanters and clergy. | Laypeople find it complex. Reviewers complain about changed translations and glitches since GOA took over AGES. | [App Store](https://apps.apple.com/us/app/-/id891132857); [orthodoxroad](https://www.orthodoxroad.com/?p=1467) |
| Orthodox Calendar † (Alexey Dushkin) | Calendar free. Bible and prayer book need a purchase or subscription. Ad-free tier is a subscription. | Julian and Revised Julian views | Users report wrong fasting days. Dense, reference-first UI. | [App Store](https://apps.apple.com/app/id1437751976); [livesofthesaintscalendar](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps) |
| Orthodox Christian Calendar+ | Free, collects no data | Russian Church calendar, fasting, Gospel, prayers, Liturgy text, Bible | Single-tradition (Russian) focus | [App Store](https://apps.apple.com/us/app/id1010208102) |
| OrthoPrax | iOS/Android | Julian or Revised Julian, multiple typicons, 3,500+ icons | Onboarding asks many questions | [livesofthesaintscalendar](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps) |
| Orthodox Daily Companion (Lives of the Saints) | Free with optional premium. iOS only. | Widget, reminders, journal, "no ads, no paywalled prayers" (vendor claim) | iOS only | [vendor page](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps) |
| Orthodox Daily | Free | No accounts, analytics, ads or trackers (listing claim) | — | [mwm.ai listing](https://mwm.ai/apps/orthodox-daily/6768548082) |
| Ancient Faith | Free radio and podcasts | 24/7 Orthodox radio and podcasts (e.g., Fr Thomas Hopko), offline downloads | Doesn't show the day's fast. Not a Bible app. | [livesofthesaintscalendar](https://www.livesofthesaintscalendar.com/best-orthodox-christian-apps); [orthodoxroad](https://www.orthodoxroad.com/?p=1467) |
| Pray Always! / English Orthodox Prayers / Orthodox Daily Prayers | Prayer books (English Orthodox Prayers is free, Android) | Font control, KJV vs modern English choice (Pray Always) | Abbreviated (Jordanville-based) or basic layout | [orthodoxroad](https://www.orthodoxroad.com/?p=1467) |
| Orthodox Prayers (and Services) / Orthodox Info | Same developer | Huge breadth of services, akathists, writings | No clear "daily rule" entry point | [orthodoxroad](https://www.orthodoxroad.com/?p=1467) |
| Eastern Orthodox Bible (EOB) NT | $1.99, iOS | Orthodox NT translation | Single translator | [orthodoxroad](https://www.orthodoxroad.com/?p=1467) |
| Candle, Orthodox Way, OrthoApp, Azbyka / Pravoslavie apps | Mostly Russian-language | Candle: customizable 5–20 min prayer rule in Russian or Church Slavonic | Language barrier for English speakers | [mwm.ai Candle](https://mwm.ai/apps/app/6763723853); [OrthoApp App Store](https://apps.apple.com/app/id1069901416) |

- Privacy is a theme: one Orthodox blogger warns some Christian apps behave like spyware and advises deleting apps asking for location or contacts. Several Orthodox apps market "no data collected". — [orthodoxroad](https://www.orthodoxroad.com/?p=1467); [Calendar+](https://apps.apple.com/us/app/id1010208102)
- Latria, an iOS paid app, uses Catena Aurea and the Fathers. Reviewers call it a generous offline companion, but its full verse study is paywalled. — [learnofchrist Latria](https://learnofchrist.com/resources/latria)

### Inferences
- **The gap:** a free, offline-first app where "Today" shows the Orthodox lectionary reading and 2–4 short public-domain patristic comments on it (Chrysostom's homilies on Matthew, John, Romans and others from NPNF; Theophylact where public domain). Add the saint of the day, a fast indicator and the prayer rule, with no account, ads or tracking.
  - No competitor combines lectionary to Fathers. Catena has the Fathers but no calendar, and the calendar apps have no Fathers.
- **Differentiators that answer common complaints:**
  - Accurate, explained fasting with a "your parish may differ" note.
  - Thee/Thou vs You toggle for prayers.
  - One short saint life instead of several long biographies.
  - Calendar choice set once.
  - Android parity (Orthodox Daily Companion is iOS only).
  - No subscription: competitors at $7.99–$19.99/month leave an opening.
- Avoid an AI Q&A, or label it clearly, because Orthodox users are sensitive to doctrinal accuracy and pastoral authority (inference).

### Gaps
- No Reddit r/OrthodoxChristianity threads were retrieved, so sentiment there is unverified.
- Exact current store ratings for Catena, GOARCH Daily Readings, Ancient Faith, OCA and Digital Chant Stand were not collected.
- An official "OCA app" was not confirmed to exist. OCA's readings are web-based on oca.org.

## Q4. What learning plans would be most helpful, and what classic content is usable?

### Takeaway
Orthodox catechesis rests on Scripture read with the Fathers, the Liturgy, the Philokalic and desert tradition, the Lives of Saints and a catechism. Many classic recommendations are in copyright in their popular translations (Ware, Philokalia, Ladder by Moore, Ward's Desert Fathers, the Prologue). Plans should therefore be built on public-domain sources (NPNF, Philaret's Catechism, Hapgood's Service Book, KJV/Brenton) and link out to copyrighted books as "further reading".

### Cited Findings
- NPNF (1886–1900, 28 volumes) supplies public-domain English for Chrysostom (homilies on the Gospels and Epistles), Athanasius, the Cappadocians and others. — [Wikipedia](https://en.wikipedia.org/wiki/Nicene_and_Post-Nicene_Fathers); [CCEL Gregory of Nyssa NPNF2-05](https://www.ccel.org/ccel/schaff/npnf205.html)
- Philaret's Catechism (1823, revised 1839) is the classic Russian question-and-answer catechism and is listed among online Orthodox books. — [HSE](https://publications.hse.ru/pubs/share/direct/967729892.pdf); [OrthodoxWiki](https://orthodoxwiki.org/Online_books)
- The Philokalia's English editions are by Faber and in copyright. The Greek and Russian originals are public domain. — [Princeton catalog](https://catalog.princeton.edu/catalog/SCSB-8037259)
- Athon already offers "guided Bible studies" and audio studies, so competitors see demand for structured plans. — [App Store](https://apps.apple.com/us/app/athon-orthodox-bible/id6748612588)
- Catena offers custom reading plans. — [learnofchrist](https://learnofchrist.com/resources/catena-bible)
- Ancient Faith podcasts (e.g., Fr Thomas Hopko) are a popular layperson learning channel. — [orthodoxroad](https://www.orthodoxroad.com/?p=1467)

### Inferences
- **Suggested plans, with sources that are public domain or originally written:**
  1. **Intro to Orthodoxy (14 days):** Creed line by line, using Philaret's Catechism and original summaries. Link to Ware's *The Orthodox Church* (copyrighted) as further reading only.
  2. **The Divine Liturgy explained (10 days):** text from Hapgood 1906, plus commentary from public-domain Nicholas Cabasilas or Chrysostom where available. Verify the translation's status first.
  3. **Great Lent with the Fathers (~48 days, movable):** tied to the Paschalion. Daily Lenten readings (Genesis, Isaiah and Proverbs at the weekday Presanctified services), the Prayer of St Ephrem, and short Chrysostom excerpts. The Ladder is traditional for Lent, but Moore's translation is likely in copyright, so use excerpts from a public-domain or licensed source.
  4. **Desert Fathers in 30 days:** Waddell's *The Desert Fathers* (1936) may be public domain in some countries (Waddell died 1965) but not the US, so verify. Benedicta Ward's translation is copyrighted. Alternatively, use Rufinus/Palladius in public-domain translations (e.g., the Lausiac History by Lowther Clarke, 1918).
  5. **On the Incarnation (St Athanasius) in 9 days:** the NPNF2-4 Archibald Robertson translation is public domain. The CSMV 1944 translation with C.S. Lewis's introduction is not.
  6. **The Jesus Prayer:** short original content plus *The Way of a Pilgrim*. The R.M. French translation is from 1930, so check its status.
  7. **Psalter by kathisma:** a 20-day cycle, or the traditional weekly cycle.
  8. **Mysteries/sacraments, icons explained, church year explained:** short original explainers, which avoid copyright entirely.
- Present plans as sources the user can verify, and recommend people learn alongside their priest or parish.

### Gaps
- Public-domain status was not verified by fetched sources for: Hapgood, Waddell, Lowther Clarke, R.M. French, the Robertson/NPNF *On the Incarnation*, Moore's Ladder, or Blackmore's Philaret translation. The project should check each title page and death date before shipping.
- No data was found on which learning plans Orthodox users actually complete or request. Recommendations here are inference.

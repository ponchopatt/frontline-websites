# Church Fathers Texts and Verse-to-Father Data Sources for a Free Orthodox Bible App

Research date: 2026-10-16. Tools used: web fetch of primary pages (New Advent, CCEL, GitHub, historicalchristian.faith, catenabible.com) and web search. Some pages (New Advent copyright page, CCEL scripture index, CCEL XML download) returned 404 or a login wall and are noted as gaps.

## Q1. What Fathers and works are on New Advent, and how are they structured (URL patterns, chapters/homilies)?

### Takeaway
New Advent's Fathers index lists about 65 named authors plus sections for Liturgies, Councils, Apocrypha and Miscellaneous. The texts are the 19th-century Schaff/Roberts-Donaldson ANF/NPNF translations, "revised and edited for New Advent by Kevin Knight". Each work has a numeric ID (e.g. `/fathers/2001.htm`), and each homily or chapter is the ID plus a two-digit suffix (`/fathers/200101.htm`). The verse-by-verse "core" is Chrysostom's 16 New Testament homily sets, Augustine on John, 1 John and the Psalms, and Origen on John and Matthew.

### Cited Findings
- The index lists 65 Fathers. Approximate linked-work counts per author: Augustine 48, John Chrysostom 36, Tertullian 33, Athanasius 20, Gregory of Nyssa 15, Jerome 13, Ambrose 11, Gregory Thaumaturgus 11, Hippolytus 9, Ignatius 9, Justin Martyr 9, Lactantius 8, Origen 8, Ephraim the Syrian 7, Methodius 7, Clement of Alexandria 5, Clement of Rome 5, Eusebius 5, Sulpitius Severus 5, Theodoret 5, Cyprian 4, Basil the Great 3, John Cassian 3, Hilary 3, Rufinus 3, Tatian 3, Peter of Alexandria 3, Gregory Nazianzen 2, Gregory the Great 2, Leo the Great 2, Irenaeus 2, Polycarp 2, Novatian 2, Victorinus 2, Athenagoras 2, Cyril of Jerusalem 1, John of Damascus 1, Socrates 1, Sozomen 1, Vincent of Lérins 1, Papias 1, Hermas 1, Barnabas 1, Aphrahat 1, and others with 1 each — [New Advent Fathers index](https://www.newadvent.org/fathers/)
- Other sections: Liturgies (3), Councils (18), Apocrypha (some tagged [GNOSTIC] or [DOCETIC]), and Miscellaneous (Didache, Apostolic Constitutions). Authors carry tags such as [SAINT], [DOCTOR], [LOCAL], [ECUMENICAL] and [SPURIOUS] — [New Advent Fathers index](https://www.newadvent.org/fathers/)
- URL pattern: works are `/fathers/NNNN.htm`, usually 4 digits and sometimes 5 (e.g. `07158.htm`). Numbers are grouped by author (Augustine runs from 1101 to 1801). Author names link to Catholic Encyclopedia entries under `/cathen/` — [New Advent Fathers index](https://www.newadvent.org/fathers/)
- Example: Chrysostom's Homilies on Matthew is `/fathers/2001.htm`, a contents page listing 90 homilies at `/fathers/200101.htm` … `/fathers/200190.htm`. The footer reads: "Translated by George Prevost and revised by M.B. Riddle. From Nicene and Post-Nicene Fathers, First Series, Vol. 10. Edited by Philip Schaff. (Buffalo, NY: Christian Literature Publishing Co., 1888.) Revised and edited for New Advent by Kevin Knight." and "Copyright © 2026 by New Advent LLC." — [New Advent, Homilies on Matthew](https://www.newadvent.org/fathers/2001.htm)
- Scripture commentaries and homilies listed on the index:
  - Chrysostom: Matthew, John, Acts, Romans, 1–2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1–2 Thessalonians, 1–2 Timothy, Titus, Philemon, Hebrews.
  - Augustine: Sermon on the Mount, Harmony of the Gospels, Tractates on John, Homilies on 1 John, Enarrations (Expositions) on the Psalms.
  - Origen: Commentaries on John and Matthew.
  - Others: Hilary, Homilies on the Psalms; Victorinus, Commentary on the Apocalypse; Pamphilus, Exposition on Acts; Methodius, Oration on the Psalms; Gregory Thaumaturgus, Metaphrase of Ecclesiastes and a piece on Matthew 6:22-23; Athanasius, on Luke 10:22; Basil, Hexaemeron (Genesis 1).
  — [New Advent Fathers index](https://www.newadvent.org/fathers/)
- The ANF has 10 volumes, and Vol. 10 is a bibliographic synopsis and general index — [CCEL ANF10](https://ccel.org/ccel/schaff/anf10)

### Inferences
- The index itself does not say "ANF" or "NPNF", but the per-work footers do (as with the Matthew example). So the whole collection is effectively an edited HTML rendering of ANF (10 vols), NPNF1 (14 vols) and NPNF2 (14 vols), plus a few additions such as Ephraim and Mar Jacob.
- Rough scale is about 400 linked works. Many of them, such as homily series, split into tens of sub-pages, so the total is several thousand HTML pages. Chrysostom alone has roughly 1,000+ homily pages across his NT series. This is an estimate, not a counted figure.
- An app gets most verse-level value from Chrysostom's NT homilies and Augustine on John, 1 John and the Psalms. Both are written as running commentary that quotes the verse and then explains it.

### Gaps
- No exact page count was available. A crawl of `/fathers/` would be needed.
- The index does not map each Father to his ANF or NPNF volume. That mapping has to be read from each work's footer.

## Q2. Can an app legally reuse the texts, and which source is safest (CCEL XML, New Advent HTML, Wikisource)?

### Takeaway
The underlying ANF/NPNF translations (1885–1900, US) are public domain. However, both New Advent and CCEL claim copyright on their editions or sites: New Advent says "Copyright © 2026 New Advent LLC" and the texts are "revised and edited … by Kevin Knight", and CCEL restricts commercial use and republishing without permission. The legally cleanest route for a free app is to take the text from page scans or public-domain transcriptions (Wikisource, Internet Archive, or the HistoricalChristianFaith public-domain dedication). CCEL or New Advent should be used only for cross-checking, or with written permission.

### Cited Findings
- Every New Advent work page carries "Revised and edited for New Advent by Kevin Knight" and "Copyright © 2026 by New Advent LLC" — [New Advent Matthew homilies](https://www.newadvent.org/fathers/2001.htm)
- New Advent's copyright page (`/utility/copyright.htm`) and FAQ returned 404 at research time, so its exact reuse terms could not be quoted — [attempted URL](https://www.newadvent.org/utility/copyright.htm)
- CCEL policy: "Most of the editions … are based on books that are public domain", but "they may have copyrighted introductions, cover art, and other special contents". The policy also says "CCEL.org website and special contents copyright 1993-2020 Harry Plantinga", "These books may be used for personal, educational, or non-profit purposes", and "Contact us for permission to republish CCEL works or to use them commercially". It warns that public domain status varies by country — [CCEL Copyright Policy](https://ccel.org/about/copyright.html)
- Wikipedia reports that CCEL stores texts in ThML, claims copyright on its formatting, and requires a login to download formatted versions — [Wikipedia: CCEL](https://en.wikipedia.org/wiki/Christian_Classics_Ethereal_Library). This is consistent with my test: an anonymous request for `ccel.org/ccel/s/schaff/npnf110/cache/npnf110.xml` returned an HTML "Page Not Found" page, not XML.
- The CCEL Catena Aurea page offers PDF, Word HTML, ThML (XML), UTF-8 text and ePub downloads — [CCEL Catena Aurea Matthew](https://www.ccel.org/ccel/aquinas/catena1)
- ThML was developed for CCEL in the hope it would serve as a royalty-free format for theological texts — [ThML 1.04 spec](https://ccel.org/ThML/ThML1.04.htm)
- Wikisource hosts ANF volume by volume, with treatises split into chapters plus "Elucidations" (e.g. Tertullian, Against Praxeas, under Vol. III) — [Wikisource ANF Vol III](https://en.wikisource.org/wiki/Ante-Nicene_Fathers/Volume_III/Anti-Marcion/Against_Praxeas), [Wikisource ANF Vol IV](https://en.wikisource.org/wiki/Ante-Nicene_Fathers/Volume_IV)
- Scans of the original ANF volumes are on the Internet Archive — [archive.org ANF vol 1](https://archive.org/details/cuaantenicenefat01robe/page/28/mode/2up?q=healer)

### Inferences
- Copyright law (Feist v. Rural, US) generally does not protect "sweat of the brow" or HTML markup of a PD text. Kevin Knight's "revisions" (modernised spelling, corrected typos, reformatting) may give a thin claim, and the site copyright clearly covers the site design, Catholic Encyclopedia links and so on. Scraping New Advent wholesale also likely conflicts with its terms and would be ethically poor for a free Christian app. Recommendation: do not scrape New Advent HTML for redistribution. At most, link out to it.
- CCEL's "non-profit purposes" clause probably covers a free, ad-free app run by a non-profit, but not a free app with ads or in-app purchases. Ask CCEL for written permission if using its ThML. It is the best-structured source.
- Wikisource text is CC BY-SA or PD. Transcriptions of PD works are PD in the US, so Wikisource is safe, but its NPNF coverage is incomplete (see gaps).
- The original 1880s–1890s printed volumes are PD in the US. In the UK and EU there is typically no copyright on the original translations either, since the translators died more than 70 years ago.

### Gaps
- New Advent's exact written reuse terms were not retrieved (404).
- How complete Wikisource's NPNF transcription is could not be verified.
- Whether CCEL's ThML download now requires a paid or registered account could not be confirmed directly.

## Q3. What ready-made verse-to-patristic-commentary datasets exist, how big are they, and what are their licences?

### Takeaway
The best open dataset is HistoricalChristianFaith/Commentaries-Database on GitHub. It is TOML keyed by verse, compiles to SQLite, CSV or JSON, and is public-domain-dedicated, but it mixes in some copyrighted fair-use excerpts and heretic exclusions, and a sister repo uses ChatGPT translations of Migne. Catena Bible, run by Coptic Orthodox volunteers, is the closest Orthodox app, but its data licence is unpublished. Aquinas's Catena Aurea (Newman/Oxford 1841–45 translation, PD) gives verse-by-verse Gospel catenae. Biblindex (about 650k references) is an index of citations, not text. The ACCS and the Chrysostom Press Theophylact are copyrighted.

### Cited Findings
- **HistoricalChristianFaith Commentaries-Database**:
  - Format: one folder per author, one TOML file per verse or range (e.g. `Augustine/Matthew 23_35.toml`, `Jerome/Matthew 23_35-41.toml`). Required fields are `quote` and `source_title`; optional fields are `source_url`, `append_to_author_name` and `time`. Each author also has a `metadata.toml` with `default_year`, `wiki` and `father_category`.
  - `compile_data.py` exports CSV, SQLite or JSON, and a compiled SQLite DB is in Releases.
  - About 1,358 commits, 63 stars, 15 forks.
  - Sources include CCEL, New Advent, Tertullian.org and Patrologia Latina mirrors.
  - Its FAQ says quotes from heretics are excluded.
  — [GitHub repo](https://github.com/HistoricalChristianFaith/Commentaries-Database)
- Its LICENSE file is a "PUBLIC DOMAIN DEDICATION" for the compilation, structure, metadata, build script and PD-sourced commentary. It adds a fair-use notice: "some commentary excerpts remain under copyright" and are excluded from the dedication — [LICENSE](https://raw.githubusercontent.com/HistoricalChristianFaith/Commentaries-Database/master/LICENSE)
- The front-end site describes three databases (Writings, Commentaries, Doctrine), says they are released into the public domain and on GitHub, and covers writers from Clement of Rome (c. 99) through Aquinas and on to Luther, Calvin, Wesley and Spurgeon — [historicalchristian.faith](https://historicalchristian.faith/)
- The sister Writings-Database draws on ANF/NPNF, Roger Pearse's collections, and Migne PG/PL "translated with ChatGPT" — [Writings-Database](https://github.com/HistoricalChristianFaith/Writings-Database)
- **Catena Bible** (catenabible.com):
  - Founded in 2015 in Ontario by Coptic Orthodox Christians and run by volunteers. It is a verse-by-verse Bible (NKJV) with Fathers' commentary, plus a Library, Lectionary and Media, on iOS and Android. The About page names no data sources and no licence — [Catena About](https://catenabible.com/about)
  - The iOS app has been out since April 2017, with seller David Salib and a copyright line of "AD30, Inc." Reviewers note the app does not cite which editions it quotes. Pages show Schaff- and Roberts-credited (ANF/NPNF) translations — [learnofchrist review](https://learnofchrist.com/resources/catena-bible), [App Store](https://apps.apple.com/app/id1218663640)
  - Its NKJV text is copyrighted by Thomas Nelson, so the app as a whole is not open.
- **Catena Aurea (Aquinas)**: CCEL hosts it by Gospel, arranged chapter by chapter with each section quoting Fathers such as Augustine, Cyril, Ambrose and Bede, and offers ThML, text and PDF downloads — [CCEL Catena Aurea Matthew](https://www.ccel.org/ccel/aquinas/catena1). (The 1841–45 Oxford translation by J.H. Newman et al. is PD by date. This is my knowledge and was not verified on the page fetched.)
- **Biblindex** (Institut des Sources Chrétiennes): more than 650,000 biblical references across about 4,500 works by about 800 authors (2026). Each record gives the verse, the location in the patristic work, and the page and line in a reference edition. Access is free, but no open bulk licence was found, and older notes say coverage was incomplete (e.g. Augustine missing in 2009) — [Digital Classicist wiki](https://wiki.digitalclassicist.org/Biblindex), [ANR project](https://anr.fr/Project-ANR-10-BLAN-2001), [Roger Pearse](https://www.roger-pearse.com/weblog/tag/bible-citations/)
- **ITSEE Patristic Citations Database** (Birmingham): an academic citation database for NT textual criticism — [Birmingham](https://research.birmingham.ac.uk/en/publications/introducing-the-itsee-patristic-citations-database/)
- **Theophylact, Explanation of the Gospels**: Chrysostom Press published the first English translation (Mark 1993, Luke 1997, John, translated by Fr. Christopher Stade), now sold through St Herman Monastery/Press. It is a modern translation and therefore copyrighted — [OrthodoxWiki Theophylact](https://orthodoxwiki.org/Theophylact_of_Ohrid), [St Herman Monastery](https://www.sainthermanmonastery.com/Theophylact-on-the-Gospel-of-John-p/john.htm)

### Inferences
- The fastest MVP is to import the HCF Commentaries SQLite release, then filter out entries whose `source_url` or `source_title` points to copyrighted works such as ACCS, modern translations, or AI-translated Migne. Keep only ANF/NPNF and other PD-sourced rows. Its "heretic exclusion" policy follows Protestant and generic criteria, not Orthodox ones, so re-label authors per Q5.
- The ACCS (InterVarsity, 29 vols, 1998–2010) is copyrighted and not usable without a licence. This is from my knowledge; no page on it was fetched.
- Bible Hub and Bible Gateway "Church Fathers" features were not researched in depth. Bible Hub's commentary pages largely reproduce PD texts, but no licence grants verse-linked data, so treat them as reference only.
- Catena Bible is the natural partner or peer, since it is Orthodox and free. It would be worth contacting them about data sharing rather than scraping.

### Gaps
- Exact HCF entry and author counts: the GitHub page did not show totals. Download the release SQLite to count.
- Catena Bible's data licence and API: none is published.
- No machine-readable Catena Aurea verse dataset on GitHub was confirmed.
- No GitHub search was run beyond HCF, because GitHub org-level API access was blocked in this session.

## Q4. How could verse references be extracted automatically from the patristic texts, and how accurate is that?

### Takeaway
The ANF/NPNF print editions put scripture references in footnotes and inline parentheses (e.g. "Matt. v. 3"). CCEL's ThML encodes these as `<scripRef>` elements with parsed passage attributes, which is the most accurate machine source. From plain HTML or Wikisource, a regex for book abbreviations plus Roman-numeral chapters and Arabic verses, followed by normalisation, works well for explicit citations. Allusions are missed, and NPNF's Roman-chapter style plus the LXX/Hebrew Psalm numbering need careful handling.

### Cited Findings
- CCEL texts are stored in ThML and converted to other formats — [Wikipedia: CCEL](https://en.wikipedia.org/wiki/Christian_Classics_Ethereal_Library); [ThML spec](https://ccel.org/ThML/ThML1.04.htm)
- Biblindex-style indexing records each verse together with its location in the patristic work. This is the scholarly standard for citation and allusion detection, and Biblindex is built from Strasbourg printed indexes compiled 1965–2000 — [Digital Classicist wiki](https://wiki.digitalclassicist.org/Biblindex)
- A TEI-encoded sample corpus of patristic text reuse was built for automatic detection research — [JDMDH article](https://jdmdh.episciences.org/3989/pdf)

### Inferences
- From my knowledge of the ThML spec (not re-verified this session): `<scripRef passage="Matt. v. 3" parsed="|Matt|5|3|0|0|">` gives machine-parsed references. CCEL also builds per-volume Scripture indexes from these tags.
- Accuracy expectations, estimated rather than measured: explicit footnoted references should be about 95%+ accurate after normalisation. Errors come from OCR (e.g. "ii." read as "11"), from Psalm numbering (LXX/Vulgate versus Hebrew, which matters for an Orthodox app using LXX numbering), and from ranges. Unmarked allusions, which are a large share of patristic Bible use, will be missed entirely.
- A ref found in a footnote marks a quotation, not a commentary. For "what the Fathers taught about this verse" in running commentaries (Chrysostom, Augustine on John), segment each homily at the verse lemma it quotes and attach that passage to the verse range. Treat incidental citations elsewhere as "also cited in" links.
- An LLM-assisted pass could add allusion detection, but it needs human review and must be labelled as such.

### Gaps
- Could not download a CCEL ThML file to count `<scripRef>` tags or confirm the attribute format (the anonymous download returned an error page).
- No published accuracy benchmark for automatic reference extraction from ANF/NPNF was found.

## Q5. Which Fathers and works matter most to Orthodox Christians and should be prioritised or flagged? What Eastern Fathers are missing, and are there public-domain English sources?

### Takeaway
Prioritise Chrysostom (the largest NT verse-by-verse corpus, and a pillar of Orthodox exegesis), the Cappadocians, Athanasius, Cyril of Jerusalem, Ephrem, John of Damascus and the Apostolic Fathers. Label Augustine "Blessed/St Augustine (Western; venerated with reservations)". Flag Tertullian (Montanist), Origen (condemned at the 5th Ecumenical Council, 553), Novatian (schismatic), Rufinus and some Theodoret writings, and mark the Latin-only figures. The major later Eastern Fathers (Maximus, Symeon, Palamas, the full Philokalia, Theophylact) are not on New Advent and have no complete public-domain English translation, so they are a gap to fill with licensed translations or links.

### Cited Findings
- New Advent includes Eastern Fathers: Athanasius (20 works), Gregory of Nyssa (15), Basil (3), Gregory Nazianzen (2), Cyril of Jerusalem (1), Chrysostom (36), Ephraim (7), and John of Damascus (only 1 work). Western and Latin figures include Augustine (48), Jerome (13), Ambrose (11), Gregory the Great, Leo, Cassian, Hilary and Vincent. Problem authors include Tertullian (33), Origen (8), Novatian (2) and Rufinus (3), along with heterodox apocrypha tagged [GNOSTIC]/[DOCETIC] — [New Advent Fathers index](https://www.newadvent.org/fathers/)
- On Augustine, Orthodox views differ:
  - One academic paper says he is not counted among the Holy Fathers in the strict sense, mainly because of his Trinitarian theology as a precursor of the filioque. A Minsk monastery blog says his doctrine laid the foundation of the filioque while Orthodox still honour him — [Obitel-Minsk blog](https://blog.obitel-minsk.com/blog/2020/06/three-mistakes-of-blessed-augustines-theology)
  - Others defend him and blame later Carolingian readings — [orthodoxchristiantheology.com](https://orthodoxchristiantheology.com/2020/08/23/final-thoughts-about-augustines-on-the-trinity/)
  - He is commemorated on 15 June in Orthodox calendars — [Wikipedia June 15 (Eastern Orthodox liturgics)](https://en.wikipedia.org/wiki/June_15_(Eastern_Orthodox_liturgics)); [Fordham/St Photios event](https://now.fordham.edu/event/augustine-and-the-orthodox-the-west-in-the-east/)
- The filioque is regarded by most Orthodox as heretical (in the eternal-cause sense), and St Photius's *Mystagogy* is the classic rebuttal — [OrthodoxWiki Filioque](https://orthodoxwiki.org/Filioque)
- **Philokalia**:
  - The complete English translation (Palmer, Sherrard and Ware; Faber, vol. 1 1979, vol. 5 2023) is copyrighted. Maximus and John of Damascus are in vol. 2; Symeon the New Theologian, Gregory of Sinai and Gregory Palamas are in vol. 4.
  - An earlier partial translation (Kadloubovsky and Palmer, 1951, from the Russian) exists, but its PD status is unverified.
  - The Greek (1782) and Slavonic (Paisius, 1793) originals are PD — [OrthodoxWiki Philokalia](https://orthodoxwiki.org/Philokalia), [Faber vol 4](https://www.faber.co.uk/product/9780571266180-the-philokalia-vol-4/), [CJOC review](https://www.cjoc.ca/pdf/CJOC_XIX_I_2_Philokalia_V.pdf)
- Theophylact's Gospel commentaries, the classic Byzantine verse-by-verse commentary that largely distils Chrysostom, exist in English only in the copyrighted Chrysostom Press translation — [OrthodoxWiki](https://orthodoxwiki.org/Theophylact_of_Ohrid)

### Inferences
- Suggested app labels:
  - "Saint / Holy Father" for Eastern and Western pre-schism saints accepted by the Orthodox.
  - "Blessed Augustine (venerated; some teachings not received)".
  - "Western saint (Latin tradition)" for Jerome, Ambrose, Leo, Gregory the Great, Hilary, Cassian and Vincent. All of these are on Orthodox calendars; Cassian is especially honoured in the East.
  - "Early Christian writer, not a saint" for Tertullian, Origen, Novatian, Lactantius, Eusebius, Arnobius, Rufinus, Minucius Felix and Commodianus.
  - "Not patristic / heterodox" for gnostic apocrypha. Exclude these from verse commentary.
  - Theodoret: the writings against Cyril were condemned in 553, but his Psalms commentary is used.
- Priority order for a verse-commentary MVP:
  - (1) Chrysostom's NT homilies (Matthew, John, Acts, Pauline epistles, Hebrews).
  - (2) Catena Aurea Gospels, filtered to Eastern and accepted Fathers. It quotes Chrysostom, Cyril, Origen, Theophylact (as "Theophylact") and others, so it is a PD route to some Theophylact in English translation.
  - (3) Basil's Hexaemeron (Genesis), Athanasius on the Psalms (Letter to Marcellinus), and Gregory of Nyssa.
  - (4) Augustine on the Psalms and John, labelled as above.
  - (5) Ephrem.
- Public-domain English for missing Eastern Fathers is thin. The possible routes are:
  - John of Damascus, *Exact Exposition* (NPNF2 vol. 9, already on New Advent and CCEL).
  - Some Maximus extracts in old translations.
  - 19th-century Orthodox translations, e.g. the Holy Trinity–era or Russian Orthodox English translations. These would need checking per title.
  - Otherwise, partnership or licensing with Holy Trinity Publications, St Vladimir's Seminary Press, Chrysostom Press/St Herman, or Faber. Or translate afresh from PD Greek (PG/Philokalia 1782) with clear labelling. AI translation should be marked as such, and orthodoxy-reviewed.

### Gaps
- No OCA page confirming Augustine's listing or wording was retrieved (search found none).
- The PD status of Kadloubovsky and Palmer (1951) and of older English Symeon or Palamas translations is unverified.
- No public-domain English Theophylact was found.
- Catena Bible's author-labelling policy was not reviewed.

# Orthodox Bible

A simple, free Orthodox Christian Bible app: the Septuagint, the day's readings from the Church
calendar, what the Church Fathers said about every verse, and reading plans on the Gospels, the
Psalter, the Seven Ecumenical Councils and the Fathers. No accounts, no ads, no tracking: what a
person saves (highlights, notes, plans) stays on their own phone.

It is a web app that installs to the home screen ("Add to Home Screen") and works offline.

## What's in it

- **Today**: the date in the New or Old Calendar, the day's feast and saints, whether it's a fast
  day and what to fast from, the tone, and the Epistle and Gospel. Each reading shows how many
  comments the Fathers left on it. Tap to read, then *Mark as read*. A streak counts days in a row.
- **Bible**: Brenton's Septuagint (1851) for the Old Testament, with every Orthodox book, and the
  World English Bible for the New Testament. A second choice is the World English Bible
  throughout. Book names follow the Septuagint (1 Kingdoms, Jesus son of Nave), with the usual
  name underneath. Psalms show the Church's number with the English one in brackets: Psalm 50 (51).
- **What the Fathers said**: a red dot on a verse means the Fathers wrote on it. Tap the verse to
  read them, grouped by Father, each with an honest label (Saint, Blessed, Western saint, or "Not
  a saint" for writers like Origen and Tertullian). About 31,000 passages from 46 Fathers.
  Highlights, notes, save, copy and share are on the same sheet. Notes are stored by verse, not by
  translation, so they stay put when switching Bibles.
- **Study a verse**: tap a verse, then *Study this verse* (or swipe up). It shows the verse in
  English and Greek, the Greek word by word with each word's meaning (tap for the full entry,
  and save words you want to keep), up to ten similar verses, what the Fathers said, and the plans
  that read it. The *Saved* tab has your note and saved words for that verse.
- **Plans**: 19 plans, 272 days: the Four Gospels with the Fathers, the Psalter by kathisma, Acts,
  Romans and Hebrews with St John Chrysostom, the Seven Ecumenical Councils (one plan each, plus an
  overview), Meet the Fathers, the Apostolic Fathers, On the Incarnation, the Life of St Antony,
  the Creed in 12 days with St Cyril of Jerusalem, and the Lord's Prayer.
- **Fathers**: every Father on New Advent's index, with an Orthodox label, a short introduction,
  feast days and links to their writings.
- **More**: saved verses, highlights and notes; New/Old Calendar; hide writers who aren't saints;
  a daily reminder added to the phone's calendar; save the whole Bible for offline; backup and
  restore.

- **Help for struggles**: type what you're struggling with (lust, anger, worry, grief, doubt and
  more, 19 in all) and get a short word on it, the Scriptures to read, what the Fathers said
  (passages picked from the public-domain data, saints first) and a 7-day plan. Typing about
  self-harm, or opening *Despair*, shows Lifeline (13 11 14) straight away.
- **Grow in virtue**: 11 plans for growing in self-control, patience, humility, love, trust in God,
  hope, inner peace, thankfulness, courage, honesty and guarding your thoughts, each with the
  Fathers' passages, and linked from the struggles they answer (lust → self-control).
- **Questions about the faith**: 97 short, plain answers in 9 sections, such as what the Eucharist is, why
  icons, why fast, who the Theotokos is, how we are saved, and why Pascha's date differs. Each
  has the Scriptures behind it and what the Fathers said. Search understands questions: *what is
  the Eucharist?* opens the answer, then shows any verses.
- **Fasting calendar**: a month at a glance, coloured by the fast (strict, wine and oil, fish),
  with the great feasts marked; tap a day for its saints. A Pascha countdown; in Bright Week the
  app turns gold, and until Ascension the greeting is *Christ is Risen! Indeed He is Risen!*
- **Prayer list**: the living and the departed you pray for. Their names appear in Morning and
  Evening Prayers. For the departed it remembers the 3rd, 9th and 40th day and each year, shows
  them on Home, and can add them to the phone's calendar.
- **Greek side by side** (Aa → Greek): the Septuagint under Brenton, and the 1904 Patriarchal
  text (the Greek Church's own) under the New Testament. Tap a New Testament word for its meaning.

**Search** puts the teaching first: search *lust*, *anger*, *self-control* or *the Eucharist* and you
get a short word on it, a 7-day plan, three passages from the Fathers, related plans and questions,
and the key verses; every verse with the word is a tap away underneath. It is instant after the first time: each Bible is one file the phone keeps, and words match from their start (*anger* finds *angered*, not *stranger*).

**Feel**: swipe left or right to turn the chapter, pull a sheet down to close it, and Back takes
you to the same place on the page you came from. Home has *Continue reading* and shows straight
away while the Church calendar loads; each day's calendar is kept on the phone once fetched.

**Look**: dark by default (light in Settings), a floating tab bar (Home, Bible, Plans, Discover,
You), Geist for the interface and Source Serif for Scripture.

**Extras**: *Verse of the day* with what the Fathers said about it; *Listen* (the phone's own voice
reads the chapter and lights each verse); *verse images* to share in six styles; *Prayers*
(morning, evening, meals, St Ephrem, before Communion, in English versions made for this app);
the *Jesus Prayer* with a tap-to-count prayer rope of 33, 50 or 100 knots; *badges* for streaks,
finished plans, the Psalter, the Councils and 1,000 Jesus Prayers; saved plans; and a *You* page
with your streak, days read this year and everything you've highlighted, noted and saved.

## Put it live (Vercel)

1. In Vercel, **Add New → Project**, import this GitHub repo.
2. Set **Root Directory** to `apps/orthodox-bible`. Framework: *Other*. Leave the build command
   empty; the output directory is `public` (already set in `vercel.json`).
3. Deploy. `api/day.js` and `api/month.js` fetch the calendar from orthocal.info and cache it.

To try it on a computer: `node dev.mjs`, then open http://localhost:8790.

## Where the words come from

| What | Source | Status |
|---|---|---|
| Old Testament | Brenton's Septuagint, eBible.org | Public domain (1851) |
| New Testament, second Bible | World English Bible, eBible.org | Public domain |
| The Fathers on each verse | HistoricalChristianFaith/Commentaries-Database, filtered | Only public-domain translations kept (see below) |
| Fathers library | New Advent's index of the Fathers | Titles and links only; the app links to New Advent and does not copy its pages |
| Calendar | orthocal.info (MIT-licensed code, OCA rubrics) | Readings, saints and fast days, through `api/day.js` and `api/month.js` |
| Greek Old Testament | Brenton's Greek Septuagint, eBible.org | Public domain |
| Greek New Testament | 1904 Patriarchal Text with Strong's numbers, eBible.org | Public domain |
| Greek word meanings | STEP Bible's brief Greek lexicon (Tyndale House) | CC BY 4.0, credited on each word |
| Similar verses | OpenBible.info cross references | CC BY |
| Help for struggles, questions about the faith, prayer list words | Written for this app | |
| Plans, introductions, labels | Written for this app | |

**The Fathers filter** (`build/fathers.py`): the source database mixes public-domain 19th-century
translations with modern copyrighted ones and some machine translations. The app keeps only:
the Ante-Nicene and Nicene and Post-Nicene Fathers translations (1880s–1900), the 1841 Catena
Aurea, and a few other old translations named in the file. Later Western writers (Aquinas,
Bonaventure), modern authors, and writers condemned as heretics are left out. About half the
source data is dropped.

## Rebuild the data

```
mkdir sources && cd sources
curl -LO https://ebible.org/Scriptures/eng-Brenton_usfm.zip && unzip eng-Brenton_usfm.zip -d brenton
curl -LO https://ebible.org/Scriptures/eng-web_usfm.zip && unzip eng-web_usfm.zip -d web
curl -LO https://ebible.org/Scriptures/grcbrent_usfm.zip && unzip grcbrent_usfm.zip -d grcbrent
curl -LO https://ebible.org/Scriptures/grcbyz_usfm.zip && unzip grcbyz_usfm.zip -d grcbyz
git clone --depth 1 https://github.com/STEPBible/STEPBible-Data.git step
curl -LO https://a.openbible.info/data/cross-references.zip && unzip cross-references.zip -d xref
git clone --depth 1 https://github.com/HistoricalChristianFaith/Commentaries-Database.git cdb
cd .. && npm run data && npm test
```

## Permissions worth asking for

None is needed to run the app as it is. Asking would let the app do more:

- **New Advent** (Kevin Knight, via newadvent.org): permission to show the Fathers' texts inside
  the app instead of linking out.
- **orthocal.info** (Brian Glass): a note that the app uses the API, and whether there are limits.
- **Eastern Orthodox Bible** (eobeditor@easternorthodoxbible.org): permission to offer the EOB New
  Testament, a translation made for Orthodox readers.
- **CCEL** (ccel.org): permission to use their tidy ANF/NPNF files for more Father readings.

A short email works: who you are, that the app is free with no ads, what you'd like to use, and
how it will be credited.

## Checks

`npm test` checks that every plan reading points to a real chapter, every Father link goes to New
Advent, the Fathers' words are filed and labelled, and the Septuagint Psalm numbering lines up.

## Before telling people about it

- Have a priest look over the plans, the council introductions and the Fathers' labels.
- Feast days in the library are on the New Calendar; Old Calendar parishes keep them 13 days later.
- Saints' lives aren't included: the good English ones are copyrighted. The app shows the saints'
  names from the calendar.

## App Store and Google Play

The phone apps are this same web app inside a Capacitor shell (`capacitor.config.json`).

1. Put the live Vercel address in `public/config.js` (`window.OB_SITE`). Inside the apps the pages
   come from the phone, so the calendar is fetched from the website.
2. **Android**: run the *Orthodox Bible Android* workflow in GitHub Actions. It gives an `.apk` to
   try on a phone. For Google Play, add the secrets `ANDROID_KEYSTORE_BASE64`,
   `ANDROID_KEY_PASSWORD` and `ANDROID_KEY_ALIAS` (an upload key made with `keytool`) and it also
   gives a signed `.aab` to upload. Or on a computer with Android Studio: `npm install && npm run android`.
   A Google Play developer account is US$25 once. New personal accounts must run a closed test
   with 12 testers for 14 days before going public; a parish is a good place to find them.
3. **iPhone**: needs a Mac with Xcode and an Apple Developer account (US$99 a year).
   `npm install && npm run ios`, then in Xcode set the team, archive, and upload to App Store
   Connect. Test with TestFlight first.
4. Both stores ask for a privacy policy. The honest one is short: the app keeps everything on the
   phone and collects nothing. Make the icons with `npx @capacitor/assets generate` from
   `public/icon-512.png`.

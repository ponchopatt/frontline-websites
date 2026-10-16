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
- **Plans**: 19 plans, 272 days: the Four Gospels with the Fathers, the Psalter by kathisma, Acts,
  Romans and Hebrews with St John Chrysostom, the Seven Ecumenical Councils (one plan each, plus an
  overview), Meet the Fathers, the Apostolic Fathers, On the Incarnation, the Life of St Antony,
  the Creed in 12 days with St Cyril of Jerusalem, and the Lord's Prayer.
- **Fathers**: every Father on New Advent's index, with an Orthodox label, a short introduction,
  feast days and links to their writings.
- **More**: saved verses, highlights and notes; New/Old Calendar; hide writers who aren't saints;
  a daily reminder added to the phone's calendar; save the whole Bible for offline; backup and
  restore.

## Put it live (Vercel)

1. In Vercel, **Add New → Project**, import this GitHub repo.
2. Set **Root Directory** to `apps/orthodox-bible`. Framework: *Other*. Leave the build command
   empty; the output directory is `public` (already set in `vercel.json`).
3. Deploy. The `api/day.js` function fetches the calendar from orthocal.info and caches each day.

To try it on a computer: `node dev.mjs`, then open http://localhost:8790.

## Where the words come from

| What | Source | Status |
|---|---|---|
| Old Testament | Brenton's Septuagint, eBible.org | Public domain (1851) |
| New Testament, second Bible | World English Bible, eBible.org | Public domain |
| The Fathers on each verse | HistoricalChristianFaith/Commentaries-Database, filtered | Only public-domain translations kept (see below) |
| Fathers library | New Advent's index of the Fathers | Titles and links only; the app links to New Advent and does not copy its pages |
| Calendar | orthocal.info (MIT-licensed code, OCA rubrics) | Readings, saints and fast days, through `api/day.js` |
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
- To go in the App Store and Google Play, wrap this web app with Capacitor or rebuild it in Expo.
  Google needs 12 testers for 14 days first; a parish is a good place to find them.

"""The reading plans. All words here are the app's own; Father readings link to New Advent.

A plan is {id, title, about, cat, days: [{title, items}]}. An item is one of:
  {"read": "JHN 1:1-18"}           a Bible passage, English numbering (Psalms: add "n": "lxx")
  {"father": title, "u": url}      a reading from a Father, opened on New Advent
  {"text": "..."}                  a short note
Book codes are USFM (GEN, PSA, MAT, ...).
"""

NA = "https://www.newadvent.org/fathers/"
TAP = "Tap a verse with a dot to read what the Fathers said about it."

# ---------------------------------------------------------------- Scripture with the Fathers

def gospels():
    days = []
    for code, name, n in (("MAT", "Matthew", 28), ("MRK", "Mark", 16), ("LUK", "Luke", 24), ("JHN", "John", 21)):
        for c in range(1, n + 1):
            days.append({"title": f"{name} {c}", "items": [{"read": f"{code} {c}"}]})
    days[0]["items"].append({"text": TAP})
    return {"id": "gospels", "cat": "scripture", "title": "The Four Gospels with the Fathers",
            "about": "One chapter a day through Matthew, Mark, Luke and John, with St John Chrysostom, Blessed Theophylact, St Cyril and others on every page.",
            "days": days}


def book_plan(id_, code, name, n, father, url, about):
    days = [{"title": f"{name} {c}", "items": [{"read": f"{code} {c}"}]} for c in range(1, n + 1)]
    days[0]["items"] += [{"father": father, "u": url}, {"text": TAP}]
    return {"id": id_, "cat": "scripture", "title": f"{name} with St John Chrysostom", "about": about, "days": days}


# The Psalter as the Church reads it: twenty kathismata (Septuagint numbering).
KATHISMATA = [(1, 8), (9, 16), (17, 23), (24, 31), (32, 36), (37, 45), (46, 54), (55, 63), (64, 69), (70, 76),
              (77, 84), (85, 90), (91, 100), (101, 104), (105, 108), (109, 117), (118, 118), (119, 133), (134, 142), (143, 150)]


def psalter():
    days = []
    for i, (a, b) in enumerate(KATHISMATA, 1):
        ref = f"PSA {a}" if a == b else f"PSA {a}-{b}"
        days.append({"title": f"Kathisma {i}: Psalms {a}–{b}" if a != b else f"Kathisma {i}: Psalm {a}",
                     "items": [{"read": ref, "n": "lxx"}]})
    days[0]["items"].append({"text": "The Psalter is divided into 20 kathismata ('sittings'). In church it is read through every week, and twice a week in Great Lent. Psalm numbers here are the Church's (Septuagint) numbers; the English number is shown in brackets."})
    days[16]["items"].append({"text": "Psalm 118 (119), the longest psalm, is a kathisma on its own. It is sung at funerals and at Matins on Holy Saturday."})
    return {"id": "psalter", "cat": "scripture", "title": "The Psalter in 20 days",
            "about": "The whole Book of Psalms, one kathisma a day, as the Church divides it.", "days": days}


# ---------------------------------------------------------------- the councils

def council(id_, n, title, year, about, days):
    return {"id": id_, "cat": "councils", "title": f"{n}. {title} ({year})", "about": about, "days": days}


COUNCILS = [
    council("nicaea1", 1, "First Council of Nicaea", 325,
            "Is the Son of God truly God? Five days on Arius, St Athanasius and the Creed.",
            [
                {"title": "The question", "items": [
                    {"text": "In 325 the Emperor Constantine called the bishops of the whole Church to Nicaea. A priest of Alexandria named Arius taught that the Son of God was the first and greatest creature: 'there was when He was not'. St Alexander of Alexandria and his young deacon Athanasius answered that the Son is eternal, true God from true God."},
                    {"read": "JHN 1:1-18"}]},
                {"title": "The Scriptures at stake", "items": [
                    {"text": "Arius pointed to Proverbs 8:22, where Wisdom says 'The Lord created me'. The Fathers read it of the Son's taking flesh, and pointed to the passages that call Him God and Creator."},
                    {"read": "PRO 8:22-31"}, {"read": "PHP 2:5-11"}, {"read": "COL 1:15-20"}, {"read": "HEB 1:1-4"}]},
                {"title": "St Athanasius answers", "items": [
                    {"text": "Read the opening chapters of On the Incarnation: why the Word, through whom all was made, became man to renew His image in us."},
                    {"father": "St Athanasius, On the Incarnation of the Word, chapters 1–10", "u": NA + "2802.htm"}]},
                {"title": "The Creed of Nicaea", "items": [
                    {"text": "The council confessed the Son 'of one essence (homoousios) with the Father'. This became the first part of the Creed said at every Liturgy. The council also agreed that all should keep Pascha on the same day."},
                    {"father": "The Creed, canons and letter of the First Council of Nicaea", "u": NA + "3801.htm"}]},
                {"title": "What it means for us", "items": [
                    {"text": "If the Son were a creature, a creature could not unite us to God. Because He is true God made man, our nature is joined to God in Him. Say the Creed slowly today, phrase by phrase."},
                    {"read": "JHN 10:22-38"},
                    {"father": "St Athanasius, Letter on the Council of Nicaea (De Decretis)", "u": NA + "2809.htm"}]},
            ]),
    council("constantinople1", 2, "First Council of Constantinople", 381,
            "Is the Holy Spirit God? The council that completed the Creed.",
            [
                {"title": "The question", "items": [
                    {"text": "After Nicaea some accepted the Son but taught that the Holy Spirit was a creature or a servant of God. In 381 the Emperor Theodosius gathered 150 bishops in Constantinople, with St Gregory the Theologian and St Gregory of Nyssa among them."},
                    {"read": "JHN 14:15-26"}]},
                {"title": "The Scriptures at stake", "items": [
                    {"read": "MAT 28:16-20"}, {"read": "JHN 15:26"}, {"read": "ACT 5:1-11"}, {"read": "1CO 2:9-13"},
                    {"text": "We are baptised into one Name of the Father, the Son and the Holy Spirit. Lying to the Holy Spirit is lying to God (Acts 5:3-4)."}]},
                {"title": "St Basil on the Holy Spirit", "items": [
                    {"text": "St Basil died before the council, but his book On the Holy Spirit prepared the way. Read the first chapters on giving glory 'to the Father, with the Son, together with the Holy Spirit'."},
                    {"father": "St Basil the Great, On the Holy Spirit", "u": NA + "3203.htm"}]},
                {"title": "The Creed completed", "items": [
                    {"text": "The council added the words on the Holy Spirit: 'the Lord, the Giver of Life, who proceeds from the Father, who with the Father and the Son is worshipped and glorified'. This is the Creed the Orthodox Church says today, with no additions. The council also condemned Apollinarius, who denied that Christ had a human mind."},
                    {"father": "The Creed and canons of the First Council of Constantinople", "u": NA + "3808.htm"}]},
                {"title": "St Gregory the Theologian", "items": [
                    {"text": "St Gregory's Fifth Theological Oration (Oration 31) is the classic sermon on the divinity of the Holy Spirit."},
                    {"father": "St Gregory the Theologian, Fifth Theological Oration (Oration 31)", "u": NA + "310231.htm"}, {"read": "ROM 8:9-17"}]},
            ]),
    council("ephesus", 3, "Council of Ephesus", 431,
            "Is Mary the Theotokos, the Mother of God? One Christ, not two.",
            [
                {"title": "The question", "items": [
                    {"text": "Nestorius, archbishop of Constantinople, refused to call the Virgin Mary 'Theotokos' (she who gave birth to God). He spoke as if the Son of God and the man Jesus were two. St Cyril of Alexandria answered that the one born of Mary is the eternal Son Himself, made flesh."},
                    {"read": "LUK 1:26-38"}]},
                {"title": "The Scriptures at stake", "items": [
                    {"read": "LUK 1:39-45"}, {"read": "JHN 1:14"}, {"read": "GAL 4:4-7"}, {"read": "ISA 7:14"},
                    {"text": "Elizabeth calls Mary 'the mother of my Lord'. The Word did not join Himself to a man; He became flesh."}]},
                {"title": "St Cyril's letters", "items": [
                    {"text": "The council's acts include St Cyril's letters to Nestorius, which explain how the one Christ is both God and man."},
                    {"father": "The Council of Ephesus, with St Cyril's letters", "u": NA + "3810.htm"}]},
                {"title": "The council's decision", "items": [
                    {"text": "About 200 bishops, led by St Cyril, deposed Nestorius and confessed Mary as Theotokos. The council also forbade anyone to put forward a different creed from that of Nicaea."},
                    {"read": "LUK 1:46-55"}]},
                {"title": "What it means for us", "items": [
                    {"text": "Every time we sing 'Most holy Theotokos, save us', we confess who her Son is. Honour given to the Mother is a confession of faith in Christ."},
                    {"read": "JHN 2:1-11"}, {"read": "JHN 19:25-27"}]},
            ]),
    council("chalcedon", 4, "Council of Chalcedon", 451,
            "Truly God and truly man: one Person in two natures.",
            [
                {"title": "The question", "items": [
                    {"text": "Eutyches, an abbot in Constantinople, taught that after the union Christ's humanity was swallowed up in His divinity, so that He had only one nature. A council at Ephesus in 449, later called the 'Robber Council', backed him. The Emperor Marcian and Empress Pulcheria called a new council at Chalcedon."},
                    {"read": "HEB 2:14-18"}]},
                {"title": "The Scriptures at stake", "items": [
                    {"read": "JHN 11:32-44"}, {"read": "HEB 4:14-16"}, {"read": "LUK 2:40-52"},
                    {"text": "Christ weeps as man and raises Lazarus as God. He grows in wisdom, and He is tempted in all things as we are, yet without sin."}]},
                {"title": "The Tome of St Leo", "items": [
                    {"text": "St Leo of Rome's letter to Flavian (Letter 28, the 'Tome') was read at the council, and the bishops cried 'Peter has spoken through Leo! Cyril taught the same!'"},
                    {"father": "St Leo the Great, Letters (Letter 28, the Tome)", "u": NA + "3604.htm"}]},
                {"title": "The definition of faith", "items": [
                    {"text": "The council confessed one and the same Christ 'in two natures, without confusion, without change, without division, without separation'. It also gave 30 canons, among them canon 28 on the honour of Constantinople."},
                    {"father": "The definition and canons of the Council of Chalcedon", "u": NA + "3811.htm"}]},
                {"title": "What it means for us", "items": [
                    {"text": "Because Christ's humanity is whole and real, everything human except sin is healed in Him: our body, mind, will and feelings. Note: the Coptic, Ethiopian, Armenian and Syriac churches did not accept Chalcedon; dialogue with them continues today."},
                    {"read": "PHP 2:5-11"}]},
            ]),
    council("constantinople2", 5, "Second Council of Constantinople", 553,
            "Reading Chalcedon with St Cyril: the 'Three Chapters'.",
            [
                {"title": "The question", "items": [
                    {"text": "A century after Chalcedon, the Emperor Justinian sought to heal the split over it. Some writings that leaned toward Nestorius (the 'Three Chapters': works of Theodore of Mopsuestia, writings of Theodoret against St Cyril, and a letter of Ibas) were still defended by some."},
                    {"read": "JHN 1:14"}, {"read": "COL 2:8-10"}]},
                {"title": "One of the Holy Trinity suffered in the flesh", "items": [
                    {"text": "The council confessed that 'one of the Holy Trinity was crucified in the flesh'. We sing it at every Liturgy in the hymn 'Only-begotten Son', said to be written by Justinian himself."},
                    {"read": "1CO 2:6-8"}, {"read": "ACT 20:28"}]},
                {"title": "The council's anathemas", "items": [
                    {"father": "The Second Council of Constantinople", "u": NA + "3812.htm"},
                    {"text": "The council condemned the Three Chapters. It is also linked with the condemnation of Origen's speculations on the pre-existence of souls."}]},
                {"title": "St John of Damascus sums it up", "items": [
                    {"text": "Book 3 of St John's Exposition of the Orthodox Faith gathers the teaching of the councils on Christ."},
                    {"father": "St John of Damascus, Exposition of the Orthodox Faith, Book 3", "u": NA + "3304.htm"}]},
            ]),
    council("constantinople3", 6, "Third Council of Constantinople", 680,
            "Two wills in Christ: St Maximus and the Garden of Gethsemane.",
            [
                {"title": "The question", "items": [
                    {"text": "In the 7th century a compromise was put forward: Christ has two natures but only one will. St Sophronius of Jerusalem and St Maximus the Confessor resisted; Maximus had his tongue and right hand cut off. In 680–681 the Emperor Constantine IV called a council that vindicated them."},
                    {"read": "MAT 26:36-46"}]},
                {"title": "Not My will, but Yours", "items": [
                    {"read": "JHN 6:38-40"}, {"read": "LUK 22:39-46"}, {"read": "HEB 5:7-9"},
                    {"text": "In Gethsemane Christ's human will freely obeys His Father. If He had no human will, our will would not be healed."}]},
                {"title": "The council's definition", "items": [
                    {"text": "The council confessed two natural wills and two energies in Christ, the human will following the divine without resisting. It condemned those who taught one will, including Pope Honorius of Rome."},
                    {"father": "The Third Council of Constantinople", "u": NA + "3813.htm"}]},
                {"title": "The canons of Trullo (692)", "items": [
                    {"text": "Because the 5th and 6th councils made no canons, a council met in 692 in the domed hall (Trullo) of the palace and gave 102 canons. The Orthodox Church receives them as part of the 6th Council; Rome does not."},
                    {"father": "The canons of the Council in Trullo (Quinisext)", "u": NA + "3814.htm"}]},
                {"title": "What it means for us", "items": [
                    {"text": "Our salvation is not God overpowering us but our will freely joined to His, as Christ's human will was. 'Thy will be done' is the prayer of the Garden."},
                    {"read": "PHP 2:12-13"},
                    {"father": "St John of Damascus on the two wills (Exposition, Book 3)", "u": NA + "3304.htm"}]},
            ]),
    council("nicaea2", 7, "Second Council of Nicaea", 787,
            "The holy icons: why we venerate images of Christ and His saints.",
            [
                {"title": "The question", "items": [
                    {"text": "From 726 emperors of the iconoclast party ordered icons destroyed, calling them idols. Monks and laypeople suffered for them. In 787 the Empress Irene called a council at Nicaea."},
                    {"read": "COL 1:15-20"}]},
                {"title": "The Scriptures at stake", "items": [
                    {"read": "EXO 25:17-22"}, {"read": "NUM 21:4-9"}, {"read": "JHN 1:14-18"}, {"read": "JHN 14:8-11"},
                    {"text": "God commanded golden cherubim over the ark. The unseen God has shown Himself: 'he who has seen Me has seen the Father'. Christ, the image of the invisible God, can be painted because He truly became man."}]},
                {"title": "The honour passes to the prototype", "items": [
                    {"text": "The council quoted St Basil: 'the honour paid to the image passes to its prototype'. Find the words in On the Holy Spirit, chapter 18."},
                    {"father": "St Basil the Great, On the Holy Spirit, chapter 18", "u": NA + "3203.htm"},
                    {"father": "St John of Damascus on images (Exposition, Book 4, chapter 16)", "u": NA + "3304.htm"}]},
                {"title": "The council's definition", "items": [
                    {"text": "The council distinguished worship (latreia), due to God alone, from veneration (proskynesis) given to icons, the Cross, the Gospel book and relics. It also gave 22 canons."},
                    {"father": "The Second Council of Nicaea", "u": NA + "3819.htm"}]},
                {"title": "The Triumph of Orthodoxy", "items": [
                    {"text": "After a second wave of iconoclasm, icons were restored for good in 843. The Church keeps this every year on the first Sunday of Great Lent, the Sunday of Orthodoxy, with a procession of icons."},
                    {"read": "HEB 11:24-40"}, {"read": "JHN 1:43-51"},
                    {"text": "These are the Epistle and Gospel read on the Sunday of Orthodoxy."}]},
            ]),
]


def councils_overview():
    days = []
    for c in COUNCILS:
        first = c["days"][0]["items"]
        days.append({"title": c["title"], "items": first + [{"text": "For more on this council, start its own 5-day plan."}]})
    days.append({"title": "Councils after the seven", "items": [
        {"text": "Many Orthodox also hold in high honour the council of 879–880 in Constantinople, under St Photius, which restored peace with Rome and kept the Creed without additions, and the councils of 1341–1351 that upheld St Gregory Palamas' teaching on the uncreated light. Some call them the 8th and 9th Ecumenical Councils. Later Western councils counted by Rome are not received by the Orthodox Church."},
        {"read": "MAT 17:1-9"}]})
    return {"id": "councils", "cat": "councils", "title": "The Seven Ecumenical Councils in 8 days",
            "about": "One council a day: what was at stake and what the Church confessed.", "days": days}


# ---------------------------------------------------------------- the Fathers

def apostolic_fathers():
    w = [("The Didache", "0714", "A 1st-century guide: the Two Ways, baptism, fasting on Wednesday and Friday, and the Eucharist."),
         ("St Clement of Rome, First Letter to the Corinthians", "1010", "A call to peace and humility in a church torn by rivalry."),
         ("St Ignatius, Letter to the Ephesians", "0104", "'Do nothing without the bishop.' Ignatius on unity and the Eucharist as 'the medicine of immortality'."),
         ("St Ignatius, Letter to the Magnesians", "0105", ""),
         ("St Ignatius, Letter to the Trallians", "0106", ""),
         ("St Ignatius, Letter to the Romans", "0107", "'I am the wheat of God, ground by the teeth of wild beasts.'"),
         ("St Ignatius, Letters to the Philadelphians and Smyrnaeans", "0108", ""),
         ("St Polycarp, Letter to the Philippians", "0136", ""),
         ("The Martyrdom of St Polycarp", "0102", "'Eighty-six years I have served Him, and He has done me no wrong.'"),
         ("The Letter to Diognetus", "0101", "Christians 'live in their own countries, but only as sojourners'.")]
    days = []
    for t, n, note in w:
        items = [{"father": t, "u": NA + n + ".htm"}]
        if note:
            items.insert(0, {"text": note})
        days.append({"title": t, "items": items})
    return {"id": "apostolic", "cat": "fathers", "title": "The Apostolic Fathers in 10 days",
            "about": "The writings of those who knew the Apostles or their disciples.", "days": days}


def incarnation():
    parts = [(1, 5), (6, 10), (11, 16), (17, 21), (22, 26), (27, 32), (33, 40), (41, 48), (49, 57)]
    notes = ["Why begin with creation? Because the One who made us is the One who saves us.",
             "God's 'dilemma': man was perishing, and it was not fitting that God's work should be undone.",
             "Men forgot God, so the Word came to renew the knowledge of Him.",
             "The Word in the body, yet not confined by it.",
             "Why the Cross, and why in public?",
             "The Resurrection, and the proof of it: Christians no longer fear death.",
             "Answers to the Jews, from the Prophets.",
             "Answers to the Greeks.",
             "'He became man that we might become god.' And how to read the Scriptures: with a pure life."]
    days = [{"title": f"Chapters {a}–{b}", "items": [{"text": notes[i]}, {"father": f"St Athanasius, On the Incarnation, chapters {a}–{b}", "u": NA + "2802.htm"}]}
            for i, (a, b) in enumerate(parts)]
    days[0]["items"].insert(0, {"text": "St Athanasius wrote this short book as a young man, around 318. It is one of the clearest books ever written on why God became man. Read the chapters named for each day."})
    return {"id": "incarnation", "cat": "fathers", "title": "On the Incarnation in 9 days",
            "about": "St Athanasius' classic, a few chapters a day.", "days": days}


def anthony():
    days = [{"title": f"Day {i + 1}", "items": [{"father": f"St Athanasius, Life of St Antony, sections {a}–{b}", "u": NA + "2811.htm"}]}
            for i, (a, b) in enumerate([(1, 15), (16, 33), (34, 50), (51, 66), (67, 82), (83, 94)])]
    days[0]["items"].insert(0, {"text": "The life of the father of monks, written by St Athanasius, who knew him. It shaped monasticism East and West."})
    return {"id": "antony", "cat": "fathers", "title": "The Life of St Antony in 6 days",
            "about": "The desert, the battle with the passions and the love of God, by St Athanasius.", "days": days}


def meet_the_fathers(library):
    pick = ["St Ignatius of Antioch", "St Polycarp of Smyrna", "St Justin Martyr", "St Irenaeus of Lyons", "St Cyprian of Carthage",
            "St Athanasius the Great", "St Basil the Great", "St Gregory the Theologian", "St Gregory of Nyssa", "St Cyril of Jerusalem",
            "St Ephrem the Syrian", "St John Chrysostom", "St Ambrose of Milan", "St Jerome", "Blessed Augustine of Hippo",
            "St John Cassian", "St Leo the Great", "St Gregory the Dialogist", "St John of Damascus", "St Hilary of Poitiers"]
    verse = {"St John Chrysostom": "MAT 5:1-12", "St Athanasius the Great": "JHN 1:1-14", "St Basil the Great": "GEN 1:1-5",
             "St Gregory the Theologian": "JHN 14:15-17", "St Cyril of Jerusalem": "JHN 6:51-58", "Blessed Augustine of Hippo": "PSA 51:1-12",
             "St Irenaeus of Lyons": "EPH 1:7-10", "St Ignatius of Antioch": "JHN 6:53-56", "St Gregory of Nyssa": "MAT 5:8",
             "St Ephrem the Syrian": "LUK 2:1-14", "St John of Damascus": "COL 1:15", "St Leo the Great": "JHN 11:35-44",
             "St Ambrose of Milan": "PSA 1", "St Jerome": "2TI 3:14-17", "St Justin Martyr": "ACT 2:42-47", "St Polycarp of Smyrna": "PHP 3:7-14",
             "St Cyprian of Carthage": "MAT 6:9-13", "St John Cassian": "MAT 5:3", "St Gregory the Dialogist": "LUK 15:1-10",
             "St Hilary of Poitiers": "MAT 28:19"}
    by = {a["name"]: a for a in library}
    days = []
    for name in pick:
        a = by[name]
        items = [{"text": a["bio"] + (f" Feast: {a['feast']}." if a["feast"] else "")}, {"read": verse[name]}]
        if a["works"]:
            items.append({"father": f"{name}: {a['works'][0]['t']}", "u": a["works"][0]["u"]})
        days.append({"title": name, "items": items})
    return {"id": "meet-fathers", "cat": "fathers", "title": "Meet the Fathers in 20 days",
            "about": "One Father a day: who they were, a passage they loved, and where to start reading them.", "days": days}


# ---------------------------------------------------------------- learn the faith

def creed():
    arts = [
        ("I believe in one God, the Father Almighty, Maker of heaven and earth, and of all things visible and invisible.", ["GEN 1:1-5", "DEU 6:4-9"], 6),
        ("And in one Lord Jesus Christ, the Son of God, the Only-begotten, begotten of the Father before all ages.", ["JHN 1:1-5", "HEB 1:1-4"], 10),
        ("Light of Light, true God of true God, begotten, not made, of one essence with the Father, through whom all things were made.", ["JHN 1:9-14", "COL 1:15-17"], 11),
        ("Who for us men and for our salvation came down from heaven, and was incarnate of the Holy Spirit and the Virgin Mary, and became man.", ["LUK 1:26-38", "PHP 2:5-8"], 12),
        ("And was crucified for us under Pontius Pilate, and suffered and was buried.", ["ISA 53:3-9", "MAT 27:45-61"], 13),
        ("And rose again on the third day, according to the Scriptures.", ["1CO 15:1-8", "LUK 24:1-12"], 14),
        ("And ascended into heaven, and sits at the right hand of the Father.", ["ACT 1:6-11", "HEB 8:1-2"], 14),
        ("And He shall come again with glory to judge the living and the dead; His kingdom shall have no end.", ["MAT 25:31-46", "DAG 7:13-14"], 15),
        ("And in the Holy Spirit, the Lord, the Giver of Life, who proceeds from the Father, who with the Father and the Son is worshipped and glorified, who spoke by the Prophets.", ["JHN 15:26", "2PE 1:19-21"], 16),
        ("In one, holy, catholic and apostolic Church.", ["MAT 16:13-19", "EPH 4:1-16"], 18),
        ("I confess one baptism for the remission of sins.", ["ROM 6:3-11", "ACT 2:37-41"], 18),
        ("I look for the resurrection of the dead, and the life of the age to come. Amen.", ["1CO 15:35-58", "REV 21:1-5"], 18),
    ]
    days = []
    for i, (words, reads, lecture) in enumerate(arts):
        items = [{"text": words}] + [{"read": r} for r in reads]
        items.append({"father": f"St Cyril of Jerusalem, Catechetical Lecture {lecture}", "u": NA + f"3101{lecture:02d}.htm"})
        days.append({"title": f"Article {i + 1}", "items": items})
    days[0]["items"].insert(0, {"text": "The Creed of Nicaea and Constantinople is said at every Divine Liturgy and at every baptism. The Orthodox Church says it as the councils gave it, without the later Western addition 'and the Son' (filioque). Each day: one phrase, the Scriptures behind it, and St Cyril of Jerusalem's lecture on it to the newly baptised."})
    return {"id": "creed", "cat": "learn", "title": "The Creed in 12 days",
            "about": "What Orthodox Christians believe, phrase by phrase, with the Scriptures and St Cyril of Jerusalem.", "days": days}


def lords_prayer():
    lines = [("Our Father, who art in heaven", "MAT 6:9"), ("Hallowed be Thy name", "MAT 6:9"), ("Thy kingdom come", "MAT 6:10"),
             ("Thy will be done, on earth as it is in heaven", "MAT 6:10"), ("Give us this day our daily bread", "MAT 6:11"),
             ("And forgive us our trespasses, as we forgive those who trespass against us", "MAT 6:12"),
             ("And lead us not into temptation, but deliver us from the evil one", "MAT 6:13")]
    days = [{"title": l, "items": [{"read": r}, {"text": TAP}]} for l, r in lines]
    days[0]["items"].insert(0, {"text": "The prayer the Lord Himself gave us. Each day, read the line and the Fathers on it: St Cyprian, St Cyril of Jerusalem, St John Chrysostom, Tertullian and others all wrote on the Lord's Prayer."})
    days[0]["items"].append({"father": "St Cyprian of Carthage, On the Lord's Prayer (Treatise 4)", "u": NA + "050704.htm"})
    return {"id": "lords-prayer", "cat": "learn", "title": "The Lord's Prayer in 7 days",
            "about": "One line a day, with what the Fathers said about it.", "days": days}


def all_plans(library):
    out = _plans(library)
    for p in out:
        c = COVERS[p["id"]]
        p["cover"] = {"bg": c[0], "t": c[1], "s": c[2], "style": c[3], "motif": c[4]}
    return out


def _plans(library):
    return [
        gospels(),
        psalter(),
        book_plan("acts", "ACT", "Acts", 28, "St John Chrysostom, Homilies on Acts", NA + "2101.htm",
                  "The Church is born: one chapter of Acts a day with St John Chrysostom's homilies beside it."),
        book_plan("romans", "ROM", "Romans", 16, "St John Chrysostom, Homilies on Romans", NA + "2102.htm",
                  "St Paul's great letter on grace and faith, as the Orthodox Church has always read it."),
        book_plan("hebrews", "HEB", "Hebrews", 13, "St John Chrysostom, Homilies on Hebrews", NA + "2402.htm",
                  "Christ our great High Priest, with St John Chrysostom."),
        councils_overview(),
        *COUNCILS,
        meet_the_fathers(library),
        apostolic_fathers(),
        incarnation(),
        anthony(),
        creed(),
        lords_prayer(),
    ]


# Cover art for each plan: (colour, big words, small words, style, motif). Styles: "block" (bold
# capitals) or "serif" (italic). Motifs: cross, halo, dome, wave, book, dove, star, flame.
COVERS = {
    "gospels": ("#6b8f5e", "The Four Gospels", "with the Fathers", "block", "book"),
    "psalter": ("#2f4a5c", "The Psalter", "in 20 kathismata", "serif", "wave"),
    "acts": ("#b5532e", "Acts", "with St John Chrysostom", "block", "flame"),
    "romans": ("#7a2d3a", "Romans", "with St John Chrysostom", "serif", "book"),
    "hebrews": ("#3c3a5c", "Hebrews", "our great High Priest", "serif", "cross"),
    "councils": ("#8a6a2f", "Seven Councils", "the faith of the Church", "block", "dome"),
    "nicaea1": ("#5c3a2e", "Nicaea", "325", "serif", "halo"),
    "constantinople1": ("#2e5c58", "The Holy Spirit", "Constantinople 381", "serif", "dove"),
    "ephesus": ("#2c4a7a", "Theotokos", "Ephesus 431", "serif", "star"),
    "chalcedon": ("#6a2f4f", "Two Natures", "Chalcedon 451", "block", "cross"),
    "constantinople2": ("#4f5a33", "One of the Trinity", "Constantinople 553", "serif", "halo"),
    "constantinople3": ("#3d4f6b", "Two Wills", "Constantinople 680", "block", "wave"),
    "nicaea2": ("#9a3b2a", "The Holy Icons", "Nicaea 787", "serif", "halo"),
    "meet-fathers": ("#4a3f35", "Meet the Fathers", "20 days", "block", "halo"),
    "apostolic": ("#5e6b3a", "Apostolic Fathers", "those who knew the Apostles", "block", "cross"),
    "incarnation": ("#7a5a2c", "On the Incarnation", "St Athanasius", "serif", "star"),
    "antony": ("#a0763a", "St Antony", "of the desert", "serif", "dome"),
    "creed": ("#1f3b4d", "I Believe", "the Creed in 12 days", "block", "cross"),
    "lords-prayer": ("#5a2e4a", "Our Father", "the Lord's Prayer", "serif", "flame"),
}
# Topics for the coloured tiles on Plans and Discover.
TOPICS = [
    ("christ", "Christ", "#b5402f", ["nicaea1", "chalcedon", "constantinople2", "constantinople3", "incarnation", "gospels", "hebrews"]),
    ("spirit", "Holy Spirit", "#2e7d73", ["constantinople1", "acts", "creed"]),
    ("theotokos", "Theotokos", "#2c5aa0", ["ephesus", "gospels"]),
    ("prayer", "Prayer", "#7b4fa0", ["psalter", "lords-prayer", "antony"]),
    ("icons", "Icons", "#a8742c", ["nicaea2"]),
    ("faith", "The Faith", "#3e6b3a", ["creed", "councils", "romans"]),
    ("fathers", "The Fathers", "#5b5148", ["meet-fathers", "apostolic", "incarnation", "antony"]),
    ("councils", "Councils", "#8a3a52", ["councils", "nicaea1", "constantinople1", "ephesus", "chalcedon", "constantinople2", "constantinople3", "nicaea2"]),
    ("scripture", "Scripture", "#4a5a8a", ["gospels", "psalter", "acts", "romans", "hebrews"]),
    ("desert", "Desert & Monks", "#9a6a3a", ["antony", "psalter"]),
]
FEATURED = ["gospels", "councils", "psalter", "meet-fathers", "creed"]

CATEGORIES = {
    "scripture": "Scripture with the Fathers",
    "councils": "The Councils",
    "fathers": "The Fathers",
    "learn": "Learn the faith",
}

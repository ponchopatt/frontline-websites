"""The Fathers library: every Father on New Advent's index (newadvent.org/fathers), with an Orthodox
label, a short introduction written for this app, and links to their works on New Advent.

The app links to New Advent rather than copying its pages, which are edited and copyrighted by
New Advent. The introductions here are the app's own words.

Run from build.py with New Advent's index saved as na-index.json (made by build/newadvent.py).
"""

# New Advent name -> (display name, label, century, introduction, feast day or "")
# Labels are as in fathers.py. Feast days are on the Church (new) calendar; Old Calendar
# parishes keep them 13 days later.
LIBRARY = {
    "Ignatius of Antioch": ("St Ignatius of Antioch", "saint", "1st–2nd", "Bishop of Antioch after the Apostles. On his way to martyrdom in Rome he wrote seven letters on unity, the bishop and the Eucharist.", "20 December"),
    "Polycarp": ("St Polycarp of Smyrna", "saint", "2nd", "A disciple of St John the Apostle and bishop of Smyrna, burned for Christ at 86. His letter and the account of his martyrdom are among the oldest Christian writings.", "23 February"),
    "Clement of Rome": ("St Clement of Rome", "saint", "1st", "An early bishop of Rome. His letter to the Corinthians calls a divided church back to peace and order.", "25 November"),
    "Mathetes": ("The Letter to Diognetus", "document", "2nd", "An early letter by an unknown Christian ('a disciple') explaining how Christians live in the world but are not of it.", ""),
    "Barnabas": ("The Epistle of Barnabas", "document", "1st–2nd", "An early letter reading the Old Testament as pointing to Christ. Not by the Apostle Barnabas, though it carries his name.", ""),
    "Hermas": ("The Shepherd of Hermas", "document", "2nd", "A book of visions and teachings on repentance, much read in the early Church.", ""),
    "Papias": ("St Papias of Hierapolis", "saint", "2nd", "A hearer of the Apostle John. Only fragments of his writings survive, mostly about the Gospels.", ""),
    "Justin Martyr": ("St Justin Martyr", "saint", "2nd", "A philosopher who found Christ and defended the faith before the emperors. His First Apology gives the oldest description of the Sunday Liturgy.", "1 June"),
    "Irenaeus of Lyons": ("St Irenaeus of Lyons", "saint", "2nd", "A disciple of St Polycarp and bishop of Lyons. Against Heresies answers the Gnostics with the faith handed down from the Apostles.", "23 August"),
    "Athenagoras": ("Athenagoras of Athens", "writer", "2nd", "A Christian philosopher who wrote a defence of the Christians and a treatise on the resurrection.", ""),
    "Theophilus": ("St Theophilus of Antioch", "saint", "2nd", "Bishop of Antioch. His books to Autolycus are the first to use the word 'Trinity'.", ""),
    "Aristides the Philosopher": ("Aristides of Athens", "writer", "2nd", "An Athenian Christian whose Apology, addressed to the emperor, is one of the oldest defences of the faith.", ""),
    "Hippolytus": ("St Hippolytus of Rome", "saint", "3rd", "A priest of Rome and martyr. He wrote against heresies and on Daniel and the end times.", "30 January"),
    "Cyprian of Carthage": ("St Cyprian of Carthage", "saint", "3rd", "Bishop of Carthage and martyr. He wrote on the unity of the Church, the Lord's Prayer and those who fell away in persecution.", "31 August"),
    "Gregory Thaumaturgus": ("St Gregory the Wonderworker", "saint", "3rd", "A student of Origen who became bishop of Neocaesarea. Known for his miracles and his short statement of faith in the Trinity.", "17 November"),
    "Dionysius the Great": ("St Dionysius of Alexandria", "saint", "3rd", "Bishop of Alexandria in a time of plague and persecution. His letters survive in pieces.", "5 October"),
    "Dionysius of Rome": ("St Dionysius of Rome", "saint", "3rd", "Bishop of Rome who wrote against those who blurred the Persons of the Trinity.", ""),
    "Methodius": ("St Methodius of Olympus", "saint", "3rd–4th", "Bishop and martyr. His Banquet of the Ten Virgins praises chastity; he also wrote against Origen's views on the resurrection.", "20 June"),
    "Peter of Alexandria": ("St Peter of Alexandria", "saint", "4th", "Bishop of Alexandria and the 'seal of the martyrs'. His canons on those who lapsed in persecution are part of Orthodox church law.", "25 November"),
    "Alexander of Alexandria": ("St Alexander of Alexandria", "saint", "4th", "The bishop who first stood against Arius and led the Church at the First Council of Nicaea, with his deacon Athanasius.", "29 May"),
    "Pamphilus": ("St Pamphilus of Caesarea", "saint", "3rd–4th", "A priest, scholar and martyr who built the great library of Caesarea.", "16 February"),
    "Victorinus": ("St Victorinus of Pettau", "saint", "3rd–4th", "Bishop and martyr who wrote the oldest Latin commentary on the Book of Revelation.", ""),
    "Athanasius": ("St Athanasius the Great", "saint", "4th", "Bishop of Alexandria, exiled five times for defending the faith of Nicaea. On the Incarnation is one of the best books ever written on why God became man.", "18 January, 2 May"),
    "Basil the Great": ("St Basil the Great", "saint", "4th", "Archbishop of Caesarea, one of the Three Holy Hierarchs. He wrote On the Holy Spirit and gave the Church the Liturgy that bears his name.", "1 January, 30 January"),
    "Gregory Nazianzen": ("St Gregory the Theologian", "saint", "4th", "Archbishop of Constantinople, one of the Three Holy Hierarchs. His Theological Orations are the classic teaching on the Holy Trinity.", "25 January, 30 January"),
    "Gregory of Nyssa": ("St Gregory of Nyssa", "saint", "4th", "Brother of St Basil and a great teacher on the Trinity, the soul and the endless growth of the soul toward God.", "10 January"),
    "Cyril of Jerusalem": ("St Cyril of Jerusalem", "saint", "4th", "Archbishop of Jerusalem. His Catechetical Lectures explain the Creed and the Holy Mysteries to the newly baptised.", "18 March"),
    "John Chrysostom": ("St John Chrysostom", "saint", "4th–5th", "Archbishop of Constantinople and the Church's greatest preacher, one of the Three Holy Hierarchs. His homilies go verse by verse through much of the New Testament. The Divine Liturgy most often served bears his name.", "13 November, 30 January"),
    "Ephraim the Syrian (306-373)": ("St Ephrem the Syrian", "saint", "4th", "Deacon of Nisibis and Edessa, the 'Harp of the Spirit'. His hymns teach the faith in poetry. His Lenten prayer is said in every Orthodox church.", "28 January"),
    "Aphrahat/Aphraates (c. 280-367)": ("Aphrahat the Persian Sage", "writer", "4th", "A Syriac teacher whose Demonstrations explain the faith simply, from the Scriptures.", ""),
    "Hilary of Poitiers": ("St Hilary of Poitiers", "western", "4th", "Bishop in Gaul, called the 'Athanasius of the West' for defending the faith of Nicaea.", "13 January"),
    "Ambrose (340-397)": ("St Ambrose of Milan", "western", "4th", "Bishop of Milan, who baptised Augustine and stood up to an emperor. A great preacher and hymn writer.", "7 December"),
    "Jerome": ("St Jerome", "western", "4th–5th", "Priest, monk and Bible scholar who translated the Scriptures into Latin and lived his last years in Bethlehem.", "15 June"),
    "Augustine of Hippo": ("Blessed Augustine of Hippo", "blessed", "4th–5th", "Bishop of Hippo in North Africa. His Confessions are loved by all Christians. The Orthodox honour him while setting aside parts of his teaching, such as his view of the Holy Spirit's procession and of grace.", "15 June"),
    "John Cassian (c. 360-c. 435)": ("St John Cassian", "saint", "4th–5th", "A monk who learned from the Desert Fathers of Egypt and brought their teaching to the West in his Institutes and Conferences.", "29 February (28 February)"),
    "Vincent of Lérins (d. c. 450)": ("St Vincent of Lérins", "western", "5th", "A monk who gave the rule for the true faith: what has been believed everywhere, always and by all.", "24 May"),
    "Leo the Great, Pope (c. 395-461)": ("St Leo the Great", "western", "5th", "Bishop of Rome. His Tome was read at the Council of Chalcedon on the two natures of Christ.", "18 February"),
    "Gregory the Great, Pope (c. 540-604)": ("St Gregory the Dialogist", "western", "6th", "Bishop of Rome, a monk and pastor. The Orthodox call him the Dialogist after his Dialogues, and serve the Liturgy of the Presanctified Gifts in his name.", "12 March"),
    "John of Damascus": ("St John of Damascus", "saint", "8th", "A monk of St Sabbas and great defender of the holy icons. His Exposition of the Orthodox Faith sums up the teaching of the Fathers before him.", "4 December"),
    "Sulpitius Severus (c. 363-c. 420)": ("Sulpicius Severus", "writer", "4th–5th", "A Christian writer from Gaul best known for his life of St Martin of Tours.", ""),
    "Clement of Alexandria": ("Clement of Alexandria", "writer", "2nd–3rd", "A teacher in Alexandria who showed how faith and true learning fit together. Honoured as an early writer, but not counted among the saints in the Orthodox calendar.", ""),
    "Origen": ("Origen", "writer", "3rd", "A brilliant Bible scholar of Alexandria. Some of his speculations, such as the pre-existence of souls, were later condemned (553), so read him with care.", ""),
    "Tertullian": ("Tertullian", "writer", "2nd–3rd", "A sharp Latin writer from Carthage who coined much Christian vocabulary, but later joined the Montanist sect.", ""),
    "Novatian": ("Novatian", "writer", "3rd", "A Roman priest who wrote well on the Trinity but led a schism against the Church's mercy to the repentant.", ""),
    "Lactantius": ("Lactantius", "writer", "3rd–4th", "A teacher of rhetoric who wrote the Divine Institutes, a defence of the faith for educated pagans.", ""),
    "Arnobius": ("Arnobius", "writer", "3rd–4th", "A convert who wrote Against the Heathen soon after becoming a Christian.", ""),
    "Commodianus": ("Commodian", "writer", "3rd", "A Latin Christian poet.", ""),
    "Minucius Felix": ("Minucius Felix", "writer", "2nd–3rd", "A Roman lawyer whose dialogue Octavius defends the faith.", ""),
    "Julius Africanus": ("Julius Africanus", "writer", "3rd", "A Christian historian who worked out a chronology of the world.", ""),
    "Caius": ("Gaius of Rome", "writer", "3rd", "A Roman presbyter who mentions the tombs of Sts Peter and Paul in Rome.", ""),
    "Archelaus": ("Archelaus", "writer", "4th", "Account of a debate with Mani, founder of the Manichees.", ""),
    "Malchion": ("Malchion", "writer", "3rd", "A priest of Antioch who exposed the heresy of Paul of Samosata.", ""),
    "Venantius": ("Venantius Fortunatus", "writer", "6th", "A Latin poet and bishop, author of hymns on the Cross.", ""),
    "Eusebius of Caesarea (c. 265-c. 340)": ("Eusebius of Caesarea", "writer", "4th", "The first Church historian. Without his Church History we would know far less about the early Church, though he leaned toward Arius.", ""),
    "Socrates Scholasticus (c. 379-c. 450)": ("Socrates Scholasticus", "writer", "5th", "A lawyer of Constantinople who carried on Eusebius' history to 439.", ""),
    "Sozomen (c. 375-c. 447)": ("Sozomen", "writer", "5th", "Another historian of the 4th and early 5th century Church.", ""),
    "Theodoret": ("Theodoret of Cyrus", "writer", "5th", "Bishop and historian. His writings against St Cyril were condemned in 553, but his history is valuable.", ""),
    "Rufinus": ("Rufinus of Aquileia", "writer", "4th–5th", "A monk and translator who explained the Apostles' Creed.", ""),
    "Gennadius of Marseilles": ("Gennadius of Marseilles", "writer", "5th", "A priest who listed the Christian writers of his day.", ""),
    "Mar Jacob (452-521)": ("Jacob of Serugh", "writer", "5th–6th", "A Syriac poet-preacher, honoured by the Syriac churches.", ""),
    "Liturgies": ("The ancient Liturgies", "document", "4th+", "Early forms of the Divine Liturgy, including the Liturgy of St James, still served on his feast.", ""),
}
# Left out: Gnostic and other heretical works (the Apocrypha section, Bardesanes, Theodotus),
# a pagan philosopher (Alexander of Lycopolis), Tatian (later founded a sect) and a national
# history (Moses of Chorene). The councils have their own section.
SKIP = {"Alexander of Lycopolis", "Bardesanes (154-222)", "Theodotus", "Tatian", "Moses of Chorene (c. 400-c. 490)", "Apocrypha", "Councils"}
KEEP_MISC = {"0714.htm", "0715.htm"}  # the Didache and the Apostolic Constitutions


def build(index):
    out = []
    for a in index:
        if a["name"] in SKIP:
            continue
        if a["name"] == "Miscellaneous":
            works = [w for w in a["works"] if w[0] in KEEP_MISC]
            out.append({"id": "early-documents", "name": "Early Church documents", "label": "document", "era": "1st–4th",
                        "bio": "The Didache, a 1st-century guide to Christian life, prayer and the Eucharist, and the Apostolic Constitutions, a 4th-century collection of church order.",
                        "feast": "", "works": [{"t": t, "u": "https://www.newadvent.org/fathers/" + u} for u, t in works]})
            continue
        if a["name"] not in LIBRARY:
            raise SystemExit("No entry for New Advent's " + repr(a["name"]))
        name, label, era, bio, feast = LIBRARY[a["name"]]
        out.append({"id": name.lower().replace("st ", "").replace(" ", "-"), "name": name, "label": label, "era": era,
                    "bio": bio, "feast": feast, "works": [{"t": t, "u": "https://www.newadvent.org/fathers/" + u} for u, t in a["works"]]})
    order = {"saint": 0, "blessed": 1, "western": 1, "document": 2, "writer": 3}
    return out, order

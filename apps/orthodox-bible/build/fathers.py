"""Which Fathers the app shows, how it labels them, and which of their translations are free to use.

Labels follow how the Orthodox Church receives each writer:
  saint    a saint of the Church
  blessed  honoured, with reservations about parts of his teaching (Blessed Augustine, Theophylact)
  western  a saint of the West before the schism
  writer   an early Christian writer, not counted among the saints (Origen, Tertullian, ...)
  document an early Christian writing with no named author (the Didache, the Shepherd, ...)
Writers condemned as heretics, later Western writers and modern authors are left out.
"""

# folder name in the source data -> (display name, label, rank). Lower rank shows first.
AUTHORS = {
    "John Chrysostom": ("St John Chrysostom", "saint", 1),
    "Basil of Caesarea": ("St Basil the Great", "saint", 2),
    "Gregory of Nazianzus": ("St Gregory the Theologian", "saint", 2),
    "Gregory of Nyssa": ("St Gregory of Nyssa", "saint", 3),
    "Athanasius of Alexandria": ("St Athanasius the Great", "saint", 2),
    "Cyril of Alexandria": ("St Cyril of Alexandria", "saint", 2),
    "Cyril of Jerusalem": ("St Cyril of Jerusalem", "saint", 3),
    "John Damascene": ("St John of Damascus", "saint", 3),
    "Ephrem the Syrian": ("St Ephrem the Syrian", "saint", 3),
    "Theophylact of Ohrid": ("Blessed Theophylact of Ohrid", "blessed", 2),
    "Irenaeus": ("St Irenaeus of Lyons", "saint", 3),
    "Ignatius of Antioch": ("St Ignatius of Antioch", "saint", 3),
    "Polycarp of Smyrna": ("St Polycarp of Smyrna", "saint", 3),
    "Clement of Rome": ("St Clement of Rome", "saint", 3),
    "Justin Martyr": ("St Justin Martyr", "saint", 4),
    "Methodius of Olympus": ("St Methodius of Olympus", "saint", 4),
    "Hippolytus of Rome": ("St Hippolytus of Rome", "saint", 4),
    "Cyprian": ("St Cyprian of Carthage", "saint", 4),
    "Dionysius of Alexandria": ("St Dionysius of Alexandria", "saint", 5),
    "Gregory of Neocaesarea": ("St Gregory the Wonderworker", "saint", 5),
    "Alexander of Alexandria": ("St Alexander of Alexandria", "saint", 5),
    "Peter of Alexandria": ("St Peter of Alexandria", "saint", 5),
    "Theophilus of Antioch": ("St Theophilus of Antioch", "saint", 5),
    "Victorinus of Pettau": ("St Victorinus of Pettau", "saint", 5),
    "Theonas of Alexandria": ("St Theonas of Alexandria", "saint", 6),
    "Pacian of Barcelona": ("St Pacian of Barcelona", "western", 6),
    "Ambrose of Milan": ("St Ambrose of Milan", "western", 3),
    "Jerome": ("St Jerome", "western", 4),
    "Hilary of Poitiers": ("St Hilary of Poitiers", "western", 4),
    "Leo the Great": ("St Leo the Great", "western", 4),
    "Gregory the Dialogist": ("St Gregory the Dialogist", "western", 4),
    "John Cassian": ("St John Cassian", "saint", 4),
    "Bede": ("St Bede the Venerable", "western", 5),
    "Remigius of Rheims": ("St Remigius of Rheims", "western", 6),
    "Augustine of Hippo": ("Blessed Augustine of Hippo", "blessed", 4),
    "Origen of Alexandria": ("Origen", "writer", 7),
    "Tertullian": ("Tertullian", "writer", 7),
    "Clement of Alexandria": ("Clement of Alexandria", "writer", 6),
    "Eusebius of Caesarea": ("Eusebius of Caesarea", "writer", 7),
    "Lucius Caecilius Firmianus Lactantius": ("Lactantius", "writer", 7),
    "Arnobius of Sicca": ("Arnobius", "writer", 8),
    "Commodian": ("Commodian", "writer", 8),
    "Didache": ("The Didache", "document", 5),
    "Epistle of Barnabas": ("The Epistle of Barnabas", "document", 6),
    "Shepherd of Hermas": ("The Shepherd of Hermas", "document", 6),
    "Apostolic Constitutions": ("The Apostolic Constitutions", "document", 7),
}

LABELS = {
    "saint": "Saint",
    "blessed": "Blessed: honoured, with some reservations",
    "western": "Western saint, before the schism",
    "writer": "Early Christian writer, not a saint",
    "document": "Early Christian writing",
}

# Translations in the source data that are public domain: the Ante-Nicene and Nicene and
# Post-Nicene Fathers series (1880s-1900), and a few other old translations. Keys are the
# author's folder and the start of the work's path on historicalchristian.faith.
FREE_WORKS = {
    "John Chrysostom": ["Homilies", "TREATISE ON THE PRIESTHOOD", "An Exhortation to Theodore"],
    "Augustine of Hippo": [
        "TRACTATES ON JOHN", "ON THE PSALMS", "Ten Homilies on the First Epistle of John",
        "OUR LORD'S SERMON ON THE MOUNT", "The City of God", "On The Trinity", "Confessions",
        "Letters", "Sermons on Selected Lessons of the New Testament", "On the Spirit and the Letter",
        "A Treatise Against Two Letters of the Pelagians", "Reply to Faustus the Manichaean",
        "The Harmony of the Gospels", "On Baptism", "On Marriage and Concupiscence",
        "A Treatise on the Predestination of the Saints", "In Answer to the Letters of Petilian",
        "Of the Work of Monks", "On Nature and Grace", "On the Soul and Its Origin",
    ],
    "Basil of Caesarea": ["The Hexaemeron", "ON THE SPIRIT", "Letters"],
    "Ambrose of Milan": [
        "Letters", "On the Holy Spirit", "Exposition of the Christian Faith", "ON THE DUTIES OF THE CLERGY",
        "On the Decease of His Brother", "Concerning Repentance", "Concerning Virgins", "Concerning Widows",
    ],
    "Athanasius of Alexandria": ["Four Discourses Against the Arians", "To the Bishops of Egypt"],
    "Clement of Alexandria": ["Fragments", "The Instructor", "The Stromata", "Exhortation to the Heathen"],
    "Clement of Rome": ["First Epistle to the Corinthians"],
    "Commodian": [""],
    "Cyprian": ["Letters", "Treatise", "The Seventh Council of Carthage"],
    "Cyril of Alexandria": ["Commentary on the Gospel of John", "Commentary on the Gospel of Luke"],
    "Cyril of Jerusalem": ["CATECHETICAL LECTURES"],
    "Didache": [""],
    "Epistle of Barnabas": [""],
    "Dionysius of Alexandria": [""],
    "Ephrem the Syrian": ["Homily - On Our Lord"],
    "Eusebius of Caesarea": ["THE CHURCH HISTORY OF EUSEBIUS", "The Proof of the Gospel"],
    "Gregory of Nazianzus": ["Orations"],
    "Gregory of Neocaesarea": [""],
    "Gregory of Nyssa": ["Against Eunomius", "On Virginity", "On the Making of Man", "On the Soul and the Resurrection", "On the Baptism of Christ"],
    "Gregory the Dialogist": ["Morals on the Book of Job", "THE BOOK OF PASTORAL RULE", "Register of Epistles", "Dialogues"],
    "Hilary of Poitiers": ["On the Trinity", "Homilies on the Psalms"],
    "Hippolytus of Rome": ["Fragments - Exegetical", "The Refutation of All Heresies", "Fragments - Dogmatical"],
    "Ignatius of Antioch": ["Epistle to"],
    "Irenaeus": ["Irenaeus Against Heresies", "Fragments from the Lost Writings", "The Proof of the Apostolic Preaching"],
    "Jerome": ["Letters", "Biblical Prefaces"],
    "John Cassian": ["Conferences of John Cassian"],
    "John Damascene": ["An Exact Exposition of the Orthodox Faith"],
    "Justin Martyr": [""],
    "Leo the Great": ["Sermons", "Letters"],
    "Lucius Caecilius Firmianus Lactantius": [""],
    "Methodius of Olympus": [""],
    "Origen of Alexandria": ["Commentary on Matthew", "Commentary on John", "De Principiis", "Against Celsus"],
    "Pacian of Barcelona": [""],
    "Peter of Alexandria": [""],
    "Polycarp of Smyrna": [""],
    "Shepherd of Hermas": ["Translation-ANF"],
    "Tertullian": [""],
    "Theonas of Alexandria": [""],
    "Theophilus of Antioch": [""],
    "Victorinus of Pettau": ["Commentary on the Apocalypse", "On the Creation of the World"],
    "Arnobius of Sicca": [""],
    "Apostolic Constitutions": [""],
    "Alexander of Alexandria": [""],
}
# Never kept, even under an author above: spurious works and modern translations sold as PDFs.
NOT_FREE = ("Pseudo-", "Dubious and Spurious", ".pdf", "Rabanus Maurus")


def author_for(folder):
    a = AUTHORS.get(folder)
    if not a:
        return None
    name, label, rank = a
    return {"id": folder.lower().replace(" ", "-"), "name": name, "label": label, "about": LABELS[label], "rank": rank}


def source_ok(folder, url, work):
    """True only for public-domain translations."""
    if any(x in work for x in NOT_FREE):
        return False
    if work.startswith("Thomas Aquinas/Catena Aurea"):
        return True  # the Oxford translation of 1841-45
    host = url.split("/")[2] if url.count("/") >= 2 else ""
    if host in ("www.newadvent.org", "newadvent.org"):
        return True  # the ANF/NPNF translations; the app links back rather than copying New Advent's pages
    if host in ("ccel.org", "www.ccel.org") and "/fathers2/" in url:
        return True
    if not work.startswith(folder + "/"):
        return False
    rest = work[len(folder) + 1:]
    return any(rest.startswith(w) for w in FREE_WORKS.get(folder, []))

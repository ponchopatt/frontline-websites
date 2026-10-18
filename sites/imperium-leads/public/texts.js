/*
  The texts: the price sheet and the words for each step, filled in for one lead.

  Plain logic only, shared by the page and the tests (window.ILTexts; needs window.ILModel).
  Nothing here sends anything: the Text button opens the phone's messages app with the words
  filled in, and a person sends it. Prices only ever come from PRICES below (the website's,
  by car size: hatch or sedan, SUV or ute, 4x4 or 7-seater; a car whose size isn't known gets the
  hatch/sedan "from" price), or from the quote someone typed in. A service with no price says
  "I'll confirm the price" instead.
*/
(function (root) {
  "use strict";
  var M = root.ILModel;

  // [hatch or sedan, SUV or ute, 4x4 / 7-seater], from imperiumdetailing.com.au.
  var PRICES = { "Full detail": [250, 280, 320], Exterior: [130, 140, 160], Interior: [170, 190, 220], Correction: [497, 597, 697], Ceramic: [997, 1097, 1197], "Maintenance plan": null, "Pre-sale": null };
  var NO_PRICE = "I'll confirm the price";
  // How each service reads in a sentence.
  var WORDS = {
    "Full detail": "full detail", Interior: "interior detail", Exterior: "exterior detail", Correction: "paint correction",
    Ceramic: "ceramic coating", "Maintenance plan": "maintenance plan", "Pre-sale": "pre-sale detail", "Not sure": "detail",
  };
  // The four touches, the backlog, deposit and on-my-way texts are the defaults: each can be changed in Settings
  // (settings/templates), and the page passes the saved words in as o.templates.
  var TEMPLATES = {
    touch1: "Hey [name], it's [owner] from Imperium Detailing. Got your request for the [car]. Full details start from $250 and we come to you. I've got [day] or [day] free. Which suits?",
    touch2: "Hey [name], just checking you got my message about the [car]. Happy to sort a price and lock in a time. What day suits?",
    touch3: "Hey [name], still keen on getting the [car] done? I've got spots this week if you want one.",
    touch4: "Hey [name], last one from me. If you'd still like the [car] detailed, just reply and I'll sort a time. If not, no worries at all.",
    backlog: "Hey [name], it's Angus from Imperium Detailing. Just checking in on the detail for your [car]. Still keen? I've got spots this week if you want to lock one in.",
    deposit: "Hey [name], to lock in [day] at [time] for the [car], here's the $50 deposit link: [link]. It comes off the final price and is fully refundable with 24 hours' notice.",
    onmyway: "Hey [name], it's Ananth from Imperium Detailing. On our way now, see you soon!",
    after: "Hi [name], [owner] from Imperium Detailing. Hope the [car] is looking good! Here's the link for payment: [link]. Any questions, just message me.",
    review: "Thanks [name], payment received. If you've got a minute, a Google review would mean a lot to us: [review link]",
  };
  // The ones that can be changed in Settings, in order.
  var EDITABLE = ["touch1", "touch2", "touch3", "touch4", "backlog", "deposit", "onmyway"];
  var LABELS = {
    touch1: "Touch 1 (straight away)", touch2: "Touch 2 (next day)", touch3: "Touch 3 (day 3)", touch4: "Touch 4 (day 7)",
    backlog: "Backlog: still keen?", deposit: "Deposit link", onmyway: "On my way", after: "After the job", review: "Review ask",
  };

  // 0 hatch or sedan, 1 SUV or ute, 2 4x4, 4WD, van or 7/8-seater; -1 when the car doesn't say.
  function sizeOf(car) {
    var c = String(car || "").toLowerCase();
    if (/4x4|4wd|van|[78][ -]?seat|people mover|landcruiser|patrol|prado/.test(c)) return 2;
    if (/suv|ute|wagon/.test(c)) return 1;
    if (/hatch|sedan|coupe/.test(c)) return 0;
    return -1;
  }
  function priceFor(service, car) {
    var p = PRICES[service];
    if (!p) return null;
    return p[Math.max(0, sizeOf(car))];
  }
  // The quote someone typed in if there is one, else the price sheet's "from" price.
  function priceOf(key, l, o) {
    if (o.price != null && o.price !== "") return o.price;
    if (l && l.quoted != null && l.quoted !== "") return l.quoted;
    return key === "quote" ? null : priceFor(l && l.service, l && l.car);
  }
  function firstName(l) {
    return String((l && l.name) || "").trim().split(/\s+/)[0] || "there";
  }
  function carOf(l) {
    return String((l && l.car) || "").trim() || "car";
  }
  function words(service) {
    return WORDS[service] || "detail";
  }
  function capital(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function amount(n) {
    return Number(n).toLocaleString("en-AU", { maximumFractionDigits: 2 });
  }

  /*
    The words for `key`, filled in for lead `l`. o: { owner, price, hours, days: [a, b],
    reviewLink, templates, day, time, link }. [name], [car] and [owner] come from the lead; anything
    not known ([day], [time], [link]) is left in brackets for the person to fill in before sending.
  */
  function fill(key, l, o) {
    o = o || {};
    var service = words(l && l.service);
    var price = priceOf(key, l, o);
    var saved = o.templates && typeof o.templates[key] === "string" && o.templates[key].trim() ? o.templates[key] : "";
    var t = saved || TEMPLATES[key] || "";
    var days = (o.days || []).filter(Boolean);
    t = t.replace("a [service]", (/^[aeiou]/.test(service) ? "an " : "a ") + "[service]");
    t = t.replace("[day] or [day]", days.length === 2 ? days[0] + " or " + days[1] : days.length === 1 ? days[0] + " or [day]" : "[day] or [day]");
    return t
      .split("[name]").join(firstName(l))
      .split("[owner]").join(o.owner || (l && l.owner) || "")
      .split("[car]").join(carOf(l))
      .split("[service]").join(service)
      .split("[Service]").join(capital(service))
      .split("[price]").join(price == null ? "[price]" : amount(price))
      .split("[hours]").join(o.hours ? String(o.hours) : "[hours]")
      .split("[review link]").join(o.reviewLink || "[review link]")
      .split("[link]").join(o.link || "[link]")
      .split("[day]").join(o.day || "[day]")
      .split("[time]").join(o.time || "[time]");
  }

  /*
    Which text a lead is up to, today: touch 1 for a new lead (or one that's enquired again),
    then touches 2, 3 and 4; the "still keen?" text for a lead waiting; after the job, the payment
    text, then the review ask once it's paid. A booking whose day hasn't come yet has none.
  */
  function which(l, today) {
    var stage = M.stageOf(l, today);
    if (stage === "Done" || (stage === "Booked" && l.jobDate && today && l.jobDate <= today)) return l.paid === "Yes" ? "review" : "after";
    if (stage === "Booked") return "";
    if (stage === "Waiting") return "backlog";
    if (stage === "New" || M.againPending(l)) return "touch1";
    return "touch" + Math.min((Number(l.touches) || 0) + 1, M.TOUCHES);
  }
  function message(l, o) {
    o = o || {};
    var key = o.key || which(l, o.today || M.canberraDate(new Date()));
    return { key: key, label: LABELS[key] || "", text: key ? fill(key, l, o) : "" };
  }
  // A link that opens the messages app with the text filled in (works on iPhone and Android).
  function smsHref(phone, text) {
    var to = String(phone || "").replace(/[^\d+]/g, "");
    return "sms:" + to + (text ? "?&body=" + encodeURIComponent(text) : "");
  }

  root.ILTexts = {
    PRICES: PRICES, NO_PRICE: NO_PRICE, TEMPLATES: TEMPLATES, EDITABLE: EDITABLE, LABELS: LABELS,
    priceFor: priceFor, sizeOf: sizeOf, firstName: firstName, words: words, fill: fill, which: which, message: message, smsHref: smsHref,
  };
})(typeof window !== "undefined" ? window : globalThis);

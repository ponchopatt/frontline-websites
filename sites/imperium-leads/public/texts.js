/*
  The texts: the price sheet and the words for each step, filled in for one lead.

  Plain logic only, shared by the page and the tests (window.ILTexts; needs window.ILModel).
  Nothing here sends anything: the Text button opens the phone's messages app with the words
  filled in, and a person sends it. Prices only ever come from PRICES below ("from" prices,
  hatch/sedan), or from the quote someone typed in. A service with no price says
  "I'll confirm the price" instead.
*/
(function (root) {
  "use strict";
  var M = root.ILModel;

  var PRICES = { "Full detail": 225, Exterior: 110, Interior: 140, Correction: 397, Ceramic: 997, "Maintenance plan": null, "Pre-sale": null };
  var NO_PRICE = "I'll confirm the price";
  // How each service reads in a sentence.
  var WORDS = {
    "Full detail": "full detail", Interior: "interior detail", Exterior: "exterior detail", Correction: "paint correction",
    Ceramic: "ceramic coating", "Maintenance plan": "maintenance plan", "Pre-sale": "pre-sale detail", "Not sure": "detail",
  };
  var TEMPLATES = {
    first: "Hi [name], [owner] from Imperium Detailing. Got your request for the [car]. I'll text your price shortly.",
    missed: "Hi [name], [owner] from Imperium Detailing. Just tried to call about the [service] for your [car]. What suburb are you in? I'll send your price straight back.",
    day1: "Hi [name], [owner] here from Imperium. Still keen on getting the [car] done? I've got a couple of spots this week and next. Just reply and I'll lock one in.",
    day3: "Hi [name], quick one. [Service] on the [car] is from $[price] at your place. If the timing's off, tell me when suits and I'll pencil you in.",
    day3NoPrice: "Hi [name], quick one. [Service] on the [car] is done at your place, and " + NO_PRICE + ". If the timing's off, tell me when suits and I'll pencil you in.",
    day7: "Hi [name], [owner] from Imperium Detailing. No stress if the timing's off. If you still want the [car] done, just reply here and I'll sort it.",
    checkin: "Hi [name], [owner] from Imperium Detailing. Just checking in. If the [car] is due for a clean, reply here and I'll sort a time.",
    quote: "Hi [name], for the [car] a [service] is $[price], at your place. Takes about [hours] hours. I've got [day] or [day] free. Which suits?",
    after: "Hi [name], [owner] from Imperium Detailing. Hope the [car] is looking good! Here's the link for payment: [link]. Any questions, just message me.",
    review: "Thanks [name], payment received. If you've got a minute, a Google review would mean a lot to us: [review link]",
  };
  var LABELS = {
    first: "First text", missed: "Missed call", day1: "Day 1 text", day3: "Day 3 text", day7: "Day 7 text", checkin: "Check-in",
    quote: "Quote", after: "After the job", review: "Review ask",
  };

  function priceFor(service) {
    var p = PRICES[service];
    return typeof p === "number" ? p : null;
  }
  // The quote someone typed in if there is one, else the price sheet's "from" price.
  function priceOf(key, l, o) {
    if (o.price != null && o.price !== "") return o.price;
    if (l && l.quoted != null && l.quoted !== "") return l.quoted;
    return key === "quote" ? null : priceFor(l && l.service);
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
    reviewLink }. Anything not known yet ([hours], [day], [link]) is left in brackets for the
    person to fill in before sending.
  */
  function fill(key, l, o) {
    o = o || {};
    var service = words(l && l.service);
    var price = priceOf(key, l, o);
    var t = TEMPLATES[key === "day3" && price == null ? "day3NoPrice" : key] || "";
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
      .split("[review link]").join(o.reviewLink || "[review link]");
  }

  /*
    Which text a lead is up to, today: the first text for a new lead (the missed-call text if
    the call today wasn't answered), then the schedule's texts in order; the quote text on the
    day of the quote; a check-in for leads waiting; after the job, the payment text, then the
    review ask once it's paid.
  */
  function which(l, today) {
    var stage = M.stageOf(l, today);
    var last = M.lastTouch(l);
    var missed = !!last && last.type === "call" && last.pickedUp === "No" && M.canberraDate(last.at) === today;
    if (M.againPending(l)) return missed ? "missed" : "first";
    if (stage === "Booked" || stage === "Done" || stage === "Review asked") return l.paid === "Yes" ? "review" : "after";
    if (stage === "Waiting" || stage === "Lost") return "checkin";
    if (stage === "New") return missed ? "missed" : "first";
    if (missed) return "missed";
    var done = Number(l.touches) || 0;
    if (stage === "Quoted") return done === 0 && l.quotedOn === today ? "quote" : ["day1", "day3", "day7"][Math.min(done, 2)];
    var seq = M.scheduleFor(l) === "browsing" ? ["first", "day3"] : ["first", "day1", "day3", "day7"];
    return seq[Math.min(done, seq.length - 1)];
  }
  function message(l, o) {
    o = o || {};
    var key = o.key || which(l, o.today || M.canberraDate(new Date()));
    return { key: key, label: LABELS[key], text: fill(key, l, o) };
  }
  // A link that opens the messages app with the text filled in (works on iPhone and Android).
  function smsHref(phone, text) {
    var to = String(phone || "").replace(/[^\d+]/g, "");
    return "sms:" + to + (text ? "?&body=" + encodeURIComponent(text) : "");
  }

  root.ILTexts = {
    PRICES: PRICES, NO_PRICE: NO_PRICE, TEMPLATES: TEMPLATES, LABELS: LABELS,
    priceFor: priceFor, firstName: firstName, words: words, fill: fill, which: which, message: message, smsHref: smsHref,
  };
})(typeof window !== "undefined" ? window : globalThis);

/*
  Google reviews: where each customer is up to, what to do next, and the words to use.

  Plain logic only (no page, no database), so the page and the tests share it. The page loads it
  as window.ILReviews. A lead's review fields:

    completedAt        when the job was marked done (the review flow starts here)
    reviewStatus       not_asked, asked_in_person, text_sent, nudged, reviewed, declined, skip
    reviewAskedAt, reviewTextSentAt, reviewNudgedAt, reviewLeftAt   ISO times, or null
    reviewNotes        a short note

  reviewAsked / reviewLeft ("Yes"/"No") are the older fields the Numbers tab reads; they're kept
  in step with reviewStatus.
*/
(function (root) {
  var STATUSES = ["not_asked", "asked_in_person", "text_sent", "nudged", "reviewed", "declined", "skip"];
  var LABELS = {
    not_asked: "Not asked",
    asked_in_person: "Asked",
    text_sent: "Text sent",
    nudged: "Nudged",
    reviewed: "Reviewed",
    declined: "Declined",
    skip: "Skipped",
  };
  var DEFAULTS = {
    reviewLink: "https://g.page/r/CSwRG2iKFelCEAE/review",
    senderName: "Angus",
    businessName: "Imperium Detailing",
  };
  var NUDGE_DAYS = 3;
  var RULES = [
    "Ask everyone, not just happy customers. No picking and choosing.",
    "Never offer a discount, gift or anything in return for a review.",
    "Never ask for a certain star rating or tell them what to write.",
    "One text, one nudge, then stop.",
  ];
  var SCRIPT =
    "Glad you're happy with it. If you've got 30 seconds later, a quick Google review helps us heaps. I'll text you the link tonight so you don't have to look for it.";

  // The saved settings, with the defaults filling any gap.
  function settings(saved) {
    var s = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = saved && typeof saved[k] === "string" ? saved[k].trim() : "";
      s[k] = v || DEFAULTS[k];
    });
    return s;
  }

  function firstName(l) {
    return String((l && l.name) || "").trim().split(/\s+/)[0] || "there";
  }
  function car(l) {
    return String((l && l.car) || "").trim() || "car";
  }

  // The review ask, sent once they've paid.
  function text(l, s) {
    s = settings(s);
    return "Thanks " + firstName(l) + ", payment received. If you've got a minute, a Google review would mean a lot to us: " + s.reviewLink;
  }
  function paid(l) {
    return !!l && l.paid === "Yes";
  }
  function nudge(l, s) {
    s = settings(s);
    return "Hey " + firstName(l) + ", no stress if you're flat out, just leaving the review link here in case it's handy: " + s.reviewLink +
      "\nThanks again, " + s.senderName;
  }
  function reply(l, s) {
    s = settings(s);
    return "Thanks " + firstName(l) + ", really appreciate you taking the time. Enjoy the " + car(l) +
      ", and give us a shout whenever it needs a freshen up. " + s.senderName + ", " + s.businessName;
  }

  // Whole days between the day of `iso` and the day of `now`, in this phone's time zone.
  function dayStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  function daysSince(iso, now) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d)) return null;
    return Math.round((dayStart(now || new Date()) - dayStart(d)) / 864e5);
  }
  function dayName(d) {
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }

  function isDone(l) {
    return !!(l && l.completedAt);
  }
  function statusOf(l) {
    return l && STATUSES.indexOf(l.reviewStatus) !== -1 ? l.reviewStatus : isDone(l) ? "not_asked" : null;
  }
  function nudgeDue(l, now) {
    var d = daysSince(l.reviewTextSentAt, now);
    return d !== null && d >= NUDGE_DAYS;
  }

  /*
    What to do next, for the Review card:
    { title, say (words to say or send, or ""), copy (true when `say` is a text to copy), buttons: [{status, label, primary}] }
  */
  function step(l, s, now) {
    now = now || new Date();
    var st = statusOf(l);
    var reviewedBtn = { status: "reviewed", label: "They reviewed", primary: false };
    var declinedBtn = { status: "declined", label: "Declined", primary: false };
    switch (st) {
      case "not_asked":
        return {
          title: "At handover, walk them round the car, then say this:",
          say: SCRIPT,
          copy: false,
          buttons: [{ status: "asked_in_person", label: "Asked in person", primary: true }, { status: "skip", label: "Skip", primary: false }],
        };
      case "asked_in_person":
        if (!paid(l)) return { title: "Tick Paid once the money's in. The review text comes up then.", say: "", copy: false, buttons: [] };
        return { title: "Paid. Send this text:", say: text(l, s), copy: true, buttons: [{ status: "text_sent", label: "Text sent", primary: true }] };
      case "text_sent":
        if (nudgeDue(l, now)) {
          return {
            title: "No review yet? Send one nudge, then leave it:",
            say: nudge(l, s),
            copy: true,
            buttons: [{ status: "nudged", label: "Nudged", primary: true }, reviewedBtn, declinedBtn],
          };
        }
        var sent = new Date(l.reviewTextSentAt);
        var nudgeOn = new Date(sent.getFullYear(), sent.getMonth(), sent.getDate() + NUDGE_DAYS);
        return { title: "Text sent. No review by " + dayName(nudgeOn) + "? Send one nudge then.", say: "", copy: false, buttons: [reviewedBtn, declinedBtn] };
      case "nudged":
        return { title: "Nudge sent. That's it, leave it now.", say: "", copy: false, buttons: [reviewedBtn, declinedBtn] };
      case "reviewed":
        return { title: "Reply to their review within 24 hours:", say: reply(l, s), copy: true, buttons: [] };
      case "declined":
        return { title: "They'd rather not. Leave it there.", say: "", copy: false, buttons: [] };
      case "skip":
        return { title: "Skipped.", say: "", copy: false, buttons: [] };
      default:
        return { title: "Mark the job done to start.", say: "", copy: false, buttons: [] };
    }
  }

  // The older Yes/No fields, kept in step for the Numbers tab.
  function legacy(status) {
    var asked = ["asked_in_person", "text_sent", "nudged", "reviewed", "declined"].indexOf(status) !== -1;
    return { reviewAsked: asked ? "Yes" : status === "skip" ? "No" : "", reviewLeft: status === "reviewed" ? "Yes" : "" };
  }

  // Fields to save when a lead moves to `status`. Each step stamps its own time.
  function patch(l, status, nowIso) {
    var p = { reviewStatus: status };
    if (status === "asked_in_person") p.reviewAskedAt = nowIso;
    if (status === "text_sent") p.reviewTextSentAt = nowIso;
    if (status === "nudged") p.reviewNudgedAt = nowIso;
    if (status === "reviewed") p.reviewLeftAt = nowIso;
    var legacyFields = legacy(status);
    p.reviewAsked = legacyFields.reviewAsked;
    p.reviewLeft = legacyFields.reviewLeft;
    return p;
  }

  // Fields to save when the job is marked done: the review flow starts at "not asked".
  function completePatch(l, nowIso) {
    return {
      completedAt: (l && l.completedAt) || nowIso,
      reviewStatus: (l && l.reviewStatus) || "not_asked",
      reviewAskedAt: (l && l.reviewAskedAt) || null,
      reviewTextSentAt: (l && l.reviewTextSentAt) || null,
      reviewNudgedAt: (l && l.reviewNudgedAt) || null,
      reviewLeftAt: (l && l.reviewLeftAt) || null,
      reviewNotes: (l && l.reviewNotes) || "",
    };
  }

  // Due today: the text for anyone asked in person who has paid, and the one nudge once a text is 3 days old.
  function due(leads, s, now) {
    now = now || new Date();
    var out = [];
    leads.forEach(function (l) {
      var st = statusOf(l);
      if (st === "asked_in_person" && paid(l)) out.push({ lead: l, kind: "text", what: "Send the review text", done: "text_sent", doneLabel: "Text sent", text: text(l, s) });
      else if (st === "text_sent" && nudgeDue(l, now)) out.push({ lead: l, kind: "nudge", what: "Send one nudge", done: "nudged", doneLabel: "Nudged", text: nudge(l, s) });
    });
    return out.sort(function (a, b) {
      if (a.kind !== b.kind) return a.kind === "text" ? -1 : 1;
      return String(a.lead.reviewTextSentAt || a.lead.reviewAskedAt || "").localeCompare(String(b.lead.reviewTextSentAt || b.lead.reviewAskedAt || ""));
    });
  }

  // The last `days` days of finished jobs: how many were asked, texted and reviewed.
  function stats(leads, now, days) {
    now = now || new Date();
    days = days || 30;
    var done = leads.filter(function (l) {
      var d = daysSince(l.completedAt, now);
      return d !== null && d >= 0 && d < days;
    });
    var asked = done.filter(function (l) { return ["asked_in_person", "text_sent", "nudged", "reviewed", "declined"].indexOf(statusOf(l)) !== -1; }).length;
    var texts = done.filter(function (l) { return !!l.reviewTextSentAt; }).length;
    var reviewed = done.filter(function (l) { return statusOf(l) === "reviewed"; }).length;
    return {
      done: done.length,
      asked: asked,
      texts: texts,
      reviewed: reviewed,
      askRate: done.length ? asked / done.length : null,
      reviewRate: done.length ? reviewed / done.length : null,
    };
  }

  root.ILReviews = {
    STATUSES: STATUSES,
    LABELS: LABELS,
    DEFAULTS: DEFAULTS,
    NUDGE_DAYS: NUDGE_DAYS,
    RULES: RULES,
    SCRIPT: SCRIPT,
    settings: settings,
    text: text,
    nudge: nudge,
    reply: reply,
    daysSince: daysSince,
    isDone: isDone,
    statusOf: statusOf,
    step: step,
    patch: patch,
    completePatch: completePatch,
    due: due,
    stats: stats,
  };
})(typeof window !== "undefined" ? window : this);

/*
  Job checklists from the SOPs: which lists a job gets, its frozen copy of them, progress,
  sign-off, and the dashboard numbers.

  Plain logic only (no page, no database), so the page and the tests share it. The page loads it
  as window.ILJobs. Records it works with (all in the docs table):

    sops/<key>        one SOP template: { key, name, sort, intro, outro, sections: [{ id, name,
                      heading, headingNote, intro, style, needs, items: [{ id, type, title, detail,
                      subs, required, when, length, purpose, ... }] }] }
    settings/sop      { services: { <service>: { templates, stopAfter, pitch } }, paintMin,
                      paintSpread, admins }
    checklists/<id>   the job's frozen copy of its templates (id = the lead's id)
    jobs/<id>         the job's progress. One key per tick, so two phones never overwrite each
                      other: "s:<itemId>": { done, skipped, reason, note, by, at }, and
                      "p:<panel>": { label, r: [5 readings], note }, correction, warranty,
                      ceramicPitched, planPitched, signoff { by, at }, override { by, reason, at }.
*/
(function (root) {
  var PANELS = [
    ["bonnet", "Bonnet"], ["roof", "Roof"], ["boot", "Boot"],
    ["front-left-guard", "Front left guard"], ["front-right-guard", "Front right guard"],
    ["front-left-door", "Front left door"], ["front-right-door", "Front right door"],
    ["rear-left-door", "Rear left door"], ["rear-right-door", "Rear right door"],
    ["rear-left-quarter", "Rear left quarter"], ["rear-right-quarter", "Rear right quarter"],
  ].map(function (p) { return { key: p[0], label: p[1] }; });
  var DEFAULTS = { paintMin: 80, paintSpread: 30, admins: ["Angus"] };

  function clone(x) {
    return x == null ? x : JSON.parse(JSON.stringify(x));
  }
  function byId(list) {
    var m = {};
    (list || []).forEach(function (x) { m[x.key] = x; });
    return m;
  }
  function sorted(sops) {
    return (sops || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  function settings(saved) {
    var s = saved || {};
    return {
      services: s.services || {},
      paintMin: typeof s.paintMin === "number" ? s.paintMin : DEFAULTS.paintMin,
      paintSpread: typeof s.paintSpread === "number" ? s.paintSpread : DEFAULTS.paintSpread,
      admins: Array.isArray(s.admins) && s.admins.length ? s.admins : DEFAULTS.admins,
    };
  }
  function isAdmin(who, set) {
    return !!who && settings(set).admins.indexOf(who) !== -1;
  }

  function servicesOf(lead) {
    if (lead && Array.isArray(lead.services) && lead.services.length) return lead.services.slice();
    return [(lead && lead.service) || "Not sure"];
  }

  /*
    The templates a job gets: every service's list, combined without repeats, in the templates'
    own order. stopAfter cuts a template's steps after one item (correction and ceramic stop the
    exterior list at the rinse). The pitch is the plan pitch if any service is a ceramic one.
  */
  function plan(services, sops, set) {
    var mapping = settings(set).services;
    var want = {}, stopAfter = {}, pitch = null;
    (services || []).forEach(function (sv) {
      var m = mapping[sv] || mapping["Not sure"] || { templates: sorted(sops).map(function (t) { return t.key; }) };
      (m.templates || []).forEach(function (k) { want[k] = true; });
      Object.keys(m.stopAfter || {}).forEach(function (k) { stopAfter[k] = m.stopAfter[k]; });
      if (m.pitch === "plan" || !pitch) pitch = m.pitch || pitch;
    });
    var keys = sorted(sops).map(function (t) { return t.key; }).filter(function (k) { return want[k]; });
    return { keys: keys, stopAfter: stopAfter, pitch: pitch || "ceramic" };
  }

  // The job's own copy of its lists. Later SOP edits never reach it.
  function buildChecklist(lead, sops, set, nowIso) {
    var services = servicesOf(lead);
    var p = plan(services, sops, set);
    var tpls = byId(sops);
    var keep = function (x) { return !x.needs || p.keys.indexOf(x.needs) !== -1; };
    var templates = p.keys.map(function (k) {
      var t = tpls[k], stop = p.stopAfter[k], stopped = false;
      var sections = (t.sections || []).filter(keep).map(function (s) {
        var items = (s.items || []).filter(keep).filter(function (it) {
          if (it.type !== "step") return true;
          if (stopped) return false;
          if (stop && it.id === stop) stopped = true;
          return true;
        }).map(clone);
        var c = clone(s);
        c.items = items;
        return c;
      }).filter(function (s) { return s.items.length || s.intro; });
      return { key: t.key, name: t.name, intro: t.intro || "", sections: sections };
    });
    var steps = [], clips = [], signoffs = [];
    templates.forEach(function (t) {
      t.sections.forEach(function (s) {
        s.items.forEach(function (it) {
          if (it.type === "step" && it.required !== false) steps.push(it.id);
          if (it.type === "clip") clips.push(it.id);
          if (it.type === "signoff") signoffs.push(it.id);
        });
      });
    });
    return {
      snapshot: { leadId: lead.id, createdAt: nowIso, services: services, templates: templates },
      job: { leadId: lead.id, createdAt: nowIso, services: services, templateKeys: p.keys, pitch: p.pitch, steps: steps, clips: clips, signoffs: signoffs },
    };
  }
  // The service changed after booking: the lists need rebuilding (ticks are kept by item id).
  function needsRebuild(job, lead) {
    return !!job && JSON.stringify(job.services || []) !== JSON.stringify(servicesOf(lead));
  }

  function state(job, id) {
    return (job && job["s:" + id]) || null;
  }
  function settled(st) {
    return !!(st && (st.done || st.skipped));
  }
  function progress(job) {
    var steps = (job && job.steps) || [], clips = (job && job.clips) || [], sign = (job && job.signoffs) || [];
    return {
      done: steps.filter(function (id) { return settled(state(job, id)); }).length,
      total: steps.length,
      skipped: steps.filter(function (id) { var s = state(job, id); return !!(s && s.skipped); }).length,
      clipsDone: clips.filter(function (id) { var s = state(job, id); return !!(s && s.done); }).length,
      clipsTotal: clips.length,
      signDone: sign.filter(function (id) { var s = state(job, id); return !!(s && s.done); }).length,
      signTotal: sign.length,
    };
  }
  // Whoever ticked the most steps. On a tie, whoever ticked last.
  function mainWorker(job) {
    var count = {}, last = {};
    ((job && job.steps) || []).forEach(function (id) {
      var s = state(job, id);
      if (!settled(s) || !s.by) return;
      count[s.by] = (count[s.by] || 0) + 1;
      if (!last[s.by] || String(s.at) > last[s.by]) last[s.by] = String(s.at || "");
    });
    var best = null;
    Object.keys(count).forEach(function (p) {
      if (!best || count[p] > count[best] || (count[p] === count[best] && last[p] > last[best])) best = p;
    });
    return best;
  }
  // Can `who` tick the sign-off list? Every step settled, and not the person who did most of it.
  function canSignOff(job, who) {
    var pr = progress(job);
    if (pr.done < pr.total) return { ok: false, reason: "steps", left: pr.total - pr.done };
    var main = mainWorker(job);
    if (main && who === main) return { ok: false, reason: "same", main: main };
    if (!who) return { ok: false, reason: "who" };
    return { ok: true, main: main };
  }
  function signOffPatch(job, who, nowIso) {
    if (!canSignOff(job, who).ok) return null;
    var pr = progress(job);
    if (pr.signDone < pr.signTotal) return null;
    return { signoff: { by: who, at: nowIso } };
  }
  function isSignedOff(job) {
    return !!(job && (job.signoff || job.override));
  }
  // An admin can let a job through without the sign-off, with a written reason.
  function overridePatch(who, reason, set, nowIso) {
    if (!isAdmin(who, set)) throw new Error("Only " + settings(set).admins.join(" or ") + " can override the sign-off.");
    var r = String(reason || "").trim();
    if (!r) throw new Error("Write why.");
    return { override: { by: who, reason: r, at: nowIso } };
  }
  function canMarkDone(job) {
    return isSignedOff(job);
  }
  // Marking the job done starts the review flow (reviewStatus "not_asked"). Null until signed off.
  function donePatch(lead, job, nowIso, reviews) {
    if (!canMarkDone(job)) return null;
    return reviews.completePatch(lead, nowIso);
  }

  function paintFlags(reading, set) {
    var s = settings(set);
    var r = ((reading && reading.r) || []).map(function (v) { return v === "" || v == null || isNaN(Number(v)) ? null : Number(v); });
    var vals = r.filter(function (v) { return v !== null; });
    var low = [];
    r.forEach(function (v, i) { if (v !== null && v < s.paintMin) low.push(i); });
    var spread = vals.length >= 2 ? Math.max.apply(null, vals) - Math.min.apply(null, vals) : 0;
    return { low: low, spread: spread, bigJump: spread > s.paintSpread };
  }

  function addYear(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
    if (!m) return "";
    var y = Number(m[1]) + 1, mo = m[2], d = m[3];
    if (mo === "02" && d === "29") d = "28";
    return y + "-" + mo + "-" + d;
  }
  function warrantyDefaults(lead, today) {
    var date = (lead && lead.jobDate) || today || "";
    return { customer: (lead && lead.name) || "", car: (lead && lead.car) || "", rego: "", date: date, package: "", product: "", batch: "", layers: "", photos: "", annualCheck: addYear(date) };
  }

  function quoted(text) {
    var m = /"([^"]+)"/.exec(text || "");
    return m ? m[1] : text || "";
  }
  // The handover scripts for this job: the right pitch, the referral line and the review ask.
  function handoverScripts(snapshot, job, lead) {
    var out = [], pitchItem = null, referral = null, review = null;
    ((snapshot && snapshot.templates) || []).forEach(function (t) {
      t.sections.forEach(function (s) {
        s.items.forEach(function (it) {
          if (it.type === "script" && it.pitch === ((job && job.pitch) || "ceramic")) pitchItem = it;
          if (it.script === "referral") referral = it;
          if (it.script === "review") review = it;
        });
      });
    });
    if (pitchItem) {
      var text = quoted(pitchItem.detail);
      if (lead && lead.car) text = text.replace("[car]", lead.car);
      out.push({ key: "pitch", label: pitchItem.title.replace(/:$/, ""), text: text });
    }
    if (referral) out.push({ key: "referral", label: "Referral line", text: quoted(referral.detail) });
    if (review) out.push({ key: "review", label: "Review ask", text: quoted(review.detail) });
    return out;
  }

  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function shift(now, days) {
    return ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
  }
  // Jobs earlier this week (Monday to yesterday) that aren't signed off. Today's are still under way;
  // quick "Add a job" records have no checklist.
  function unsigned(jobs, leads, now) {
    now = now || new Date();
    var today = ymd(now), monday = shift(now, -((now.getDay() + 6) % 7));
    return (leads || []).filter(function (l) {
      return l.status === "Booked" && l.jobDate && l.jobDate >= monday && l.jobDate < today && l.kind !== "job" && !isSignedOff(jobs[l.id]);
    }).sort(function (a, b) { return a.jobDate.localeCompare(b.jobDate); });
  }
  // The last `days` days of jobs with a checklist.
  function stats(jobs, leads, now, days) {
    now = now || new Date();
    days = days || 30;
    var today = ymd(now), from = shift(now, -(days - 1));
    var list = (leads || []).filter(function (l) { return l.jobDate && l.jobDate >= from && l.jobDate <= today && jobs[l.id]; }).map(function (l) { return jobs[l.id]; });
    var skipped = 0, filmed = 0, clips = 0, cerAsked = 0, cerYes = 0, planAsked = 0, planYes = 0;
    list.forEach(function (j) {
      var p = progress(j);
      skipped += p.skipped;
      filmed += p.clipsDone;
      clips += p.clipsTotal;
      if (j.pitch === "plan") { planAsked++; if (j.planPitched === "Yes") planYes++; }
      else { cerAsked++; if (j.ceramicPitched === "Yes") cerYes++; }
    });
    return {
      jobs: list.length,
      skippedPerJob: list.length ? skipped / list.length : null,
      clipsFilmed: filmed,
      clipsExpected: clips,
      ceramicPitchedRate: cerAsked ? cerYes / cerAsked : null,
      planPitchedRate: planAsked ? planYes / planAsked : null,
    };
  }

  // The SOPs as markdown, in the same layout as the original Appendix.
  function markdown(sops) {
    var out = [];
    var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; };
    sorted(sops).forEach(function (t) {
      out.push("## " + t.name, "");
      if (t.intro) out.push(t.intro, "");
      (t.sections || []).forEach(function (s) {
        if (s.heading !== false) out.push("**" + s.name + "**" + (s.headingNote ? " " + s.headingNote : ""), "");
        if (s.intro) out.push(s.intro, "");
        var items = s.items || [];
        if (s.style === "clips") {
          out.push("| When | Clip | Length | What it's for |", "| --- | --- | --- | --- |");
          items.forEach(function (it) { out.push("| " + cap(it.when) + " | " + it.title + " | " + (it.length || "") + " | " + (it.purpose || "") + " |"); });
          out.push("");
        } else if (s.style === "scripts") {
          items.forEach(function (it) { out.push(it.title, it.detail, ""); });
        } else if (items.length) {
          items.forEach(function (it, n) {
            var text = it.title ? "**" + it.title + "**" + (it.detail ? " " + it.detail : "") : it.detail;
            if (s.style === "checks") out.push("- [ ] " + text);
            else if (s.style === "bullets") out.push("- " + text);
            else out.push(n + 1 + ". " + text);
            (it.subs || []).forEach(function (sub) { out.push("    - " + sub); });
          });
          out.push("");
        }
      });
      if (t.outro) out.push(t.outro, "");
    });
    while (out.length && out[out.length - 1] === "") out.pop();
    return out.join("\n") + "\n";
  }

  root.ILJobs = {
    PANELS: PANELS,
    DEFAULTS: DEFAULTS,
    settings: settings,
    isAdmin: isAdmin,
    servicesOf: servicesOf,
    plan: plan,
    buildChecklist: buildChecklist,
    needsRebuild: needsRebuild,
    state: state,
    settled: settled,
    progress: progress,
    mainWorker: mainWorker,
    canSignOff: canSignOff,
    signOffPatch: signOffPatch,
    isSignedOff: isSignedOff,
    overridePatch: overridePatch,
    canMarkDone: canMarkDone,
    donePatch: donePatch,
    paintFlags: paintFlags,
    addYear: addYear,
    warrantyDefaults: warrantyDefaults,
    handoverScripts: handoverScripts,
    unsigned: unsigned,
    stats: stats,
    markdown: markdown,
  };
})(typeof window !== "undefined" ? window : this);

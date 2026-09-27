import { addDays, dayName, localDate, longDay } from "./time.js";

/*
  The morning chase list and the evening "not logged yet" list, worked out exactly as the app's
  Morning and Evening tabs do, and written in the app's words.
*/

const isOpen = (l) => !["Booked", "Lost"].includes(l.status);
const money = (n) => "$" + Math.round(n || 0).toLocaleString("en-AU");
const plural = (n, one, many) => (n === 1 ? one : many);

function migrate(d) {
  if (!d.status) d.status = d.booked === "Yes" ? "Booked" : d.booked === "No" ? "Lost" : d.quoted != null ? "Quoted" : d.replyMins != null ? "Contacted" : "New";
  if (!d.log) d.log = [];
  return d;
}

export function asLeads(rows) {
  return rows.map((r) => migrate({ id: r.id, ...r.data }));
}

/** Follow up today: open leads due (or with no date), New first, then the longest overdue. */
export function chaseList(leads, today) {
  return leads
    .filter((l) => isOpen(l) && (!l.nextFollowUp || l.nextFollowUp <= today))
    .sort((a, b) => (a.status === "New" ? 0 : 1) - (b.status === "New" ? 0 : 1) || (a.nextFollowUp || "").localeCompare(b.nextFollowUp || ""));
}

export function jobsOn(leads, date) {
  return leads.filter((l) => l.status === "Booked" && l.jobDate === date).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

const loggedOn = (l, today) => (l.log || []).some((e) => localDate(e.at) === today);

/** Leads to log: new today or due, and not logged yet. A job added with "Add a job" isn't a lead to log. */
export function toLogList(leads, today) {
  return leads.filter((l) => l.kind !== "job" && (l.date === today || (isOpen(l) && l.nextFollowUp && l.nextFollowUp <= today)) && !loggedOn(l, today));
}

function leadLine(l, today) {
  const who = `${l.name || "No name"} · ${l.car || "car?"}`;
  const about = [l.service, l.suburb, l.source ? l.source + (l.ad ? ` (${l.ad})` : "") : ""].filter(Boolean).join(" · ");
  const when =
    l.status === "New" && l.date === today
      ? "New today"
      : l.nextFollowUp && l.nextFollowUp < today
        ? `Overdue since ${dayName(l.nextFollowUp)}`
        : l.status === "New"
          ? "New"
          : "Due today";
  return { who, about, phone: l.phone || "", when };
}

function jobLine(l) {
  return {
    who: `${l.name || "No name"} · ${l.car || "car?"}`,
    about: [l.service, l.suburb, l.revenue != null ? money(l.revenue) : l.quoted != null ? money(l.quoted) : ""].filter(Boolean).join(" · "),
    phone: l.phone || "",
    when: "",
  };
}

export function morningEmail(leads, today, name, appUrl) {
  const chase = chaseList(leads, today);
  const jobs = jobsOn(leads, today);
  const overdue = chase.filter((l) => l.nextFollowUp && l.nextFollowUp < today).length;
  const sub = `${longDay(today)} · ${chase.length} to chase${overdue ? ` (${overdue} overdue)` : ""} · ${jobs.length} ${plural(jobs.length, "job", "jobs")} today`;
  const subject = `Morning: ${chase.length} to chase${overdue ? `, ${overdue} overdue` : ""} · ${jobs.length} ${plural(jobs.length, "job", "jobs")} today`;
  const sections = [
    {
      title: `Follow up today (${chase.length})`,
      help: "New leads first, then anyone due a chase. Log each one in the app.",
      lines: chase.map((l) => leadLine(l, today)),
      empty: "Nobody to chase. Go get more leads.",
    },
    { title: `Jobs today (${jobs.length})`, help: "", lines: jobs.map(jobLine), empty: "No jobs booked for today." },
  ];
  const tomorrow = jobsOn(leads, addDays(today, 1));
  if (tomorrow.length) sections.push({ title: `Tomorrow (${tomorrow.length})`, help: "", lines: tomorrow.map(jobLine), empty: "" });
  return render({ subject, heading: `Morning${name ? ", " + name : ""}`, sub, sections, appUrl });
}

export function eveningEmail(leads, today, name, appUrl) {
  const todo = toLogList(leads, today);
  const subject = `Evening: ${todo.length} ${plural(todo.length, "lead", "leads")} still to log`;
  const sections = [
    {
      title: `Leads to log (${todo.length} to go)`,
      help: "Anyone new today, due today, or that you talked to. Log each one, then close the day.",
      lines: todo.map((l) => leadLine(l, today)),
      empty: "Nothing to log today.",
    },
  ];
  return { ...render({ subject, heading: `Evening${name ? ", " + name : ""}`, sub: "Log every lead you touched today, then close the day.", sections, appUrl }), count: todo.length };
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function render({ subject, heading, sub, sections, appUrl }) {
  const text = [
    heading,
    sub,
    "",
    ...sections.flatMap((s) => [
      s.title,
      ...(s.help ? [s.help] : []),
      ...(s.lines.length ? s.lines.map((l) => `- ${l.who}${l.about ? " — " + l.about : ""}${l.phone ? " · " + l.phone : ""}${l.when ? " · " + l.when : ""}`) : [s.empty]),
      "",
    ]),
    appUrl ? `Open Imperium Leads: ${appUrl}` : "",
  ]
    .filter((x, i, a) => !(x === "" && a[i - 1] === ""))
    .join("\n")
    .trim();

  const line = (l) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #D6DCE4">` +
    `<div style="font-weight:700">${esc(l.who)}</div>` +
    (l.about ? `<div style="color:#5C6675;font-size:13px">${esc(l.about)}</div>` : "") +
    (l.phone ? `<div style="font-size:13px"><a href="tel:${esc(l.phone.replace(/\s+/g, ""))}" style="color:#1F5FD6">${esc(l.phone)}</a></div>` : "") +
    (l.when ? `<div style="font-size:12px;font-weight:700;color:${l.when.startsWith("Overdue") ? "#D6453D" : "#D98A0B"}">${esc(l.when)}</div>` : "") +
    `</td></tr>`;
  const html =
    `<div style="font-family:Montserrat,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#121721;max-width:560px;margin:0 auto;padding:16px;font-size:15px;line-height:1.45">` +
    `<div style="font-weight:700;letter-spacing:.32em;font-size:12px">IMPERIUM <span style="color:#1F5FD6">LEADS</span></div>` +
    `<h1 style="font-size:20px;margin:12px 0 2px">${esc(heading)}</h1><p style="color:#5C6675;margin:0 0 16px;font-size:13px">${esc(sub)}</p>` +
    sections
      .map(
        (s) =>
          `<h2 style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#5C6675;margin:20px 0 4px">${esc(s.title)}</h2>` +
          (s.help ? `<p style="color:#5C6675;font-size:12px;margin:0 0 4px">${esc(s.help)}</p>` : "") +
          (s.lines.length ? `<table style="width:100%;border-collapse:collapse">${s.lines.map(line).join("")}</table>` : `<p style="color:#5C6675">${esc(s.empty)}</p>`),
      )
      .join("") +
    (appUrl ? `<p style="margin-top:24px"><a href="${esc(appUrl)}" style="display:inline-block;background:#1F5FD6;color:#fff;font-weight:700;padding:12px 18px;border-radius:12px;text-decoration:none">Open Imperium Leads</a></p>` : "") +
    `</div>`;
  return { subject, text, html };
}

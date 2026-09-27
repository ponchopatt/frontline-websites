// Copies each booking and fleet enquiry into Imperium Leads, the team's lead tracker.
//
// Fire and forget: it never waits, never throws, and never touches the Web3Forms send, so a
// slow or broken tracker can't cost a lead. With NEXT_PUBLIC_LEADS_API unset it does nothing.
//
// No secret is sent: anything shipped to the browser can be read by anyone. The tracker lets
// these in because they come from this site's own address.

const endpoint = process.env.NEXT_PUBLIC_LEADS_API ?? "";
const UTM_KEY = "imperium-utm";

type Utm = { source: string; content: string };

// Where the visitor came from: this page's utm_source/utm_content, or the ones they landed with
// earlier in this visit (an ad that lands on the home page, then they tap through to /book).
function utm(): Utm {
  try {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source") ?? "";
    const content = params.get("utm_content") ?? "";
    if (source || content) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify({ source, content }));
      return { source, content };
    }
    const saved = sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved) as Utm;
  } catch {}
  return { source: "", content: "" };
}

// Remember the landing UTMs as soon as a page with a form loads.
if (typeof window !== "undefined") utm();

// "Meta ad · Kluger", "Google · Ceramic", "TikTok", or "Website".
function sourceLabel({ source, content }: Utm): string {
  const s = source.toLowerCase();
  const name = /meta|facebook|instagram|^fb$|^ig$/.test(s) ? "Meta ad" : s.includes("google") ? "Google" : s.includes("tiktok") ? "TikTok" : source ? source : "Website";
  return content ? `${name} · ${content}` : name;
}

export type LeadPayload = {
  name: string;
  phone: string;
  email?: string;
  service?: string;
  vehicle?: string;
  suburb?: string;
  when?: string;
  notes?: string;
  form: "booking" | "fleet";
};

export function sendToLeads(lead: LeadPayload): void {
  if (!endpoint) return;
  try {
    const body = JSON.stringify({ ...lead, source: sourceLabel(utm()) });
    // text/plain keeps it a simple request (no preflight), and keepalive lets it finish even if
    // the page moves on.
    void fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

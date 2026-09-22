# Frontline Websites

Every client site Frontline Systems has built, plus the design skills used to build them.
Kept separate from the trading project so the two never mix.

## Sites

| Folder | Client | What it is | Live at |
|---|---|---|---|
| `sites/imperium-detailing` | Imperium Detailing | Mobile car detailing, Canberra. Next.js, many pages, price calculators, booking form, service-area and guide pages. | imperiumdetailing.com.au |
| `sites/canberra-to-coast-fencing` | Canberra to Coast Fencing | Colorbond fencing, Canberra. One page, static. Price guide, colour picker on a real photo, quote form. | not live yet |
| `sites/crossroads-church` | Crossroads Christian Church | Canberra church. About 50 pages built by a Python generator. | not live yet |
| `sites/frontline-systems` | Frontline Systems | Our own site. Static. | frontlinesystems.com.au |
| `sites/clock` | Imperium Detailing | Staff clock-in and timesheet web app. One page, three tabs, Google Sheets backend. | not live yet |

## How each one is built

**Static, no build step** (`canberra-to-coast-fencing`, `frontline-systems`, `clock`)
Upload the folder as-is to Vercel, Netlify or Cloudflare Pages. Nothing to install.

**Python generator** (`crossroads-church`)
Edit `data.py` and the content files, then `python3 build.py` writes the HTML pages.
`python3 build.py --portable <dir>` makes a version that opens from a local folder.

**Next.js** (`imperium-detailing`)
```
cd sites/imperium-detailing
npm install
npm run dev      # local preview
npm run build    # production build
npm run check    # the site's own checks
```

## Deploying one site to Vercel

Import this repo, then set **Root Directory** to the site's folder, for example
`sites/canberra-to-coast-fencing`. That is the setting people forget. Without it Vercel
looks at the repo root and the build fails.

One Vercel project per site. They all sit in this one repo.

## The design skills

`.claude/skills/` holds the 10 skills used on these builds, so they travel with the work:

- **frontend-design**, **ui-ux-pro-max**, **ui-styling**, **web-design-guidelines** for layout, interaction and quality checks
- **brand**, **design-system**, **theme-factory**, **uupm-design** for colour, type and tokens
- **banner-design**, **slides** for marketing pieces

They load on their own when a job matches. Nothing to install.

## Starting a new client site

1. Copy the closest existing site into `sites/<client-name>`.
2. Swap the photos, colours, copy and contact details.
3. New Vercel project, Root Directory set to that folder.

`canberra-to-coast-fencing` is the best starting point for a one-page trade business.
Its README lists the six pre-launch steps, four of which need the client to confirm them.

# Driven Detailing — the live site, ready to go

The site for drivendetailing.com.au (Seb Smith, mobile car detailing, Wantirna South).
It's the pitch demo in `demos/driven-detailing`, made ready to replace their current site.
**Don't put it live until Seb says yes.** Until then the demo stays the only public copy,
and it's hidden from Google.

What's different from the demo:

- **Google can find it.** There's no noindex tag or header. It has a canonical address, a
  `robots.txt` that allows everything, a `sitemap.xml`, and their business details in
  JSON-LD (name, phone, area, hours, ABN).
- **Their old pages still work, so their Google rankings carry over.** Every page Google
  knows about either has a new page at the same address, or redirects to the right part
  of the home page:

  | Old address | Now |
  |---|---|
  | `/` | the new home page |
  | `/interior-car-detailing/`, `/exterior-car-detailing/`, `/paint-correction/` | rebuilt in the new design, with their own words |
  | `/mobile-car-detailing/{glen-waverley,rowville,wheelers-hill,ferntree-gully,wantirna}/` | rebuilt in the new design, with their own words |
  | `/privacy.html` | their own policy, word for word |
  | `/book/` | redirects to `/#book` |
  | `/referrals/` | redirects to `/#refer` |
  | `/car-detailing-membership/`, `/car-detailing-membership/join/` | redirect to `/` (Driven+ is gone) |

- **Booking calendar slot.** Paste Seb's GoHighLevel booking link into `BOOKING_URL` at
  the top of `app.js`, and the booking section shows his calendar instead of the 3-step
  form that texts him. The ad's tracking tags (`utm_…`, `fbclid`, `gclid`) are passed on
  to the calendar.
- **A quote form that sends.** A one-screen form like Imperium's (the detail, when, car,
  suburb, name, mobile, and optional email and notes). It emails each request to Seb
  through Web3Forms once `QUOTE_KEY` at the top of `app.js` is set (see below). Until then,
  and if a send ever fails, it hands the customer a text to Seb with everything filled in.
- **A footer** with links to the services, the suburbs and the privacy policy.
- **Root paths** (`/assets/…`), so the same header and footer work on every page.

## Files

    index.html     the home page, written by hand
    app.js         the prices, the price picker, the booking, the slider. BOOKING_URL is at the top.
    styles.css     all the styles, the inner pages' at the end
    content.mjs    the words on the inner pages
    build.mjs      writes the inner pages and sitemap.xml
    vercel.json    the redirects, headers and trailing slashes

The inner pages are built, not written by hand. Their header, footer and phone bar are
copied from `index.html` (between its `shared:` comments), and their prices are read from
`app.js`. After changing `index.html`'s header or footer, `app.js`'s prices, or
`content.mjs`, run this and commit what it writes:

    node build.mjs

Vercel serves the files as they are, with no build step.

## The quote form's key

1. Go to web3forms.com and enter the email Seb wants the requests sent to.
2. Web3Forms emails that address an access key.
3. Paste the key into `QUOTE_KEY` at the top of `app.js` and push. It's safe to have in the
   page: it can only send to that one address.
4. Send a test request from the live site and check it arrives.

Each email's subject is "Quote request: [detail] in [suburb]", and replying goes straight to
the customer when they gave an email.

## Going live, once Seb says yes

1. **Merge the PR** that adds this folder.
2. **Seb's booking calendar.** Make it in GoHighLevel and paste its booking link into
   `BOOKING_URL` in `app.js`. Make a test booking.
3. **Vercel.** Either change the demo project (Settings: Root Directory to
   `sites/driven-detailing`, Production Branch to `main`), or import a new project with
   that root directory. Then Settings, then Domains: add `drivendetailing.com.au` and
   `www.drivendetailing.com.au`. Vercel shows the 2 DNS records to use.
4. **Hostinger** (his domain and DNS are there, nameservers `dns-parking.com`). In hPanel,
   go to Domains, then DNS:
   - delete the 2 old A records for `@` and add the one Vercel shows;
   - point `www` to the CNAME Vercel shows (turn off Hostinger's CDN if it holds `www`);
   - **leave the MX records alone.** His email runs on Hostinger.
5. **Check it.** Open every old address in the table above. Book a test detail.
6. **Google Search Console.** Submit `https://www.drivendetailing.com.au/sitemap.xml`. The
   site's main address is the `www` one, because Vercel sends `drivendetailing.com.au` there.
7. **Take down the demo.** Delete the demo's Vercel project, and the `demos/driven-detailing`
   folder (and its copy on `claude/clever-gates-o4atph`), as `demos/README.md` says.

## To confirm with Seb before it goes live

- **The prices.** They're the ones Pat set, not the ones on his old site:
  - Full Detail $225 / $260 / $290 and Interior $140 / $165 / $170, both up to $60 more for condition;
  - Paint Correction on a hatch or sedan $347 single-step, $547 two-step, and quoted for bigger cars;
  - Exterior $110 / $125 / $140 and Maintenance $165 / $185 / $200;
  - add-ons: Tyre Endurance Gel $20, Engine Bay $80, Trim Restoration from $100, Headlight
    Restoration $150, Glass Polish and Light Scratch Removal quoted, and the interior add-ons as before.
    Rain repellent, clay bar, spray-on ceramic and wax are gone as add-ons (clay bar and ceramic
    are in every Full and Exterior Detail).
- **The referral offer** still gives the friend a free rain repellent, which is no longer an add-on.
- **Driven+ is gone** from the site, and its old pages redirect to the home page. He'll
  need to tell his current members.
- **The privacy policy** is his own, word for word. It names Offsider Agency as his
  marketing partner and mentions memberships. If Frontline takes over from Offsider, it
  needs updating.
- **"5.0 from 50+ Google reviews"** is his own claim. Check it on Google.

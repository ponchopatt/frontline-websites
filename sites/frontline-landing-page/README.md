# Frontline landing page

The detailer offer page (4 weeks of free marketing for 3 detailers) as its own
site, with the page at the home address instead of `/detailers/`. Static files,
no build step.

    index.html          the page
    styles.css, app.js  its styles and script (CONFIG at the top of app.js)
    booked/             where people land after booking
    privacy/            privacy policy (with its own stylesheet, site.css)
    assets/             font, logo, proof screens, app screens, share image

On Vercel: Root Directory `sites/frontline-landing-page`, Framework Preset
"Other", no build command.

It's a copy of `sites/frontline-systems/detailers/` (the cut-back landing page). The README there has the
CONFIG table and the claims to check before it goes live. Change both copies
together, or retire one.

# Demo quality bar — every demo must pass this

## The standard
Nulook Pools (/clients/nulook-pools) is the reference demo once approved. Every demo must look and read at that level. If a demo would embarrass me in front of the owner, it fails.

## Brief first (clients/<slug>/BRIEF.md, written BEFORE building)
- Who they are in one line, owner/key people's names (pull from Google reviews), years, area, main services, job size.
- What customers praise, in their words (3–5 themes from reviews).
- ONE angle: the single reason to pick them. The hero headline comes from this.
- What's weak on their current site (for my call).
- A photo inventory: every usable image, its size, what it shows.

## Photos
- Only their own photos (current site first; Google Maps / Facebook / Instagram only if I provide them).
- Hero image at least 1600px wide and sharp. If none is good enough, pick the best one, crop it well and flag it.
- Gallery: 6 is ideal, 4 is the minimum. No blurry, tiny, watermarked, logo, clip-art or screenshot images. No stretched or pixelated images.
- Upscale only with a proper AI upscaler, max 2x, and flag it.
- No stock photos. If there aren't enough photos, hide the gallery and flag it.
- Every image has real alt text and a caption that says what the job was.

## Words
- Written for THIS business. If a sentence would work for any business in that trade, rewrite it.
- Use the owner's first name and suburbs they actually work in.
- Plain Australian English. Short sentences. No "elevate", "seamless", "unparalleled", "bespoke solutions", "look no further".
- Never invent facts: years, awards, licences, numbers, prices, guarantees. Unsure = leave out + flag.

## Reviews
- From data/google_reviews_top25.json, word for word, with names as published. 4–6 of the strongest, varied.
- Never edit a review's wording. Reviews marked "shortened" are allowed in demos only.
- Show the real Google rating and count. Never round up.

## Technical
- Passes npm run check with zero warnings.
- Lighthouse mobile: performance 90+, accessibility 95+.
- Screenshots at 390px and 1440px. Nothing overlaps, cut off, empty, or showing "0".
- Phone number correct and tappable. SMS button pre-filled. Demo form works.
- noindex + demo banner + demo footer line present.

## Reviewer scorecard (1–5 each, must average 4.5+, nothing below 4)
1. Hero: would the owner say "that's us"?
2. Photos: sharp, real, well cropped?
3. Words: specific to them, no filler?
4. Proof: reviews, rating, real facts, well placed?
5. Mobile: looks premium on a phone?
6. Call to action: can a customer call or text within 3 seconds?

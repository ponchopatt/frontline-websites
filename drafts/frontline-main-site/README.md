# Frontline main site: sections cut from the detailer landing page

The detailer landing page (`sites/frontline-systems/detailers/`) was cut back to one job,
watch the video and book the call, to match Syncova's funnel. What came off it is kept
here for the main site later. Nothing in this folder is deployed.

    index.html   the full page as it was before the cut (25 Oct 2026)
    styles.css   its styles
    app.js       its script: calculators, the 4-question form with the locked calendar

## The sections to reuse

- **The two calculators.** "How much is slow follow-up costing you?" and "What could $2,000
  of ads do for you?" They print their answers on the docket.
- **The problem.** "Most detailers don't have a lead problem. They have a follow-up
  problem." The 3 points come with it. The speed-to-lead line cites Harvard Business
  Review (2011, 1.25 million leads).
- **The system.** "One system that answers, chases and books for you." It has 5 parts
  and the 3 app screens, which use made-up data.
- **How it works.** 4 numbered steps.
- **The rest.**
  - Is this for you / not for you.
  - The FAQ, all 7 questions.
  - Patrick's bio.
  - The offer box with why it's free and why only 3, and the spot boxes.
- **The 4-question booking form.** Name, email and mobile, then business and town, then jobs
  a week and ad budget (tap buttons). After that a GHL calendar opens with the details
  filled in. It posts `started` and `answered` to a webhook.

## Before reusing

- The page loads its assets from `/detailers/assets/`, so it only works next to the
  live page, or with those paths changed.
- **The $41.7K label.** The docket here reads "Work done in 4 weeks" under the ad numbers,
  and its total rule makes $41.7K look like what the ads made. The landing page now says
  "Imperium's total work in the same 4 weeks", in a separate box. Use that.
- **The ad calculator's numbers.** Its defaults give $4.38 back per $1 of ads, and that
  sits badly next to the $41.7K. Keep the two apart, or explain both.

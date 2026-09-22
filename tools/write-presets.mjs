/**
 * One-shot writer for presets/*.json.
 *
 * The presets are meant to be edited by hand afterwards — this just lays them
 * down consistently so all thirteen have the same shape. Re-running it
 * OVERWRITES them, so do not re-run it once you have edited a preset.
 *
 *   node tools/write-presets.mjs
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'presets');

/** Shared steps, worded so they read for any trade that quotes on site. */
const siteVisitProcess = (who = 'We') => [
  { step: 'Tell us about the job', detail: 'A few details and a photo or two is enough to get started. No forms to print, no site visit needed yet.' },
  { step: `${who} come and look`, detail: 'We measure up, check access and talk through what you actually want, then put a fixed price in writing.' },
  { step: 'We book it in', detail: 'You pick a start date. We turn up when we said we would and leave the place tidy.' },
];

const P = {
  /* ------------------------------------------------- trust: bought on belief */

  pools: {
    template: 'trust',
    responsePromise: 'We come back to every enquiry within a day, usually the same one.',
    copy: {
      servicesTitle: 'What we build',
      processTitle: 'How a pool gets built',
      reviewsTitle: 'What owners say',
      faqTitle: 'Questions we get asked',
    },
    serviceHints: ['Concrete pools', 'Plunge pools', 'Pool and landscaping together', 'Renovations and resurfacing'],
    process: [
      { step: 'A look at the site', detail: 'Access, levels, soil and where the sun falls decide most of it. We come and see before anyone draws anything.' },
      { step: 'Design and a fixed price', detail: 'You get a plan and a price in writing, with the inclusions spelled out so nothing arrives as a surprise.' },
      { step: 'Approvals', detail: 'We handle the certifier and the paperwork. Pool fencing rules are not optional and we build to them.' },
      { step: 'Build and handover', detail: 'Excavation through to water in, then we show you how to run it.' },
    ],
    faq: [
      { q: 'How long does a pool take?', a: 'From the first dig to swimming is usually a few months, and approvals add to the front of that. We give you the real timeline at the quote rather than the one you want to hear.' },
      { q: 'Do I need council approval?', a: 'Almost always, and the pool barrier has to comply before the pool can be filled. We deal with the certifier as part of the job.' },
      { q: 'What is not in the price?', a: 'We list inclusions and exclusions in writing. Rock, difficult access and retaining are the three things that most often change a number, and we tell you before the work, never after.' },
      { q: 'Can you do the landscaping too?', a: 'Yes. Paving, fencing, decking and planting around the pool are part of the same job, which saves you coordinating two trades.' },
    ],
  },

  landscaping: {
    template: 'trust',
    responsePromise: 'We read every enquiry and come back within a day.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it runs', faqTitle: 'Questions we are asked' },
    serviceHints: ['Landscape design', 'Construction', 'Planting and turf', 'Maintenance'],
    process: [
      { step: 'Consultation', detail: 'We come to you, walk the space and talk through what you want it to do. You get a design proposal scaled to the project.' },
      { step: 'Design', detail: 'Plans, levels, materials and planting, so you can see it before anyone digs.' },
      { step: 'Build', detail: 'One crew, one job at a time, so the person who drew it is the person building it.' },
      { step: 'Handover', detail: 'We walk you through the planting and how to keep it right.' },
    ],
    faq: [
      { q: 'Do you do design as well as build?', a: 'Yes, and doing both is the point. A design drawn by someone who has to build it is a design that can actually be built to the budget.' },
      { q: 'How long does a garden take?', a: 'A courtyard can be a few weeks. A full rear yard with structures and paving runs longer. We give you a real date at the quote.' },
      { q: 'Do I need approval?', a: 'Most garden work does not. Retaining over a certain height, work near a boundary and anything structural can. We will tell you at the quote if yours does.' },
      { q: 'Can you work with my architect or builder?', a: 'Yes. Coming in early while levels and drainage are still on paper saves money later.' },
    ],
  },

  builders: {
    template: 'trust',
    responsePromise: 'We come back to every enquiry within a day.',
    copy: { servicesTitle: 'What we build', processTitle: 'How a job runs', faqTitle: 'Questions we get asked' },
    serviceHints: ['Extensions', 'Renovations', 'New homes', 'Decks and outdoor living'],
    process: [
      { step: 'First conversation', detail: 'What you want, roughly what you want to spend, and whether the two meet. Better to find out now.' },
      { step: 'Plans and a fixed price', detail: 'Drawings, then a detailed quote with the inclusions written down, so you are comparing like for like.' },
      { step: 'Approvals', detail: 'We deal with the certifier and the council so you are not chasing paperwork.' },
      { step: 'Build', detail: 'One site supervisor you can actually ring, and a schedule you can see.' },
    ],
    faq: [
      { q: 'How much does an extension cost?', a: 'It depends on size, site access and how much of the existing house gets touched. We give you a real number after we have seen it, not a per-square-metre guess over the phone.' },
      { q: 'Do you handle approvals?', a: 'Yes. Plans, certifier and council are part of the job.' },
      { q: 'Can we live in the house during the build?', a: 'Often yes, depending on what is being touched. We will be straight with you about what it will be like.' },
      { q: 'How do variations work?', a: 'In writing, priced, and approved by you before the work happens. No surprises on the final invoice.' },
    ],
  },

  'granny-flats': {
    template: 'trust',
    responsePromise: 'We come back to every enquiry within a day.',
    copy: { servicesTitle: 'What we build', processTitle: 'How it runs', faqTitle: 'Good to know' },
    serviceHints: ['One bedroom', 'Two bedroom', 'Custom designs', 'Site works and connections'],
    process: siteVisitProcess(),
    faq: [
      { q: 'Can I put one on my block?', a: 'It depends on block size, setbacks and what is already on it. We check the rules for your address before quoting.' },
      { q: 'What is included in the price?', a: 'We write inclusions and exclusions down. Site works, connections and driveway access are the three that most often sit outside a headline price elsewhere.' },
      { q: 'How long does it take?', a: 'Approvals are usually the long part. Construction itself is measured in months, not years.' },
      { q: 'Can I rent it out?', a: 'In most places yes, but the rules differ by council. We will tell you what applies to your block.' },
    ],
  },

  'kitchens-joinery': {
    template: 'trust',
    responsePromise: 'We come back to every enquiry within a day.',
    copy: { servicesTitle: 'What we make', processTitle: 'How it runs', faqTitle: 'Good to know' },
    serviceHints: ['Kitchens', 'Wardrobes and storage', 'Vanities', 'Custom joinery'],
    process: [
      { step: 'Measure and talk it through', detail: 'How you actually use the space decides the layout more than the finishes do.' },
      { step: 'Design and a fixed price', detail: 'Drawings and a quote with the hardware and materials named, so you know what you are getting.' },
      { step: 'Made to measure', detail: 'Built in the workshop to your measurements, not adjusted on site.' },
      { step: 'Install', detail: 'In and finished with the least disruption we can manage.' },
    ],
    faq: [
      { q: 'How long will my kitchen be out of action?', a: 'Usually days rather than weeks, because the cabinetry is made before we start pulling anything out.' },
      { q: 'Do you handle plumbing and electrical?', a: 'We coordinate the trades so you are not managing three diaries.' },
      { q: 'Stone or laminate?', a: 'Both have their place. We will tell you where the money actually shows and where it does not.' },
      { q: 'Can you match existing joinery?', a: 'Usually. Bring us a photo or a door and we will tell you honestly how close we can get.' },
    ],
  },

  bathrooms: {
    template: 'trust',
    responsePromise: 'We come back to every enquiry within a day.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it runs', faqTitle: 'Good to know' },
    serviceHints: ['Full renovations', 'Ensuites', 'Laundries', 'Accessible bathrooms'],
    process: siteVisitProcess(),
    faq: [
      { q: 'How long is a bathroom out of use?', a: 'A full renovation is usually a few weeks. We give you a real date and tell you as soon as anything moves.' },
      { q: 'What is waterproofing and why does it matter?', a: 'It is the membrane under the tiles. Done badly it is the single most expensive thing to fix later, so it is certified and documented on every job.' },
      { q: 'Do you supply the fittings?', a: 'We can, or you can. Either way we write down exactly what is included before we start.' },
      { q: 'What happens if you find something behind the wall?', a: 'Old pipework and rot do turn up. We stop, show you, price it and get your approval before continuing.' },
    ],
  },

  /* ------------------------------------- quote: bought on price and how soon */

  roofing: {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['Roof replacement', 'Re-roofing', 'Gutters and downpipes', 'Repairs and leak fixes'],
    process: [
      { step: 'Send us a photo', detail: 'A couple of photos and your suburb is enough for a guide price.' },
      { step: 'We come and measure', detail: 'We get up there, check the frame and the flashings, and give you a fixed price in writing.' },
      { step: 'We do the job', detail: 'Most homes are a few days. We sheet and make watertight as we go, so you are never left open.' },
    ],
    faq: [
      { q: 'How much does a new roof cost?', a: 'It comes down to roof area, pitch, access and whether the frame needs work. Use the guide above for a range, then we confirm on site.' },
      { q: 'Metal or tile?', a: 'Metal is lighter, faster to install and better on a low pitch. Tile suits some houses and some streets better. We will tell you which yours wants.' },
      { q: 'What happens if it rains mid-job?', a: 'We only strip what we can make watertight that day. Your house does not get left open overnight.' },
      { q: 'Do you handle insurance work?', a: 'Yes. We can quote in the format your insurer wants and deal with the assessor.' },
    ],
    calculatorUnits: { unit: 'm²', label: 'Roughly how many square metres?', min: 20, max: 1000, default: 150 },
  },

  'air-conditioning': {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['Split systems', 'Multi-head systems', 'Ducted', 'Service and repairs'],
    process: [
      { step: 'Tell us the rooms', detail: 'Room sizes and a photo of where the outdoor unit could go is usually enough for a guide price.' },
      { step: 'We check the site', detail: 'Power, pipe runs and where it will actually be quiet. Then a fixed price in writing.' },
      { step: 'Installed and running', detail: 'Most single splits are a morning. We test it, show you the controller and clean up.' },
    ],
    faq: [
      { q: 'What size do I need?', a: 'Room size, ceiling height, insulation and which way the windows face all matter. An undersized unit runs flat out and costs more to run, so we size it properly rather than guessing.' },
      { q: 'Split or ducted?', a: 'Splits are cheaper per room and easy to retrofit. Ducted looks tidier and suits whole houses. We will tell you where the break-even sits for your place.' },
      { q: 'How long does installation take?', a: 'A single split is usually a morning. Ducted is a few days.' },
      { q: 'Do you service what you install?', a: 'Yes, and we will tell you honestly when a repair is not worth it.' },
    ],
    calculatorUnits: { unit: 'system', label: 'How many systems?', min: 1, max: 12, default: 1 },
  },

  'solar-batteries': {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['Solar systems', 'Battery storage', 'Solar and battery together', 'Service and fault finding'],
    process: [
      { step: 'Send us a bill', detail: 'A recent electricity bill and your roof orientation tells us most of what we need for a guide price.' },
      { step: 'We design the system', detail: 'Panel layout, inverter, and what it will actually save you. Fixed price in writing.' },
      { step: 'Install and connect', detail: 'Most homes are a day on the roof. We handle the grid application and the paperwork.' },
    ],
    faq: [
      { q: 'How much will it save me?', a: 'It depends on how much power you use during the day. We work it out from your actual bill rather than a brochure figure.' },
      { q: 'Is a battery worth it?', a: 'Sometimes. It depends on your usage pattern and your feed-in tariff. We will run your numbers and tell you if the answer is no.' },
      { q: 'What rebates apply?', a: 'They change, and they differ by state. We apply the current ones to your quote and show you the number before and after.' },
      { q: 'What if my roof is shaded?', a: 'Shade matters more than most people expect. We will tell you straight if your roof is not a good candidate.' },
    ],
    calculatorUnits: { unit: 'kW', label: 'Roughly what size system?', min: 3, max: 30, default: 6.6 },
  },

  fencing: {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['New fences', 'Fence replacements', 'Gates', 'Repairs'],
    process: [
      { step: 'Call, text or send the form', detail: 'Tell us roughly how many metres, the style you want and your suburb. A photo of the yard helps.' },
      { step: 'We measure up and quote', detail: 'We check the boundary and the levels, and give you a fixed price in writing.' },
      { step: 'Fence goes up', detail: 'Most home fences take a day or two. We take the old one away and leave it tidy.' },
    ],
    faq: [
      { q: 'How much does a fence cost?', a: 'Use the price guide above for a range, then we confirm the exact figure on site.' },
      { q: 'Do I have to pay for the whole boundary fence myself?', a: 'Usually not. Neighbours normally share the cost of a boundary fence. Talk to yours before the quote, and we will write it so you can hand a copy straight over.' },
      { q: 'Do I need council approval?', a: 'Most side and back boundary fences do not, as long as they sit behind the front of the house and stay under the height limit. Front fences and corner blocks have extra rules.' },
      { q: 'My block slopes. Does that matter?', a: 'Not much. We either step the panels down the slope or rake them to follow it, and fill gaps with a plinth.' },
      { q: 'Do you take the old fence away?', a: 'Yes, and tip fees are in the replacement price.' },
    ],
    calculatorUnits: { unit: 'm', label: 'How many metres?', min: 3, max: 300, default: 20 },
  },

  concreting: {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['Driveways', 'Paths and patios', 'Shed and garage slabs', 'Exposed aggregate and decorative'],
    process: [
      { step: 'Send us the measurements', detail: 'Rough length and width, plus a photo of the access, gets you a guide price.' },
      { step: 'We check the site', detail: 'Levels, drainage and whether a truck can get to it. Then a fixed price in writing.' },
      { step: 'Prep, pour, finish', detail: 'Usually two visits: prep and formwork, then the pour. We tell you when you can drive on it.' },
    ],
    faq: [
      { q: 'How much does a driveway cost?', a: 'Area, finish and access drive it. Use the guide above, then we confirm on site.' },
      { q: 'How long before I can drive on it?', a: 'Foot traffic in a few days, vehicles after about a month. Driving on it early is how driveways crack.' },
      { q: 'Will it crack?', a: 'All concrete moves. We put control joints where the cracks want to go, and reinforce properly, so movement does not become damage.' },
      { q: 'Plain or exposed aggregate?', a: 'Exposed costs more and hides marks better. We will show you finished jobs of both so you are choosing from real ones.' },
    ],
    calculatorUnits: { unit: 'm²', label: 'Roughly how many square metres?', min: 5, max: 500, default: 40 },
  },

  'decks-pergolas': {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we build', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['Decks', 'Pergolas', 'Patios and covered outdoor areas', 'Repairs and restaining'],
    process: siteVisitProcess(),
    faq: [
      { q: 'How much does a deck cost?', a: 'Size, height off the ground and decking material drive it. Use the guide above for a range, then we confirm on site.' },
      { q: 'Timber or composite?', a: 'Timber is cheaper up front and wants oiling. Composite costs more and mostly does not. We will tell you what each really costs over ten years.' },
      { q: 'Do I need approval?', a: 'Low decks usually do not. Height, proximity to a boundary and a roof over it can change that. We will tell you what applies to yours.' },
      { q: 'How long does it take?', a: 'Most home decks are under a week once materials are on site.' },
    ],
    calculatorUnits: { unit: 'm²', label: 'Roughly how many square metres?', min: 5, max: 200, default: 25 },
  },

  glazing: {
    template: 'quote',
    responsePromise: 'Quote back within a few hours, seven days a week.',
    copy: { servicesTitle: 'What we do', processTitle: 'How it works', faqTitle: 'Good to know' },
    serviceHints: ['Window replacement', 'Shower screens', 'Splashbacks', 'Emergency glass repairs'],
    process: [
      { step: 'Send us a photo and a measurement', detail: 'A photo with a tape measure in it is usually enough for a guide price.' },
      { step: 'We measure properly', detail: 'Glass is cut to the millimetre, so we measure on site before anything is ordered.' },
      { step: 'Made and fitted', detail: 'We fit it, seal it and take the old glass away.' },
    ],
    faq: [
      { q: 'How fast can you come for a broken window?', a: 'We board up same day where we can, then fit the new glass once it is cut.' },
      { q: 'Single or double glazing?', a: 'Double costs more and is quieter and warmer. On a main road or a cold room it pays for itself; on a sheltered side it may not.' },
      { q: 'Do you take the old glass away?', a: 'Yes, and we clean up. Broken glass is not something to leave with a customer.' },
      { q: 'Is the glass compliant?', a: 'Safety glass is required in bathrooms, doors and low windows. Everything we fit meets the standard and we will tell you where it applies.' },
    ],
    calculatorUnits: { unit: 'job', label: 'How many openings?', min: 1, max: 40, default: 1 },
  },
};

for (const [industry, spec] of Object.entries(P)) {
  const out = {
    _comment: `Defaults for ${industry}. The client's own config.json overrides anything here — objects merge, arrays replace whole. Edit freely; nothing regenerates this.`,
    industry,
    template: spec.template,
    responsePromise: spec.responsePromise,
    copy: spec.copy,
    process: spec.process,
    faq: spec.faq,
    _serviceHints: spec.serviceHints,
    ...(spec.calculatorUnits ? { _calculatorUnits: spec.calculatorUnits } : {}),
  };
  await writeFile(join(DIR, `${industry}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(`  wrote presets/${industry}.json`);
}
console.log(`\n${Object.keys(P).length} presets written\n`);

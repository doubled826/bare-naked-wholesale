export interface OnboardingChecklistTemplateItem {
  id: string;
  label: string;
  note: string;
  talkingPoint: string;
  agreementPlaceholder: string;
}

export interface OnboardingChecklistTemplateSection {
  title: string;
  items: OnboardingChecklistTemplateItem[];
}

export const ONBOARDING_CHECKLIST_SECTIONS: OnboardingChecklistTemplateSection[] = [
  {
    title: 'Sampling program',
    items: [
      {
        id: 'sampling-agree',
        label: 'Sampling program quantity and location confirmed',
        note: 'Sample-to-size bags — agree on placement, starting quantity, and who manages restocking',
        talkingPoint: '"We do a big sampling push with every new partner — it\'s honestly the most effective thing we do. The idea is to get the product into customers\' hands right at the moment of decision. We\'ve seen it work really well near the topper section, on an endcap near the product, or even by the checkout. What spot do you think would get the most foot traffic in your store? And how many samples do you think you\'d need to start so we can make a real impact without running out early?"',
        agreementPlaceholder: 'e.g. 30 units to start, near checkout by register 2, Sarah manages restocking',
      },
    ],
  },
  {
    title: 'Intro promotion',
    items: [
      {
        id: 'promo-agree',
        label: 'Introductory promotion agreed',
        note: '10–20% off retail, brand covers cost, 2–4 weeks',
        talkingPoint: '"The last piece of the launch plan is a promo — we want to lower the barrier for customers trying us for the first time. We typically offer anywhere from 10 to 20% off retail and we cover the cost on our end, so it doesn\'t come out of your margin. Do you guys typically run promos for new products? What percentage feels right to you?"',
        agreementPlaceholder: 'e.g. 15% off retail, brand covers it, running for 3 weeks starting Monday',
      },
      {
        id: 'promo-duration',
        label: 'Promo duration and start date confirmed',
        note: 'Pin down the dates so both sides can plan',
        talkingPoint: '"Great — let\'s nail down the dates so we can both plan around it. When would you want to kick it off, and how long do you want to run it? We usually say 2–4 weeks is the sweet spot to really get momentum going."',
        agreementPlaceholder: 'e.g. Starts April 14, runs 3 weeks through May 5',
      },
    ],
  },
  {
    title: 'Astro setup',
    items: [
      {
        id: 'astro-account',
        label: "Confirmed they're on Astro",
        note: 'If not, get them signed up live on this call',
        talkingPoint: '"Are you guys on Astro? It\'s the platform we use for wholesale — it\'s where you\'ll be placing orders, requesting samples, all that. If you\'re not on it yet, it only takes a couple minutes and we can get you set up right now while we\'re on the call."',
        agreementPlaceholder: 'e.g. Already on Astro / Signed up live, username: sarah@pawsandplay.com',
      },
      {
        id: 'astro-loyalty',
        label: 'Enrolled in Astro loyalty program',
        note: 'Buy 10 Get 1 — punch card starts immediately',
        talkingPoint: '"While you\'re in Astro — make sure you\'re signed up for our loyalty program. It\'s a Buy 10, Get 1 free deal and it starts accumulating from your very first order. We want to make sure you\'re getting credit from day one."',
        agreementPlaceholder: 'e.g. Enrolled — confirmed in Astro portal during call',
      },
      {
        id: 'astro-offers',
        label: 'Aware of Astro offers and opted in',
        note: 'They must opt into each offer individually — flag this clearly',
        talkingPoint: '"One heads up — we run promotional offers through Astro throughout the year, but they do require you to opt in to each one individually. So it\'s really important you\'re keeping an eye on those. The easiest way to stay on top of it is the promo calendar."',
        agreementPlaceholder: 'e.g. Opted into current offer, noted they need to opt in manually each time',
      },
      {
        id: 'astro-calendar',
        label: 'Promo calendar sent and reviewed together',
        note: 'Give them lead time to plan signage, stock up, and build marketing around events',
        talkingPoint: '"Let me share our 2026 promo calendar with you — it\'s subject to change but gives you a solid picture of what\'s coming. Things like National Pet Month, holiday promos, that kind of stuff. We want to give you as much lead time as possible so you can really capitalize on these."',
        agreementPlaceholder: 'e.g. Calendar sent via email, they noted the May promo and want to build signage',
      },
    ],
  },
  {
    title: 'Shelf placement',
    items: [
      {
        id: 'shelf-placement',
        label: 'Shelf placement strategy agreed',
        note: 'Endcap or eye-level preferred — brand covers cost',
        talkingPoint: '"This rolls right into shelf placement — we want to make sure people can actually find the product and it\'s getting max visibility, especially in that first 30 days. Is there an endcap or a prime eye-level spot we could get into? We\'re happy to cover the cost if there\'s a placement fee — we just want to make sure we\'re setting this up for success."',
        agreementPlaceholder: 'e.g. Endcap at end of aisle 4, no fee, available next week',
      },
    ],
  },
  {
    title: 'Portal & expectations',
    items: [
      {
        id: 'portal',
        label: 'Walked through the wholesale ordering portal',
        note: 'Reordering, sample requests, marketing assets, staff training one-pagers',
        talkingPoint: '"Let me give you a quick tour of the portal — this is your 24/7 resource for everything. Reordering, sample requests, and staff training one-pagers you can print so your team knows how to talk about the product confidently when customers ask."',
        agreementPlaceholder: 'e.g. Toured portal, they bookmarked it, noted the staff one-pagers',
      },
      {
        id: 'cadence',
        label: 'Explained the 30/60 follow-up cadence',
        note: 'Set clear expectations — when they\'ll hear from us and why',
        talkingPoint: '"Here\'s how we like to stay in touch after today. We\'ll check in around 30 days — just a quick pulse check on sampling, the promo, and anything we can adjust. Then after 60 days we\'ll do a full recap and talk through what\'s working and where we want to keep momentum going."',
        agreementPlaceholder: 'e.g. They\'re good with the cadence, prefer email over calls for check-ins',
      },
      {
        id: 'materials',
        label: 'Confirmed whether they already received a table tent',
        note: 'If not, note that we\'ll send a new one with their order',
        talkingPoint: '"Last thing — did you already receive a table tent from us? If not, no problem at all, we can send a new one out with your order so you have it in-store."',
        agreementPlaceholder: 'e.g. Already received one / Needs a new table tent sent with upcoming order',
      },
      {
        id: 'ready-to-order',
        label: 'Ready to order?',
        note: 'See if we can secure the order now or agree on a later date',
        talkingPoint: '"One last thing before we wrap up — are you in a spot where you\'d like to place the order now, or would it make more sense to aim for a specific date a little later on?"',
        agreementPlaceholder: 'e.g. Placed order on call / Wants to order next Tuesday after inventory check',
      },
    ],
  },
];

export const AGREEMENT_SNAPSHOT_ITEM_IDS = [
  'sampling-agree',
  'shelf-placement',
  'promo-agree',
  'astro-account',
] as const;

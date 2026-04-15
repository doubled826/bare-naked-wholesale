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
        label: 'Agreed to in-store sampling program',
        note: 'Sample-to-size bags — if they try it, they buy it',
        talkingPoint: '"We do a big sampling push with every new partner — it\'s honestly the most effective thing we do. The idea is to get the product into customers\' hands right at the moment of decision. We\'ve seen it work really well near the topper section, on an endcap near the product, or even by the checkout. What spot do you think would get the most foot traffic in your store?"',
        agreementPlaceholder: 'e.g. 25 units, by the checkout aisle near register 2',
      },
      {
        id: 'sampling-quantity',
        label: 'Sampling quantity and location confirmed',
        note: 'Get specific — quantity, exact location, who manages restocking',
        talkingPoint: '"How many do you think you\'d need to start? We want to make sure you have enough to make a real impact — better to have too many than run out early. And who on your team would be the point person for managing the sample display?"',
        agreementPlaceholder: 'e.g. 30 units to start, Sarah at front desk manages restocking',
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
        label: 'Explained the 30/60/90 follow-up cadence',
        note: 'Set clear expectations — when they\'ll hear from us and why',
        talkingPoint: '"Here\'s how we like to stay in touch after today. We\'ll check in around 6 weeks — just a quick pulse check on sampling, the promo, and anything we can adjust. Then around the 90-day mark we\'ll do a full recap and transition you to our normal account flow."',
        agreementPlaceholder: 'e.g. They\'re good with the cadence, prefer email over calls for check-ins',
      },
      {
        id: 'checkin-booked',
        label: '6-week check-in call booked',
        note: 'Get a date and time before hanging up — send Calendly link if needed',
        talkingPoint: '"Before we wrap up — let\'s get that 6-week call on the calendar now so it doesn\'t fall through the cracks. I can send you a Calendly link or we can pick something right now. What\'s easier for you?"',
        agreementPlaceholder: 'e.g. Booked for May 19 at 2pm EST / Calendly link sent',
      },
      {
        id: 'materials',
        label: 'Table tent + QR code materials confirmed sent',
        note: 'Verify shipping address and quantity',
        talkingPoint: '"Last thing — we\'ll be sending over your table tent and QR code materials. The QR code links customers to a short brand video. Can you confirm the best shipping address? And how many do you think you\'ll need?"',
        agreementPlaceholder: 'e.g. Shipping to 123 Main St, need 3 table tents for 3 checkout locations',
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


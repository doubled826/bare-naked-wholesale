'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Copy,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  StickyNote,
  User,
} from 'lucide-react';
import { ONBOARDING_CHECKLIST_SECTIONS } from '@/lib/onboardingChecklist';
import { cn } from '@/lib/utils';

type Tab = 'intro' | 'followup' | 'checklist' | 'assistant' | 'templates' | 'onepager';
type ChecklistType = 'onboarding' | 'day30' | 'day60';
type CheckItemKind = 'checkbox' | 'rating' | 'note' | 'boolean';

interface CheckItem {
  id: string;
  label: string;
  note: string;
  talkingPoint: string;
  agreementPlaceholder: string;
  kind: CheckItemKind;
  checked: boolean;
  agreement: string;
  rating: number | null;
  boolValue: boolean | null;
  noteValue: string;
  activityDate: string;
}

interface CheckSection {
  title: string;
  items: CheckItem[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Template {
  id: string;
  name: string;
  desc: string;
  prompt: (store: string, rep: string) => string;
}

interface GuideSection {
  title: string;
  intro?: string;
  bullets?: string[];
  callout?: {
    label: string;
    text: string;
  };
}

interface DealOption {
  id: number;
  title: string;
}

function createChecklistSections(): CheckSection[] {
  return ONBOARDING_CHECKLIST_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      ...item,
      kind:
        item.id === 'ready-to-order' ||
        item.id === 'astro-account' ||
        item.id === 'astro-loyalty' ||
        item.id === 'astro-offers'
          ? ('boolean' as const)
          : ('checkbox' as const),
      checked: false,
      agreement: '',
      rating: null,
      boolValue: null,
      noteValue: '',
      activityDate: '',
    })),
  }));
}

function createThirtyDaySections(): CheckSection[] {
  return [
    {
      title: '30-day pulse check',
      items: [
        {
          id: 'sell-through',
          label: 'How is sell-through?',
          note: 'Rate current velocity from 1 to 10.',
          talkingPoint: 'How would you rate sell-through so far on a 1 to 10? What feels strongest, and where are you seeing drag?',
          agreementPlaceholder: '',
          kind: 'rating',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'staff-engagement',
          label: 'How is staff engagement?',
          note: 'Rate staff buy-in and recommendation behavior from 1 to 10.',
          talkingPoint: 'If 10 means the staff is actively talking about it and recommending it, where would you score engagement today?',
          agreementPlaceholder: '',
          kind: 'rating',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'customer-feedback',
          label: 'Any customer feedback?',
          note: 'Capture what customers are saying so we can learn from it.',
          talkingPoint: 'What are you hearing from customers so far? Anything positive, confusing, or worth watching?',
          agreementPlaceholder: 'Add customer reactions, questions, or objections...',
          kind: 'note',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'sustain-course-correct',
          label: 'Plan to sustain or course correct',
          note: 'Document the next plan clearly.',
          talkingPoint: 'Based on what you are seeing, should we keep the current plan going or make a change to promo, placement, sampling, or training?',
          agreementPlaceholder: 'Write the agreed next-step plan...',
          kind: 'note',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
      ],
    },
  ];
}

function createSixtyDaySections(): CheckSection[] {
  return [
    {
      title: '60-day optimization',
      items: [
        {
          id: 'wins-worked',
          label: 'Make note of the wins and what worked',
          note: 'Capture the proof points worth repeating.',
          talkingPoint: 'What has worked best so far? Think sell-through, sampling, staff recommendations, shelf placement, or promo response.',
          agreementPlaceholder: 'Document wins, learnings, and what seems to be driving results...',
          kind: 'note',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'portal-recap',
          label: 'Recapped the wholesale portal',
          note: 'Reinforce where to reorder, request samples, and find materials.',
          talkingPoint: 'Just to keep things easy, let’s quickly recap the wholesale portal so your team knows where to reorder, request samples, and grab support materials.',
          agreementPlaceholder: 'Add any portal-related notes if needed...',
          kind: 'checkbox',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'restocked',
          label: 'Re-stocked?',
          note: 'Confirm whether they have reordered yet.',
          talkingPoint: 'Have you restocked yet, or are you still working through the first order?',
          agreementPlaceholder: '',
          kind: 'boolean',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'astro-double-punch',
          label: 'Reminded them of the Astro Loyalty Promo: Buy 1 Get 2 Punches',
          note: 'Keep the Astro momentum in front of them.',
          talkingPoint: 'One reminder: the Astro loyalty promo can be a great accelerator here — buy 1, get 2 punches helps get customers to that sticky third purchase faster.',
          agreementPlaceholder: 'Add any Astro promo notes...',
          kind: 'checkbox',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
        {
          id: 'promo-calendar',
          label: 'Annual promo calendar handoff completed',
          note: 'Make sure they have a copy so they can plan signage and timing.',
          talkingPoint: 'Let’s make sure you have the annual promo calendar so you can plan signage, stock, and timing around the bigger moments.',
          agreementPlaceholder: 'Add calendar handoff notes...',
          kind: 'checkbox',
          checked: false,
          agreement: '',
          rating: null,
          boolValue: null,
          noteValue: '',
          activityDate: '',
        },
      ],
    },
  ];
}

const CHECKLIST_META: Record<ChecklistType, { label: string; saveTitle: string; helper: string; saveHelper: string }> = {
  onboarding: {
    label: 'Onboarding Call',
    saveTitle: 'Onboarding Call Notes',
    helper: 'Track launch agreements, setup steps, and follow-up commitments from the onboarding call.',
    saveHelper: 'Saves the onboarding notes. If Ready to order? is Yes, the deal moves to First Order Received. If No, a follow-up activity is scheduled for the selected date.',
  },
  day30: {
    label: '30 Day Call',
    saveTitle: '30 Day Notes',
    helper: 'Use this pulse check to score momentum, collect feedback, and document the plan going forward.',
    saveHelper: 'Saves the 30-day pulse check notes to the selected Pipedrive deal as "30 Day Notes."',
  },
  day60: {
    label: '60 Day Call',
    saveTitle: '60 Day Notes',
    helper: 'Use this review to capture wins, check operational follow-through, and reinforce the longer-term plan.',
    saveHelper: 'Saves the 60-day review notes to the selected Pipedrive deal as "60 Day Notes."',
  },
};

const INTRO_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Goal of the intro call',
    intro: 'The intro call is about earning permission to send samples and keeping the conversation alive. You are opening a relationship, not trying to close the sale.',
    bullets: [
      'Find the right decision-maker: owner, buyer, or manager.',
      'Learn a little about the store before you get off the phone.',
      'Plant the low-risk value props: no minimums, free shipping, and product quality.',
      'Leave with their email and a clear follow-up plan whenever possible.',
    ],
  },
  {
    title: 'Before you call',
    intro: 'Spend two minutes looking at the store online so the call feels personal, not mass-dialed.',
    bullets: [
      'Check whether they are mainly retail, grooming, daycare, or boarding.',
      'Look for what brands or product types are visible.',
      'See whether they mention Astro or any loyalty program.',
      'Pull one specific observation you can reference in the first 30 seconds.',
    ],
    callout: {
      label: 'Real-call example',
      text: 'I was flipping through your photos online and noticed you do a lot of grooming with a small retail section. Based on what I saw there, I thought our topper could be a great fit.',
    },
  },
  {
    title: 'Open the call well',
    intro: 'First job: get to the right person. Second job: personalize quickly.',
    bullets: [
      'Open with: "Hi, I was hoping to talk to somebody about a potential new product for your store — whoever works with vendors and does purchasing."',
      'If they are not available, get the decision-maker’s name and a better callback time.',
      'Reference what you saw online in one or two sentences, then pivot to the product.',
    ],
  },
  {
    title: 'Product facts to know cold',
    bullets: [
      'Trail Mix Topper is a premium freeze-dried dry topper for dogs with five whole-food ingredients.',
      'It is gently freeze-dried raw, shelf-stable, and pantry-friendly with no additives or preservatives.',
      '6 oz wholesale is $16.67 and retails at $25. 12 oz wholesale is $30 and retails at $45.',
      'Margin is about 34% on both sizes.',
      'The 12 oz bag lands at just over $1 per serving per day.',
      'Fruits and veggies are sourced from the US, Canada, and Mexico depending on seasonality and freshness.',
      'Proteins are sourced from Oregon / Pacific Northwest. Freeze-drying and packaging happen near Salt Lake City. Orders ship from Indianapolis.',
      'Secondary products include freeze-dried single-ingredient treats: bison liver, whole minnows, and lamb heart.',
    ],
    callout: {
      label: 'Key visual line',
      text: 'You can notice even in the photos that it looks very different from toppers that are basically processed brown pellets. That transparency really resonates with people.',
    },
  },
  {
    title: 'Selling points to weave in',
    bullets: [
      'No minimums and free shipping lower the risk immediately.',
      'The direct model is a benefit: easier support, more flexibility, and free sampling.',
      'The product does a lot of the heavy lifting once people try it.',
      'Free customer samples with first orders help stores launch well.',
      'If they are on Astro, mention the buy-10-get-1 loyalty program.',
    ],
    callout: {
      label: 'How to say it',
      text: 'We have no minimums and free shipping. Stores can start with whatever amount feels comfortable, and if it takes off, you can scale from there.',
    },
  },
  {
    title: 'Handle common situations',
    bullets: [
      'If they are busy, keep your answers short and match their pace.',
      'If they say "just send me an email," treat it as a bridge, not a rejection.',
      'If they are selective about brands, agree with that instinct and frame Bare Naked as worth the shelf space because it is visually different, simple, and low risk to test.',
      'If they ask about Faire or distribution, be honest and frame direct ordering as the reason you can offer no minimums and free shipping.',
    ],
    callout: {
      label: 'Email bridge',
      text: 'I’ll shoot that over today. Should I plan to follow up with you in a week or two once you’ve had a chance to look it over?',
    },
  },
  {
    title: 'Close checklist',
    bullets: [
      'Get the email address.',
      'Confirm they are open to samples, unless they explicitly want to hold off.',
      'Agree on a follow-up date or at least a rough time window before you hang up.',
      'If you cannot reach the decision-maker, leave a specific message and do not let the callback drift past two weeks.',
    ],
  },
];

const FOLLOW_UP_GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'What the follow-up call is for',
    intro: 'This call is about re-opening the conversation after samples were sent, reinforcing why the product works, and landing the next concrete step.',
    bullets: [
      'Lead with the samples so they immediately know why you are calling.',
      'Reconfirm you are speaking with the right buyer or decision-maker.',
      'Use the product story, launch support, and Astro tools to lower hesitation.',
      'Always leave with a clear next action or date.',
    ],
    callout: {
      label: 'Opener',
      text: 'Yeah, hi — I just wanted to follow up on some samples we sent to the store a few weeks back.',
    },
  },
  {
    title: 'Core follow-up talking points',
    bullets: [
      'The product sells itself once it gets into people’s hands.',
      'Five whole-food ingredients is a meaningful simplicity story.',
      'No order minimums and free shipping keep the front-end risk very low.',
      'The product is sticky: once a customer buys three times, it tends to become part of their routine.',
    ],
    callout: {
      label: 'Sticky-data line',
      text: 'Once a customer buys three times, it gets sticky and becomes part of their normal routine. We see really strong numbers there compared to market averages.',
    },
  },
  {
    title: 'Use Astro as an advantage',
    bullets: [
      'Always ask early if the store is on Astro.',
      'Astro gives you loyalty punches, double-punch launch promos, private promotions, and performance data.',
      'The goal is to get shoppers to their third punch as quickly as possible.',
    ],
    callout: {
      label: 'How to frame Astro',
      text: 'Our goal is to get your customers to that third punch on Astro. Once we do that, the repeat numbers get really strong.',
    },
  },
  {
    title: 'Launch plan to describe',
    bullets: [
      'Free customer samples included with the first order.',
      'Supported launch promotion so first-time buyers have an easier reason to try it.',
      'Premium shelf placement whenever possible.',
      'Astro set up from day one so loyalty and promos start immediately.',
    ],
    callout: {
      label: 'Launch framing',
      text: 'We like to launch really strong out of the gate: free samples for customers, a supported promotion, and Astro set up from day one.',
    },
  },
  {
    title: 'Handle common objections',
    bullets: [
      'If budget is tight, lean on no minimums and free shipping, then ask when budget usually opens back up.',
      'If they need the owner or buyer, get the name and best time to reach them and follow up directly.',
      'If they already have a lot of products, focus on the clean ingredients, visual differentiation, and repeat-purchase story.',
      'If they need more time or more samples, keep the door open and lock in a specific follow-up date.',
    ],
  },
  {
    title: 'Call flow reminders',
    bullets: [
      'Do not open with a long intro. Start with the reason for the call.',
      'Confirm the right contact early so you are not pitching the wrong person.',
      'Use the "game of telephone" to your advantage by leaving easy-to-repeat value props like no minimums and free shipping.',
      'Never end the call without a next step, even if that next step is just another callback date.',
    ],
  },
];

const SALES_ASSISTANT_SYSTEM = `You are the Bare Naked Pet Co. sales assistant inside the Sales Hub. Base your answers on the internal Intro Call Guide, Follow-Up Call Guide, and onboarding checklist.

INTRO CALL GUIDE
- Primary goal: get permission to send samples and keep the conversation alive.
- Do not try to close the sale on the intro call. Open a relationship.
- Before calling, spend 2 minutes looking at the store online so you can personalize the call.
- Opening line: "Hi, I was hoping to talk to somebody about a potential new product for your store — whoever works with vendors and does purchasing."
- Product basics: Trail Mix Topper is a premium freeze-dried dry topper for dogs with 5 whole-food ingredients.
- Visual differentiator: it looks very different from processed brown-pellet toppers and signals transparency.
- Key low-risk points: no minimums, free shipping, direct ordering, free customer samples, Astro loyalty if they use Astro.
- Pricing: 6 oz wholesale $16.67 / MSRP $25. 12 oz wholesale $30 / MSRP $45. Margin about 34%.
- Sourcing/manufacturing: proteins sourced from Oregon / Pacific Northwest, packaged near Salt Lake City, ships from Indianapolis.
- If they say "send me an email," treat it as a bridge and still land a follow-up window.
- Close with email + samples + agreed follow-up timing whenever possible.

FOLLOW-UP CALL GUIDE
- Follow up on samples about 3 weeks after sending to give the team time to try and test them.
- Strong opener: "Yeah, hi — I just wanted to follow up on some samples we sent to the store a few weeks back."
- Lead with the samples and confirm you are talking to the right buyer.
- Core talking points: the product sells itself once tried, only 5 whole-food ingredients, no minimums, free shipping, and strong repeat-purchase stickiness.
- Sticky data framing: once a customer buys 3 times, the product becomes part of their routine.
- Astro tools: loyalty punches, double-punch launch promos, private promotions, and performance data.
- Goal with Astro: get shoppers to their 3rd punch quickly.
- Launch plan: free customer samples, supported promotion, premium shelf placement, and Astro from day one.
- Always leave with a next step or specific date.

ONBOARDING CHECKLIST / LAUNCH SUPPORT
- In-store sampling matters: "If they try it, they buy it."
- Prefer endcap or eye-level shelf placement; the brand can cover placement cost.
- Intro promo usually runs 2 to 4 weeks and brand covers the promo cost.
- Confirm Astro account, loyalty enrollment, offers opt-in, and promo calendar.
- Use the portal for reorders, samples, marketing assets, and staff training one-pagers.
- Explain the 30/60/90 cadence and book the 6-week check-in during onboarding.

30-DAY CALL CHECKLIST
- Rate sell-through from 1 to 10.
- Rate staff engagement from 1 to 10.
- Capture customer feedback in notes.
- Document the plan to sustain momentum or course correct.

60-DAY CALL CHECKLIST
- Document the wins and what worked.
- Recap the wholesale portal.
- Confirm whether they have restocked.
- Remind them about the Astro loyalty promo: Buy 1 Get 2 Punches.
- Confirm the annual promo calendar handoff.

STYLE
- Be concise, practical, and supportive.
- Sound like a helpful sales coach, not a marketer.
- Prefer scripts, objections, and next-step language the rep can actually say out loud.
- If asked about something not covered, say what is known, note the gap plainly, and suggest the safest next step.`;

const QUICK_PROMPTS = [
  'Give me a natural intro-call opener for a grooming-heavy store.',
  'How should I follow up after samples have been with the store for 3 weeks?',
  'A buyer says budget is tight right now. What should I say?',
  'How do I explain the Astro advantage without overcomplicating it?',
  'What is the cleanest way to ask for a follow-up date before hanging up?',
];

const TEMPLATES: Template[] = [
  {
    id: 'sample-followup',
    name: 'Sample follow-up',
    desc: '3 weeks after samples sent',
    prompt: (store, rep) =>
      `Write a short, warm follow-up email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}, sent 3 weeks after they received samples so they have had time to try and test them out. Ask how the team liked the samples and whether they got any feedback. Keep it conversational, supportive, and not salesy. Under 150 words. Include a subject line.`,
  },
  {
    id: '30-day',
    name: '30-day check-in',
    desc: 'First pulse check follow-up',
    prompt: (store, rep) =>
      `Write a 30-day check-in email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}. Reference the sampling program, promo, and shelf placement set up at onboarding. Ask how things are going and if there is anything the brand can do to support them. Offer a quick call. Under 150 words, warm and supportive. Include a subject line.`,
  },
  {
    id: '60-day',
    name: '60-day optimization',
    desc: 'Mid-point review and next steps',
    prompt: (store, rep) =>
      `Write a 60-day optimization email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}. Reference the progress made in the first 30 days. Mention reviewing results together and whether a second promo or demo day would help drive more velocity. Friendly and solution-focused. Under 150 words. Include a subject line.`,
  },
  {
    id: '90-day',
    name: '90-day handoff',
    desc: 'Transition to core account',
    prompt: (store, rep) =>
      `Write a 90-day handoff email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}. Celebrate the wins from the first 90 days. Explain the transition to standard account management — they will get monthly newsletters, ongoing Astro promos, and can always reach out. Frame it as graduating to a long-term partnership, not being abandoned. Under 175 words. Include a subject line.`,
  },
];

async function searchPipedriveDeals(query: string) {
  const res = await fetch(`/api/admin/pipedrive/deals/search?term=${encodeURIComponent(query)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to search Pipedrive deals.');
  }
  return (data.deals || []) as DealOption[];
}

async function addNoteToDeal(dealId: number, content: string) {
  const res = await fetch('/api/admin/pipedrive/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId, content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to save note to Pipedrive.');
  }
  return data.note;
}

async function createActivity(dealId: number, subject: string, dueDate: string) {
  const res = await fetch('/api/admin/pipedrive/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId, subject, dueDate }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to create activity in Pipedrive.');
  }
  return data.activity;
}

async function updateDealStage(dealId: number, stageName: string) {
  const res = await fetch('/api/admin/pipedrive/deals/stage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId, stageName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to update Pipedrive deal stage.');
  }
  return data.deal;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function subtractDays(dateString: string, days: number): string {
  const d = new Date(dateString);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}
async function generateSalesHubText(messages: { role: string; content: string }[], system: string): Promise<string> {
  const res = await fetch('/api/admin/sales-hub', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Something went wrong. Please try again.');
  }
  return data?.text || 'Something went wrong. Please try again.';
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap',
        active ? 'bg-bark-500 text-white shadow-sm' : 'text-bark-500/70 hover:bg-cream-200 hover:text-bark-500'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function GuideTab({
  title,
  subtitle,
  sections,
  cheatSheet,
}: {
  title: string;
  subtitle: string;
  sections: GuideSection[];
  cheatSheet: string[];
}) {
  const [openSection, setOpenSection] = useState<number>(0);

  return (
    <div className="space-y-5">
      <div className="bg-bark-500 rounded-2xl p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">{title}</p>
        <p className="text-sm leading-relaxed">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <div key={section.title} className="bg-cream-100 rounded-2xl border border-cream-200 overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === index ? -1 : index)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <span className="font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                {section.title}
              </span>
              {openSection === index ? (
                <ChevronUp className="w-4 h-4 text-bark-500/40 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-bark-500/40 flex-shrink-0" />
              )}
            </button>
            {openSection === index && (
              <div className="px-5 pb-5 border-t border-cream-200 pt-4 space-y-4">
                {section.intro && <p className="text-sm text-bark-500 leading-relaxed">{section.intro}</p>}
                {section.bullets && (
                  <div className="space-y-2">
                    {section.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-2.5 bg-white rounded-xl border border-cream-200 px-3.5 py-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-bark-500/40 mt-2 flex-shrink-0" />
                        <span className="text-sm text-bark-500 leading-relaxed">{bullet}</span>
                      </div>
                    ))}
                  </div>
                )}
                {section.callout && (
                  <div className="bg-white rounded-xl border border-cream-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/40 mb-1.5">
                      {section.callout.label}
                    </p>
                    <p className="text-sm text-bark-500 italic leading-relaxed">"{section.callout.text}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50 mb-3">Quick reference</p>
        <div className="grid gap-2">
          {cheatSheet.map((item) => (
            <div key={item} className="bg-white rounded-xl border border-cream-200 px-3.5 py-2.5 text-sm text-bark-500">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DealSearchPicker({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: DealOption | null;
  onSelect: (deal: DealOption | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DealOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      setError('');
      return;
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const deals = await searchPipedriveDeals(query.trim());
        setResults(deals);
        setOpen(true);
      } catch (err) {
        setResults([]);
        setOpen(true);
        setError(err instanceof Error ? err.message : 'Unable to search deals.');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  return (
    <div className="space-y-2">
      <label className="label">{label}</label>
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 text-bark-500/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0 || error) {
                setOpen(true);
              }
            }}
            placeholder={value?.title || 'Search Pipedrive deals...'}
            className="input text-sm pl-10"
          />
        </div>

        {open && (query.trim() || error) && (
          <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-cream-200 shadow-lg overflow-hidden">
            {loading && <div className="px-3 py-2.5 text-sm text-bark-500/50">Searching deals...</div>}
            {!loading && error && <div className="px-3 py-2.5 text-sm text-red-600">{error}</div>}
            {!loading && !error && results.length === 0 && (
              <div className="px-3 py-2.5 text-sm text-bark-500/50">No matching deals.</div>
            )}
            {!loading &&
              !error &&
              results.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => {
                    onSelect(deal);
                    setQuery('');
                    setResults([]);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-bark-500 hover:bg-cream-100 transition-colors"
                >
                  {deal.title}
                </button>
              ))}
          </div>
        )}
      </div>

      {value && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-cream-200 px-3 py-2">
          <span className="text-sm text-bark-500 font-medium">{value.title}</span>
          <button onClick={() => onSelect(null)} className="text-xs text-bark-500/50 hover:text-bark-500">
            remove
          </button>
        </div>
      )}
    </div>
  );
}

function ChecklistTab() {
  const [activeChecklist, setActiveChecklist] = useState<ChecklistType>('onboarding');
  const [checklists, setChecklists] = useState<Record<ChecklistType, CheckSection[]>>({
    onboarding: createChecklistSections(),
    day30: createThirtyDaySections(),
    day60: createSixtyDaySections(),
  });
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [orderFollowUpModal, setOrderFollowUpModal] = useState<{ open: boolean; sectionIdx: number | null; itemId: string | null }>({
    open: false,
    sectionIdx: null,
    itemId: null,
  });
  const [pendingOrderDate, setPendingOrderDate] = useState(addDays(14));
  const [dealQuery, setDealQuery] = useState('');
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const sections = checklists[activeChecklist];
  const allItems = sections.flatMap((section) => section.items);
  const checkedCount = allItems.filter((item) => {
    if (item.kind === 'checkbox') return item.checked;
    if (item.kind === 'rating') return item.rating !== null;
    if (item.kind === 'boolean') return item.boolValue !== null;
    return item.noteValue.trim().length > 0;
  }).length;
  const total = allItems.length;
  const pct = total ? Math.round((checkedCount / total) * 100) : 0;

  function toggleCheck(sectionIdx: number, itemId: string) {
    setChecklists((prev) => ({
      ...prev,
      [activeChecklist]: prev[activeChecklist].map((section, idx) =>
        idx !== sectionIdx
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item
              ),
            },
      ),
    }));
  }

  function updateAgreement(sectionIdx: number, itemId: string, value: string) {
    setChecklists((prev) => ({
      ...prev,
      [activeChecklist]: prev[activeChecklist].map((section, idx) =>
        idx !== sectionIdx
          ? section
          : {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, agreement: value } : item)),
            },
      ),
    }));
  }

  function updateRating(sectionIdx: number, itemId: string, value: number) {
    setChecklists((prev) => ({
      ...prev,
      [activeChecklist]: prev[activeChecklist].map((section, idx) =>
        idx !== sectionIdx
          ? section
          : {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, rating: value } : item)),
            },
      ),
    }));
  }

  function updateBoolean(sectionIdx: number, itemId: string, value: boolean) {
    if (activeChecklist === 'onboarding' && itemId === 'ready-to-order') {
      if (value) {
        setChecklists((prev) => ({
          ...prev,
          [activeChecklist]: prev[activeChecklist].map((section, idx) =>
            idx !== sectionIdx
              ? section
              : {
                  ...section,
                  items: section.items.map((item) =>
                    item.id === itemId
                      ? {
                          ...item,
                          boolValue: true,
                          activityDate: addDays(30),
                          agreement: 'Ready to order now. Schedule the 30-day follow-up call and send the Calendly email reminder one week before.',
                        }
                      : item
                  ),
                },
          ),
        }));
        return;
      }

      setPendingOrderDate(addDays(14));
      setOrderFollowUpModal({ open: true, sectionIdx, itemId });
      return;
    }

    setChecklists((prev) => ({
      ...prev,
      [activeChecklist]: prev[activeChecklist].map((section, idx) =>
        idx !== sectionIdx
          ? section
          : {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, boolValue: value } : item)),
            },
      ),
    }));
  }

  function updateNote(sectionIdx: number, itemId: string, value: string) {
    setChecklists((prev) => ({
      ...prev,
      [activeChecklist]: prev[activeChecklist].map((section, idx) =>
        idx !== sectionIdx
          ? section
          : {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, noteValue: value } : item)),
            },
      ),
    }));
  }

  function resetSections(type: ChecklistType): CheckSection[] {
    if (type === 'day30') return createThirtyDaySections();
    if (type === 'day60') return createSixtyDaySections();
    return createChecklistSections();
  }

  function reset() {
    setChecklists((prev) => ({
      ...prev,
      [activeChecklist]: resetSections(activeChecklist),
    }));
    setOrderFollowUpModal({ open: false, sectionIdx: null, itemId: null });
    setPendingOrderDate(addDays(14));
    setSelectedDeal(null);
    setDeals([]);
    setDealQuery('');
    setSavedMsg('');
    setExpandedItem(null);
  }

  async function searchDeals() {
    if (!dealQuery.trim()) {
      return;
    }
    setSearching(true);
    try {
      const results = await searchPipedriveDeals(dealQuery);
      setDeals(results);
    } catch {
      setDeals([]);
    } finally {
      setSearching(false);
    }
  }

  function formatItemLine(item: CheckItem) {
    if (item.kind === 'checkbox') {
      return `${item.checked ? '✓' : '✗'} ${item.label}`;
    }
    if (item.kind === 'rating') {
      return `${item.label}: ${item.rating !== null ? `${item.rating}/10` : 'Not rated'}`;
    }
    if (item.kind === 'boolean') {
      if (item.id === 'ready-to-order' && item.boolValue === false && item.activityDate) {
        return `${item.label}: No — follow up on ${item.activityDate}`;
      }
      return `${item.label}: ${item.boolValue === null ? 'Not answered' : item.boolValue ? 'Yes' : 'No'}`;
    }
    return `${item.label}: ${item.noteValue.trim() || 'No notes'}`;
  }

  function saveOrderFollowUpDate() {
    if (!orderFollowUpModal.open || orderFollowUpModal.sectionIdx === null || !orderFollowUpModal.itemId || !pendingOrderDate) {
      return;
    }

    setChecklists((prev) => ({
      ...prev,
      onboarding: prev.onboarding.map((section, idx) =>
        idx !== orderFollowUpModal.sectionIdx
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id === orderFollowUpModal.itemId
                  ? {
                      ...item,
                      boolValue: false,
                      activityDate: pendingOrderDate,
                      agreement: `Not ready to order on this call. Follow up on ${pendingOrderDate} to restart the order conversation.`,
                    }
                  : item
              ),
            },
      ),
    }));
    setOrderFollowUpModal({ open: false, sectionIdx: null, itemId: null });
  }

  async function saveToPipedrive() {
    if (!selectedDeal) {
      return;
    }

    setSaving(true);
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const meta = CHECKLIST_META[activeChecklist];
    const lines: string[] = [`${meta.saveTitle} — ${date}\n`];

    sections.forEach((section) => {
      lines.push(`\n## ${section.title}`);
      section.items.forEach((item) => {
        lines.push(formatItemLine(item));
        if (item.agreement.trim()) {
          lines.push(`   → ${item.agreement.trim()}`);
        }
      });
    });

    const unchecked = allItems.filter((item) => {
      if (item.kind === 'checkbox') return !item.checked;
      if (item.kind === 'rating') return item.rating === null;
      if (item.kind === 'boolean') return item.boolValue === null;
      return item.noteValue.trim().length === 0;
    });
    if (unchecked.length) {
      lines.push(`\nStill open: ${unchecked.map((item) => item.label).join(', ')}`);
    }

    try {
      await addNoteToDeal(selectedDeal.id, lines.join('\n'));
      if (activeChecklist === 'onboarding') {
        const readyToOrder = allItems.find((item) => item.id === 'ready-to-order');
        const astroAccount = allItems.find((item) => item.id === 'astro-account');
        const astroLoyalty = allItems.find((item) => item.id === 'astro-loyalty');
        const astroOffers = allItems.find((item) => item.id === 'astro-offers');

        if (readyToOrder?.boolValue === true) {
          await updateDealStage(selectedDeal.id, 'First Order Received');
          if (
            astroAccount?.boolValue === true &&
            astroLoyalty?.boolValue === true &&
            astroOffers?.boolValue === true
          ) {
            await createActivity(
              selectedDeal.id,
              'BNP — Create private Astro "Buy 1 Get 2 Punches" promo for approval',
              addDays(0)
            );
          }
          setSavedMsg('Saved to Pipedrive ✓ — onboarding notes added and the deal was moved to First Order Received.');
        } else if (readyToOrder?.boolValue === false && readyToOrder.activityDate) {
          await createActivity(selectedDeal.id, 'BNP — Follow up to restart order conversation', readyToOrder.activityDate);
          setSavedMsg(`Saved to Pipedrive ✓ — onboarding notes added and a follow-up activity was scheduled for ${readyToOrder.activityDate}.`);
        } else {
          setSavedMsg('Saved to Pipedrive ✓ — onboarding notes added. Ready to order? is still open, so no follow-up activity was created yet.');
        }
      } else {
        setSavedMsg(`Saved to Pipedrive ✓ — ${meta.saveTitle} added to the selected deal.`);
      }
    } catch {
      setSavedMsg('Error saving to Pipedrive. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(CHECKLIST_META) as [ChecklistType, { label: string }][]).map(([type, meta]) => (
          <button
            key={type}
            onClick={() => {
              setActiveChecklist(type);
              setExpandedItem(null);
              setSavedMsg('');
            }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeChecklist === type ? 'bg-bark-500 text-white' : 'bg-cream-100 border border-cream-200 text-bark-500/70 hover:text-bark-500'
            )}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div className="bg-bark-500 rounded-2xl p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">{CHECKLIST_META[activeChecklist].label}</p>
        <p className="text-sm leading-relaxed">{CHECKLIST_META[activeChecklist].helper}</p>
      </div>

      <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-bark-500">
            {checkedCount} of {total} complete
          </span>
          <span className="text-sm font-semibold text-bark-500">{pct}%</span>
        </div>
        <div className="w-full bg-cream-200 rounded-full h-2">
          <div className="bg-bark-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {checkedCount === total && <p className="text-sm text-emerald-600 font-medium mt-2">All items covered — great call!</p>}
      </div>

      {sections.map((section, sectionIdx) => (
        <div key={section.title}>
          <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wider mb-2">{section.title}</p>
          <div className="space-y-2">
            {section.items.map((item) => {
              const isExpanded = expandedItem === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-xl border transition-all duration-150',
                    ((item.kind === 'checkbox' && item.checked) ||
                      (item.kind === 'rating' && item.rating !== null) ||
                      (item.kind === 'boolean' && item.boolValue !== null) ||
                      (item.kind === 'note' && item.noteValue.trim().length > 0))
                      ? 'bg-emerald-50 border-emerald-100'
                      : 'bg-cream-100 border-cream-200'
                  )}
                >
                  <div className="flex items-start gap-3 p-3.5">
                    {item.kind === 'checkbox' ? (
                      <button
                        onClick={() => toggleCheck(sectionIdx, item.id)}
                        className={cn(
                          'mt-0.5 w-5 h-5 min-w-[20px] rounded-md border flex items-center justify-center transition-colors flex-shrink-0',
                          item.checked ? 'bg-bark-500 border-bark-500' : 'border-cream-300 bg-white'
                        )}
                        >
                          {item.checked && <Check className="w-3 h-3 text-white" />}
                        </button>
                    ) : (
                      <button
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        className="mt-0.5 w-5 h-5 min-w-[20px] rounded-md border border-cream-300 bg-white flex items-center justify-center text-[11px] font-semibold text-bark-500/60 hover:border-bark-500/30 transition-colors flex-shrink-0"
                        aria-label={`Open ${item.label}`}
                      >
                        {item.kind === 'rating' ? (item.rating ?? '-') : item.kind === 'boolean' ? (item.boolValue === null ? '-' : item.boolValue ? 'Y' : 'N') : '•'}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium text-bark-500', item.kind === 'checkbox' && item.checked && 'line-through text-bark-500/50')}>
                        {item.label}
                      </p>
                      <p className="text-xs text-bark-500/50 mt-0.5">{item.note}</p>
                      {!isExpanded && item.kind === 'checkbox' && item.agreement && <p className="text-xs text-emerald-700 mt-1 font-medium">→ {item.agreement}</p>}
                      {!isExpanded && item.kind === 'rating' && item.rating !== null && <p className="text-xs text-emerald-700 mt-1 font-medium">→ {item.rating}/10</p>}
                      {!isExpanded && item.kind === 'note' && item.noteValue && <p className="text-xs text-emerald-700 mt-1 font-medium">→ {item.noteValue}</p>}
                      {!isExpanded && item.kind === 'boolean' && item.boolValue !== null && (
                        <p className="text-xs text-emerald-700 mt-1 font-medium">
                          → {item.boolValue ? 'Yes' : item.activityDate ? `No — follow up on ${item.activityDate}` : 'No'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-bark-500/40 hover:text-bark-500 transition-colors mt-0.5 px-1"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-cream-200 pt-3">
                      <div className="bg-white rounded-xl border border-cream-200 p-3">
                        <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-1.5">Suggested talking point</p>
                        <p className="text-sm text-bark-500 italic leading-relaxed">{item.talkingPoint}</p>
                      </div>
                      {item.kind === 'checkbox' && (
                        <div>
                          <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-1.5">What did you agree on?</p>
                          <textarea
                            value={item.agreement}
                            onChange={(e) => updateAgreement(sectionIdx, item.id, e.target.value)}
                            placeholder={item.agreementPlaceholder}
                            rows={2}
                            className="input text-sm resize-none"
                          />
                        </div>
                      )}
                      {item.kind === 'note' && (
                        <div>
                          <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-1.5">Notes</p>
                          <textarea
                            value={item.noteValue}
                            onChange={(e) => updateNote(sectionIdx, item.id, e.target.value)}
                            placeholder={item.agreementPlaceholder}
                            rows={3}
                            className="input text-sm resize-none"
                          />
                        </div>
                      )}
                      {item.kind === 'rating' && (
                        <div>
                          <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-2">Rating</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: 10 }, (_, idx) => idx + 1).map((score) => (
                              <button
                                key={score}
                                onClick={() => updateRating(sectionIdx, item.id, score)}
                                className={cn(
                                  'w-9 h-9 rounded-lg border text-sm font-medium transition-colors',
                                  item.rating === score
                                    ? 'bg-bark-500 border-bark-500 text-white'
                                    : 'bg-white border-cream-200 text-bark-500 hover:border-bark-500/30'
                                )}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.kind === 'boolean' && (
                        <div>
                          <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-2">Answer</p>
                          <div className="flex gap-2">
                            {[
                              { label: 'Yes', value: true },
                              { label: 'No', value: false },
                            ].map((option) => (
                              <button
                                key={option.label}
                                onClick={() => updateBoolean(sectionIdx, item.id, option.value)}
                                className={cn(
                                  'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                                  item.boolValue === option.value
                                    ? 'bg-bark-500 border-bark-500 text-white'
                                    : 'bg-white border-cream-200 text-bark-500 hover:border-bark-500/30'
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          {item.id === 'ready-to-order' && (
                            <p className="text-xs text-bark-500/50 mt-2">
                              {item.boolValue === true
                                ? 'Selecting Yes schedules a 30-day follow-up call and a Calendly reminder one week before when you save to Pipedrive.'
                                : item.boolValue === false && item.activityDate
                                  ? `Selecting No schedules a follow-up activity for ${item.activityDate} when you save to Pipedrive.`
                                  : 'If they are not ready, choose No and pick the follow-up date in the calendar modal.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
          Save to Pipedrive
        </p>
        <p className="text-xs text-bark-500/50">{CHECKLIST_META[activeChecklist].saveHelper}</p>
        <div className="flex gap-2">
          <input
            value={dealQuery}
            onChange={(e) => setDealQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchDeals()}
            placeholder="Search deal by retailer name..."
            className="input text-sm py-2"
          />
          <button onClick={searchDeals} disabled={searching} className="btn-secondary text-sm px-4 py-2 whitespace-nowrap">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {deals.length > 0 && (
          <div className="space-y-1">
            {deals.map((deal) => (
              <button
                key={deal.id}
                onClick={() => {
                  setSelectedDeal(deal);
                  setDeals([]);
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white border border-cream-200 hover:border-bark-500/30 text-sm text-bark-500 transition-colors"
              >
                {deal.title}
              </button>
            ))}
          </div>
        )}
        {selectedDeal && (
          <div className="flex items-center justify-between bg-white rounded-xl border border-cream-200 px-3 py-2">
            <span className="text-sm text-bark-500 font-medium">{selectedDeal.title}</span>
            <button onClick={() => setSelectedDeal(null)} className="text-xs text-bark-500/50 hover:text-bark-500">
              remove
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={saveToPipedrive}
            disabled={!selectedDeal || saving}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" />
            {saving ? 'Saving...' : `Save ${CHECKLIST_META[activeChecklist].saveTitle}`}
          </button>
          <button onClick={reset} className="btn-ghost text-sm px-3 py-2 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        {savedMsg && <p className={cn('text-sm font-medium', savedMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600')}>{savedMsg}</p>}
      </div>

      {orderFollowUpModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bark-500/25 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-cream-200 bg-white shadow-xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-bark-500/50 mb-1">Follow-up date</p>
              <h3 className="text-lg font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                When should we follow up to restart the order conversation?
              </h3>
            </div>
            <p className="text-sm text-bark-500/70">
              Pick the date they gave you and we’ll schedule a Pipedrive activity for that day when you save the onboarding call.
            </p>
            <div>
              <label className="label">Follow-up date</label>
              <input
                type="date"
                value={pendingOrderDate}
                onChange={(e) => setPendingOrderDate(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOrderFollowUpModal({ open: false, sectionIdx: null, itemId: null })}
                className="btn-ghost text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button onClick={saveOrderFollowUpDate} disabled={!pendingOrderDate} className="btn-primary text-sm px-4 py-2">
                Save date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = text ?? input.trim();
    if (!content) {
      return;
    }

    setInput('');
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setLoading(true);

    try {
      const reply = await generateSalesHubText(next.map((message) => ({ role: message.role, content: message.content })), SALES_ASSISTANT_SYSTEM);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Error reaching the AI. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => send(prompt)}
            className="text-xs px-3 py-1.5 rounded-lg bg-cream-100 border border-cream-200 text-bark-500/70 hover:text-bark-500 hover:border-bark-500/30 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
      <div className="bg-cream-100 rounded-2xl border border-cream-200 flex flex-col" style={{ minHeight: 380 }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 380 }}>
          {messages.length === 0 && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-bark-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-bark-500 border border-cream-200 max-w-lg">
                I’m your Bare Naked Pet Co. sales assistant. Ask me about the intro call, the follow-up call, objection handling, Astro, or how to phrase your next step.
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={cn('flex items-start gap-3', message.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                  message.role === 'user' ? 'bg-cream-200' : 'bg-bark-500'
                )}
              >
                {message.role === 'user' ? <User className="w-4 h-4 text-bark-500" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div
                className={cn(
                  'px-4 py-2.5 rounded-2xl text-sm border max-w-lg whitespace-pre-wrap',
                  message.role === 'user'
                    ? 'bg-bark-500 text-white border-bark-500 rounded-tr-sm'
                    : 'bg-white text-bark-500 border-cream-200 rounded-tl-sm'
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-bark-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-cream-200 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-bark-500/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-cream-200 p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about the intro call, follow-up call, objections, or Astro..."
            className="input text-sm py-2 flex-1"
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-4 py-2">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [storeName, setStoreName] = useState('');
  const [repName, setRepName] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveStoreName = storeName || selectedDeal?.title || '';

  async function generate() {
    setLoading(true);
    setOutput('');
    try {
      const text = await generateSalesHubText(
        [{ role: 'user', content: selectedTemplate.prompt(effectiveStoreName || 'the store', repName || 'the team') }],
        SALES_ASSISTANT_SYSTEM
      );
      setOutput(text);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Error generating email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => {
              setSelectedTemplate(template);
              setOutput('');
            }}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              selectedTemplate.id === template.id
                ? 'bg-bark-500 border-bark-500 text-white'
                : 'bg-cream-100 border-cream-200 text-bark-500 hover:border-bark-500/30'
            )}
          >
            <p className="text-sm font-semibold">{template.name}</p>
            <p className={cn('text-xs mt-0.5', selectedTemplate.id === template.id ? 'text-white/70' : 'text-bark-500/50')}>
              {template.desc}
            </p>
          </button>
        ))}
      </div>

      <DealSearchPicker
        label="Pipedrive deal"
        value={selectedDeal}
        onSelect={(deal) => {
          setSelectedDeal(deal);
          if (deal && !storeName) {
            setStoreName(deal.title);
          }
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Store / retailer name</label>
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Paws & Play Pet Supply" className="input text-sm" />
        </div>
        <div>
          <label className="label">Your name</label>
          <input value={repName} onChange={(e) => setRepName(e.target.value)} placeholder="Your name" className="input text-sm" />
        </div>
      </div>

      <button onClick={generate} disabled={loading} className="btn-primary flex items-center gap-2">
        <Mail className="w-4 h-4" />
        {loading ? 'Generating...' : 'Generate email'}
      </button>

      {(output || loading) && (
        <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4">
          {loading ? (
            <p className="text-sm text-bark-500/50 italic animate-pulse">Writing your email...</p>
          ) : (
            <>
              <pre className="text-sm text-bark-500 whitespace-pre-wrap font-body leading-relaxed">{output}</pre>
              <div className="flex gap-2 mt-3 pt-3 border-t border-cream-200">
                <button onClick={copy} className="btn-ghost text-sm flex items-center gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={generate} className="btn-ghost text-sm flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OnePagerTab() {
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);
  const [fields, setFields] = useState({ store: '', contact: '', rep: '', promo: '', shelf: '' });
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function generate() {
    setLoading(true);
    setOutput('');

    const store = fields.store || selectedDeal?.title || 'the store';
    const prompt = `Create a concise, professional one-pager for ${store} (contact: ${fields.contact || 'the buyer'}), written by ${fields.rep || 'the Bare Naked Pet Co. team'} at Bare Naked Pet Co. It should outline the launch and follow-up plan, including: free customer samples, supported intro promo (${fields.promo || '15–20% off retail'}, brand covers cost), shelf placement (${fields.shelf || 'endcap or eye-level'}), Astro loyalty program support, and the follow-up cadence after onboarding. Mention that sample follow-up usually happens about 3 weeks after samples are sent so the team has time to try them. Format it cleanly as plain text with clear sections. Make it compelling, practical, and partnership-focused. Under 300 words.`;

    try {
      const text = await generateSalesHubText([{ role: 'user', content: prompt }], SALES_ASSISTANT_SYSTEM);
      setOutput(text);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Error generating one-pager. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-bark-500/60">
        Fill in the retailer details to generate a customized one-pager to email or print before the onboarding call.
      </p>

      <DealSearchPicker
        label="Pipedrive deal"
        value={selectedDeal}
        onSelect={(deal) => {
          setSelectedDeal(deal);
          if (deal && !fields.store) {
            set('store', deal.title);
          }
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'store', label: 'Store name', placeholder: 'Paws & Play Pet Supply' },
          { key: 'contact', label: 'Contact / owner name', placeholder: 'Sarah' },
          { key: 'rep', label: 'Your name', placeholder: 'Your name' },
          { key: 'promo', label: 'Agreed promo discount', placeholder: '15% off retail' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="label">{label}</label>
            <input
              value={fields[key as keyof typeof fields]}
              onChange={(e) => set(key as keyof typeof fields, e.target.value)}
              placeholder={placeholder}
              className="input text-sm"
            />
          </div>
        ))}
        <div className="col-span-2">
          <label className="label">Shelf placement notes</label>
          <input
            value={fields.shelf}
            onChange={(e) => set('shelf', e.target.value)}
            placeholder="Endcap near checkout, brand covers cost"
            className="input text-sm"
          />
        </div>
      </div>

      <button onClick={generate} disabled={loading} className="btn-primary flex items-center gap-2">
        <FileText className="w-4 h-4" />
        {loading ? 'Generating...' : 'Generate one-pager'}
      </button>

      {(output || loading) && (
        <div className="bg-cream-100 rounded-2xl border border-cream-200 p-5">
          {loading ? (
            <p className="text-sm text-bark-500/50 italic animate-pulse">Building your one-pager...</p>
          ) : (
            <>
              <pre className="text-sm text-bark-500 whitespace-pre-wrap font-body leading-relaxed">{output}</pre>
              <div className="flex gap-2 mt-4 pt-3 border-t border-cream-200">
                <button onClick={copy} className="btn-ghost text-sm flex items-center gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy text'}
                </button>
                <button onClick={generate} className="btn-ghost text-sm flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SalesHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('intro');

  const tabs: Array<{ id: Tab; icon: React.ElementType; label: string; href?: string }> = [
    { id: 'intro', icon: Phone, label: 'Intro call guide' },
    { id: 'followup', icon: Phone, label: 'Follow-up call guide' },
    { id: 'checklist', icon: CheckSquare, label: 'Onboarding checklist' },
    { id: 'assistant', icon: ClipboardList, label: 'Performance', href: 'https://sales.barenakedpet.com/' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Sales Hub</h1>
        <p className="text-bark-500/60 text-sm mt-1">
          Intro and follow-up call guides, onboarding support, and quick access to sales performance tools.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 bg-cream-100 p-1.5 rounded-2xl border border-cream-200">
        {tabs.map((tab) => (
          tab.href ? (
            <a
              key={tab.label}
              href={tab.href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'text-bark-500/80 hover:text-bark-500 hover:bg-white'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </a>
          ) : (
            <TabButton key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id)} />
          )
        ))}
      </div>

      <div>
        {activeTab === 'intro' && (
          <GuideTab
            title="Intro call guide"
            subtitle="The intro call is for opening the relationship, getting permission to send samples, and setting a follow-up path. You are not trying to close the sale on call one."
            sections={INTRO_GUIDE_SECTIONS}
            cheatSheet={[
              'Goal: permission to send samples and keep the conversation alive.',
              'Before calling: find one store-specific detail online.',
              'Lead with: who handles vendors and purchasing?',
              'Core low-risk points: no minimums, free shipping, direct support.',
              'Know pricing: 6 oz $16.67 wholesale / $25 retail, 12 oz $30 wholesale / $45 retail.',
              'Close with email + samples + follow-up timing.',
            ]}
          />
        )}
        {activeTab === 'followup' && (
          <GuideTab
            title="Follow-up call guide"
            subtitle="Follow up on samples about 3 weeks after sending so the team has time to try and test them. Re-open the conversation, reinforce the launch support, and always land a next step."
            sections={FOLLOW_UP_GUIDE_SECTIONS}
            cheatSheet={[
              'Open with the samples first, not a long intro.',
              'Timing: follow up about 3 weeks after samples were sent.',
              'Core story: 5 whole-food ingredients, no minimums, free shipping, sticky repeat purchase.',
              'Astro goal: get shoppers to the third punch quickly.',
              'Use launch support as proof you are invested: samples, promo, shelf placement, Astro.',
              'Never end the call without a next action or callback date.',
            ]}
          />
        )}
        {activeTab === 'checklist' && <ChecklistTab />}
        {activeTab === 'assistant' && <AssistantTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'onepager' && <OnePagerTab />}
      </div>
    </div>
  );
}

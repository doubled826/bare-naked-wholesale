'use client';

import { useState, useRef, useEffect } from 'react';
import {
  BookOpen, CheckSquare, MessageSquare, Mail, FileText,
  ChevronDown, ChevronUp, Check, Send, Copy, RefreshCw,
  User, Bot, ClipboardList, ChevronRight, StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'playbook' | 'checklist' | 'assistant' | 'templates' | 'onepager';

interface CheckItem {
  id: string;
  label: string;
  note: string;
  talkingPoint: string;
  agreementPlaceholder: string;
  checked: boolean;
  agreement: string;
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

interface Phase {
  label: string;
  title: string;
  goal: string;
  color: string;
  bg: string;
  items: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYBOOK_SYSTEM = `You are the internal sales assistant for Bare Naked Pet Co., a whole-ingredient pet food topper brand. You help sales reps with scripts, objection handling, and strategy. Keep answers concise and practical.

BRAND PITCH: "We help pet parents bridge the gap between kibble and raw with zero-compromise toppers."

PROSPECTING: Cold call or in-person visit. Lead with the whole-ingredient differentiator. Send sample kit with table tent + QR code linking to brand video. Include 10–20 samples for VIP customers plus staff trial product. Follow up 5–7 days after samples arrive — ask "How did your shop dog like it?" not "Ready to buy?" Introduce the 30/60/90 plan early to signal long-term investment.

ONBOARDING CALL CHECKLIST: Portal walkthrough, Astro loyalty enrollment, Astro offers enrollment, sampling program agreement (sample-to-size bags at register), shelf placement discussion (endcap preferred — eye-level is buy-level — brand covers cost), intro promo agreement (15–20% off retail, brand covers cost, 2–4 weeks), 2026 promo calendar share, staff training one-pagers, explain 30/60/90 cadence, confirm 6-week check-in on calendar.

30-DAY PLAN: Heavy sampling, eye-level or endcap shelf placement, 15–20% introductory promo via Astro to lower the barrier and get customers on the hamster wheel.

60-DAY CALL: Pulse check — is product moving? Staff recommending it? Troubleshoot if slow: demo day, refresh shelf talkers, BOGO or gift with purchase. Execute corrections immediately.

90-DAY HANDOFF: Review wins, hand over annual Astro promo calendar, reinforce portal use, transition to standard account management. Frame positively: "We're graduating you, not leaving you." Ongoing support: monthly newsletter, Astro promo alerts, self-serve portal.

ASTRO: Platform for wholesale ordering, loyalty program (Buy 10 Get 1), monthly promos, and promotional offers. Retailers should sign up on the onboarding call. They must opt into each individual offer, so make sure they have the promo calendar so they can plan signage and stock up in advance.

KEY OBJECTION — "I'm not sure it'll sell": Present the 30/60/90 plan as the answer. "We have a full game plan — sampling, endcap placement, an intro promo, and the Astro loyalty program. We're invested in making this work in your store."`;

const PHASES: Phase[] = [
  {
    label: 'Prospecting',
    title: 'Phase 1 — Hook & qualify',
    goal: 'Secure trial and establish a professional follow-up rhythm',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-100',
    items: [
      'Cold call or in-person visit — lead with the whole-ingredient differentiator: "We help pet parents bridge the gap between kibble and raw."',
      'Send curated sample kit with table tent + QR code linking to brand video',
      'Include 10–20 samples for VIP customers plus enough product for staff to trial',
      'Follow up 5–7 days after samples arrive — ask "How did your shop dog like it?" not "Ready to buy?"',
      'Introduce the 30/60/90 onboarding plan early to signal long-term investment',
    ],
  },
  {
    label: 'Days 1–30',
    title: 'Phase 2 — Build momentum',
    goal: 'Drive first purchase and build store-staff confidence',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-100',
    items: [
      'Onboarding call (week 1): portal walkthrough, Astro loyalty enrollment, staff training one-pagers',
      'Sampling: provide sample-to-size bags at register — if they try it, they buy it',
      'Shelf strategy: negotiate endcap or eye-level placement; offer to cover cost',
      'Launch promo: 2–4 week introductory offer (15–20% off retail) via Astro',
      'Share the 2026 promotional calendar so they can plan inventory ahead',
    ],
  },
  {
    label: 'Days 31–60',
    title: 'Phase 3 — Optimize & add fuel',
    goal: "Evaluate what's working and course-correct fast",
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-100',
    items: [
      'Pulse check call: is product moving? Is staff recommending it to customers?',
      'Audit: review sampling conversion, promo results, and shelf performance',
      'Troubleshoot if slow: demo day, refresh shelf talkers, BOGO or gift-with-purchase',
      'Execute any course corrections immediately — don\'t let the account go stagnant',
    ],
  },
  {
    label: 'Days 61–90',
    title: 'Phase 4 — Transition to core account',
    goal: 'Hand off to standard account management and empower self-sufficiency',
    color: 'text-orange-800',
    bg: 'bg-orange-50 border-orange-100',
    items: [
      'Review the wins from the first 90 days — celebrate the partnership',
      'Hand over the annual Astro promo calendar (National Pet Month, Holiday sales, etc.)',
      'Reinforce portal as 24/7 resource: reordering, samples, marketing assets',
      'Frame the transition positively: "We\'re graduating you, not leaving you"',
      'Ongoing: monthly newsletter, Astro promo alerts, loyalty program keeps momentum going',
    ],
  },
];

const INITIAL_SECTIONS: CheckSection[] = [
  {
    title: 'Sampling program',
    items: [
      {
        id: 'sampling-agree',
        label: 'Agreed to in-store sampling program',
        note: 'Sample-to-size bags — if they try it, they buy it',
        talkingPoint: '"We do a big sampling push with every new partner — it\'s honestly the most effective thing we do. The idea is to get the product into customers\' hands right at the moment of decision. We\'ve seen it work really well near the topper section, on an endcap near the product, or even by the checkout. What spot do you think would get the most foot traffic in your store?"',
        agreementPlaceholder: 'e.g. 25 units, by the checkout aisle near register 2',
        checked: false,
        agreement: '',
      },
      {
        id: 'sampling-quantity',
        label: 'Sampling quantity and location confirmed',
        note: 'Get specific — quantity, exact location, who manages restocking',
        talkingPoint: '"How many do you think you\'d need to start? We want to make sure you have enough to make a real impact — better to have too many than run out early. And who on your team would be the point person for managing the sample display?"',
        agreementPlaceholder: 'e.g. 30 units to start, Sarah at front desk manages restocking',
        checked: false,
        agreement: '',
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
        checked: false,
        agreement: '',
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
        checked: false,
        agreement: '',
      },
      {
        id: 'promo-duration',
        label: 'Promo duration and start date confirmed',
        note: 'Pin down the dates so both sides can plan',
        talkingPoint: '"Great — let\'s nail down the dates so we can both plan around it. When would you want to kick it off, and how long do you want to run it? We usually say 2–4 weeks is the sweet spot to really get momentum going."',
        agreementPlaceholder: 'e.g. Starts April 14, runs 3 weeks through May 5',
        checked: false,
        agreement: '',
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
        checked: false,
        agreement: '',
      },
      {
        id: 'astro-loyalty',
        label: 'Enrolled in Astro loyalty program',
        note: 'Buy 10 Get 1 — punch card starts immediately',
        talkingPoint: '"While you\'re in Astro — make sure you\'re signed up for our loyalty program. It\'s a Buy 10, Get 1 free deal and it starts accumulating from your very first order. Your customers don\'t have to do anything extra — it all happens through you. We want to make sure you\'re getting credit from day one."',
        agreementPlaceholder: 'e.g. Enrolled — confirmed in Astro portal during call',
        checked: false,
        agreement: '',
      },
      {
        id: 'astro-offers',
        label: 'Aware of Astro offers and opted in',
        note: 'They must opt into each offer individually — flag this clearly',
        talkingPoint: '"One heads up — we run promotional offers through Astro throughout the year, but they do require you to opt in to each one individually. So it\'s really important you\'re keeping an eye on those. The easiest way to stay on top of it is the promo calendar — it shows you everything we have planned so you can opt in ahead of time and even build out any signage or marketing around it."',
        agreementPlaceholder: 'e.g. Opted into current offer, noted they need to opt in manually each time',
        checked: false,
        agreement: '',
      },
      {
        id: 'astro-calendar',
        label: 'Promo calendar sent and reviewed together',
        note: 'Give them lead time to plan signage, stock up, and build marketing around events',
        talkingPoint: '"Let me share our 2026 promo calendar with you — it\'s subject to change but gives you a solid picture of what\'s coming. Things like National Pet Month, holiday promos, that kind of stuff. The idea is that if you know a 15% off event is coming in six weeks, you can plan your signage, make sure you\'re stocked up, maybe put it on your social. We want to give you as much lead time as possible so you can really capitalize on these."',
        agreementPlaceholder: 'e.g. Calendar sent via email, they noted the May promo and want to build signage',
        checked: false,
        agreement: '',
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
        talkingPoint: '"Let me give you a quick tour of the portal — this is your 24/7 resource for everything. Reordering is right here, sample requests here, and we also have staff training one-pagers you can print out so your team knows how to talk about the product confidently when customers ask."',
        agreementPlaceholder: 'e.g. Toured portal, they bookmarked it, noted the staff one-pagers',
        checked: false,
        agreement: '',
      },
      {
        id: 'cadence',
        label: 'Explained the 30/60/90 follow-up cadence',
        note: 'Set clear expectations — when they\'ll hear from us and why',
        talkingPoint: '"Here\'s how we like to stay in touch after today. We\'ll give you a call in about 6 weeks — just a quick check-in to see how sampling is going, how the promo landed, if there\'s anything we can adjust. Then again around the 90-day mark, we\'ll do a full recap and at that point you\'ll be transitioning to our normal account flow which is a little less hands-on, but we\'re always here if you need us."',
        agreementPlaceholder: 'e.g. They\'re good with the cadence, prefer email over calls for check-ins',
        checked: false,
        agreement: '',
      },
      {
        id: 'checkin-booked',
        label: '6-week check-in call booked',
        note: 'Get a date and time before hanging up — send Calendly link if needed',
        talkingPoint: '"Before we wrap up — let\'s actually get that 6-week call on the calendar now so it doesn\'t fall through the cracks. I can send you a Calendly link and you can grab whatever time works best, or we can pick something right now. What\'s easier for you?"',
        agreementPlaceholder: 'e.g. Booked for May 19 at 2pm EST / Calendly link sent',
        checked: false,
        agreement: '',
      },
      {
        id: 'materials',
        label: 'Table tent + QR code materials confirmed sent',
        note: 'Verify shipping address and quantity',
        talkingPoint: '"Last thing — we\'ll be sending over your table tent and QR code materials. The QR code links customers to a short brand video that gets them excited about the product. Can you confirm the best shipping address? And how many do you think you\'ll need?"',
        agreementPlaceholder: 'e.g. Shipping to 123 Main St, need 3 table tents for 3 checkout locations',
        checked: false,
        agreement: '',
      },
    ],
  },
];

const TEMPLATES: Template[] = [
  {
    id: 'sample-followup',
    name: 'Sample follow-up',
    desc: '5–7 days after samples sent',
    prompt: (store, rep) =>
      `Write a short, warm follow-up email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}, sent 5–7 days after they received samples. Ask how their shop dog and staff liked the product. Mention you're excited to share the 30/60/90 onboarding plan if they want to move forward. Under 150 words, conversational, not salesy. Include a subject line.`,
  },
  {
    id: '30-day',
    name: '30-day check-in',
    desc: 'First pulse check follow-up',
    prompt: (store, rep) =>
      `Write a 30-day check-in email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}. Reference the sampling program, promo, and shelf placement set up at onboarding. Ask how things are going and if there's anything the brand can do to support them. Offer a quick call. Under 150 words, warm and supportive. Include a subject line.`,
  },
  {
    id: '60-day',
    name: '60-day optimization',
    desc: 'Mid-point review and next steps',
    prompt: (store, rep) =>
      `Write a 60-day optimization email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}. Reference the progress made in the first 30 days. Mention reviewing results together and whether a second promo or demo day would help drive more velocity. Friendly, solution-focused. Under 150 words. Include a subject line.`,
  },
  {
    id: '90-day',
    name: '90-day handoff',
    desc: 'Transition to core account',
    prompt: (store, rep) =>
      `Write a 90-day handoff email from ${rep} at Bare Naked Pet Co. to the buyer at ${store}. Celebrate the wins from the first 90 days. Explain the transition to standard account management — they'll get monthly newsletters, ongoing Astro promos, and can always reach out. Frame it as "graduating" to a long-term partnership, not being abandoned. Under 175 words. Include a subject line.`,
  },
];

// ─── Pipedrive helpers ────────────────────────────────────────────────────────

const PIPEDRIVE_TOKEN = '75a332c3eb4c02b620776bcf329643e36e6f0db6';
const PD_BASE = 'https://api.pipedrive.com/v1';

async function searchPipedriveDeals(query: string) {
  const res = await fetch(
    `${PD_BASE}/deals/search?term=${encodeURIComponent(query)}&api_token=${PIPEDRIVE_TOKEN}&limit=5`
  );
  const data = await res.json();
  return data.data?.items ?? [];
}

async function addNoteToDeal(dealId: number, content: string) {
  const res = await fetch(`${PD_BASE}/notes?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal_id: dealId, content }),
  });
  return res.json();
}

async function createActivity(dealId: number, subject: string, dueDate: string) {
  const res = await fetch(`${PD_BASE}/activities?api_token=${PIPEDRIVE_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, type: 'call', deal_id: dealId, due_date: dueDate, done: 0 }),
  });
  return res.json();
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── Gemini API helper ────────────────────────────────────────────────────────

const GEMINI_API_KEY = 'AIzaSyDl7IcjpdfnwnFdd5uXhMkCLMw1lTJ-QYw';
const GEMINI_MODEL = 'gemini-2.0-flash';

async function askClaude(messages: { role: string; content: string }[], system: string): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 600 },
      }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Something went wrong. Please try again.';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ active, icon: Icon, label, onClick }: {
  active: boolean; icon: React.ElementType; label: string; onClick: () => void;
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

// ─── Playbook Tab ─────────────────────────────────────────────────────────────

function PlaybookTab() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {PHASES.map((phase, i) => (
        <div key={i} className={cn('rounded-2xl border', phase.bg)}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-semibold px-3 py-1 rounded-full bg-white/60 border', phase.color, 'border-current/20')}>
                {phase.label}
              </span>
              <span className="font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
                {phase.title}
              </span>
            </div>
            {open === i ? <ChevronUp className="w-4 h-4 text-bark-500/50" /> : <ChevronDown className="w-4 h-4 text-bark-500/50" />}
          </button>
          {open === i && (
            <div className="px-5 pb-5">
              <p className="text-sm text-bark-500/60 mb-3 italic">Goal: {phase.goal}</p>
              <ul className="space-y-2">
                {phase.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-sm text-bark-500">
                    <span className="mt-2 w-1.5 h-1.5 min-w-[6px] rounded-full bg-bark-500/30" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
      <div className="bg-cream-100 rounded-2xl border border-cream-200 p-5">
        <p className="font-semibold text-bark-500 mb-3" style={{ fontFamily: 'var(--font-poppins)' }}>Success metrics</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Prospecting', 'Sample kit requested & QR code scanned'],
            ['30 days', 'Astro activated & first reorder placed'],
            ['60 days', 'Staff feedback collected & secondary promo executed if needed'],
            ['90 days', 'Promo calendar handed over; account is self-sufficient'],
          ].map(([stage, metric]) => (
            <div key={stage} className="bg-white rounded-xl p-3 border border-cream-200">
              <p className="text-xs font-semibold text-bark-500/60 uppercase tracking-wide mb-1">{stage}</p>
              <p className="text-bark-500">{metric}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-bark-500/60 italic border-t border-cream-200 pt-3">
          We aren't selling a bag of food — we're selling a partnership. The 30/60/90 plan is your strongest closing tool because it removes the risk for the retailer.
        </p>
      </div>
    </div>
  );
}

// ─── Checklist Tab (v2) ───────────────────────────────────────────────────────

function ChecklistTab() {
  const [sections, setSections] = useState<CheckSection[]>(INITIAL_SECTIONS);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [dealQuery, setDealQuery] = useState('');
  const [deals, setDeals] = useState<any[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const allItems = sections.flatMap(s => s.items);
  const checkedCount = allItems.filter(i => i.checked).length;
  const total = allItems.length;
  const pct = Math.round((checkedCount / total) * 100);

  function toggleCheck(sectionIdx: number, itemId: string) {
    setSections(prev => prev.map((s, si) =>
      si !== sectionIdx ? s : {
        ...s,
        items: s.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item),
      }
    ));
  }

  function updateAgreement(sectionIdx: number, itemId: string, value: string) {
    setSections(prev => prev.map((s, si) =>
      si !== sectionIdx ? s : {
        ...s,
        items: s.items.map(item => item.id === itemId ? { ...item, agreement: value } : item),
      }
    ));
  }

  function reset() {
    setSections(INITIAL_SECTIONS.map(s => ({ ...s, items: s.items.map(i => ({ ...i, checked: false, agreement: '' })) })));
    setSelectedDeal(null);
    setDeals([]);
    setDealQuery('');
    setSavedMsg('');
    setExpandedItem(null);
  }

  async function searchDeals() {
    if (!dealQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchPipedriveDeals(dealQuery);
      setDeals(results.map((r: any) => r.item));
    } catch { setDeals([]); }
    finally { setSearching(false); }
  }

  async function saveToPipedrive() {
    if (!selectedDeal) return;
    setSaving(true);
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lines: string[] = [`Onboarding call summary — ${date}\n`];
    sections.forEach(section => {
      lines.push(`\n## ${section.title}`);
      section.items.forEach(item => {
        const status = item.checked ? '✓' : '✗';
        lines.push(`${status} ${item.label}`);
        if (item.agreement) lines.push(`   → ${item.agreement}`);
      });
    });
    const unchecked = allItems.filter(i => !i.checked);
    if (unchecked.length) lines.push(`\nFollow up needed on: ${unchecked.map(i => i.label).join(', ')}`);
    try {
      await addNoteToDeal(selectedDeal.id, lines.join('\n'));
      await createActivity(selectedDeal.id, 'BNP — 6-week check-in call', addDays(42));
      await createActivity(selectedDeal.id, 'BNP — 90-day handoff call', addDays(90));
      setSavedMsg('Saved to Pipedrive ✓ — call summary added to deal notes and follow-up activities created for 6-week and 90-day calls.');
    } catch {
      setSavedMsg('Error saving to Pipedrive. Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-bark-500">{checkedCount} of {total} complete</span>
          <span className="text-sm font-semibold text-bark-500">{pct}%</span>
        </div>
        <div className="w-full bg-cream-200 rounded-full h-2">
          <div className="bg-bark-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {checkedCount === total && (
          <p className="text-sm text-emerald-600 font-medium mt-2">All items covered — great call!</p>
        )}
      </div>

      {/* Checklist sections */}
      {sections.map((section, si) => (
        <div key={si}>
          <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wider mb-2">{section.title}</p>
          <div className="space-y-2">
            {section.items.map(item => {
              const isExpanded = expandedItem === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-xl border transition-all duration-150',
                    item.checked ? 'bg-emerald-50 border-emerald-100' : 'bg-cream-100 border-cream-200'
                  )}
                >
                  {/* Item header row */}
                  <div className="flex items-start gap-3 p-3.5">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleCheck(si, item.id)}
                      className={cn(
                        'mt-0.5 w-5 h-5 min-w-[20px] rounded-md border flex items-center justify-center transition-colors flex-shrink-0',
                        item.checked ? 'bg-bark-500 border-bark-500' : 'border-cream-300 bg-white'
                      )}
                    >
                      {item.checked && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Label + note */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium text-bark-500', item.checked && 'line-through text-bark-500/50')}>
                        {item.label}
                      </p>
                      <p className="text-xs text-bark-500/50 mt-0.5">{item.note}</p>
                      {/* Agreement summary when collapsed */}
                      {!isExpanded && item.agreement && (
                        <p className="text-xs text-emerald-700 mt-1 font-medium">→ {item.agreement}</p>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      className="flex-shrink-0 flex items-center gap-1 text-xs text-bark-500/40 hover:text-bark-500 transition-colors mt-0.5 px-1"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Expanded: talking point + agreement field */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-cream-200 pt-3">
                      {/* Talking point */}
                      <div className="bg-white rounded-xl border border-cream-200 p-3">
                        <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-1.5">Suggested talking point</p>
                        <p className="text-sm text-bark-500 italic leading-relaxed">{item.talkingPoint}</p>
                      </div>
                      {/* Agreement notes */}
                      <div>
                        <p className="text-xs font-semibold text-bark-500/50 uppercase tracking-wide mb-1.5">What did you agree on?</p>
                        <textarea
                          value={item.agreement}
                          onChange={e => updateAgreement(si, item.id, e.target.value)}
                          placeholder={item.agreementPlaceholder}
                          rows={2}
                          className="input text-sm resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Pipedrive sync */}
      <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
          Save to Pipedrive
        </p>
        <p className="text-xs text-bark-500/50">
          Saves a full call summary (including agreement notes) to the deal record and auto-creates the 6-week and 90-day follow-up activities.
        </p>
        <div className="flex gap-2">
          <input
            value={dealQuery}
            onChange={e => setDealQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchDeals()}
            placeholder="Search deal by retailer name..."
            className="input text-sm py-2"
          />
          <button onClick={searchDeals} disabled={searching} className="btn-secondary text-sm px-4 py-2 whitespace-nowrap">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {deals.length > 0 && (
          <div className="space-y-1">
            {deals.map((deal: any) => (
              <button
                key={deal.id}
                onClick={() => { setSelectedDeal(deal); setDeals([]); }}
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
            <button onClick={() => setSelectedDeal(null)} className="text-xs text-bark-500/50 hover:text-bark-500">remove</button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={saveToPipedrive}
            disabled={!selectedDeal || saving}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save summary + create follow-ups'}
          </button>
          <button onClick={reset} className="btn-ghost text-sm px-3 py-2 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        {savedMsg && (
          <p className={cn('text-sm font-medium', savedMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600')}>
            {savedMsg}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── AI Assistant Tab ─────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "What do I say if a retailer pushes back on the promo terms?",
  "Give me the script for the 60-day pulse check call.",
  "A retailer hasn't activated Astro yet — how do I bring it up?",
  "What's the best way to pitch endcap placement?",
  "How do I handle the 'it seems niche' objection?",
];

function AssistantTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send(text?: string) {
    const content = text ?? input.trim();
    if (!content) return;
    setInput('');
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await askClaude(next.map(m => ({ role: m.role, content: m.content })), PLAYBOOK_SYSTEM);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error reaching the AI. Please try again.' }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => send(p)}
            className="text-xs px-3 py-1.5 rounded-lg bg-cream-100 border border-cream-200 text-bark-500/70 hover:text-bark-500 hover:border-bark-500/30 transition-colors">
            {p}
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
                Hey — I'm your Bare Naked Pet Co. sales assistant. Ask me anything about the playbook, objection handling, call scripts, or Astro. I'm here to help you close.
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex items-start gap-3', msg.role === 'user' && 'flex-row-reverse')}>
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', msg.role === 'user' ? 'bg-cream-200' : 'bg-bark-500')}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-bark-500" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={cn('px-4 py-2.5 rounded-2xl text-sm border max-w-lg whitespace-pre-wrap',
                msg.role === 'user' ? 'bg-bark-500 text-white border-bark-500 rounded-tr-sm' : 'bg-white text-bark-500 border-cream-200 rounded-tl-sm')}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-bark-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-cream-200 flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-bark-500/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-cream-200 p-3 flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about the playbook, scripts, objections..."
            className="input text-sm py-2 flex-1" />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-4 py-2">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [storeName, setStoreName] = useState('');
  const [repName, setRepName] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true); setOutput('');
    try {
      const text = await askClaude(
        [{ role: 'user', content: selectedTemplate.prompt(storeName || 'the store', repName || 'the team') }],
        PLAYBOOK_SYSTEM
      );
      setOutput(text);
    } catch { setOutput('Error generating email. Please try again.'); }
    finally { setLoading(false); }
  }

  function copy() { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => { setSelectedTemplate(t); setOutput(''); }}
            className={cn('p-3 rounded-xl border text-left transition-all',
              selectedTemplate.id === t.id ? 'bg-bark-500 border-bark-500 text-white' : 'bg-cream-100 border-cream-200 text-bark-500 hover:border-bark-500/30')}>
            <p className="text-sm font-semibold">{t.name}</p>
            <p className={cn('text-xs mt-0.5', selectedTemplate.id === t.id ? 'text-white/70' : 'text-bark-500/50')}>{t.desc}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Store / retailer name</label><input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Paws & Play Pet Supply" className="input text-sm" /></div>
        <div><label className="label">Your name</label><input value={repName} onChange={e => setRepName(e.target.value)} placeholder="Your name" className="input text-sm" /></div>
      </div>
      <button onClick={generate} disabled={loading} className="btn-primary flex items-center gap-2">
        <Mail className="w-4 h-4" />{loading ? 'Generating...' : 'Generate email'}
      </button>
      {(output || loading) && (
        <div className="bg-cream-100 rounded-2xl border border-cream-200 p-4">
          {loading ? <p className="text-sm text-bark-500/50 italic animate-pulse">Writing your email...</p> : (
            <>
              <pre className="text-sm text-bark-500 whitespace-pre-wrap font-body leading-relaxed">{output}</pre>
              <div className="flex gap-2 mt-3 pt-3 border-t border-cream-200">
                <button onClick={copy} className="btn-ghost text-sm flex items-center gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={generate} className="btn-ghost text-sm flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── One-Pager Tab ────────────────────────────────────────────────────────────

function OnePagerTab() {
  const [fields, setFields] = useState({ store: '', contact: '', rep: '', promo: '', shelf: '' });
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function set(key: keyof typeof fields, val: string) { setFields(prev => ({ ...prev, [key]: val })); }

  async function generate() {
    setLoading(true); setOutput('');
    const { store, contact, rep, promo, shelf } = fields;
    const prompt = `Create a concise, professional one-pager for ${store || 'the store'} (contact: ${contact || 'the buyer'}), written by ${rep || 'the Bare Naked Pet Co. team'} at Bare Naked Pet Co. It should outline the 30/60/90 day partnership plan including: in-store sampling program, agreed intro promo (${promo || '15–20% off retail'}, brand covers cost), shelf placement (${shelf || 'endcap or eye-level'}), Astro loyalty program enrollment, and the follow-up cadence (6-week check-in, 90-day handoff). Format it cleanly as plain text with clear sections. Make it compelling — this is a sales tool that shows we're invested in their success. Under 300 words.`;
    try {
      const text = await askClaude([{ role: 'user', content: prompt }], PLAYBOOK_SYSTEM);
      setOutput(text);
    } catch { setOutput('Error generating one-pager. Please try again.'); }
    finally { setLoading(false); }
  }

  function copy() { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div className="space-y-4">
      <p className="text-sm text-bark-500/60">Fill in the retailer details to generate a customized one-pager to email or print before the onboarding call.</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'store', label: 'Store name', placeholder: 'Paws & Play Pet Supply' },
          { key: 'contact', label: 'Contact / owner name', placeholder: 'Sarah' },
          { key: 'rep', label: 'Your name', placeholder: 'Your name' },
          { key: 'promo', label: 'Agreed promo discount', placeholder: '15% off retail' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}><label className="label">{label}</label>
            <input value={fields[key as keyof typeof fields]} onChange={e => set(key as keyof typeof fields, e.target.value)} placeholder={placeholder} className="input text-sm" />
          </div>
        ))}
        <div className="col-span-2"><label className="label">Shelf placement notes</label>
          <input value={fields.shelf} onChange={e => set('shelf', e.target.value)} placeholder="Endcap near checkout, brand covers cost" className="input text-sm" />
        </div>
      </div>
      <button onClick={generate} disabled={loading} className="btn-primary flex items-center gap-2">
        <FileText className="w-4 h-4" />{loading ? 'Generating...' : 'Generate one-pager'}
      </button>
      {(output || loading) && (
        <div className="bg-cream-100 rounded-2xl border border-cream-200 p-5">
          {loading ? <p className="text-sm text-bark-500/50 italic animate-pulse">Building your one-pager...</p> : (
            <>
              <pre className="text-sm text-bark-500 whitespace-pre-wrap font-body leading-relaxed">{output}</pre>
              <div className="flex gap-2 mt-4 pt-3 border-t border-cream-200">
                <button onClick={copy} className="btn-ghost text-sm flex items-center gap-1.5">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied!' : 'Copy text'}
                </button>
                <button onClick={generate} className="btn-ghost text-sm flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Regenerate</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('playbook');

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'playbook', icon: BookOpen, label: 'Playbook' },
    { id: 'checklist', icon: CheckSquare, label: 'Onboarding checklist' },
    { id: 'assistant', icon: MessageSquare, label: 'AI assistant' },
    { id: 'templates', icon: Mail, label: 'Email templates' },
    { id: 'onepager', icon: FileText, label: 'One-pager' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Sales Hub</h1>
        <p className="text-bark-500/60 text-sm mt-1">Playbook, onboarding checklist, AI assistant, and retailer tools — all in one place.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 bg-cream-100 p-1.5 rounded-2xl border border-cream-200">
        {tabs.map(t => (
          <TabButton key={t.id} active={activeTab === t.id} icon={t.icon} label={t.label} onClick={() => setActiveTab(t.id)} />
        ))}
      </div>
      <div>
        {activeTab === 'playbook' && <PlaybookTab />}
        {activeTab === 'checklist' && <ChecklistTab />}
        {activeTab === 'assistant' && <AssistantTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'onepager' && <OnePagerTab />}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, Clock, Gift, MailCheck, MessageCircle, PackageCheck, Users, Workflow } from 'lucide-react';
import {
  DAVID_EMAIL,
  RETAILER_ONE_PAGER_URL,
  WHOLESALE_SIGNUP_URL,
  wholesaleLeadFollowupStages,
} from '@/lib/wholesaleLeadFollowupTemplates';

const automationGroups = [
  {
    id: 'welcome-offer',
    title: 'Welcome Offer',
    description: 'Reminder sequence for retailers who have not used their first-order offer yet.',
    icon: Gift,
    cadence: 'Day 1, day 7, day 11, and final reminder around day 13 after account creation.',
    trigger: 'Retailer creates a wholesale account and has not placed an order.',
    destination: 'Retailer email',
  },
  {
    id: 'private-launch-promo',
    title: 'Private Launch Promo',
    description: 'Automated date capture, schedule confirmation, launch reminders, and POS summary follow-up.',
    icon: Gift,
    cadence: 'Daily status check; dates-needed, pre-launch, launch-day, post-promo, and POS-summary reminders.',
    trigger: 'Retailer claims the Welcome Offer or schedules a promo from the dashboard.',
    destination: 'Retailer email and Private Promos admin overview',
  },
  {
    id: 'order-updates',
    title: 'Order Updates',
    description: 'Transactional emails for confirmations, invoices, and shipping notifications.',
    icon: PackageCheck,
    cadence: 'Triggered by order and fulfillment actions.',
    trigger: 'Order creation, invoice send, or shipping notification.',
    destination: 'Retailer email and internal order workflow',
  },
  {
    id: 'portal-activity',
    title: 'Portal Activity',
    description: 'Alerts for account updates, samples, retailer messages, and internal admin notifications.',
    icon: Bell,
    cadence: 'Triggered by portal activity.',
    trigger: 'Retailer/admin actions that need team visibility.',
    destination: 'Admin notification email',
  },
  {
    id: 'customer-review-outreach',
    title: 'Customer Review Outreach',
    description: 'Follow-up emails tied to customer review requests and retailer success moments.',
    icon: MessageCircle,
    cadence: 'Manual/admin-triggered outreach.',
    trigger: 'Admin selects eligible prospects or retailers.',
    destination: 'Prospect or retailer email',
  },
  {
    id: 'wholesale-sample-followup',
    title: 'Wholesale Sample Follow-up',
    description: 'Automated retailer follow-ups after a sample request is approved.',
    icon: Users,
    cadence: 'Day 14, day 21, and day 30 after sample approval.',
    trigger: 'Admin approves a wholesale sample request.',
    destination: 'Retailer email, plus optional rep outreach request to admin',
  },
];

const previewLead = {
  id: 'sample-lead-id',
  contact_name: 'Jane',
  email: 'jane@yourstore.com',
  store_name: 'Paws & Co.',
};

export default function AdminAutomationsPage() {
  const [selectedAutomationId, setSelectedAutomationId] = useState('wholesale-sample-followup');
  const selectedAutomation = automationGroups.find((group) => group.id === selectedAutomationId) || automationGroups[0];
  const SelectedIcon = selectedAutomation.icon;
  const isWholesaleSampleFollowup = selectedAutomation.id === 'wholesale-sample-followup';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-cream-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-bark-500" style={{ fontFamily: 'var(--font-poppins)' }}>
              Automations
            </h1>
            <p className="text-sm text-bark-500/60 mt-1">
              Automated email workflows separated from build-your-own campaigns.
            </p>
          </div>
          <Link
            href="/admin/email-templates"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bark-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-bark-600"
          >
            <MailCheck className="h-4 w-4" />
            Review Templates
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {automationGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedAutomationId(group.id)}
            className={`rounded-xl border p-5 text-left shadow-sm transition-colors ${
              selectedAutomationId === group.id
                ? 'border-bark-500 bg-cream-50'
                : 'border-gray-100 bg-white hover:border-cream-300 hover:bg-cream-50/40'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                selectedAutomationId === group.id ? 'bg-bark-500 text-white' : 'bg-cream-100 text-bark-500'
              }`}>
                <group.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{group.title}</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">{group.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-bark-500/70">{group.cadence}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-100 text-bark-500">
                <SelectedIcon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedAutomation.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{selectedAutomation.description}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2 text-xs font-semibold text-bark-500">
            {selectedAutomation.cadence}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Trigger</p>
            <p className="mt-2 text-sm leading-6 text-gray-800">{selectedAutomation.trigger}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destination</p>
            <p className="mt-2 text-sm leading-6 text-gray-800">{selectedAutomation.destination}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Where to review</p>
            <p className="mt-2 text-sm leading-6 text-gray-800">
              {isWholesaleSampleFollowup
                ? 'Email copy is previewed below and shared with the sending cron.'
                : 'Templates and transactional copy are split between the template library and code-based workflow routes.'}
            </p>
          </div>
        </div>

        {isWholesaleSampleFollowup ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {wholesaleLeadFollowupStages.map((stage) => (
              <div key={stage.key} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-bark-500 ring-1 ring-cream-200">
                      <Clock className="h-3.5 w-3.5" />
                      Day {stage.dayOffset}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-gray-900">{stage.headline}</h3>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{stage.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</p>
                    <p className="mt-1 text-sm leading-6 text-gray-700">{stage.preview}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Body</p>
                    <div className="mt-2 space-y-2 text-sm leading-6 text-gray-700">
                      {stage.body(previewLead).map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-cream-200 bg-white p-3 text-sm text-gray-700">
                    <p className="font-semibold text-bark-500">Email CTAs</p>
                    <p className="mt-2">Primary: {stage.ctaLabel} to {WHOLESALE_SIGNUP_URL}</p>
                    <p className="mt-1">Secondary: Talk to a rep to lead-specific request form</p>
                    <p className="mt-1">Retailer one-pager: {RETAILER_ONE_PAGER_URL}</p>
                    <p className="mt-1">Questions: {DAVID_EMAIL}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-bark-500/20 bg-cream-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-bark-500">
                  <MailCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-bark-500">Template previews</h3>
                  <p className="mt-1 text-sm leading-6 text-bark-500/70">
                    Open the template library for the detailed preview where this workflow uses reusable email templates.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/email-templates"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-bark-500/20 bg-white px-4 py-2 text-sm font-semibold text-bark-500 transition-colors hover:bg-cream-100"
              >
                Open Templates
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-bark-500/30 bg-cream-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-bark-500">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-bark-500">Automation controls</h2>
              <p className="mt-1 text-sm leading-6 text-bark-500/70">
                The automated email logic currently lives in code and scheduled API routes. Use Templates to review the copy those workflows send.
              </p>
            </div>
          </div>
          <Link
            href="/admin/email-templates"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-bark-500/20 bg-white px-4 py-2 text-sm font-semibold text-bark-500 transition-colors hover:bg-cream-100"
          >
            Open Templates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

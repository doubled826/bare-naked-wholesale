'use client';

import Link from 'next/link';
import { ArrowRight, Bell, Gift, MailCheck, MessageCircle, PackageCheck, Workflow } from 'lucide-react';

const automationGroups = [
  {
    title: 'Welcome Offer',
    description: 'Reminder sequence for retailers who have not used their first-order offer yet.',
    icon: Gift,
  },
  {
    title: 'Order Updates',
    description: 'Transactional emails for confirmations, invoices, and shipping notifications.',
    icon: PackageCheck,
  },
  {
    title: 'Portal Activity',
    description: 'Alerts for account updates, samples, retailer messages, and internal admin notifications.',
    icon: Bell,
  },
  {
    title: 'Customer Review Outreach',
    description: 'Follow-up emails tied to customer review requests and retailer success moments.',
    icon: MessageCircle,
  },
];

export default function AdminAutomationsPage() {
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
          <div key={group.title} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-bark-500">
                <group.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{group.title}</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">{group.description}</p>
              </div>
            </div>
          </div>
        ))}
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

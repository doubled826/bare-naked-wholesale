'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Plus, RefreshCw, Trash2, UserMinus, Users } from 'lucide-react';
import type { RetailerLocation } from '@/types';

type TeamMember = {
  id: string;
  role: 'owner' | 'staff';
  status: 'active' | 'disabled';
  display_name: string;
  email: string;
  locations?: Array<{ location_id: string }>;
};

type Invitation = {
  id: string;
  display_name: string;
  email: string;
  expires_at: string;
  locations?: Array<{ location_id: string }>;
};

export function TeamMembers({ locations }: { locations: RetailerLocation[] }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ displayName: '', email: '', locationIds: [] as string[] });

  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location.location_name])), [locations]);

  const loadTeam = async () => {
    setLoading(true);
    const response = await fetch('/api/team');
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMembers(payload.members || []);
      setInvitations(payload.invitations || []);
    } else {
      setNotice(payload.error || 'Unable to load team members.');
    }
    setLoading(false);
  };

  useEffect(() => { loadTeam(); }, []);

  const toggleLocation = (locationId: string) => {
    setForm((current) => ({
      ...current,
      locationIds: current.locationIds.includes(locationId)
        ? current.locationIds.filter((id) => id !== locationId)
        : [...current.locationIds, locationId],
    }));
  };

  const invite = async () => {
    setSaving(true);
    setNotice('');
    const response = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setNotice(payload.error || 'Unable to send invitation.');
      return;
    }
    setNotice(`Invitation sent to ${form.email}.`);
    setForm({ displayName: '', email: '', locationIds: [] });
    setShowInvite(false);
    await loadTeam();
  };

  const invitationAction = async (action: 'resend' | 'cancel', invitationId: string) => {
    setSaving(true);
    const response = await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, invitationId }) });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    setNotice(response.ok ? (action === 'resend' ? 'Invitation resent.' : 'Invitation canceled.') : payload.error || 'Unable to update invitation.');
    if (response.ok) await loadTeam();
  };

  const removeMember = async (membershipId: string) => {
    if (!window.confirm('Remove this staff member’s portal access? Their past orders will remain attributed to them.')) return;
    setSaving(true);
    const response = await fetch(`/api/team?membershipId=${encodeURIComponent(membershipId)}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    setNotice(response.ok ? 'Staff access removed.' : payload.error || 'Unable to remove staff access.');
    if (response.ok) await loadTeam();
  };

  const updateMemberLocations = async (member: TeamMember, locationId: string) => {
    const currentIds = (member.locations || []).map((item) => item.location_id);
    const locationIds = currentIds.includes(locationId)
      ? currentIds.filter((id) => id !== locationId)
      : [...currentIds, locationId];
    if (!locationIds.length) {
      setNotice('Staff must keep access to at least one location.');
      return;
    }
    setSaving(true);
    const response = await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'locations', membershipId: member.id, locationIds }) });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    setNotice(response.ok ? 'Store access updated.' : payload.error || 'Unable to update store access.');
    if (response.ok) await loadTeam();
  };

  const locationLabel = (items?: Array<{ location_id: string }>) => {
    const names = (items || []).map((item) => locationById.get(item.location_id)).filter(Boolean);
    return names.length ? names.join(', ') : 'No locations assigned';
  };

  if (loading) return <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-bark-500" /></div>;

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title flex items-center gap-2"><Users className="w-5 h-5" /> Team Members</h2>
          <p className="text-sm text-bark-500/70 mt-1">Invite staff and choose which stores they can order for.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowInvite(true)}><Plus className="w-4 h-4 mr-2" /> Invite Staff</button>
      </div>

      {notice && <div className="rounded-xl bg-cream-200 px-4 py-3 text-sm text-bark-500">{notice}</div>}

      {showInvite && (
        <div className="rounded-xl bg-cream-200 p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          </div>
          <div>
            <p className="label">Store access</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {locations.map((location) => (
                <label key={location.id} className="flex items-center gap-3 rounded-lg border border-cream-300 bg-white px-3 py-3 text-sm text-bark-500">
                  <input type="checkbox" checked={form.locationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} />
                  <span>{location.location_name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3"><button className="btn-primary" disabled={saving} onClick={invite}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invitation'}</button><button className="btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button></div>
        </div>
      )}

      <div className="divide-y divide-cream-200 rounded-xl border border-cream-200">
        {members.filter((member) => member.status === 'active').map((member) => (
          <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1"><p className="font-semibold text-bark-500">{member.display_name || member.email}</p><p className="text-sm text-bark-500/60">{member.email}</p><p className="text-xs text-bark-500/60 mt-1">{member.role === 'owner' ? 'Owner · All locations' : `Staff · ${locationLabel(member.locations)}`}</p>
              {member.role === 'staff' && <div className="mt-3 flex flex-wrap gap-2">{locations.map((location) => <label key={location.id} className="flex items-center gap-2 rounded-full border border-cream-300 px-3 py-1.5 text-xs text-bark-500"><input type="checkbox" disabled={saving} checked={(member.locations || []).some((item) => item.location_id === location.id)} onChange={() => updateMemberLocations(member, location.id)} />{location.location_name}</label>)}</div>}
            </div>
            {member.role === 'staff' && <button className="btn-ghost text-red-600" disabled={saving} onClick={() => removeMember(member.id)}><UserMinus className="w-4 h-4 mr-2" /> Remove</button>}
          </div>
        ))}
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between bg-cream-50">
            <div><p className="font-semibold text-bark-500">{invitation.display_name}</p><p className="text-sm text-bark-500/60">{invitation.email}</p><p className="text-xs text-amber-700 mt-1">Invitation pending · {locationLabel(invitation.locations)}</p></div>
            <div className="flex gap-2"><button className="btn-ghost" disabled={saving} onClick={() => invitationAction('resend', invitation.id)}><RefreshCw className="w-4 h-4 mr-2" /> Resend</button><button className="btn-ghost text-red-600" disabled={saving} onClick={() => invitationAction('cancel', invitation.id)}><Trash2 className="w-4 h-4" /></button></div>
          </div>
        ))}
        {members.length === 0 && invitations.length === 0 && <div className="p-8 text-center text-sm text-bark-500/60"><Mail className="w-6 h-6 mx-auto mb-2" />No team members yet.</div>}
      </div>
    </div>
  );
}

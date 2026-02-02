'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Send, Users, Megaphone, X, CheckCircle, AlertCircle, Plus, Edit2, Trash2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement { id: string; title: string; message: string; is_active: boolean; created_at: string }
interface Retailer { id: string; company_name: string }

export default function AdminCommunicationsPage() {
  const supabase = createClientComponentClient();
  const [activeTab, setActiveTab] = useState<'announcements' | 'email'>('announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', is_active: true });
  const [emailForm, setEmailForm] = useState({ recipients: 'all' as 'all' | 'selected', selectedRetailers: [] as string[], subject: '', message: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: ann } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      setAnnouncements(ann || []);
      const { data: ret } = await supabase.from('retailers').select('id, company_name').order('company_name');
      setRetailers(ret || []);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const showNotificationMessage = (msg: string, type: 'success' | 'error') => { setNotification({ message: msg, type }); setTimeout(() => setNotification({ message: '', type: '' }), 3000); };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.message) { showNotificationMessage('Fill all fields', 'error'); return; }
    setIsSubmitting(true);
    try {
      if (isEditing && selectedAnnouncement) { await supabase.from('announcements').update(announcementForm).eq('id', selectedAnnouncement.id); }
      else { await supabase.from('announcements').insert(announcementForm); }
      showNotificationMessage(isEditing ? 'Updated' : 'Created', 'success');
      setShowAnnouncementModal(false); fetchData();
    } catch (e) { showNotificationMessage('Failed', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.message) { showNotificationMessage('Fill subject and message', 'error'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/communications/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailForm) });
      const data = await res.json();
      showNotificationMessage(`Sent to ${data.count || 0} retailers`, 'success');
      setShowEmailModal(false); setEmailForm({ recipients: 'all', selectedRetailers: [], subject: '', message: '' });
    } catch (e) { showNotificationMessage('Failed', 'error'); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div></div>;

  return (
    <div className="space-y-6">
      {notification.message && <div className={cn("fixed top-20 right-6 z-50 border rounded-xl p-4 shadow-lg flex items-center gap-3", notification.type === 'success' ? "bg-white border-gray-200" : "bg-red-50 border-red-200")}>{notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}<span>{notification.message}</span></div>}

      <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100 inline-flex">
        <button onClick={() => setActiveTab('announcements')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium", activeTab === 'announcements' ? "bg-bark-500 text-white" : "text-gray-600 hover:bg-gray-100")}><Megaphone className="w-4 h-4" />Announcements</button>
        <button onClick={() => setActiveTab('email')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium", activeTab === 'email' ? "bg-bark-500 text-white" : "text-gray-600 hover:bg-gray-100")}><Mail className="w-4 h-4" />Email Retailers</button>
      </div>

      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div><h3 className="text-lg font-semibold text-gray-900">Announcements</h3><p className="text-sm text-gray-500">Shown on retailer dashboard</p></div>
            <button onClick={() => { setIsEditing(false); setAnnouncementForm({ title: '', message: '', is_active: true }); setShowAnnouncementModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600"><Plus className="w-4 h-4" />New</button>
          </div>
          {announcements.length === 0 ? <div className="bg-white rounded-xl p-12 text-center border"><Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p className="text-gray-500">No announcements</p></div> : announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-start justify-between">
                <div><div className="flex items-center gap-2 mb-2"><h4 className="font-semibold text-gray-900">{a.title}</h4><span className={cn("text-xs px-2 py-0.5 rounded-full", a.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>{a.is_active ? 'Active' : 'Inactive'}</span></div><p className="text-gray-600">{a.message}</p><p className="text-sm text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString()}</p></div>
                <div className="flex gap-1"><button onClick={() => { setIsEditing(true); setSelectedAnnouncement(a); setAnnouncementForm({ title: a.title, message: a.message, is_active: a.is_active }); setShowAnnouncementModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button><button onClick={async () => { await supabase.from('announcements').delete().eq('id', a.id); fetchData(); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div><h3 className="text-lg font-semibold text-gray-900">Email Retailers</h3><p className="text-sm text-gray-500">Send to all or selected</p></div>
            <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600"><Send className="w-4 h-4" />Compose</button>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Users className="w-6 h-6 text-blue-600" /></div><div><p className="text-2xl font-bold text-gray-900">{retailers.length}</p><p className="text-sm text-gray-500">Total Retailers</p></div></div>
          </div>
        </div>
      )}

      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold">{isEditing ? 'Edit' : 'New'} Announcement</h3><button onClick={() => setShowAnnouncementModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Title</label><input type="text" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-bark-500" /></div>
              <div><label className="block text-sm font-medium mb-1">Message</label><textarea value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} rows={5} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-bark-500" /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={announcementForm.is_active} onChange={(e) => setAnnouncementForm({ ...announcementForm, is_active: e.target.checked })} className="rounded" /><span className="text-sm">Active</span></label>
              <div className="flex gap-3 pt-4"><button onClick={() => setShowAnnouncementModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleSaveAnnouncement} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save'}</button></div>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-semibold">Compose Email</h3><button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Recipients</label><div className="flex gap-4"><label className="flex items-center gap-2"><input type="radio" checked={emailForm.recipients === 'all'} onChange={() => setEmailForm({ ...emailForm, recipients: 'all' })} />All ({retailers.length})</label><label className="flex items-center gap-2"><input type="radio" checked={emailForm.recipients === 'selected'} onChange={() => setEmailForm({ ...emailForm, recipients: 'selected' })} />Select</label></div></div>
              {emailForm.recipients === 'selected' && <div className="max-h-32 overflow-y-auto border rounded-lg p-2">{retailers.map(r => <label key={r.id} className="flex items-center gap-2 p-1"><input type="checkbox" checked={emailForm.selectedRetailers.includes(r.id)} onChange={(e) => setEmailForm({ ...emailForm, selectedRetailers: e.target.checked ? [...emailForm.selectedRetailers, r.id] : emailForm.selectedRetailers.filter(id => id !== r.id) })} />{r.company_name}</label>)}</div>}
              <div><label className="block text-sm font-medium mb-1">Subject</label><input type="text" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Message</label><textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} rows={6} className="w-full px-4 py-2 border rounded-lg" /></div>
              <div className="flex gap-3 pt-4"><button onClick={() => setShowEmailModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleSendEmail} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting ? 'Sending...' : <><Send className="w-4 h-4" />Send</>}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  Send,
  MessageSquare,
  Users,
  Megaphone,
  X,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

interface Retailer {
  id: string;
  company_name: string;
  email?: string;
}

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

  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    is_active: true
  });

  const [emailForm, setEmailForm] = useState({
    recipients: 'all' as 'all' | 'selected',
    selectedRetailers: [] as string[],
    subject: '',
    message: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      setAnnouncements(announcementsData || []);

      // Fetch retailers for email
      const { data: retailersData } = await supabase
        .from('retailers')
        .select('id, company_name')
        .order('company_name');

      // We'd need to get emails from auth.users
      // For now, we'll just use retailer data
      setRetailers(retailersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotificationMessage = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 3000);
  };

  const handleCreateAnnouncement = () => {
    setIsEditing(false);
    setSelectedAnnouncement(null);
    setAnnouncementForm({ title: '', message: '', is_active: true });
    setShowAnnouncementModal(true);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setIsEditing(true);
    setSelectedAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      message: announcement.message,
      is_active: announcement.is_active
    });
    setShowAnnouncementModal(true);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotificationMessage('Announcement deleted', 'success');
      fetchData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      showNotificationMessage('Failed to delete announcement', 'error');
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.message) {
      showNotificationMessage('Please fill in all fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && selectedAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title: announcementForm.title,
            message: announcementForm.message,
            is_active: announcementForm.is_active
          })
          .eq('id', selectedAnnouncement.id);

        if (error) throw error;
        showNotificationMessage('Announcement updated', 'success');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({
            title: announcementForm.title,
            message: announcementForm.message,
            is_active: announcementForm.is_active
          });

        if (error) throw error;
        showNotificationMessage('Announcement created', 'success');
      }

      setShowAnnouncementModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving announcement:', error);
      showNotificationMessage('Failed to save announcement', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.message) {
      showNotificationMessage('Please fill in subject and message', 'error');
      return;
    }

    if (emailForm.recipients === 'selected' && emailForm.selectedRetailers.length === 0) {
      showNotificationMessage('Please select at least one retailer', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/communications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emailForm.recipients,
          selectedRetailers: emailForm.selectedRetailers,
          subject: emailForm.subject,
          message: emailForm.message
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotificationMessage(`Email sent to ${data.count} retailers`, 'success');
        setShowEmailModal(false);
        setEmailForm({
          recipients: 'all',
          selectedRetailers: [],
          subject: '',
          message: ''
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showNotificationMessage('Failed to send email', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bark-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification.message && (
        <div className={cn(
          "fixed top-20 right-6 z-50 border rounded-xl p-4 shadow-lg flex items-center gap-3",
          notification.type === 'success' ? "bg-white border-gray-200" : "bg-red-50 border-red-200"
        )}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className={notification.type === 'success' ? 'text-gray-900' : 'text-red-900'}>
            {notification.message}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100 inline-flex">
        <button
          onClick={() => setActiveTab('announcements')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'announcements' 
              ? "bg-bark-500 text-white" 
              : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <Megaphone className="w-4 h-4" />
          Announcements
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === 'email' 
              ? "bg-bark-500 text-white" 
              : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <Mail className="w-4 h-4" />
          Email Retailers
        </button>
      </div>

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
              <p className="text-sm text-gray-500">Manage announcements shown to retailers on their dashboard</p>
            </div>
            <button
              onClick={handleCreateAnnouncement}
              className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </button>
          </div>

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
                <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No announcements yet</p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <div key={announcement.id} className="bg-white rounded-xl p-6 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{announcement.title}</h4>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          announcement.is_active 
                            ? "bg-green-100 text-green-700" 
                            : "bg-gray-100 text-gray-600"
                        )}>
                          {announcement.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-gray-600 whitespace-pre-wrap">{announcement.message}</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Created {new Date(announcement.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button
                        onClick={() => handleEditAnnouncement(announcement)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Email Retailers</h3>
              <p className="text-sm text-gray-500">Send emails to all or selected retailers</p>
            </div>
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 transition-colors"
            >
              <Send className="w-4 h-4" />
              Compose Email
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{retailers.length}</p>
                <p className="text-sm text-gray-500">Total Retailers</p>
              </div>
            </div>
            <p className="text-gray-600">
              Use this feature to send announcements, updates, or order-related communications to your retailers.
            </p>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button onClick={() => setShowAnnouncementModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="Announcement title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="Write your announcement..."
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={announcementForm.is_active}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                />
                <span className="text-sm text-gray-700">Active (visible to retailers)</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAnnouncementModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAnnouncement}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isEditing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Compose Email</h3>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="recipients"
                      checked={emailForm.recipients === 'all'}
                      onChange={() => setEmailForm({ ...emailForm, recipients: 'all', selectedRetailers: [] })}
                      className="w-4 h-4 text-bark-500 focus:ring-bark-500"
                    />
                    <span className="text-sm text-gray-700">All Retailers ({retailers.length})</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="recipients"
                      checked={emailForm.recipients === 'selected'}
                      onChange={() => setEmailForm({ ...emailForm, recipients: 'selected' })}
                      className="w-4 h-4 text-bark-500 focus:ring-bark-500"
                    />
                    <span className="text-sm text-gray-700">Select Retailers</span>
                  </label>
                </div>
              </div>

              {emailForm.recipients === 'selected' && (
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {retailers.map((retailer) => (
                    <label key={retailer.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={emailForm.selectedRetailers.includes(retailer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEmailForm({ 
                              ...emailForm, 
                              selectedRetailers: [...emailForm.selectedRetailers, retailer.id] 
                            });
                          } else {
                            setEmailForm({ 
                              ...emailForm, 
                              selectedRetailers: emailForm.selectedRetailers.filter(id => id !== retailer.id) 
                            });
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-bark-500 focus:ring-bark-500"
                      />
                      <span className="text-sm text-gray-700">{retailer.company_name}</span>
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="Email subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-bark-500"
                  placeholder="Write your email..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-bark-500 text-white rounded-lg hover:bg-bark-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

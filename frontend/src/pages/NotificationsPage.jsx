import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, MessageSquare, Trash2, Send, Mail, User, Tag, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sendNotification } from '../lib/api'
import { useToast } from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'

export default function NotificationsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)

  const filteredNotifications = notifications.filter(notification => {
    const isContact = notification.metadata?.type === 'contact';
    const isPaperRequest = notification.title === 'New Paper Request';
    
    if (activeTab === 'all') return true;
    if (activeTab === 'messages') return isContact;
    if (activeTab === 'paper_requests') return isPaperRequest;
    if (activeTab === 'system') return !isContact && !isPaperRequest;
    return true;
  });

  const fetchNotifications = async () => {
    if (!user) return
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      
    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString())
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query = query.lte('created_at', end.toISOString())
    }
      
    const { data, error } = await query
    
    if (!error && data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNotifications()

    if (!user) return
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, startDate, endDate])

  const markAsRead = async (id) => {
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
    fetchNotifications()
  }

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    fetchNotifications()
  }

  const removeNotification = async (id, e) => {
    if (e) e.stopPropagation()
    if (!user) return
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => notifications.find(n => n.id === id && !n.is_read) ? prev - 1 : prev)
  }

  const clearAll = async () => {
    setClearLoading(true)
    if (activeTab === 'all') {
      await supabase.from('notifications').delete().eq('user_id', user.id)
      setNotifications([])
      setUnreadCount(0)
    } else {
      const idsToDelete = filteredNotifications.map(n => n.id)
      if (idsToDelete.length > 0) {
        await supabase.from('notifications').delete().in('id', idsToDelete)
        setNotifications(prev => prev.filter(n => !idsToDelete.includes(n.id)))
        setUnreadCount(prev => {
          const deletedUnread = filteredNotifications.filter(n => !n.is_read).length
          return Math.max(0, prev - deletedUnread)
        })
      }
    }
    setClearLoading(false)
    setClearConfirmOpen(false)
  }

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!replyingTo || !replyText.trim()) return
    
    setSendingReply(true)
    try {
      const res = await sendNotification('/api/notify/reply-contact', {
        recipientEmail: replyingTo.metadata.sender_email,
        originalSubject: replyingTo.metadata.subject,
        originalMessage: replyingTo.metadata.full_message,
        replyMessage: replyText
      })
      
      if (!res || !res.ok) throw new Error('Failed to send reply')
      
      toast.success('Reply sent successfully')
      
      setReplyingTo(null)
      setReplyText('')
      
    } catch (err) {
      console.error(err)
      toast.error('Failed to send reply')
    }
    setSendingReply(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={24} style={{ color: 'var(--primary)' }} /> Notifications
          </h1>
          <p className="page-subtitle">
            {unreadCount === 0 ? "You're all caught up." : `You have ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CheckCircle size={16} /> Mark all read
            </button>
          )}
          {filteredNotifications.length > 0 && (
            <button 
              onClick={() => setClearConfirmOpen(true)} 
              className="btn btn-outline btn-sm" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--destructive)', borderColor: 'var(--destructive)' }}
            >
              <Trash2 size={16} /> {activeTab === 'all' ? 'Clear All' : `Clear ${activeTab === 'messages' ? 'Messages' : activeTab === 'paper_requests' ? 'Requests' : 'System'}`}
            </button>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
          <Filter size={16} style={{ color: 'var(--text-hint)' }} /> Filter by Date:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From</label>
          <input 
            type="date" 
            className="input" 
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-section)' }} 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To</label>
          <input 
            type="date" 
            className="input" 
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-section)' }} 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
          />
        </div>
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }} 
            style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {[
          { id: 'all', label: 'All Notifications' },
          { id: 'system', label: 'System' },
          { id: 'messages', label: 'Contact Messages' },
          { id: 'paper_requests', label: 'Paper Requests' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              background: 'none', border: 'none', padding: '0.5rem 0', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 600 : 500,
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredNotifications.length === 0 ? (
          <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--bg-section)', borderRadius: '50%', marginBottom: '1rem' }}>
              <CheckCircle size={32} style={{ color: 'var(--text-hint)' }} />
            </div>
            <h3 className="card-title">{(startDate || endDate || activeTab !== 'all') ? 'No notifications found for this view' : "You're all caught up!"}</h3>
            <p className="card-description">{(startDate || endDate || activeTab !== 'all') ? 'Try adjusting your filters or switching tabs.' : 'There are no new notifications in your inbox.'}</p>
          </div>
        ) : (
          filteredNotifications.map(notification => {
            const isContact = notification.metadata?.type === 'contact';
            const isUnread = !notification.is_read;
            
            return (
              <div 
                key={notification.id}
                className="card"
                style={{ 
                  borderLeft: isUnread ? '4px solid var(--primary)' : '4px solid transparent',
                  opacity: isUnread ? 1 : 0.7,
                  cursor: isUnread ? 'pointer' : 'default',
                  transition: 'opacity var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onClick={() => { if(isUnread) markAsRead(notification.id) }}
              >
                <div className="card-content" style={{ display: 'flex', gap: '1.5rem', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {isContact && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-section)', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Contact Form
                        </span>
                      )}
                      {isUnread && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'var(--primary-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          New
                        </span>
                      )}
                      <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {new Date(notification.created_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    <h3 className="card-title" title={notification.title} style={{ marginBottom: '0.5rem', color: isUnread ? 'var(--text-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {notification.title}
                    </h3>
                    
                    {isContact ? (
                      <div style={{ background: 'var(--bg-section)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={14} style={{ color: 'var(--text-hint)' }} />
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sender</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{notification.metadata.sender_name}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Mail size={14} style={{ color: 'var(--text-hint)' }} />
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
                              <a href={notification.metadata.sender_email?.startsWith('mailto:') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notification.metadata.sender_email) ? `mailto:${notification.metadata.sender_email}` : '#'} style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--primary)', textDecoration: 'none' }}>
                                {notification.metadata.sender_email}
                              </a>
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {notification.metadata.full_message}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {notification.message}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                    {isContact && profile?.role === 'admin' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                          setReplyingTo(notification);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
                      >
                        <MessageSquare size={14} /> Reply
                      </button>
                    )}
                    <button 
                      onClick={(e) => removeNotification(notification.id, e)}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                  
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Elegant Reply Modal */}
      {replyingTo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div 
            style={{ position: 'absolute', inset: 0, background: 'var(--bg-primary)', opacity: 0.8, backdropFilter: 'blur(8px)' }} 
            onClick={() => setReplyingTo(null)}
          />
          <div className="card" style={{ position: 'relative', width: '100%', maxWidth: '600px', zIndex: 1001, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            <div className="card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-section)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1.1rem' }}>Send Reply</h3>
                  <p className="card-description" style={{ margin: 0, fontSize: '0.8rem' }}>To: {replyingTo.metadata?.sender_name} ({replyingTo.metadata?.sender_email})</p>
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo(null)} 
                className="btn btn-outline btn-sm"
                style={{ padding: '0.4rem', border: 'none' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', background: 'var(--bg-section)', borderBottom: '1px solid var(--border)', overflowY: 'auto', maxHeight: '150px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={12} /> Subject: {replyingTo.metadata?.subject}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', paddingLeft: '0.75rem', borderLeft: '2px solid var(--border)' }}>
                {replyingTo.metadata?.full_message}
              </div>
            </div>

            <form onSubmit={handleReplySubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-card)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Your Message</label>
                <textarea 
                  className="input"
                  style={{ width: '100%', minHeight: '150px', padding: '1rem', resize: 'none' }}
                  placeholder="Type your response here. This will be sent directly to their email inbox..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="button" onClick={() => setReplyingTo(null)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" disabled={sendingReply} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {sendingReply ? <div className="spinner-sm" style={{ borderTopColor: 'transparent' }} /> : <Send size={16} />}
                  {sendingReply ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={clearAll}
        title="Clear Notifications?"
        message={`Are you sure you want to delete ${{ all: 'all notifications', system: 'System notifications', messages: 'Contact Messages', paper_requests: 'Paper Requests' }[activeTab] || 'these notifications'}? This cannot be undone.`}
        confirmText="Clear"
        loading={clearLoading}
        type="danger"
      />
    </div>
  )
}

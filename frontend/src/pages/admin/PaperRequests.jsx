import { useEffect, useState } from 'react'
import { Mail, Check, X, RefreshCw, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { sendNotification } from '../../lib/api'

const statusColors = {
  pending: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
  approved: { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  rejected: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
}

export default function PaperRequests() {
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [expanded, setExpanded] = useState(null)
  const [actioning, setActioning] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchRequests is stable and intentionally mount-only
  useEffect(() => { fetchRequests() }, [])


  async function fetchRequests() {
    setLoading(true)
    const { data, error } = await supabase
      .from('paper_requests')
      .select('*, journals(file_url)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load requests')
    setRequests(data ?? [])
    setLoading(false)
  }

  async function handleAction(req, action) {
    setActioning(req.id)
    try {
      const { error } = await supabase
        .from('paper_requests')
        .update({ status: action })
        .eq('id', req.id)
      if (error) throw error

      let emailFailed = false;
      if (action === 'rejected') {
        const res = await sendNotification('/api/notify/paper-request-rejected', {
          requesterName: req.requester_name,
          requesterEmail: req.requester_email,
          journalTitle: req.journal_title,
        })
        if (!res || !res.ok) emailFailed = true;
      }

      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: action } : r))
      
      if (emailFailed) {
        toast.error('Request rejected, but failed to notify requester via email.', { duration: 5000 });
      } else {
        toast.success(action === 'approved'
          ? 'Marked as approved. Please send the PDF to the requester manually via email.'
          : 'Request rejected and requester notified.')
      }
    } catch (err) {
      toast.error(err.message || 'Action failed')
    }
    setActioning(null)
  }

  async function handleSendPDF(req) {
    if (!req.journals?.file_url) return toast.error('Error: Original PDF not found in database')
    setActioning(req.id + '_send')
    try {
      const res = await sendNotification('/api/notify/paper-delivery', {
        requesterName: req.requester_name,
        requesterEmail: req.requester_email,
        journalTitle: req.journal_title,
        fileUrl: req.journals?.file_url
      })
      if (!res || !res.ok) throw new Error('Failed to send PDF via email.');
      toast.success('PDF successfully attached and sent via email!')
    } catch (err) {
      console.error('Failed to send PDF email:', err)
      toast.error('Failed to send PDF email.')
    }
    setActioning(null)
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  return (
    <div className="space-y-6">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Full Paper Requests</h1>
          <p className="page-subtitle">Visitors requesting full PDFs of published papers</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchRequests} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span style={{ marginLeft: '0.35rem', opacity: 0.75 }}>
                ({requests.filter(r => r.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted-foreground)' }}>
          <p style={{ fontStyle: 'italic', fontSize: '0.95rem' }}>No pending full paper requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const sc = statusColors[req.status] || statusColors.pending
            const isExpanded = expanded === req.id
            return (
              <div key={req.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Header Row */}
                <div className="card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.925rem', marginBottom: '0.25rem' }}>{req.journal_title}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="text-sm text-muted">{req.requester_name}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <a href={`mailto:${req.requester_email}`} className="text-sm" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {req.requester_email}
                      </a>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span className="text-xs text-muted">{new Date(req.created_at).toLocaleDateString()}</span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.6rem',
                        borderRadius: '999px', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`
                      }}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setExpanded(isExpanded ? null : req.id)}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      Details
                    </button>
                    {req.status === 'pending' && (
                      <>
                        <button className="btn btn-sm" style={{ background: '#059669', color: '#fff', gap: '0.3rem' }}
                          onClick={() => handleAction(req, 'approved')} disabled={actioning === req.id}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', gap: '0.3rem' }}
                          onClick={() => handleAction(req, 'rejected')} disabled={actioning === req.id}>
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}
                    {req.status === 'approved' && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={() => handleSendPDF(req)} disabled={actioning === req.id + '_send'}>
                          {actioning === req.id + '_send' ? <div className="spinner-sm" style={{borderColor: '#fff', borderRightColor: 'transparent'}}/> : <Send size={14} />} Send PDF Directly
                        </button>
                        <a href={`mailto:${req.requester_email}?subject=Your Full Paper Request — ${encodeURIComponent(req.journal_title)}&body=Dear ${encodeURIComponent(req.requester_name)},%0A%0APlease find the full paper attached.%0A%0ARegards,%0AScience %26 Society Editorial Board`}
                          className="btn btn-sm btn-outline" title="Send manually via your email client" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Mail size={14} /> Manual Email
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', background: 'var(--muted)' }}>
                    <div className="space-y-2">
                      {req.affiliation && (
                        <div><span className="text-xs font-semibold text-muted">Affiliation: </span>
                          <span className="text-sm">{req.affiliation}</span></div>
                      )}
                      {req.reason && (
                        <div><span className="text-xs font-semibold text-muted">Reason: </span>
                          <span className="text-sm">{req.reason}</span></div>
                      )}
                      {req.status === 'approved' && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: 'var(--radius)', border: '1px solid #86efac' }}>
                          <p className="text-sm" style={{ color: '#166534', fontWeight: 500 }}>
                            Approved — Use the "Send PDF Directly" button above to automatically email the PDF to <strong>{req.requester_email}</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

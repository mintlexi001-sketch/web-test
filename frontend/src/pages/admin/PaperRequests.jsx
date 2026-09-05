import { useEffect, useState } from 'react'
import { Mail, Check, X, RefreshCw, ChevronDown, ChevronUp, Send, FileText, User, Calendar, Tag } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { sendNotification } from '../../lib/api'

const statusColors = {
  pending:  { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Pending' },
  approved: { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Rejected' },
}

export default function PaperRequests() {
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [actioning, setActioning] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    setLoading(true)
    const { data, error } = await supabase
      .from('paper_requests')
      .select('*, journals(file_url)')
      .order('created_at', { ascending: false })

    if (error) toast.error('Failed to load full paper requests')
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

      let emailFailed = false
      if (action === 'rejected') {
        const res = await sendNotification('/api/notify/paper-request-rejected', {
          requesterName: req.requester_name,
          requesterEmail: req.requester_email,
          journalTitle: req.journal_title,
        })
        if (!res || !res.ok) emailFailed = true
      }

      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: action } : r))

      if (emailFailed) {
        toast.error('Request rejected, but failed to notify requester via email.', { duration: 5000 })
      } else {
        toast.success(action === 'approved'
          ? 'Marked as approved. You can send the PDF directly via email using the button below.'
          : 'Request rejected and requester notified.')
      }
    } catch (err) {
      toast.error(err.message || 'Action failed')
    }
    setActioning(null)
  }

  async function handleSendPDF(req) {
    if (!req.journals?.file_url) return toast.error('Error: Original PDF file not found in storage')
    setActioning(req.id + '_send')
    try {
      const res = await sendNotification('/api/notify/paper-delivery', {
        requesterName: req.requester_name,
        requesterEmail: req.requester_email,
        journalTitle: req.journal_title,
        fileUrl: req.journals?.file_url
      })
      if (!res || !res.ok) throw new Error('Failed to send PDF via email server.')
      toast.success(`PDF successfully attached & sent to ${req.requester_email}!`)
    } catch (err) {
      console.error('Failed to send PDF email:', err)
      toast.error(err.message || 'Failed to send PDF email.')
    }
    setActioning(null)
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Full Paper Requests</h1>
          <p className="page-subtitle">Manage visitor & researcher requests for full published PDF manuscripts</p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={fetchRequests}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Filter Tabs Bar ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all',      label: 'All Requests', color: '#2563eb' },
          { key: 'pending',  label: 'Pending',      color: '#d97706' },
          { key: 'approved', label: 'Approved',     color: '#16a34a' },
          { key: 'rejected', label: 'Rejected',     color: '#dc2626' },
        ].map(({ key, label, color }) => {
          const count = key === 'all' ? requests.length : requests.filter(r => r.status === key).length
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: '9999px',
                border: active ? `2px solid ${color}` : '1px solid var(--border)',
                background: active ? color : 'var(--card)',
                color: active ? '#ffffff' : 'var(--foreground)',
                fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {label}
              <span style={{
                background: active ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                color: active ? '#ffffff' : 'var(--muted-foreground)',
                fontSize: '0.68rem', fontWeight: 700,
                padding: '0.05rem 0.38rem', borderRadius: '9999px',
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Content Area ──────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--muted-foreground)', padding: '3rem 0', justifyContent: 'center' }}>
          <RefreshCw size={18} className="spin" /> Loading requests…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted-foreground)', background: 'var(--card)', borderRadius: '0.75rem', border: '1px dashed var(--border)' }}>
          <FileText size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.25rem 0' }}>No paper requests found</p>
          <p style={{ fontSize: '0.8rem', margin: 0 }}>No requests match the selected filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.map(req => {
            const sc = statusColors[req.status] || statusColors.pending
            const isExpanded = expanded === req.id

            return (
              <div key={req.id} className="card" style={{ transition: 'all 0.15s ease' }}>
                <div className="card-content" style={{ padding: '1.15rem' }}>

                  {/* 1. Header Row: Journal Title & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: 'var(--foreground)', lineHeight: 1.4, flex: 1 }}>
                      {req.journal_title}
                    </h3>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 800, padding: '0.2rem 0.65rem',
                      borderRadius: '9999px', background: sc.bg, color: sc.color,
                      border: `1px solid ${sc.border}`, textTransform: 'uppercase',
                      letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {sc.label}
                    </span>
                  </div>

                  {/* 2. Metadata Info Line */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '0.85rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--foreground)', fontWeight: 600 }}>
                      <User size={13} style={{ color: 'var(--primary)' }} />
                      {req.requester_name}
                    </span>
                    <span>·</span>
                    <a href={`mailto:${req.requester_email}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {req.requester_email}
                    </a>
                    <span>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} />
                      {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* 3. Dedicated Action Bar (Consistently positioned at bottom of card!) */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: '0.75rem', flexWrap: 'wrap',
                    paddingTop: '0.75rem', borderTop: '1px solid var(--border)',
                  }}>
                    {/* Left: Details Toggle */}
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setExpanded(isExpanded ? null : req.id)}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Hide Details' : 'Details'}
                    </button>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {req.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-sm"
                            style={{ background: '#16a34a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.35rem 0.85rem', fontWeight: 600, border: 'none' }}
                            onClick={() => handleAction(req, 'approved')}
                            disabled={actioning === req.id}
                          >
                            <Check size={14} /> Approve Request
                          </button>

                          <button
                            className="btn btn-sm"
                            style={{ background: '#dc2626', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.35rem 0.85rem', fontWeight: 600, border: 'none' }}
                            onClick={() => handleAction(req, 'rejected')}
                            disabled={actioning === req.id}
                          >
                            <X size={14} /> Reject Request
                          </button>
                        </>
                      )}

                      {req.status === 'approved' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
                            onClick={() => handleSendPDF(req)}
                            disabled={actioning === req.id + '_send'}
                          >
                            {actioning === req.id + '_send' ? (
                              <RefreshCw size={13} className="spin" />
                            ) : (
                              <Send size={13} />
                            )}
                            Send PDF Directly
                          </button>

                          <a
                            href={`mailto:${req.requester_email}?subject=Your Full Paper Request — ${encodeURIComponent(req.journal_title)}&body=Dear ${encodeURIComponent(req.requester_name)},%0A%0APlease find the full paper attached.%0A%0ARegards,%0AScience %26 Society Editorial Board`}
                            className="btn btn-outline btn-sm"
                            title="Send email manually using your system email client"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                          >
                            <Mail size={13} /> Manual Email
                          </a>
                        </>
                      )}

                      {req.status === 'rejected' && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                          onClick={() => handleAction(req, 'approved')}
                          disabled={actioning === req.id}
                        >
                          Re-approve Request
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4. Expandable Details Box */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border)',
                      background: 'var(--muted)44', borderRadius: '0.5rem', padding: '0.85rem 1rem',
                      display: 'flex', flexDirection: 'column', gap: '0.5rem',
                    }}>
                      {req.affiliation && (
                        <div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.15rem' }}>Institutional Affiliation</span>
                          <p style={{ fontSize: '0.83rem', color: 'var(--foreground)', margin: 0, fontWeight: 500 }}>{req.affiliation}</p>
                        </div>
                      )}

                      {req.reason && (
                        <div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.15rem' }}>Reason for Request</span>
                          <p style={{ fontSize: '0.83rem', color: 'var(--foreground)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{req.reason}</p>
                        </div>
                      )}

                      {req.status === 'approved' && (
                        <div style={{ marginTop: '0.25rem', padding: '0.6rem 0.85rem', background: '#d1fae5', borderRadius: '0.375rem', border: '1px solid #a7f3d0' }}>
                          <p style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Check size={14} /> Approved — Click <strong>"Send PDF Directly"</strong> above to email the manuscript PDF to <strong>{req.requester_email}</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

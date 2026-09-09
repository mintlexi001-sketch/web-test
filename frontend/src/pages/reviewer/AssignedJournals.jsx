import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { FileText, ArrowLeft, Download, CheckCircle, Upload, Check, X, AlertTriangle, Edit3 } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { sendNotification } from '../../lib/api'

const isPdfMagicBytes = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = (e) => {
      const bytes = new Uint8Array(e.target.result)
      resolve(
        bytes[0] === 0x25 && bytes[1] === 0x50 &&
        bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D
      )
    }
    reader.readAsArrayBuffer(file.slice(0, 5))
  })

// Only reviewer-safe statuses — admin decisions are protected/private
const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  revision_required: 'Revision Required',
  rework: 'Revision Required',
}
// Helper: always return a displayable label — defensive default for any future status added
const getStatusLabel = (status) => statusLabels[status] ?? 'In Progress'
// Statuses that are admin-only and must not be shown to reviewers
const adminOnlyStatuses = new Set(['approved', 'accepted', 'published', 'rejected'])

/* ── Assigned Journals List ───────────────────────────────────────── */
export function AssignedJournals() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) fetchAssigned() }, [user])

  async function fetchAssigned() {
    setLoading(true)
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id,
        accepted_at,
        created_at,
        journals (
          id, title, abstract, status, review_level, resubmission_count, created_at
        )
      `)
      .eq('reviewer_id', user.id)
      .limit(500)

    if (error) { setLoading(false); return }

    const journalIds = (data ?? []).map(a => a.journals?.id).filter(Boolean)
    const { data: reviewedIds } = await supabase
      .from('reviews')
      .select('journal_id')
      .eq('reviewer_id', user.id)
      .in('journal_id', journalIds.length ? journalIds : ['none'])
      .limit(500)

    const reviewedSet = new Set((reviewedIds ?? []).map(r => r.journal_id))

    setItems(
      (data ?? [])
        .filter(a => a.journals)
        .map(a => {
          let reviewStatus = 'pending_accept'
          if (reviewedSet.has(a.journals.id)) {
            reviewStatus = 'completed'
          } else if (a.accepted_at) {
            reviewStatus = 'pending'
          }
          return {
            ...a.journals,
            assignmentId: a.id,
            acceptedAt: a.accepted_at,
            reviewStatus,
          }
        })
    )
    setLoading(false)
  }

  async function handleAccept(item) {
    setActionLoadingId(item.assignmentId)
    const { error } = await supabase.rpc('reviewer_respond_to_assignment', {
      p_assignment_id: item.assignmentId,
      p_accept: true,
    })
    setActionLoadingId(null)
    if (error) {
      toast.error(error.message || 'Failed to accept assignment')
      return
    }
    toast.success(`Accepted assignment for "${item.title.slice(0, 30)}…"`)
    fetchAssigned()
  }

  async function handleDecline(item) {
    if (!window.confirm(`Are you sure you want to decline reviewing "${item.title}"?`)) return
    setActionLoadingId(item.assignmentId)

    const { error } = await supabase.rpc('reviewer_respond_to_assignment', {
      p_assignment_id: item.assignmentId,
      p_accept: false,
    })

    if (error) {
      setActionLoadingId(null)
      toast.error(error.message || 'Failed to decline assignment')
      return
    }

    // Notify admin about the decline
    await sendNotification('/api/notify/reject-assignment', {
      journalTitle: item.title,
      reviewerName: profile?.name || user?.name || 'Reviewer',
    })

    setActionLoadingId(null)
    toast.success(`Declined review request for "${item.title.slice(0, 30)}…"`)
    fetchAssigned()
  }

  const filtered = filter === 'all' 
    ? items 
    : items.filter(j => j.reviewStatus === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Assigned Journals</h1>
        <p className="page-subtitle">Journals assigned to you for review</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `All (${items.length})` },
          { id: 'pending_accept', label: `Pending Acceptance (${items.filter(i => i.reviewStatus === 'pending_accept').length})` },
          { id: 'pending', label: `Assigned (Accepted) (${items.filter(i => i.reviewStatus === 'pending').length})` },
          { id: 'completed', label: `Completed (${items.filter(i => i.reviewStatus === 'completed').length})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-outline'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-content space-y-4">
          {loading ? (
            <p className="text-sm text-muted" style={{ padding: '1rem 0' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted-foreground)' }}>
              <p style={{ fontStyle: 'italic', fontSize: '0.95rem' }}>No journals match this filter.</p>
            </div>
          ) : filtered.map(j => (
            <div key={j.id} className="submission-item">
              <div>
                <h3 className="font-medium">{j.title}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <span className="text-xs text-muted">Submitted {new Date(j.created_at).toLocaleDateString()}</span>
                  {j.resubmission_count > 0 && (
                    <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600, fontSize: '0.65rem' }}>
                      Resubmission #{j.resubmission_count}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                  <span
                    className={adminOnlyStatuses.has(j.status) ? 'status-under_review' : `status-${j.status}`}
                    style={{ display: 'block', marginBottom: '0.25rem' }}
                  >
                    {adminOnlyStatuses.has(j.status) ? 'Decision Recorded' : getStatusLabel(j.status)}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Your Status:{' '}
                    {j.reviewStatus === 'completed'
                      ? 'Done'
                      : j.reviewStatus === 'pending'
                      ? 'Accepted'
                      : 'Pending Acceptance'}
                  </span>
                </div>

                {j.reviewStatus === 'pending_accept' && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={actionLoadingId === j.assignmentId}
                      onClick={() => handleAccept(j)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Check size={14} /> Accept
                    </button>
                    <button
                      className="btn btn-sm btn-outline"
                      disabled={actionLoadingId === j.assignmentId}
                      onClick={() => handleDecline(j)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger, #ef4444)', borderColor: 'var(--danger, #ef4444)' }}
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                )}

                {j.reviewStatus === 'pending' && (
                  <Link to={`/reviewer/review/${j.id}`} className="btn btn-primary btn-sm">
                    Review
                  </Link>
                )}
                {j.reviewStatus === 'completed' && (
                  <Link to={`/reviewer/review/${j.id}`} className="btn btn-outline btn-sm">
                    View
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Review Detail / Form ─────────────────────────────────────────── */
export function ReviewJournal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, profile } = useAuth()

  const [journal, setJournal] = useState(null)
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState('')
  const [revisionFile, setRevisionFile] = useState(null)
  const [existingReportUrl, setExistingReportUrl] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [existing, setExisting] = useState(null)
  const [confirmRead, setConfirmRead] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isReplacingFile, setIsReplacingFile] = useState(false)
  const [acceptingAssignment, setAcceptingAssignment] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchJournal() }, [id])

  async function fetchJournal() {
    setLoading(true)
    const [journalRes, reviewRes, assignmentRes] = await Promise.all([
      supabase.from('journals').select('id, title, abstract, status, review_level, resubmission_count, created_at, file_url, keywords').eq('id', id).single(),
      supabase.from('reviews').select('*').eq('journal_id', id).eq('reviewer_id', user?.id).maybeSingle(),
      supabase.from('assignments').select('id, accepted_at').eq('journal_id', id).eq('reviewer_id', user?.id).maybeSingle(),
    ])
    setJournal(journalRes.data ?? null)
    setAssignment(assignmentRes.data ?? null)

    if (reviewRes.data) {
      setExisting(reviewRes.data)
      setComments(reviewRes.data.comments)
      setExistingReportUrl(reviewRes.data.revision_report_url ?? null)
    }
    setLoading(false)
  }

  async function handleAcceptAssignment() {
    if (!assignment) return
    setAcceptingAssignment(true)
    const { error } = await supabase.rpc('reviewer_respond_to_assignment', {
      p_assignment_id: assignment.id,
      p_accept: true,
    })
    setAcceptingAssignment(false)
    if (error) {
      toast.error(error.message || 'Failed to accept assignment')
      return
    }
    toast.success('Assignment accepted! You can now complete your review.')
    setAssignment(prev => ({ ...prev, accepted_at: new Date().toISOString() }))
  }

  if (loading) return <p className="text-muted text-sm" style={{ padding: '2rem' }}>Loading…</p>
  if (!journal) return <p>Journal not found.</p>

  const isAccepted = Boolean(assignment?.accepted_at)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isAccepted) {
      toast.error('You must accept the assignment before submitting a review.')
      return
    }
    if (!confirmRead) {
      toast.error('Please confirm that you have downloaded and read the full manuscript.')
      return
    }
    if (!comments.trim()) { toast.error('Please provide review comments'); return }

    if (!existing && !revisionFile) {
      toast.error('Please upload the Revision Report PDF'); return
    }

    setSubmitting(true)

    try {
      let revisionUrl = existingReportUrl
      if (revisionFile) {
        if (revisionFile.size > 10 * 1024 * 1024) {
          toast.error('File size must be under 10MB')
          setSubmitting(false)
          return
        }
        const validPdf = await isPdfMagicBytes(revisionFile)
        if (!validPdf) {
          toast.error('Invalid file format. Please upload a valid PDF document.')
          setSubmitting(false)
          return
        }
        const fileName = `reviewer/${user.id}/revision_${Date.now()}.pdf`
        const { error: upErr } = await supabase.storage
          .from('journals')
          .upload(fileName, revisionFile, { cacheControl: '3600', upsert: false })
        if (upErr) throw upErr
        revisionUrl = fileName
      }

      const payload = {
        journal_id: id,
        reviewer_id: user.id,
        decision: null,
        comments,
        revision_report_url: revisionUrl,
        originality: null,
        methodology: null,
        clarity: null,
        refs: null,
        overall: null,
      }

      if (existing) {
        const { error } = await supabase.from('reviews').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reviews').insert(payload)
        if (error) throw error
      }

      const res = await sendNotification('/api/notify/review', {
        journalId: journal.id,
        studentId: journal.student_id,
        reviewerName: profile?.name,
        journalTitle: journal.title
      });
      
      setExistingReportUrl(revisionUrl)
      
      if (!res || !res.ok) {
        toast.error('Review submitted, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success('Review report submitted successfully!')
      }
      navigate('/reviewer/assigned')
    } catch (err) {
      toast.error(err.message || 'Failed to submit review.')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/reviewer/assigned')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="page-title" style={{ margin: 0, fontSize: '1.25rem' }}>Review Journal</h1>
        {existing && <span className="badge badge-secondary">Previously Submitted</span>}
        {journal.resubmission_count > 0 && (
          <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
            Resubmission #{journal.resubmission_count}
          </span>
        )}
      </div>

      {/* Acceptance Banner if reviewer has not yet accepted */}
      {!isAccepted && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: '0.75rem', padding: '1.25rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, color: '#92400e', margin: 0, fontSize: '0.95rem' }}>
                Pending Review Acceptance
              </p>
              <p style={{ fontSize: '0.85rem', color: '#b45309', margin: '0.2rem 0 0' }}>
                Please review the paper details below and accept the assignment to begin your review.
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={acceptingAssignment}
            onClick={handleAcceptAssignment}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Check size={16} /> {acceptingAssignment ? 'Accepting…' : 'Accept Assignment Now'}
          </button>
        </div>
      )}

      <div className="review-grid">
        {/* Left: form or read-only summary */}
        <div className="space-y-4">
          {/* Journal info */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              <div className="card-title" style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>{journal.title}</div>
              <div className="card-description" style={{ fontSize: '1.05rem', color: 'var(--muted-foreground)' }}>Level {journal.review_level} Review</div>
            </div>
            <div className="card-content space-y-6">
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', color: 'var(--foreground)' }}>Abstract</p>
                {journal.abstract?.startsWith('http') ? (
                  <a href={journal.abstract} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ display: 'inline-flex', marginTop: '0.25rem' }}>
                    <Download size={16} style={{ marginRight: '0.5rem' }} /> Download Abstract
                  </a>
                ) : (
                  <p style={{ fontSize: '1.1rem', lineHeight: '1.75', color: 'var(--foreground)' }}>{journal.abstract}</p>
                )}
              </div>
              {journal.file_url && (
                <div style={{ paddingTop: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    background: 'linear-gradient(to right, var(--gold-subtle), transparent)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--gold-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: 'var(--gold-muted)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <FileText size={20} style={{ color: 'var(--gold)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Full Manuscript</p>
                        <p className="text-xs text-muted">Original Submission Document</p>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 20%, transparent)', padding: '0.5rem 1rem' }}
                      onClick={async () => {
                        const { getSignedUrl } = await import('../../lib/storage')
                        const url = await getSignedUrl(supabase, journal.file_url)
                        if (url) window.open(url, '_blank', 'noreferrer')
                        else toast.error('Could not open file. Please try again.')
                      }}
                    >
                      <Download size={16} /> Download Manuscript
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* View-only summary when review already exists and not editing */}
          {existing && !editMode ? (
            <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} style={{ color: 'var(--primary)' }} />
                  Your Submitted Review Report
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditMode(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Edit3 size={14} /> Edit Review
                </button>
              </div>
              <div className="card-content space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                    Review Comments
                  </p>
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                    {existing.comments || 'No written comments provided.'}
                  </p>
                </div>
                {existingReportUrl && (
                  <div>
                    <p className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                      Revision Report (PDF)
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={async () => {
                        const { getSignedUrl } = await import('../../lib/storage')
                        const url = await getSignedUrl(supabase, existingReportUrl)
                        if (url) window.open(url, '_blank', 'noreferrer')
                        else toast.error('Could not open file. Please try again.')
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Download size={14} /> Download Submitted Report PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Editable Form */
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  {existing ? 'Update Review Report' : 'Submit Review Report'}
                </div>
              </div>
              <div className="card-content">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Comments */}
                  <div className="form-group">
                    <label>Review Comments <span style={{ color: 'red' }}>*</span></label>
                    <textarea className="textarea" rows={5}
                      placeholder="Provide detailed feedback on the paper — originality, methodology, clarity, references, and overall assessment…"
                      value={comments} onChange={e => setComments(e.target.value)} required />
                  </div>

                  {/* Revision Report PDF Upload */}
                  <div className="form-group">
                    <label>
                      Revision Report (PDF) <span style={{ color: 'red' }}>*</span>
                    </label>
                    <p className="text-xs text-muted" style={{ marginBottom: '0.5rem' }}>
                      Upload your formal review report as a PDF. This will be shared with the admin for the final decision.
                    </p>

                    {/* Show existing uploaded file if already submitted */}
                    {existing && existingReportUrl && !revisionFile && !isReplacingFile ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.75rem', background: 'var(--muted)',
                        borderRadius: 'var(--radius)', border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={16} style={{ color: 'var(--primary)' }} />
                          <span className="text-sm font-medium">Revision Report (Uploaded)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            type="button" 
                            className="btn btn-outline btn-sm"
                            onClick={async () => {
                              const { getSignedUrl } = await import('../../lib/storage')
                              const url = await getSignedUrl(supabase, existingReportUrl)
                              if (url) window.open(url, '_blank', 'noreferrer')
                              else toast.error('Could not open file. Please try again.')
                            }}
                          >
                            <Download size={13} /> View
                          </button>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsReplacingFile(true)}>
                            Replace
                          </button>
                        </div>
                      </div>
                    ) : revisionFile ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.75rem', background: 'var(--muted)',
                        borderRadius: 'var(--radius)', border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={16} style={{ color: 'var(--primary)' }} />
                          <span className="text-sm">{revisionFile.name}</span>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => { setRevisionFile(null); setIsReplacingFile(false); }}>Remove</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          padding: '1.5rem', borderRadius: 'var(--radius)',
                          border: '2px dashed var(--border)', cursor: 'pointer',
                          background: 'var(--muted)', gap: '0.5rem',
                          transition: 'border-color 0.2s'
                        }}>
                          <Upload size={24} style={{ color: 'var(--primary)', opacity: 0.7 }} />
                          <span className="text-sm font-medium">Click to upload PDF</span>
                          <span className="text-xs text-muted">Only PDF files accepted</span>
                          <input type="file" accept=".pdf" style={{ display: 'none' }}
                            onChange={e => { if (e.target.files?.[0]) setRevisionFile(e.target.files[0]) }} />
                        </label>
                        {isReplacingFile && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setIsReplacingFile(false)}
                            style={{ alignSelf: 'flex-start' }}
                          >
                            Cancel Replace
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mandatory Checkbox to prevent premature / accidental submissions */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.85rem 1rem', background: 'var(--muted)',
                    borderRadius: 'var(--radius)', border: '1px solid var(--border)'
                  }}>
                    <input
                      type="checkbox"
                      id="confirmReadManuscript"
                      checked={confirmRead}
                      onChange={e => setConfirmRead(e.target.checked)}
                      style={{ width: '1.15rem', height: '1.15rem', marginTop: '0.1rem', cursor: 'pointer' }}
                    />
                    <label htmlFor="confirmReadManuscript" style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4 }}>
                      I confirm that I have downloaded and thoroughly read the full manuscript before submitting this review.
                    </label>
                  </div>

                  <div className="page-footer-actions">
                    {existing && (
                      <button type="button" className="btn btn-outline" onClick={() => setEditMode(false)}>
                        Cancel Editing
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || !isAccepted || !confirmRead}
                    >
                      {submitting ? 'Submitting…' : <><CheckCircle size={16} /> {existing ? 'Update Review Report' : 'Submit Review Report'}</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Right: guidelines + sidebar info */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header"><div className="card-title">Review Guidelines</div></div>
            <div className="card-content">
              <ul className="list-disc" style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--foreground)', paddingLeft: '1.5rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>Read the full paper before reviewing</li>
                <li style={{ marginBottom: '0.5rem' }}>Focus on academic merit and contribution</li>
                <li style={{ marginBottom: '0.5rem' }}>Provide constructive, specific feedback</li>
                <li style={{ marginBottom: '0.5rem' }}>Upload your formal review as a PDF report</li>
                <li style={{ marginBottom: '0.5rem' }}>Maintain confidentiality of the review</li>
                <li style={{ marginBottom: '0.5rem' }}>Be objective and unbiased</li>
                <li>Complete review within the deadline</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Submission Details</div></div>
            <div className="card-content space-y-3">
              {[
                ['Submitted', new Date(journal.created_at).toLocaleDateString()],
                ['Review Level', `Level ${journal.review_level}`],
                ['Acceptance Status', isAccepted ? 'Accepted' : 'Pending Acceptance'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.05rem', color: 'var(--muted-foreground)' }}>{k}</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--foreground)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Previous Feedback (from prior submission rounds) */}
          {journal.prev_reviewer_comments && (
            <div className="card" style={{ borderTop: '4px solid var(--muted-foreground)', opacity: 0.85 }}>
              <div className="card-header">
                <div className="card-title">
                  {journal.prev_reviewer_name && profile?.name !== journal.prev_reviewer_name 
                    ? 'Previous Review' 
                    : 'Your Previous Review'}
                </div>
              </div>
              <div className="card-content space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    {journal.prev_reviewer_name && profile?.name !== journal.prev_reviewer_name 
                      ? "Reviewer's Comments" 
                      : 'Your Comments'}
                  </p>
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{journal.prev_reviewer_comments}</p>
                </div>
                {journal.prev_revision_report_url && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                    onClick={async () => {
                      const { getSignedUrl } = await import('../../lib/storage')
                      const url = await getSignedUrl(supabase, journal.prev_revision_report_url)
                      if (url) window.open(url, '_blank', 'noreferrer')
                      else toast.error('Could not open file. Please try again.')
                    }}
                  >
                    <Download size={14} /> Previous Revision Report
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

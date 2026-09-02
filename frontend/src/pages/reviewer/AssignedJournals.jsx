import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { FileText, ArrowLeft, User, Download, CheckCircle, Upload } from 'lucide-react'
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
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) fetchAssigned() }, [user])

  async function fetchAssigned() {
    setLoading(true)
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id,
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
        .map(a => ({
          ...a.journals,
          assignmentId: a.id,
          reviewStatus: reviewedSet.has(a.journals.id) ? 'completed' : 'pending',
        }))
    )
    setLoading(false)
  }

  const filtered = filter === 'all' ? items : items.filter(j => j.reviewStatus === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Assigned Journals</h1>
        <p className="page-subtitle">Journals assigned to you for review</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[{ id: 'all', label: 'All' }, { id: 'pending', label: 'Assigned' }, { id: 'completed', label: 'Completed' }].map(f => (
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
              <p style={{ fontStyle: 'italic', fontSize: '0.95rem' }}>No journals are currently assigned to you.</p>
            </div>
          ) : filtered.map(j => (
            <div key={j.id} className="submission-item">
              <div>
                <h3 className="font-medium">{j.title}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={12} />{j.profiles?.name ?? '—'}
                  </span>
                  <span className="text-xs text-muted">Submitted {new Date(j.created_at).toLocaleDateString()}</span>
                  {j.resubmission_count > 0 && (
                    <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600, fontSize: '0.65rem' }}>
                      Resubmission #{j.resubmission_count}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                  <span
                    className={adminOnlyStatuses.has(j.status) ? 'status-under_review' : `status-${j.status}`}
                    style={{ display: 'block', marginBottom: '0.25rem' }}
                  >
                    {adminOnlyStatuses.has(j.status) ? 'Decision Recorded' : getStatusLabel(j.status)}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Your Review: {j.reviewStatus === 'completed' ? 'Done' : 'Assigned'}
                  </span>
                </div>
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
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState('')
  const [revisionFile, setRevisionFile] = useState(null)
  // URL of the already-uploaded revision report (read from the reviews row)
  const [existingReportUrl, setExistingReportUrl] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [existing, setExisting] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchJournal() }, [id])

  async function fetchJournal() {
    setLoading(true)
    const [journalRes, reviewRes] = await Promise.all([
      supabase.from('journals').select('*, profiles(name)').eq('id', id).single(),
      supabase.from('reviews').select('*').eq('journal_id', id).eq('reviewer_id', user?.id).maybeSingle(),
    ])
    setJournal(journalRes.data ?? null)

    if (reviewRes.data) {
      setExisting(reviewRes.data)
      setComments(reviewRes.data.comments)
      // Read the PDF URL from the reviews row (where reviewer has write access)
      setExistingReportUrl(reviewRes.data.revision_report_url ?? null)
    }
    setLoading(false)
  }

  if (loading) return <p className="text-muted text-sm" style={{ padding: '2rem' }}>Loading…</p>
  if (!journal) return <p>Journal not found.</p>

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!comments.trim()) { toast.error('Please provide review comments'); return }

    // Require revision report PDF on first submission
    if (!existing && !revisionFile) {
      toast.error('Please upload the Revision Report PDF'); return
    }

    setSubmitting(true)

    try {
      // Upload revision report PDF to storage if a new file was selected
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
        // RLS Policy requires reviewers to upload strictly to their own UID folder
        const fileName = `reviewer/${user.id}/revision_${Date.now()}.pdf`
        const { error: upErr } = await supabase.storage
          .from('journals')
          .upload(fileName, revisionFile, { cacheControl: '3600', upsert: false })
        if (upErr) throw upErr
        // Store the storage PATH (not a public URL) — bucket is private
        revisionUrl = fileName
      }

      // Save everything in the reviews row — reviewer has write access here
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

      // Send notification via backend API securely
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

      <div className="review-grid">
        {/* Left: form */}
        <div className="space-y-4">
          {/* Journal info */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              <div className="card-title" style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: 'var(--foreground)' }}>{journal.title}</div>
              <div className="card-description" style={{ fontSize: '1.05rem', color: 'var(--muted-foreground)' }}>by <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{journal.profiles?.name ?? '—'}</span> · Level {journal.review_level} Review</div>
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
                      <Download size={16} /> Download
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Review Comments + Report Upload */}
          <div className="card">
            <div className="card-header"><div className="card-title">Review Report</div></div>
            <div className="card-content">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Comments */}
                <div className="form-group">
                  <label>Review Comments <span style={{ }}>*</span></label>
                  <textarea className="textarea" rows={5}
                    placeholder="Provide detailed feedback on the paper — originality, methodology, clarity, references, and overall assessment…"
                    value={comments} onChange={e => setComments(e.target.value)} required />
                </div>

                {/* Revision Report PDF Upload */}
                <div className="form-group">
                  <label>
                    Revision Report (PDF) <span style={{ }}>*</span>
                  </label>
                  <p className="text-xs text-muted" style={{ marginBottom: '0.5rem' }}>
                    Upload your formal review report as a PDF. This will be shared with the admin for the final decision.
                  </p>

                  {/* Show existing uploaded file if already submitted */}
                  {existing && existingReportUrl && !revisionFile ? (
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
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setRevisionFile(undefined)}>
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
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setRevisionFile(null)}>Remove</button>
                    </div>
                  ) : (
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
                  )}
                </div>

                <div className="page-footer-actions">
                  <button type="button" className="btn btn-outline" onClick={() => navigate('/reviewer/assigned')}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting…' : <><CheckCircle size={16} /> {existing ? 'Update Review' : 'Submit Review Report'}</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
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
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.05rem', color: 'var(--muted-foreground)' }}>{k}</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--foreground)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Previous Feedback (from prior submission rounds) — admin comments are private */}
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

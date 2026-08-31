import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import { supabase } from '../../lib/supabase'
import { sendNotification } from '../../lib/api'

const statusLabels = {
  submitted: 'Submitted', pending: 'Pending Review',
  under_review: 'Under Review', review_complete: 'Review Complete',
  accepted: 'Accepted', approved: 'Approved',
  rejected: 'Rejected', rework: 'Needs Rework',
  published: 'Published', revision_required: 'Revision Required',
}

export default function AdminJournals() {
  const toast = useToast()
  const navigate = useNavigate()
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [confirmState, setConfirmState] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchJournals is stable and intentionally mount-only
  useEffect(() => { fetchJournals() }, [])


  async function fetchJournals() {
    setLoading(true)
    const [journalsRes, assignmentsRes, reviewsRes] = await Promise.all([
      supabase
        .from('journals')
        .select('id, student_id, title, status, review_level, resubmission_count, created_at, profiles(name)')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('assignments')
        .select('journal_id, profiles(name)')
        .limit(200),
      supabase
        .from('reviews')
        .select('journal_id')
        .limit(200),
    ])

    if (journalsRes.error) { toast.error('Failed to load journals'); setLoading(false); return }

    const assignmentMap = {}
    for (const a of assignmentsRes.data ?? []) {
      assignmentMap[a.journal_id] = a.profiles?.name ?? '—'
    }
    const reviewSet = new Set((reviewsRes.data ?? []).map(r => r.journal_id))

    const merged = (journalsRes.data ?? []).map(j => ({
      ...j,
      reviewerName: assignmentMap[j.id] ?? '—',
      computedLevel: reviewSet.has(j.id) ? 2 : (assignmentMap[j.id] ? 1 : null),
    }))

    setJournals(merged)
    setLoading(false)
  }

  const filtered = journals.filter(j => {
    const authorName = j.profiles?.name ?? ''
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      authorName.toLowerCase().includes(search.toLowerCase())
    let matchFilter = false
    if (filter === 'all') {
      matchFilter = true
    } else if (filter === 'pending_assign') {
      matchFilter = j.reviewerName === '—' && ['submitted', 'pending', 'under_review'].includes(j.status)
    } else if (filter === 'revision') {
      matchFilter = (j.resubmission_count ?? 0) > 0
    } else if (filter === 'under_review') {
      matchFilter = j.status === 'under_review' && j.computedLevel === 1
    } else if (filter === 'review_complete') {
      matchFilter = j.status === 'under_review' && j.computedLevel === 2
    } else {
      matchFilter = j.status === filter
    }
    return matchSearch && matchFilter
  })

  async function handleDeletePublished(journalId, studentId, studentName, title) {
    setActionLoading(true)
    try {
      // 1. Delete from Supabase via Secure Backend Route
      const res = await sendNotification(`/api/admin/journals/${journalId}/delete`, {})
      if (!res || !res.ok) throw new Error('Failed to delete paper from database')

      // 2. Refresh the list immediately
      setJournals(prev => prev.filter(j => j.id !== journalId))

      // 3. Send email notification to the author
      let emailFailed = false;
      if (studentId) {
        const delRes = await sendNotification('/api/notify/paper-deleted', {
          studentId,
          studentName: studentName || 'Author',
          journalTitle: title
        })
        if (!delRes || !delRes.ok) emailFailed = true;
      }

      if (emailFailed) {
        toast.error('Paper deleted, but failed to notify author via email.', { duration: 5000 });
      } else {
        toast.success('Paper permanently deleted')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete paper')
    }
    setActionLoading(false)
    setConfirmState(null)
  }

  async function handleUnpublish(journalId) {
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('unpublish_journal', {
        p_journal_id: journalId
      })
      if (error) throw error

      toast.success('Paper unpublished and moved back to Accepted')
      setJournals(prev => prev.map(j => j.id === journalId ? { ...j, status: 'accepted' } : j))
    } catch (err) {
      console.error(err)
      toast.error('Failed to unpublish paper')
    }
    setActionLoading(false)
    setConfirmState(null)
  }


  return (
    <div className="space-y-6">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">All Journals</h1>
          <p className="page-subtitle">Manage and oversee all journal submissions</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchJournals} disabled={loading}>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input className="input input-icon-left" style={{ paddingLeft: '2.5rem' }}
            placeholder="Search journals…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'pending_assign', label: 'Pending Assign' },
            { id: 'under_review', label: 'Under Review' },
            { id: 'review_complete', label: 'Review Complete' },
            { id: 'accepted', label: 'Accepted' },
            { id: 'revision', label: 'Reworked Papers' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'published', label: 'Published' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-outline'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-content p-0">
          <div className="table-wrapper">
            <table className="table">
              <thead>
              <tr>
                <th>Paper Title</th>
                <th>Author</th>
                <th>Assigned Reviewer</th>
                <th>Submitted Date</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>Loading journals…</td></tr>
              ) : filtered.map(j => {
                const isUnassigned = j.reviewerName === '—'
                return (
                  <tr key={j.id}>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.title}</p>
                        {(j.resubmission_count ?? 0) > 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            background: '#ede9fe', color: '#6d28d9',
                            borderRadius: '9999px', padding: '0.1rem 0.5rem',
                            fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap'
                          }}>
                            Reworked Paper (Revision #{j.resubmission_count})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{j.profiles?.name ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isUnassigned ? (
                          <span style={{ color: '#6b21a8', fontWeight: 600, fontSize: '0.8rem' }}>
                            Unassigned
                          </span>
                      ) : j.reviewerName}
                    </td>

                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>
                      {new Date(j.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {j.computedLevel !== null
                        ? <span className="badge badge-outline">Level {j.computedLevel}</span>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td><span className={`status-${j.status}`}>{statusLabels[j.status] ?? j.status}</span></td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-primary btn-sm" title="View Review Report"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          onClick={() => navigate(`/admin/reports/${j.id}`)}>
                          View Report
                        </button>
                        {j.status === 'published' && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              title="Unpublish Paper"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                              onClick={() => setConfirmState({ type: 'unpublish', id: j.id, title: j.title })}
                            >
                              Unpublish
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              title="Delete Published Paper"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                              onClick={() => setConfirmState({ type: 'delete', id: j.id, title: j.title, studentId: j.student_id, studentName: j.profiles?.name })}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '3rem 1rem', fontStyle: 'italic', fontSize: '0.9rem' }}>No journals found matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        <div className="card-footer" style={{ paddingTop: '0.75rem', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          Showing {filtered.length} of {journals.length} journals
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => !actionLoading && setConfirmState(null)}
        onConfirm={() => {
          if (confirmState.type === 'delete') handleDeletePublished(confirmState.id, confirmState.studentId, confirmState.studentName, confirmState.title)
          if (confirmState.type === 'unpublish') handleUnpublish(confirmState.id)
        }}
        title={confirmState?.type === 'delete' ? 'Delete Published Paper' : 'Unpublish Paper'}
        message={
          confirmState?.type === 'delete'
            ? `WARNING: Are you sure you want to PERMANENTLY delete "${confirmState.title}"? This cannot be undone.`
            : `Are you sure you want to unpublish "${confirmState?.title}"? It will be moved back to the Accepted Papers list.`
        }
        confirmText={confirmState?.type === 'delete' ? 'Delete Permanently' : 'Unpublish'}
        type={confirmState?.type === 'delete' ? 'danger' : 'warning'}
        loading={actionLoading}
      />
    </div>
  )
}

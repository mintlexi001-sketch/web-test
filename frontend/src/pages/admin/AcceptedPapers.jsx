import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '../../components/Toast'
import ConfirmModal from '../../components/ConfirmModal'
import { supabase } from '../../lib/supabase'
import { sendNotification } from '../../lib/api'

export default function AcceptedPapers() {
  const toast = useToast()
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishModal, setPublishModal] = useState(null) // journal object
  const [publishing, setPublishing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState({ abstract: '', keywords: '', authors_text: '' })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPapers() }, [])

  async function fetchPapers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('journals')
      .select('*, profiles(name, id)')
      .in('status', ['approved', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) toast.error('Failed to load accepted papers')
    setPapers(data ?? [])
    setLoading(false)
  }

  function openPublishModal(paper) {
    // Pre-fill from stored data
    const authorsArr = Array.isArray(paper.authors) ? paper.authors : []
    const authorsText = authorsArr.map(a => a.name || a).join(', ')
    setForm({
      abstract: paper.abstract || '',
      keywords: paper.keywords || '',
      authors_text: authorsText || paper.author_name || paper.profiles?.name || '',
    })
    setPublishModal(paper)
  }

  async function handlePublish(e) {
    e.preventDefault()
    if (!form.abstract.trim()) return toast.error('Please enter the abstract')
    if (!form.authors_text.trim()) return toast.error('Please enter at least one author name')

    setPublishing(true)
    try {
      const authorsArray = form.authors_text.split(',').map((n, i) => ({
        name: n.trim(),
        is_corresponding: i === 0,
      })).filter(a => a.name)

      const { error } = await supabase.rpc('publish_pre_compile', {
        p_journal_id:  publishModal.id,
        p_abstract:    form.abstract.trim(),
        p_keywords:    form.keywords.trim(),
        p_authors:     authorsArray,
        p_author_name: authorsArray[0]?.name || publishModal.author_name,
      })

      if (error) throw error

      // Notify student if there is one
      let emailFailed = false;
      if (publishModal.student_id) {
        const res = await sendNotification('/api/notify/publish', {
          studentId: publishModal.student_id,
          studentName: publishModal.profiles?.name || 'Author',
          journalTitle: publishModal.title,
          paperId: publishModal.id,
        })
        if (!res || !res.ok) emailFailed = true;
      }

      if (emailFailed) {
        toast.error('Paper published, but failed to send email notification.', { duration: 5000 });
      } else {
        toast.success('Paper published successfully!')
      }
      setPublishModal(null)
      fetchPapers()
    } catch (err) {
      toast.error(err.message || 'Failed to publish paper')
    }
    setPublishing(false)
  }

  async function handleDeletePaper(journalId, studentId, studentName, title) {
    setDeleteLoading(true)
    try {
      // Use the secure admin delete route for complete removal
      const res = await sendNotification(`/api/admin/journals/${journalId}/delete`, {})
      if (!res || !res.ok) throw new Error('Failed to delete paper from database')

      // Remove from list
      setPapers(prev => prev.filter(j => j.id !== journalId))

      // Send email notification to the author
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
        toast.error('Paper deleted, but failed to notify author.', { duration: 5000 });
      } else {
        toast.success('Paper permanently deleted')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete paper')
    }
    setDeleteLoading(false)
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Accepted Papers</h1>
          <p className="page-subtitle">Papers ready to be published. Review and confirm details before going live.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchPapers} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : papers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <p className="text-muted">No accepted papers awaiting publication.</p>
          <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>Accepted papers will appear here after the editorial decision is made in Review Reports.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {papers.map(paper => (
            <div key={paper.id} className="card">
              <div className="card-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>{paper.title}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    <span className="badge badge-secondary">
                      {paper.profiles?.name || paper.author_name || '—'}
                    </span>
                    <span className="badge badge-secondary">
                      Accepted: {new Date(paper.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted" style={{ maxWidth: '600px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {paper.abstract?.startsWith('http') ? 'Abstract on file (PDF)' : paper.abstract}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-outline"
                    style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
                    onClick={() => setConfirmDelete({ id: paper.id, studentId: paper.student_id, studentName: paper.profiles?.name, title: paper.title })}
                  >
                    Delete
                  </button>
                  <button className="btn btn-primary" onClick={() => openPublishModal(paper)}>
                    Publish
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish Modal */}
      {publishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="card-title">Publish Paper</div>
                <div className="card-description">Confirm all details before making this paper public</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setPublishModal(null)} style={{ padding: '0.35rem' }}><X size={18} /></button>
            </div>
            <div className="card-content">
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{publishModal.title}</p>
              </div>
              <form onSubmit={handlePublish} className="space-y-4">

                <div className="form-group">
                  <label htmlFor="pub-authors">Author Names <span style={{ }}>*</span></label>
                  <input id="pub-authors" className="input" placeholder="Separate multiple authors with commas" value={form.authors_text}
                    onChange={e => setForm(p => ({ ...p, authors_text: e.target.value }))} required />
                  <p className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>First name will be the corresponding author</p>
                </div>
                <div className="form-group">
                  <label htmlFor="pub-keywords">Keywords</label>
                  <input id="pub-keywords" className="input" placeholder="Comma-separated keywords" value={form.keywords}
                    onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="pub-abstract">Abstract <span style={{ }}>*</span></label>
                  <textarea id="pub-abstract" className="input" style={{ minHeight: '120px', resize: 'vertical' }}
                    placeholder="Full abstract text..." value={form.abstract}
                    onChange={e => setForm(p => ({ ...p, abstract: e.target.value }))} required />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={publishing}>
                    {publishing ? <><div className="spinner-sm" /> Publishing…</> : 'Confirm & Publish'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setPublishModal(null)} disabled={publishing}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => !deleteLoading && setConfirmDelete(null)}
        onConfirm={() => handleDeletePaper(confirmDelete.id, confirmDelete.studentId, confirmDelete.studentName, confirmDelete.title)}
        title="Delete Accepted Paper"
        message={`WARNING: Are you sure you want to PERMANENTLY delete "${confirmDelete?.title}"? This cannot be undone.`}
        confirmText="Delete Permanently"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  )
}

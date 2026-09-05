import { useState, useEffect } from 'react'
import { Layers, Search, Info, BookOpen } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'

export default function AdminCompileIssue() {
  const toast = useToast()

  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedPapers, setSelectedPapers] = useState(new Set())
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    volume_number: '',
    issue_number: ''
  })
  const [currentIssueInfo, setCurrentIssueInfo] = useState(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    // Fetch papers in "Future Issue" pool
    const { data: futurePapers, error: papersError } = await supabase
      .from('journals')
      .select('id, title, abstract, created_at, profiles(name, id), author_name')
      .eq('status', 'published')
      .is('volume_number', null)
      .order('created_at', { ascending: true })

    if (papersError) {
      toast.error('Failed to load future papers: ' + papersError.message)
    } else {
      setPapers(futurePapers || [])
    }

    // Fetch current issue defaults
    const { data: currIssue } = await supabase
      .from('current_issue')
      .select('volume_number, issue_number, volume_topic, timeline, last_submission_date')
      .single()

    if (currIssue) {
      setCurrentIssueInfo(currIssue)
      setForm({
        volume_number: currIssue.volume_number || '',
        issue_number: currIssue.issue_number || ''
      })
    }
    setLoading(false)
  }

  const togglePaper = (id) => {
    const next = new Set(selectedPapers)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedPapers(next)
  }

  const filteredPapers = papers.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.profiles?.name || p.author_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleAll = () => {
    if (selectedPapers.size === filteredPapers.length && filteredPapers.length > 0) {
      setSelectedPapers(new Set())
    } else {
      setSelectedPapers(new Set(filteredPapers.map(p => p.id)))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.volume_number.trim()) return toast.error('Please enter the volume number')
    if (!form.issue_number.trim()) return toast.error('Please enter the issue number')
    if (selectedPapers.size === 0) return toast.error('Please select at least one paper for this issue')

    setSubmitting(true)
    try {
      const selectedIds = Array.from(selectedPapers)
      const { error: rpcError } = await supabase.rpc('admin_compile_issue', {
        p_volume: form.volume_number.trim(),
        p_issue: form.issue_number.trim(),
        p_journal_ids: selectedIds
      })

      if (rpcError) throw rpcError

      toast.success(`Successfully published ${form.volume_number} ${form.issue_number}`)

      setSelectedPapers(new Set())
      fetchData()

    } catch (err) {
      toast.error(err.message || 'Creating issue failed. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Create New Issue</h1>
        <p className="page-subtitle">Group accepted "Articles in Press" manuscripts into a new published Volume and Issue.</p>
      </div>

      {currentIssueInfo && (
        <div className="card" style={{ padding: '0.85rem 1.25rem', background: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}>
          <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <span className="font-semibold">Current Published Issue: </span>
            <span>{currentIssueInfo.volume_number || 'Volume —'}, {currentIssueInfo.issue_number || 'Issue —'}</span>
          </div>
        </div>
      )}

      {/* Responsive Flex Wrapper preventing overlap on minimized/narrow browser pages */}
      <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: '1.5rem', alignItems: 'flex-start' }}>

        {/* Papers Selection Card */}
        <div className="card" style={{ flex: '1 1 440px', minWidth: 0, width: '100%' }}>
          <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Articles in Press</div>
              <div className="card-description">Select manuscripts to include in this issue.</div>
            </div>
            {papers.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={toggleAll} style={{ fontSize: '0.8rem' }}>
                {selectedPapers.size === filteredPapers.length && filteredPapers.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          <div className="card-content space-y-4">
            {papers.length > 0 && (
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                <input
                  className="input input-icon-left"
                  style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                  placeholder="Filter manuscripts by title or author…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            )}

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>
            ) : filteredPapers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)' }}>
                <p style={{ fontStyle: 'italic', fontSize: '0.95rem' }}>
                  {search ? 'No matching manuscripts found.' : 'No accepted papers waiting to be published.'}
                </p>
                {!search && (
                  <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                    Accepted manuscripts will appear here after being processed in Accepted Papers.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPapers.map(paper => {
                  const isSelected = selectedPapers.has(paper.id)
                  return (
                    <div
                      key={paper.id}
                      onClick={() => togglePaper(paper.id)}
                      style={{
                        display: 'flex', gap: '0.85rem', padding: '0.9rem 1.1rem',
                        background: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--card)',
                        border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.1)' : 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div onClick
                        style={{ marginTop: '0.2rem', width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontWeight: 600, fontSize: '0.925rem', marginBottom: '0.25rem', color: 'var(--foreground)', lineHeight: 1.35 }}>
                          {paper.title}
                        </h4>
                        <p className="text-xs text-muted" style={{ marginBottom: '0.4rem', fontWeight: 500 }}>
                          Author: {paper.profiles?.name || paper.author_name || '—'}
                        </p>
                        {paper.abstract && (
                          <p className="text-xs text-muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                            {paper.abstract}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Issue Details Form Card */}
        <div className="card" style={{ flex: '1 1 320px', minWidth: 0, maxWidth: '100%' }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={18} style={{ color: 'var(--primary)' }} />
              Issue Details
            </div>
            <div className="card-description">Target Volume & Issue number for this release.</div>
          </div>
          <div className="card-content">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="font-medium text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Volume Number <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Volume 13"
                  value={form.volume_number}
                  onChange={e => setForm(p => ({ ...p, volume_number: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="font-medium text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Issue Number <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Issue 2"
                  value={form.issue_number}
                  onChange={e => setForm(p => ({ ...p, issue_number: e.target.value }))}
                  required
                />
              </div>

              <div style={{ paddingTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.95rem', justifyContent: 'center' }}
                  disabled={submitting || selectedPapers.size === 0}
                >
                  {submitting ? (
                    <><div className="spinner-sm" /> Creating Issue…</>
                  ) : (
                    <><Layers size={16} /> Create Issue ({selectedPapers.size})</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}

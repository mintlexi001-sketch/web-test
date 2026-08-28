import { useState, useEffect } from 'react'
import { X, CheckCircle, Plus, User } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'

export default function PublishLegacy() {
  const toast = useToast()

  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    keywords: '',
    abstract: '',
    volume_number: '',
    issue_number: '',
    published_date: new Date().toISOString().split('T')[0] // Default to today
  })

  const [correspondingAuthor, setCorrespondingAuthor] = useState('')
  const [correspondingAuthorEmail, setCorrespondingAuthorEmail] = useState('')
  const [firstAuthor, setFirstAuthor] = useState('')
  const [coAuthors, setCoAuthors] = useState([])

  // Load drafted data from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('legacy_journal_draft')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.form) setForm(parsed.form)
        if (parsed.correspondingAuthor) setCorrespondingAuthor(parsed.correspondingAuthor)
        if (parsed.correspondingAuthorEmail) setCorrespondingAuthorEmail(parsed.correspondingAuthorEmail)
        if (parsed.firstAuthor) setFirstAuthor(parsed.firstAuthor)
        if (parsed.coAuthors) setCoAuthors(parsed.coAuthors)
      }
    } catch (e) {
      console.error('Error loading draft', e)
    }
  }, [])

  // Save drafted data to local storage when changed
  useEffect(() => {
    localStorage.setItem('legacy_journal_draft', JSON.stringify({
      form, correspondingAuthor, correspondingAuthorEmail, firstAuthor, coAuthors
    }))
  }, [form, correspondingAuthor, correspondingAuthorEmail, firstAuthor, coAuthors])

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  // Co-author management
  const addCoAuthor = () => setCoAuthors(prev => [...prev, ''])
  const updateCoAuthor = (idx, val) => setCoAuthors(prev => prev.map((a, i) => i === idx ? val : a))
  const removeCoAuthor = (idx) => setCoAuthors(prev => prev.filter((_, i) => i !== idx))
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Please enter the paper title')
    if (!form.abstract.trim()) return toast.error('Please enter an abstract')
    if (!form.keywords.trim()) return toast.error('Please enter keywords')
    if (!form.volume_number.trim()) return toast.error('Please enter the volume number')
    if (!form.issue_number.trim()) return toast.error('Please enter the issue number')
    if (!correspondingAuthor.trim()) return toast.error('Please enter the corresponding author name')
    if (!correspondingAuthorEmail.trim()) return toast.error('Please enter the corresponding author email')
    if (!firstAuthor.trim()) return toast.error('Please enter the main author name')
    if (coAuthors.some(a => !a.trim())) return toast.error('Please fill in all co-author name fields')

    setSubmitting(true)
    try {
      // Build authors array
      const authorsArray = [
        { name: correspondingAuthor.trim(), email: correspondingAuthorEmail.trim(), role: 'corresponding', is_corresponding: true },
        { name: firstAuthor.trim(), role: 'first_author', is_corresponding: false },
        ...coAuthors.filter(a => a.trim()).map(name => ({ name: name.trim(), role: 'co_author', is_corresponding: false })),
      ]

      // Insert directly as "published"
      const { error: insertError } = await supabase.from('journals').insert({
        title: form.title.trim(),
        abstract: form.abstract.trim(),
        keywords: form.keywords.trim(),
        file_url: null,
        authors: authorsArray,
        author_name: authorsArray[0].name,
        status: 'published', // Instantly published
        review_level: 0, // No review
        volume_number: form.volume_number.trim(),
        issue_number: form.issue_number.trim(),
        published_at: new Date(form.published_date).toISOString(), // Backdated
        created_at: new Date(form.published_date).toISOString(), // Keep dates consistent
      })
      if (insertError) throw insertError

      toast.success('Paper published successfully!')
      localStorage.removeItem('legacy_journal_draft') // Clear draft on success

      // Reset form
      setForm({
        title: '', keywords: '', abstract: '',
        volume_number: form.volume_number, // Keep these in case uploading a batch for same volume
        issue_number: form.issue_number,
        published_date: form.published_date
      })
      setCorrespondingAuthor('')
      setCorrespondingAuthorEmail('')
      setFirstAuthor('')
      setCoAuthors([])

    } catch (err) {
      toast.error(err.message || 'Publishing failed. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Publish Paper</h1>
        <p className="page-subtitle" style={{ fontSize: '1.05rem', maxWidth: '600px' }}>Manually upload and instantly publish older papers. These skip the peer-review pipeline.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Section 1: Paper Details */}
        <div className="card" style={{ padding: '2.5rem', borderRadius: '1rem', borderTop: '4px solid var(--primary)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Paper Details</h3>

          <div className="space-y-6">
            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="volume" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Volume Number <span style={{}}>*</span></label>
                <input id="volume" className="input" style={{ padding: '0.8rem 1rem' }} placeholder="e.g. Volume 1" value={form.volume_number} onChange={set('volume_number')} required />
              </div>
              <div className="form-group">
                <label htmlFor="issue" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Issue Number <span style={{}}>*</span></label>
                <input id="issue" className="input" style={{ padding: '0.8rem 1rem' }} placeholder="e.g. Issue 2" value={form.issue_number} onChange={set('issue_number')} required />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label htmlFor="published_date" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Original Publication Date <span style={{}}>*</span></label>
                <input type="date" id="published_date" className="input" style={{ padding: '0.8rem 1rem' }} value={form.published_date} onChange={set('published_date')} required />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Paper Name / Title <span style={{}}>*</span></label>
              <input id="title" className="input" style={{ fontSize: '1.05rem', padding: '0.8rem 1rem' }} placeholder="Enter the full title of the paper" value={form.title} onChange={set('title')} required />
            </div>

            {/* Authors Section */}
            <div style={{ background: 'var(--background-alt)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.2rem' }}>Authors</h4>
                  <p className="text-sm text-muted">The corresponding author is treated as the paper owner.</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" style={{ gap: '0.4rem' }} onClick={addCoAuthor}>
                  <Plus size={16} /> Add Co-Author
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: coAuthors.length > 0 ? '1.5rem' : '0' }}>
                {/* Corresponding Author */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <User size={14} /> Corresponding Author <span style={{}}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(217,119,6,0.06)', border: '1.5px solid rgba(217,119,6,0.3)', borderRadius: '0.6rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        className="input"
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem', fontWeight: 500 }}
                        placeholder="Full name of corresponding author"
                        value={correspondingAuthor}
                        onChange={e => setCorrespondingAuthor(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ background: 'rgba(217,119,6,0.06)', border: '1.5px solid rgba(217,119,6,0.3)', borderRadius: '0.6rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="email"
                        className="input"
                        style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem', fontWeight: 500 }}
                        placeholder="Email address of corresponding author"
                        value={correspondingAuthorEmail}
                        onChange={e => setCorrespondingAuthorEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>This author is the paper owner &amp; primary contact</p>
                </div>

                {/* Main Author */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <User size={14} /> Main Author <span style={{}}>*</span>
                  </label>
                  <div style={{ background: 'rgba(37,99,235,0.05)', border: '1.5px solid rgba(37,99,235,0.2)', borderRadius: '0.6rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      className="input"
                      style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem', fontWeight: 500 }}
                      placeholder="Full name of main author"
                      value={firstAuthor}
                      onChange={e => setFirstAuthor(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: '0.35rem' }}>The primary/lead author of the paper</p>
                </div>
              </div>

              {/* Co-authors */}
              {coAuthors.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground)', marginBottom: '0.75rem' }}>Co-Authors</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {coAuthors.map((author, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--background)', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <input
                            className="input"
                            style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem' }}
                            placeholder={`Co-author ${idx + 1}`}
                            value={author}
                            onChange={e => updateCoAuthor(idx, e.target.value)}
                            required
                          />
                        </div>
                        <button type="button"
                          style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                          onClick={() => removeCoAuthor(idx)} title="Remove co-author">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="keywords" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Keywords <span style={{}}>*</span></label>
              <input id="keywords" className="input" style={{ padding: '0.8rem 1rem' }} placeholder="e.g. machine learning, neural networks, deep learning" value={form.keywords} onChange={set('keywords')} required />
            </div>

            <div className="form-group">
              <label htmlFor="abstract" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Abstract <span style={{}}>*</span></label>
              <textarea
                id="abstract"
                className="input"
                style={{ minHeight: '160px', resize: 'vertical', padding: '1rem', lineHeight: 1.6 }}
                placeholder="Enter the full text of the abstract here..."
                value={form.abstract}
                onChange={set('abstract')}
                required
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '0.8rem 2rem', fontSize: '1.05rem', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)' }}>
            {submitting ? <><div className="spinner-sm" /> Publishing…</> : <><CheckCircle size={16} /> Publish Paper</>}
          </button>
        </div>

      </form>
    </div>
  )
}

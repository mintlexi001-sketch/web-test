import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, X, Plus, User } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { sendNotification } from '../../lib/api'

/** Reads the first 5 bytes of a File and checks for the %PDF- magic number. */
const isPdfMagicBytes = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = (e) => {
      const bytes = new Uint8Array(e.target.result)
      // %PDF- = 0x25 0x50 0x44 0x46 0x2D
      resolve(
        bytes[0] === 0x25 && bytes[1] === 0x50 &&
        bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D
      )
    }
    reader.readAsArrayBuffer(file.slice(0, 5))
  })

export default function UploadJournal() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ title: '', keywords: '', abstract: '' })
  const [correspondingAuthor, setCorrespondingAuthor] = useState('')
  const [correspondingAuthorEmail, setCorrespondingAuthorEmail] = useState('')
  const [firstAuthor, setFirstAuthor] = useState('')
  const [coAuthors, setCoAuthors] = useState([])

  const [isActuallyOpen, setIsActuallyOpen] = useState(true)
  const [checkingStatus, setCheckingStatus] = useState(true)

  // Load drafted data from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('journal_draft')
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
    localStorage.setItem('journal_draft', JSON.stringify({
      form, correspondingAuthor, correspondingAuthorEmail, firstAuthor, coAuthors
    }))
  }, [form, correspondingAuthor, correspondingAuthorEmail, firstAuthor, coAuthors])

  useEffect(() => {
    async function loadData() {
      // Check issue status
      const { data } = await supabase
        .from('current_issue')
        .select('is_open')
        .single()

      if (data) {
        setIsActuallyOpen(data.is_open)
      }
      setCheckingStatus(false)
    }
    loadData()
  }, [])

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  // Co-author management
  const addCoAuthor = () => setCoAuthors(prev => [...prev, ''])
  const updateCoAuthor = (idx, val) => setCoAuthors(prev => prev.map((a, i) => i === idx ? val : a))
  const removeCoAuthor = (idx) => setCoAuthors(prev => prev.filter((_, i) => i !== idx))

  // File handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return
    if (dropped.type !== 'application/pdf') return toast.error('Please upload a PDF file')
    if (dropped.size > 10 * 1024 * 1024) return toast.error('File must be less than 10MB')
    const validPdf = await isPdfMagicBytes(dropped)
    if (!validPdf) return toast.error('File does not appear to be a valid PDF')
    setFile(dropped)
  }, [toast])

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.type !== 'application/pdf') return toast.error('Please upload a PDF file')
    if (selected.size > 10 * 1024 * 1024) return toast.error('File must be less than 10MB')
    const validPdf = await isPdfMagicBytes(selected)
    if (!validPdf) return toast.error('File does not appear to be a valid PDF')
    setFile(selected)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Please upload your full article PDF')
    if (!form.title.trim()) return toast.error('Please enter the paper title')
    if (!form.abstract.trim()) return toast.error('Please enter an abstract')
    if (!form.keywords.trim()) return toast.error('Please enter keywords')
    if (!correspondingAuthor.trim()) return toast.error('Please enter the corresponding author name')
    if (!correspondingAuthorEmail.trim()) return toast.error('Please enter the corresponding author email')
    if (!firstAuthor.trim()) return toast.error('Please enter the 1st author name')
    if (coAuthors.some(a => !a.trim())) return toast.error('Please fill in all co-author name fields')
    if (!user) return toast.error('You must be logged in')
    if (!isActuallyOpen) return toast.error('Submissions are closed')

    setSubmitting(true)
    try {
      // Upload full article PDF
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('journals')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError

      // Store the storage PATH (not a public URL) — bucket is private, signed URLs are generated on demand
      const fileStoragePath = fileName

      // Build authors array: corresponding author (paper owner) first, then 1st author, then co-authors
      const authorsArray = [
        { name: correspondingAuthor.trim(), email: correspondingAuthorEmail.trim(), role: 'corresponding', is_corresponding: true },
        { name: firstAuthor.trim(), role: 'first_author', is_corresponding: false },
        ...coAuthors.filter(a => a.trim()).map(name => ({ name: name.trim(), role: 'co_author', is_corresponding: false })),
      ]

      // Insert journal record
      const { error: insertError } = await supabase.from('journals').insert({
        student_id: user.id,
        title: form.title.trim(),
        abstract: form.abstract.trim(),
        keywords: form.keywords.trim(),
        file_url: fileStoragePath,
        authors: authorsArray,
        review_level: 0,
      })
      if (insertError) throw insertError

      // Send admin notification securely
      let emailFailed = false;
      const res = await sendNotification('/api/notify/upload', {
        studentName: profile?.name || 'An author',
        journalTitle: form.title.trim(),
      })
      if (!res || !res.ok) emailFailed = true;

      if (emailFailed) {
        toast.error('Paper submitted, but failed to send email notification to admins.', { duration: 5000 });
      } else {
        toast.success('Paper submitted successfully!')
      }
      localStorage.removeItem('journal_draft') // Clear draft on success
      navigate('/student/journals')
    } catch (err) {
      toast.error(err.message || 'Submission failed. Please try again.')
    }
    setSubmitting(false)
  }

  if (checkingStatus) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!isActuallyOpen) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Submit Paper</h1>
          <p className="page-subtitle">Submit your research paper for review</p>
        </div>
        <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(254, 226, 226, 0.5)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: '#991b1b' }}>Submissions Closed</h2>
          <p style={{ color: '#7f1d1d', maxWidth: '400px', margin: '0 auto' }}>
            Paper submissions are currently closed. Please check back later.
          </p>
          <div style={{ marginTop: '2rem' }}>
            <button className="btn btn-outline" onClick={() => navigate('/student/dashboard')}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Submit Manuscript</h1>
        <p className="page-subtitle" style={{ fontSize: '1.05rem', maxWidth: '600px' }}>Enter the details of your research paper and upload the full document for editorial review.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section 1: Basic Information */}
        <div className="card" style={{ padding: '2.5rem', borderRadius: '1rem', borderTop: '4px solid var(--primary)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Basic Information</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            {/* Paper Title */}
            <div className="form-group">
              <label htmlFor="title" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Paper Title <span style={{ }}>*</span></label>
              <input id="title" className="input" style={{ fontSize: '1.05rem', padding: '0.8rem 1rem' }} placeholder="Enter the full title of your research paper"
                value={form.title} onChange={set('title')} required />
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

              {/* Two primary author columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: coAuthors.length > 0 ? '1.5rem' : '0' }}>
                {/* Corresponding Author */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <User size={14} /> Corresponding Author <span style={{ }}>*</span>
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
                        placeholder="Email address"
                        value={correspondingAuthorEmail}
                        onChange={e => setCorrespondingAuthorEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>This author is the paper owner &amp; primary contact</p>
                </div>

                {/* 1st Author */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <User size={14} /> 1st Author <span style={{ }}>*</span>
                  </label>
                  <div style={{ background: 'rgba(37,99,235,0.05)', border: '1.5px solid rgba(37,99,235,0.2)', borderRadius: '0.6rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      className="input"
                      style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '0.5rem', fontWeight: 500 }}
                      placeholder="Full name of 1st author"
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

            {/* Keywords */}
            <div className="form-group">
              <label htmlFor="keywords" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Keywords <span style={{ }}>*</span></label>
              <input id="keywords" className="input" style={{ padding: '0.8rem 1rem' }}
                placeholder="e.g. quantum computing, neural networks"
                value={form.keywords} onChange={set('keywords')} required />
              <p className="text-xs text-muted" style={{ marginTop: '0.4rem' }}>Separate keywords with commas</p>
            </div>
          </div>
        </div>

        {/* Section 3: Abstract & Document */}
        <div className="card" style={{ padding: '2.5rem', borderRadius: '1rem', borderTop: '4px solid #10b981', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--foreground)' }}>Manuscript Content</h3>
          
          <div className="space-y-6">
            {/* Abstract */}
            <div className="form-group">
              <label htmlFor="abstract" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Abstract <span style={{ }}>*</span></label>
              <textarea
                id="abstract"
                className="input"
                style={{ minHeight: '180px', resize: 'vertical', padding: '1rem', lineHeight: 1.7 }}
                placeholder="Enter the full text of your abstract here..."
                value={form.abstract}
                onChange={set('abstract')}
                required
              />
            </div>

            {/* Full Article PDF Upload */}
            <div className="form-group">
              <label style={{ fontWeight: 500, fontSize: '0.95rem' }}>Full Article PDF <span style={{ }}>*</span></label>
              <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
                Upload the complete research paper as a PDF. Max size: 10MB.
              </p>
              
              {!file ? (
                <div
                  className={`dropzone${dragActive ? ' active' : ''}`}
                  style={{ position: 'relative', padding: '3.5rem 2rem', borderRadius: '0.75rem', background: dragActive ? 'rgba(37, 99, 235, 0.05)' : 'var(--background-alt)', border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`, transition: 'all 0.2s', textAlign: 'center', cursor: 'pointer' }}
                  onDragEnter={handleDrag} onDragLeave={handleDrag}
                  onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}><Upload size={40} style={{ margin: '0 auto' }} /></div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--foreground)' }}>Click to upload or drag and drop</p>
                  <p className="text-muted text-sm">PDF documents only</p>
                  <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#10b981', color: 'white', padding: '0.75rem', borderRadius: '0.5rem' }}><FileText size={24} /></div>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.2rem' }}>{file.name}</p>
                      <p className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary"
                    style={{  gap: '0.4rem', padding: '0.5rem 1rem' }}
                    onClick={() => setFile(null)}>
                    <X size={16} /> Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/student/dashboard')} style={{ padding: '0.8rem 1.5rem' }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '0.8rem 2rem', fontSize: '1.05rem', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)' }}>
            {submitting ? <><div className="spinner-sm" /> Submitting…</> : 'Submit Manuscript'}
          </button>
        </div>

      </form>
    </div>
  )
}

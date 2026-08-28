import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Calendar, Users, ChevronRight, X, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AnimatedSection } from '../components/ui/AnimatedSection'

/* ─────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────── */
function getAllAuthorsStr(paper) {
  if (Array.isArray(paper.authors) && paper.authors.length > 0) {
    return paper.authors.map(a => a.name || a).join(', ')
  }
  return paper.author_name || '—'
}

function getCorrespondingAuthorName(paper) {
  if (Array.isArray(paper.authors) && paper.authors.length > 0) {
    const corr = paper.authors.find(a => a.is_corresponding || a.role === 'corresponding')
    if (corr) return corr.name || corr
    return paper.authors[0].name || paper.authors[0]
  }
  return paper.author_name || '—'
}

function groupPapersByVolumeIssue(papers) {
  const volumes = {}
  papers.forEach(p => {
    const isFuture = p.volume_number == null;
    const volKey = isFuture ? 'Articles in Press' : p.volume_number
    const issKey = isFuture ? 'Upcoming Papers' : (p.issue_number || 'General Issue')
    if (!volumes[volKey]) volumes[volKey] = { label: volKey, issues: {}, latestDate: null }
    if (!volumes[volKey].issues[issKey]) volumes[volKey].issues[issKey] = { label: issKey, papers: [], latestDate: null }
    volumes[volKey].issues[issKey].papers.push(p)
    const d = new Date(p.published_at || p.created_at)
    if (!volumes[volKey].issues[issKey].latestDate || d > volumes[volKey].issues[issKey].latestDate) {
      volumes[volKey].issues[issKey].latestDate = d
    }
    if (!volumes[volKey].latestDate || d > volumes[volKey].latestDate) {
      volumes[volKey].latestDate = d
    }
  })
  return volumes
}

/* ─────────────────────────────────────────────────────────────────────
   Paper Card — used inside Issue Detail view
───────────────────────────────────────────────────────────────────── */
function PaperCard({ paper, index }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '1rem',
      padding: '1.5rem',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
      position: 'relative',
      overflow: 'hidden',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(29,78,216,0.12)'
        e.currentTarget.style.borderColor = 'rgba(29,78,216,0.35)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Paper number */}
      <div style={{
        position: 'absolute', top: '1.25rem', right: '1.25rem',
        width: '2rem', height: '2rem', borderRadius: '50%',
        background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)' }}>{index + 1}</span>
      </div>

      <div style={{ paddingRight: '2.5rem' }}>
        {/* Badges */}
        {(paper.volume_number || paper.issue_number) && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
            {paper.volume_number && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                borderRadius: '999px', background: 'var(--primary)', color: '#fff', letterSpacing: '0.03em',
              }}>Vol. {paper.volume_number}</span>
            )}
            {paper.issue_number && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                borderRadius: '999px', background: 'rgba(29,78,216,0.6)', color: '#fff', letterSpacing: '0.03em',
              }}>Iss. {paper.issue_number}</span>
            )}
          </div>
        )}

        {/* Title */}
        <Link to={`/paper/${paper.id}`} style={{ textDecoration: 'none' }}>
          <h3 style={{
            fontSize: '1.08rem', fontWeight: 700, color: 'var(--foreground)',
            marginBottom: '0.55rem', lineHeight: 1.45, cursor: 'pointer',
            transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--foreground)'}
          >{paper.title}</h3>
        </Link>

        {/* Meta */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Users size={13} style={{ color: 'var(--primary)', opacity: 0.7 }} /> {getCorrespondingAuthorName(paper)}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} style={{ color: 'var(--primary)', opacity: 0.7 }} />
            {new Date(paper.published_at || paper.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}
          </span>
        </div>

        {/* Abstract */}
        <p style={{
          fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: 1.7,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', marginBottom: '0.85rem',
        }}>{paper.abstract}</p>

        {/* Keywords */}
        {paper.keywords && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
            {paper.keywords.split(',').slice(0, 5).map((kw, i) => (
              <span key={i} style={{
                fontSize: '0.68rem', padding: '0.2rem 0.55rem', borderRadius: '999px',
                background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
              }}>{kw.trim()}</span>
            ))}
          </div>
        )}

        <Link to={`/paper/${paper.id}`} className="btn btn-primary btn-sm" style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          Read Paper
        </Link>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Issue Detail View
───────────────────────────────────────────────────────────────────── */
function IssueDetailView({ papers, volumeLabel, issueLabel, onBack }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const filtered = useMemo(() => papers.filter(p => {
    const authorStr = getAllAuthorsStr(p).toLowerCase()
    const q = debouncedSearch.toLowerCase()
    return !q.trim() ||
      p.title?.toLowerCase().includes(q) ||
      authorStr.includes(q) ||
      p.keywords?.toLowerCase().includes(q)
  }), [papers, debouncedSearch])

  return (
    <>
      {/* Sticky issue header + filters */}
      <div style={{
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: '72px',
        zIndex: 30,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0.9rem 1.5rem' }}>
          {/* Back + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            <button onClick={onBack} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              Back to Volumes
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Publication Archive</span>
              <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
              <span style={{
                fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)',
                background: 'rgba(29,78,216,0.1)', padding: '0.2rem 0.65rem', borderRadius: '999px',
              }}>{volumeLabel === 'Articles in Press' ? 'Upcoming Publications' : `Volume ${volumeLabel}`}</span>
              <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
              <span style={{
                fontSize: '0.8rem', fontWeight: 700, color: '#2563eb',
                background: 'rgba(37,99,235,0.1)', padding: '0.2rem 0.65rem', borderRadius: '999px',
              }}>{issueLabel === 'Upcoming Papers' ? issueLabel : `Issue ${issueLabel}`}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginLeft: '0.25rem' }}>
                {papers.length} paper{papers.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <input
                className="input"
                style={{ padding: '0 1rem', fontSize: '0.875rem', height: '2.5rem' }}
                placeholder="Search by title, author, or keyword…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <button className="btn btn-outline btn-sm" onClick={() => setSearch('')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Papers */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--muted-foreground)' }}>
            <p style={{ fontStyle: 'italic', fontSize: '0.95rem' }}>No papers found in this issue.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
              Showing <strong style={{ color: 'var(--foreground)' }}>{filtered.length}</strong> of {papers.length} papers
            </p>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {filtered.map((paper, i) => <PaperCard key={paper.id} paper={paper} index={i} />)}
            </div>
          </>
        )}
      </section>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Volume Grid — landing view
───────────────────────────────────────────────────────────────────── */
function VolumeGrid({ volumes, onSelectIssue }) {
  const volKeys = Object.keys(volumes).sort((a, b) => {
    if (a === 'Articles in Press') return -1
    if (b === 'Articles in Press') return 1
    const numA = parseInt(a.replace(/\D/g, '')) || 0
    const numB = parseInt(b.replace(/\D/g, '')) || 0
    return numB - numA
  })

  if (volKeys.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 1.5rem' }}>
        <BookOpen size={56} style={{ margin: '0 auto 1.5rem', opacity: 0.15 }} />
        <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No Publications Yet</p>
        <p className="text-muted">Papers will appear here once they are published.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '2rem' }}>
        Select a volume and issue to browse papers
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.75rem',
      }}>
        {volKeys.map((volKey, vi) => {
          const vol = volumes[volKey]
          const issueKeys = Object.keys(vol.issues).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0
            const numB = parseInt(b.replace(/\D/g, '')) || 0
            return numA - numB
          })
          const totalPapers = issueKeys.reduce((s, ik) => s + vol.issues[ik].papers.length, 0)

          return (
            <div key={volKey} style={{
              background: 'var(--card)',
              border: '1.5px solid var(--border)',
              borderRadius: '1.25rem',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(29,78,216,0.14)'
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.borderColor = 'rgba(29,78,216,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = ''
                e.currentTarget.style.transform = ''
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              {/* Volume header */}
              <div style={{
                background: volKey === 'Articles in Press'
                  ? 'linear-gradient(135deg, #b8860b 0%, #d4a017 50%, #c9960c 100%)'
                  : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                padding: '1.25rem 1.5rem',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* decorative circle */}
                <div style={{
                  position: 'absolute', right: '-20px', top: '-20px',
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.07)',
                }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {volKey === 'Articles in Press' ? 'Upcoming' : 'Volume'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>{volKey}</h3>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>{totalPapers}</p>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', margin: 0, marginTop: '0.1rem' }}>
                      paper{totalPapers !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Issue buttons */}
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem', margin: '0 0 0.35rem' }}>Issues</p>
                {issueKeys.map((issKey, ii) => {
                  const iss = vol.issues[issKey]
                  const isLatest = vi === 0 && ii === issueKeys.length - 1
                  return (
                    <button
                      key={issKey}
                      onClick={() => onSelectIssue(volKey, issKey)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        background: isLatest ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.03)',
                        border: isLatest ? '1.5px solid rgba(37,99,235,0.3)' : '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        gap: '0.75rem',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(29,78,216,0.07)'
                        e.currentTarget.style.borderColor = 'var(--primary)'
                        e.currentTarget.style.transform = 'translateX(3px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isLatest ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.03)'
                        e.currentTarget.style.borderColor = isLatest ? 'rgba(37,99,235,0.3)' : 'var(--border)'
                        e.currentTarget.style.transform = ''
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: isLatest ? '#2563eb' : 'var(--primary)',
                          color: '#fff', flexShrink: 0,
                        }}>{issKey}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Issue {issKey}
                        </span>
                        {isLatest && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#2563eb', background: 'rgba(37,99,235,0.12)', padding: '0.1rem 0.45rem', borderRadius: '999px', flexShrink: 0 }}>
                            LATEST
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                          {iss.papers.length}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Global Search Results
───────────────────────────────────────────────────────────────────── */
function GlobalSearchResults({ papers, search }) {
  const filtered = papers.filter(p => {
    const authorStr = getAllAuthorsStr(p).toLowerCase()
    return p.title?.toLowerCase().includes(search.toLowerCase()) ||
      authorStr.includes(search.toLowerCase()) ||
      p.keywords?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
        <strong style={{ color: 'var(--foreground)' }}>{filtered.length}</strong> result{filtered.length !== 1 ? 's' : ''} for "{search}"
      </p>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
          <p style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No results found</p>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Try different search terms.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {filtered.map((paper, i) => <PaperCard key={paper.id} paper={paper} index={i} />)}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Main PublishedPapers Page
───────────────────────────────────────────────────────────────────── */
export default function PublishedPapers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalSearch, setGlobalSearch] = useState('')
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('')

  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const SEARCH_PAGE_SIZE = 30

  const selectedVol = searchParams.get('vol') || ''
  const selectedIss = searchParams.get('iss') || ''

  // Debounce global search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedGlobalSearch(globalSearch)
      setPage(0) // reset page when search changes
    }, 400)
    return () => clearTimeout(t)
  }, [globalSearch])

  // Fetch papers when page or search changes
  useEffect(() => {
    fetchPapers(page, page > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedGlobalSearch])

  async function fetchPapers(pageIndex = 0, append = false) {
    if (pageIndex === 0) setLoading(true)
    else setLoadingMore(true)

    const isSearch = debouncedGlobalSearch.trim().length > 1

    let query = supabase
      .from('published_issues')
      .select('id, title, abstract, keywords, authors, author_name, volume_number, issue_number, published_at, created_at')
      .order('published_at', { ascending: false, nullsFirst: false })

    // Server-side global search
    const q = debouncedGlobalSearch.trim()
    if (isSearch) {
      // SEC: Strip commas and quotes to prevent PostgREST filter injection in .or() clause
      const safeQ = q.replace(/[,"]/g, ' ')
      query = query
        .or(`title.ilike.%${safeQ}%,keywords.ilike.%${safeQ}%,author_name.ilike.%${safeQ}%`)
        .range(pageIndex * SEARCH_PAGE_SIZE, (pageIndex + 1) * SEARCH_PAGE_SIZE - 1)
    }
    // No range limit when not searching — load all volumes at once

    const { data, error } = await query

    if (!error && data) {
      if (append) setPapers(prev => [...prev, ...data])
      else setPapers(data)
      setHasMore(isSearch && data.length === SEARCH_PAGE_SIZE)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  const volumes = useMemo(() => groupPapersByVolumeIssue(papers), [papers])

  function handleSelectIssue(vol, iss) {
    setSearchParams({ vol, iss })
    setGlobalSearch('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setSearchParams({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isIssueView = !!(selectedVol && selectedIss)
  const isGlobalSearch = debouncedGlobalSearch.trim().length > 1 && !isIssueView
  const issuePapers = isIssueView ? (volumes[selectedVol]?.issues[selectedIss]?.papers || []) : []

  return (
    <>
      {/* ── Hero banner ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 60%, #1e40af 100%)',
        padding: '4.5rem 1.5rem 3.5rem',
        color: '#fff',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '-120px', right: '-80px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', bottom: '-80px', left: '-60px', pointerEvents: 'none' }} />

        <AnimatedSection direction="up">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.12)', padding: '0.35rem 1rem', borderRadius: '999px', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Publication Archive</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4.5vw, 3rem)', fontWeight: 800, marginBottom: '0.85rem', lineHeight: 1.15 }}>
              Research Publications
            </h1>
            <p style={{ fontSize: '1.05rem', opacity: 0.82, maxWidth: '560px', margin: '0 auto', lineHeight: 1.75 }}>
              Peer-reviewed research spanning science, society, and the intersection of human knowledge.
            </p>
          </div>
        </AnimatedSection>
      </section>

      {/* ── Global search bar (hidden in issue detail view) ── */}
      {!isIssueView && (
        <div style={{
          background: 'var(--background)',
          borderBottom: '1px solid var(--border)',
          padding: '1rem 1.5rem',
          position: 'sticky',
          top: '72px',
          zIndex: 30,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <input
                className="input"
                style={{ padding: '0 1rem', fontSize: '0.9rem', height: '2.5rem' }}
                placeholder="Search across all volumes by title, author, or keyword…"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
              />
            </div>
            {globalSearch && (
              <button className="btn btn-primary btn-sm" onClick={() => setGlobalSearch('')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {loading && page === 0 ? (
        <div style={{ textAlign: 'center', padding: '7rem 1.5rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.25rem' }} />
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.95rem' }}>Loading publications…</p>
        </div>
      ) : isIssueView ? (
        <IssueDetailView
          papers={issuePapers}
          volumeLabel={selectedVol}
          issueLabel={selectedIss}
          onBack={handleBack}
        />
      ) : isGlobalSearch ? (
        <>
          <GlobalSearchResults papers={papers} search={debouncedGlobalSearch} />
          {hasMore && (
            <div style={{ textAlign: 'center', paddingBottom: '3rem' }}>
              <button className="btn btn-outline" onClick={() => setPage(p => p + 1)} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <VolumeGrid volumes={volumes} onSelectIssue={handleSelectIssue} />
        </>
      )}
    </>
  )
}

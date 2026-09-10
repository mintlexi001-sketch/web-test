

const guidelineCards = [
  {
    title: '1. PUBLICATION SCHEME',
    content: (
      <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>
        The journal is published as a biannual publication in January–June and July–December issues. The Editor reserves the right to accept/reject manuscripts and to edit articles wherever considered necessary. Manuscripts become the property of the publisher.
      </p>
    )
  },
  {
    title: '2. LANGUAGE',
    content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>English</p>
  },
  {
    title: '3. SUBJECTS COVERED',
    content: (
      <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>
        Science, Humanities, Commerce, Management, Literature, Education, Engineering and Ethics.
      </p>
    )
  },
  {
    title: '4. SUBMISSION GUIDELINES',
    content: (
      <ul className="text-muted text-sm" style={{ listStyleType: 'none', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '0.5rem', lineHeight: '1.6' }}>
        <li><strong>General Articles:</strong> Articles should not exceed 5000 words.</li>
        <li><strong>Review Articles:</strong> Articles are expected to survey and discuss recent developments in a field. Word limit: 4000–5000 words. Limit of cited references: up to 50.</li>
        <li><strong>Research Articles:</strong> Should present results of original research. Size: 2500–3500 words.</li>
        <li><strong>Reports:</strong> Factual reports on topics of interest such as conferences, seminars, etc. (less than 2000 words).</li>
        <li><strong>News and Views:</strong> Brief announcements, comments on new developments in any discipline (less than 750 words, max 2 display items).</li>
        <li><strong>Resource Reviews:</strong> New books, websites, CDs, etc.</li>
        <li><strong>Letters to the Editor:</strong> May be limited to less than 500 words.</li>
      </ul>
    )
  },
  {
    title: '5. INSTRUCTIONS TO THE AUTHORS',
    content: (
      <div className="text-muted text-sm space-y-2" style={{ lineHeight: '1.6' }}>
        <p>Articles will be peer-reviewed.</p>
        <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>The title page should include:</p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
          <li>Title of the paper</li>
          <li>Author’s name, designation, and postal address with PIN code</li>
          <li>Email address</li>
          <li><strong>Abstract:</strong> Not more than 250 words</li>
          <li><strong>Keywords:</strong> 3–5 words</li>
        </ul>
        <p>Manuscripts should follow a proper structure.</p>
        <p>Pages should be serially numbered.</p>
      </div>
    )
  },
  {
    title: '6. FORMATTING INSTRUCTIONS',
    content: (
      <div className="text-muted text-sm space-y-2" style={{ lineHeight: '1.6' }}>
        <p>Manuscripts should be submitted along with a soft copy.</p>
        <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Text formatting:</p>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <li>Use normal plain font (e.g., Times New Roman, 12 pt)</li>
          <li>Divide your article into clearly defined sections and subsections.</li>
        </ul>
      </div>
    )
  },
  {
    title: '7. REFERENCES',
    content: (
      <div className="text-muted text-sm space-y-2" style={{ lineHeight: '1.6' }}>
        <p>All references should be cited in the text using numbers in square brackets.</p>
        <p>References should be listed consecutively.</p>
        <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Example formats:</p>
        <div style={{ backgroundColor: 'var(--bg-section)', padding: '0.75rem', borderRadius: '0.25rem', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
          <p><strong>Journal:</strong> Author, Journal name, Volume, Page, Year</p>
          <p><strong>Book:</strong> Author, Book name, Publisher, Place, Year, Pages</p>
        </div>
      </div>
    )
  },
  {
    title: '8. ACKNOWLEDGEMENT',
    content: (
      <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>Should be placed at the end of the paper before references.</p>
    )
  },
  {
    title: '9. TABLES AND FIGURES',
    content: (
      <ul className="text-muted text-sm" style={{ listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', lineHeight: '1.6' }}>
        <li>Should be embedded in the text.</li>
        <li>Must have proper numbering and captions.</li>
        <li>High-quality images (preferably 300 dpi resolution).</li>
        <li>Grayscale mode is preferred.</li>
      </ul>
    )
  },
  {
    title: '10. FOOTNOTES',
    content: <p className="text-muted text-sm" style={{ lineHeight: '1.6' }}>Should be minimal.</p>
  }
]

export default function StudentGuidelines() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Submission Guidelines</h1>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>
          Please review the following guidelines carefully before submitting your journal to Science and Society.
        </p>
      </div>

      <div className="guidelines-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
        {guidelineCards.map((g, i) => (
          <div key={g.title} className="card guideline-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', position: 'relative', overflow: 'hidden', animation: `fadeUp 0.5s ease forwards`, animationDelay: `${i * 100}ms`, opacity: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(180deg, var(--primary) 0%, transparent 100%)', opacity: 0.8 }} />
            <div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--foreground)', fontSize: '1.15rem', fontWeight: '700', letterSpacing: '0.05em' }}>{g.title}</h3>
              {g.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

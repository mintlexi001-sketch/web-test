export function ScrollJourney({ children }) {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
      {/* Content sits at zIndex 10 — above all fixed background layers (0,1,5) */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </div>
    </div>
  );
}

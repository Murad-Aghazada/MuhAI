/** Shimmer placeholder shown while the Firestore subscriptions settle. */
export default function PageSkeleton({ rows = 4 }) {
  return (
    <div className="page">
      <div className="skel skel--title" />
      <div className="skel skel--sub" />
      <div className="kpi-grid" style={{ marginTop: 26 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel skel--card" />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
        {Array.from({ length: rows - 3 || 1 }).map((_, i) => (
          <div key={i} className="skel skel--panel" />
        ))}
      </div>
    </div>
  )
}

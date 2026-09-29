export default function Loading() {
  return <div className="admin-overview" aria-label="Loading dashboard"><div className="admin-loading-line admin-loading-heading" /><section className="admin-metrics">{Array.from({ length: 4 }, (_, index) => <div key={index} className="admin-loading-card" />)}</section><section className="admin-operations-grid"><div className="admin-loading-panel" /><div className="admin-loading-panel" /></section></div>;
}

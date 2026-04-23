/*
  StatCard.jsx — A single stat tile showing a number + a label.

  Used by: CoordinatorDashboard (Total Fields, Active, Agents Assigned)
           AgentDashboard       (Total Reports, Pending Review, etc.)

  Props:
    label (string) — description of the number, e.g. "Total Fields"
    value (number|string) — the big number displayed prominently

  Kept deliberately simple — no logic, just presentation.
  Any component that needs a stats row renders a flex container and
  places however many <StatCard> children it needs.

  Example:
    <div style={{ display: 'flex', gap: '1rem' }}>
      <StatCard label="Total Fields" value={fields.length} />
      <StatCard label="Active"       value={activeCount} />
    </div>
*/
export default function StatCard({ label, value }) {
  return (
    <div style={styles.card}>
      <span style={styles.value}>{value}</span>
      <span style={styles.label}>{label}</span>
    </div>
  )
}

const styles = {
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '10px',
    padding: '1.25rem',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(27, 94, 32, 0.08)',
  },
  value: {
    display: 'block',
    fontSize: '2.2rem',
    fontWeight: '800',
    color: '#1B5E20',
    lineHeight: 1.1,
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#5A7A5A',
    marginTop: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
}

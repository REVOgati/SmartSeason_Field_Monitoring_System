import { useState, useEffect } from 'react'
import { getMyReports } from '../api/reportsApi'
import Navbar              from '../components/Navbar'
import StatCard            from '../components/StatCard'
import PageLayout, { contentArea } from '../components/PageLayout'
import { sharedStyles as s } from '../components/sharedStyles'

/*
  AgentDashboard.jsx — Main view for logged-in field agents.

  Responsibilities:
  1. Navbar (shared)    — brand, agent name, logout
  2. Stats bar          — total reports submitted, pest alerts, fields covered
  3. Reports list       — one ReportCard per submitted field report
  4. Submit Report CTA  — links to /agent/submit (built in Session 19)

  Data flow:
    mount → getMyReports() → setReports(results)

  The backend view scopes reports to request.user automatically:
  agents only ever see their own submissions.
*/

export default function AgentDashboard() {

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const data = await getMyReports()
        setReports(data.results ?? data)
        /*
          Same pagination envelope as fields:
            { count, next, previous, results: [...] }
        */
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load reports.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const pestCount    = reports.filter(r => r.pest_observed).length
  const fieldsCovered = new Set(reports.map(r => r.field?.id).filter(Boolean)).size
  /*
    new Set() deduplicates field IDs so the stat shows distinct fields
    visited, not total report count.
  */

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout>
      <Navbar title="Agent Dashboard" />

      <main style={contentArea}>

        {/* Stats row */}
        <div style={styles.statsBar}>
          <StatCard label="Reports Submitted" value={reports.length} />
          <StatCard label="Pest Alerts"        value={pestCount}     />
          <StatCard label="Fields Covered"     value={fieldsCovered} />
        </div>

        {/* Section header */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>My Reports</h2>
          <a href="/agent/submit" style={styles.submitLink}>
            + Submit Report
          </a>
          {/*
            Plain <a> for now — navigates to /agent/submit.
            In Session 19 this route will be a full form page.
            Using <a> instead of <Link> keeps this component decoupled from
            react-router until the route actually exists.
          */}
        </div>

        {/* Content states */}
        {loading && <p style={s.stateMsg}>Loading reports…</p>}

        {!loading && error && (
          <div style={s.errorBanner}>{error}</div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div style={s.emptyState}>
            <p>No reports submitted yet.</p>
            <p>Click <strong>+ Submit Report</strong> to log your first field visit.</p>
          </div>
        )}

        {!loading && !error && reports.length > 0 && (
          <div style={styles.list}>
            {reports.map(report => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}

      </main>
    </PageLayout>
  )
}

// ── ReportCard ─────────────────────────────────────────────────────────────────
/*
  Renders one field report as a list row.

  Crop health badge colours:
    excellent → deep green
    good      → mid green
    fair      → amber
    poor      → red
*/
const HEALTH_COLORS = {
  excellent: { bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7' },
  good:      { bg: '#F1F8E9', color: '#33691E', border: '#C5E1A5' },
  fair:      { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  poor:      { bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
}

function ReportCard({ report }) {
  const hc = HEALTH_COLORS[report.crop_health] || HEALTH_COLORS.fair
  const badgeStyle = {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.2rem 0.65rem',
    borderRadius: '30px',
    backgroundColor: hc.bg,
    color: hc.color,
    border: `1px solid ${hc.border}`,
  }

  return (
    <div style={styles.reportCard}>

      {/* Top row: field name + health badge */}
      <div style={styles.cardTop}>
        <span style={styles.fieldName}>
          {report.field?.name || 'Unknown field'}
        </span>
        <span style={badgeStyle}>
          {report.crop_health.charAt(0).toUpperCase() + report.crop_health.slice(1)}
        </span>
      </div>

      {/* Meta info row */}
      <div style={styles.metaRow}>
        <span>📅 {report.report_date}</span>
        <span>💧 {report.soil_moisture}% moisture</span>
        {report.pest_observed && <span style={styles.pestAlert}>⚠️ Pest observed</span>}
      </div>

      {/* Notes */}
      {report.notes && (
        <p style={styles.notes}>{report.notes}</p>
      )}

    </div>
  )
}

// ── Page-local styles ─────────────────────────────────────────────────────────
const styles = {
  statsBar:      { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  sectionTitle:  { margin: 0, color: '#1B5E20', fontSize: '1.3rem', fontWeight: '700' },
  submitLink: {
    padding: '0.5rem 1.25rem',
    backgroundColor: '#2E7D32',
    color: '#FFFFFF',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.9rem',
    boxShadow: '0 2px 6px rgba(27, 94, 32, 0.25)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    boxShadow: '0 2px 8px rgba(27, 94, 32, 0.07)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  fieldName: {
    fontWeight: '700',
    fontSize: '1rem',
    color: '#1B2E1B',
  },
  metaRow: {
    display: 'flex',
    gap: '1.25rem',
    fontSize: '0.83rem',
    color: '#4A6741',
    flexWrap: 'wrap',
  },
  pestAlert: {
    color: '#C62828',
    fontWeight: '700',
  },
  notes: {
    marginTop: '0.6rem',
    fontSize: '0.85rem',
    color: '#5A7A5A',
    borderLeft: '3px solid #A5D6A7',
    paddingLeft: '0.75rem',
    margin: '0.6rem 0 0',
    lineHeight: 1.5,
  },
}

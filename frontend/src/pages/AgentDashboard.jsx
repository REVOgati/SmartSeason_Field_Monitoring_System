import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyReports } from '../api/reportsApi'
import { getAssignedFields } from '../api/fieldsApi'
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

  const [reports,        setReports]        = useState([])
  const [assignedFields, setAssignedFields] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [reportData, fieldData] = await Promise.all([
          getMyReports(),
          getAssignedFields(),
        ])
        setReports(reportData.results ?? reportData)
        setAssignedFields(Array.isArray(fieldData) ? fieldData : (fieldData.results ?? []))
        /*
          getAssignedFields() returns a plain array from the my-assigned action;
          fall back to .results if the shape ever gets paginated.
        */
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const pestCount = reports.filter(r => r.pest_observed).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout>
      <Navbar title="Agent Dashboard" />

      <main style={contentArea}>

        {/* Stats row */}
        <div style={styles.statsBar}>
          <StatCard label="Reports Submitted"  value={reports.length}        />
          <StatCard label="Pest Alerts"         value={pestCount}             />
          <StatCard label="Fields Assigned"     value={assignedFields.length} />
        </div>

        {/* Assigned fields section */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>My Assigned Fields</h2>
        </div>

        {!loading && assignedFields.length === 0 && (
          <div style={{...s.emptyState, marginBottom: '2rem'}}>
            <p>No fields assigned yet.</p>
            <p>Your coordinator will assign fields to you from the dashboard.</p>
          </div>
        )}

        {!loading && assignedFields.length > 0 && (
          <div style={styles.fieldsRow}>
            {assignedFields.map(field => (
              <AssignedFieldChip key={field.id} field={field} />
            ))}
          </div>
        )}

        {/* Section header */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>My Reports</h2>
          <Link to="/agent/submit" style={styles.submitLink}>
            + Submit Report
          </Link>
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

// ── AssignedFieldChip ─────────────────────────────────────────────────────────
/*
  Small card for each field assigned to the agent.
  Shows field name, location, crop type, and active status.
  Appears in the "My Assigned Fields" section above the reports list.
*/
function AssignedFieldChip({ field }) {
  return (
    <Link to={`/agent/field/${field.id}`} style={styles.fieldChip}>
      <div style={styles.chipTop}>
        <span style={styles.chipCrop}>{field.crop_type}</span>
        <span style={{
          fontSize: '0.72rem', fontWeight: '700',
          padding: '0.15rem 0.5rem', borderRadius: '20px',
          backgroundColor: field.is_active ? '#E8F5E9' : '#FFF3E0',
          color:           field.is_active ? '#2E7D32' : '#E65100',
          border:          field.is_active ? '1px solid #A5D6A7' : '1px solid #FFCC80',
        }}>
          {field.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <p style={styles.chipName}>{field.name}</p>
      <p style={styles.chipMeta}>📍 {field.location}</p>
    </Link>
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
  fieldsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.85rem',
    marginBottom: '2.5rem',
  },
  fieldChip: {
    backgroundColor: '#F1F8E9',
    border: '1px solid #C8E6C9',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    minWidth: '180px',
    maxWidth: '260px',
    flex: '1 1 180px',
    boxShadow: '0 1px 6px rgba(27, 94, 32, 0.08)',
    textDecoration: 'none',
    display: 'block',
  },
  chipTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.4rem',
  },
  chipCrop: {
    fontSize: '0.73rem',
    fontWeight: '700',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid #A5D6A7',
  },
  chipName: {
    margin: '0 0 0.2rem',
    fontWeight: '700',
    fontSize: '0.95rem',
    color: '#1B2E1B',
  },
  chipMeta: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#4A6741',
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

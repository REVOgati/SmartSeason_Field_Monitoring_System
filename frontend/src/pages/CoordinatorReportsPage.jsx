import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'
import { getMyReports } from '../api/reportsApi'
import Navbar      from '../components/Navbar'
import PageLayout, { contentArea } from '../components/PageLayout'
import StatCard    from '../components/StatCard'
import { sharedStyles as s } from '../components/sharedStyles'

/*
  CoordinatorReportsPage.jsx — Session 20

  Shows all monitoring reports submitted for the coordinator's fields.
  Includes:
    1. Summary stats bar  — total reports, pest alerts, poor health count
    2. Crop-health bar chart  — distribution of health ratings across all reports
    3. Soil-moisture line chart — trend over the last 30 reports (newest → oldest reversed)
    4. Filterable report list  — filter by crop_health and pest_observed

  Data source: GET /api/reports/  (coordinator scope — all reports for their fields)
*/

// ── Health badge colours ──────────────────────────────────────────────────────
const HEALTH_COLORS = {
  excellent: { bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7', chart: '#2E7D32' },
  good:      { bg: '#F1F8E9', color: '#33691E', border: '#C5E1A5', chart: '#558B2F' },
  fair:      { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80', chart: '#F57C00' },
  poor:      { bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2', chart: '#C62828' },
}

export default function CoordinatorReportsPage() {

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [healthFilter, setHealthFilter] = useState('')   // '' = all
  const [pestFilter,   setPestFilter]   = useState('')   // '' = all | 'true' | 'false'

  useEffect(() => {
    async function load() {
      try {
        /*
          The coordinator's reports endpoint returns all reports for their
          fields. We load all pages by following the `next` cursor, but for
          practical datasets (< 100 reports on page 1) a single call suffices.
          For production, add pagination controls.
        */
        const data = await getMyReports()
        setReports(data.results ?? data)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load reports.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived / filtered data ───────────────────────────────────────────────
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (healthFilter && r.crop_health !== healthFilter) return false
      if (pestFilter === 'true'  && !r.pest_observed)  return false
      if (pestFilter === 'false' && r.pest_observed)   return false
      return true
    })
  }, [reports, healthFilter, pestFilter])

  /*
    healthChartData — for the bar chart.
    Count reports per crop_health value across ALL (unfiltered) reports.
  */
  const healthChartData = useMemo(() => {
    const counts = { excellent: 0, good: 0, fair: 0, poor: 0 }
    reports.forEach(r => { if (counts[r.crop_health] !== undefined) counts[r.crop_health]++ })
    return [
      { label: 'Excellent', value: counts.excellent, key: 'excellent' },
      { label: 'Good',      value: counts.good,      key: 'good'      },
      { label: 'Fair',      value: counts.fair,       key: 'fair'      },
      { label: 'Poor',      value: counts.poor,       key: 'poor'      },
    ]
  }, [reports])

  /*
    moistureChartData — for the line chart.
    Take the most recent 30 reports, reverse so oldest is first (left edge),
    and plot soil_moisture vs report_date.
  */
  const moistureChartData = useMemo(() => {
    return [...reports]
      .slice(0, 30)
      .reverse()
      .map(r => ({
        date:     r.report_date,
        moisture: Number(r.soil_moisture),
        field:    r.field?.name || 'Unknown',
      }))
  }, [reports])

  // ── Summary stats ─────────────────────────────────────────────────────────
  const pestCount  = reports.filter(r => r.pest_observed).length
  const poorCount  = reports.filter(r => r.crop_health === 'poor').length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageLayout>
      <Navbar title="Reports Overview" />

      <main style={contentArea}>

        {/* Back link */}
        <Link to="/coordinator" style={styles.backLink}>← Back to Dashboard</Link>

        {/* Stats row */}
        <div style={styles.statsBar}>
          <StatCard label="Total Reports"  value={reports.length} />
          <StatCard label="Pest Alerts"    value={pestCount}      />
          <StatCard label="Poor Health"    value={poorCount}      />
        </div>

        {loading && <p style={s.stateMsg}>Loading reports…</p>}
        {!loading && error && <div style={s.errorBanner}>{error}</div>}

        {!loading && !error && reports.length > 0 && (
          <>
            {/* ─── Charts row ─────────────────────────────────────────── */}
            <div style={styles.chartsRow}>

              {/* Crop Health Distribution — Bar Chart */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Crop Health Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={healthChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F5E9" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4A6741' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#4A6741' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #C8E6C9', fontSize: '0.85rem' }}
                    />
                    <Bar dataKey="value" name="Reports" radius={[4, 4, 0, 0]}>
                      {healthChartData.map(entry => (
                        <Cell key={entry.key} fill={HEALTH_COLORS[entry.key]?.chart || '#4CAF50'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Soil Moisture Trend — Line Chart */}
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Soil Moisture Trend (latest 30)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={moistureChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F5E9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4A6741' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#4A6741' }} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #C8E6C9', fontSize: '0.85rem' }}
                      formatter={(v) => [`${v}%`, 'Moisture']}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Line
                      type="monotone"
                      dataKey="moisture"
                      name="Soil Moisture"
                      stroke="#2E7D32"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#2E7D32' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* ─── Filter bar ─────────────────────────────────────────── */}
            <div style={styles.filterBar}>
              <label style={s.label}>Filter by health:</label>
              <select
                style={{ ...s.select, width: 'auto', minWidth: '130px' }}
                value={healthFilter}
                onChange={e => setHealthFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>

              <label style={{ ...s.label, marginLeft: '1rem' }}>Pest observed:</label>
              <select
                style={{ ...s.select, width: 'auto', minWidth: '110px' }}
                value={pestFilter}
                onChange={e => setPestFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>

              {(healthFilter || pestFilter) && (
                <button
                  style={{ ...s.cancelBtn, marginLeft: '0.5rem' }}
                  onClick={() => { setHealthFilter(''); setPestFilter('') }}
                >
                  Clear filters
                </button>
              )}
              <span style={styles.filterCount}>
                {filteredReports.length} of {reports.length} reports
              </span>
            </div>

            {/* ─── Report list ─────────────────────────────────────────── */}
            {filteredReports.length === 0 ? (
              <p style={s.stateMsg}>No reports match the current filters.</p>
            ) : (
              <div style={styles.reportList}>
                {filteredReports.map(r => (
                  <ReportRow key={r.id} report={r} />
                ))}
              </div>
            )}

          </>
        )}

        {!loading && !error && reports.length === 0 && (
          <div style={s.emptyState}>
            <p>No reports submitted yet for your fields.</p>
            <p>Reports will appear here once your field agents start submitting them.</p>
          </div>
        )}

      </main>
    </PageLayout>
  )
}

// ── ReportRow ─────────────────────────────────────────────────────────────────
function ReportRow({ report }) {
  const hc = HEALTH_COLORS[report.crop_health] || HEALTH_COLORS.fair
  const badgeStyle = {
    fontSize: '0.75rem', fontWeight: '700',
    padding: '0.2rem 0.6rem', borderRadius: '20px',
    backgroundColor: hc.bg, color: hc.color, border: `1px solid ${hc.border}`,
  }
  return (
    <div style={styles.reportRow}>
      <div style={styles.reportMeta}>
        <span style={styles.fieldName}>{report.field?.name || 'Unknown field'}</span>
        <span style={styles.metaText}>📅 {report.report_date}</span>
        <span style={styles.metaText}>👤 {report.agent?.full_name || '—'}</span>
      </div>
      <div style={styles.reportBadges}>
        <span style={badgeStyle}>
          {report.crop_health.charAt(0).toUpperCase() + report.crop_health.slice(1)}
        </span>
        <span style={styles.metaText}>💧 {report.soil_moisture}%</span>
        {report.pest_observed && (
          <span style={styles.pestBadge}>⚠️ Pest</span>
        )}
      </div>
      {report.notes && (
        <p style={styles.notes}>{report.notes}</p>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  backLink: {
    display: 'inline-block',
    marginBottom: '1.25rem',
    color: '#2E7D32',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  statsBar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.25rem',
    marginBottom: '2rem',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 2px 10px rgba(27, 94, 32, 0.07)',
  },
  chartTitle: {
    margin: '0 0 0.85rem',
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#1B5E20',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1.25rem',
    padding: '0.85rem 1rem',
    backgroundColor: '#F1F8E9',
    border: '1px solid #C8E6C9',
    borderRadius: '10px',
  },
  filterCount: {
    marginLeft: 'auto',
    fontSize: '0.83rem',
    color: '#4A6741',
    fontWeight: '600',
  },
  reportList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  },
  reportRow: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '10px',
    padding: '0.9rem 1.1rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.75rem',
    boxShadow: '0 1px 6px rgba(27, 94, 32, 0.06)',
  },
  reportMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: '180px',
  },
  fieldName: {
    fontWeight: '700',
    fontSize: '0.95rem',
    color: '#1B2E1B',
  },
  metaText: {
    fontSize: '0.8rem',
    color: '#4A6741',
  },
  reportBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flex: 1,
  },
  pestBadge: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#C62828',
  },
  notes: {
    width: '100%',
    margin: 0,
    fontSize: '0.8rem',
    color: '#5A7A5A',
    borderLeft: '3px solid #A5D6A7',
    paddingLeft: '0.65rem',
    lineHeight: 1.5,
  },
}

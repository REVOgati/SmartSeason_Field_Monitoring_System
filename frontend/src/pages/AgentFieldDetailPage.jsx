import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getFieldDetail, patchRealizedDates } from '../api/fieldsApi'
import { getFieldReports } from '../api/reportsApi'
import Navbar      from '../components/Navbar'
import PageLayout, { contentArea } from '../components/PageLayout'
import { sharedStyles as s } from '../components/sharedStyles'
import DateInput   from '../components/DateInput'
import {
  STAGE_LABELS,
  STAGE_REALIZED_DATE_KEY,
  STATUS_CONFIG,
  computeFieldStatus,
} from '../utils/fieldStatus'

/*
  AgentFieldDetailPage — /agent/field/:id

  Allows a field agent to view their assigned field's full details and record
  the actual (realized) crop lifecycle dates.

  Sections:
    1. Header — field name, back link, status badge, crop chip
    2. Field Info — location, size, coordinator name (all read-only)
    3. Crop Timeline — expected dates (read-only) vs realized dates (agent-editable)
    4. My Reports — all reports submitted by this agent for this field
*/

// ── Health badge colours ──────────────────────────────────────────────────────
const HEALTH_COLORS = {
  excellent: { bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7' },
  good:      { bg: '#F1F8E9', color: '#33691E', border: '#C5E1A5' },
  fair:      { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  poor:      { bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
}

// Stage order used for the visual stepper
const STAGE_ORDER = ['not_started', 'farm_prepped', 'planted', 'growing', 'ready', 'harvested']

export default function AgentFieldDetailPage() {
  const { id } = useParams()

  // ── Field data ────────────────────────────────────────────────────────────
  const [field,   setField]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Stage form ─────────────────────────────────────────────────────────────
  const [stageForm,    setStageForm]    = useState(null)
  const [stageSaving,  setStageSaving]  = useState(false)
  const [stageError,   setStageError]   = useState(null)
  const [stageSuccess, setStageSuccess] = useState(false)

  // ── Realized dates form ───────────────────────────────────────────────────
  const [datesForm,    setDatesForm]    = useState(null)
  const [datesSaving,  setDatesSaving]  = useState(false)
  const [datesError,   setDatesError]   = useState(null)
  const [datesSuccess, setDatesSuccess] = useState(false)

  // ── My reports for this field ─────────────────────────────────────────────
  const [reports,        setReports]        = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError,   setReportsError]   = useState(null)

  // ── Mount: load field detail + my reports in parallel ─────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const [fieldData, reportsData] = await Promise.all([
          getFieldDetail(id),
          getFieldReports(id),  // scoped to this agent via the backend
        ])
        setField(fieldData)
        setStageForm({
          current_stage:  fieldData.current_stage || 'not_started',
          realized_date:  '',
        })
        setDatesForm({
          realized_farm_prep_date:  fieldData.realized_farm_prep_date  ?? '',
          realized_planting_date:   fieldData.realized_planting_date   ?? '',
          realized_emergence_date:  fieldData.realized_emergence_date  ?? '',
          realized_harvest_date:    fieldData.realized_harvest_date    ?? '',
          realized_ready_date:      fieldData.realized_ready_date      ?? '',
        })
        setReports(reportsData.results ?? reportsData)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load field details.')
      } finally {
        setLoading(false)
        setReportsLoading(false)
      }
    }
    loadAll()
  }, [id])

  // ── Save current stage (+ corresponding realized date) ────────────────────
  const handleSaveStage = useCallback(async (e) => {
    e.preventDefault()
    setStageSaving(true)
    setStageError(null)
    setStageSuccess(false)
    const payload = { current_stage: stageForm.current_stage }
    const realizedKey = STAGE_REALIZED_DATE_KEY[stageForm.current_stage]
    if (realizedKey && stageForm.realized_date) {
      payload[realizedKey] = stageForm.realized_date
    }
    try {
      const updated = await patchRealizedDates(id, payload)
      setField(updated)
      setStageForm({ current_stage: updated.current_stage || 'not_started', realized_date: '' })
      setStageSuccess(true)
    } catch (err) {
      const body = err?.response?.data
      setStageError(
        typeof body === 'string'
          ? body
          : Object.values(body || {}).flat().join(' ') || 'Could not save stage.'
      )
    } finally {
      setStageSaving(false)
    }
  }, [id, stageForm])

  // ── Save realized dates ───────────────────────────────────────────────────
  const handleSaveDates = useCallback(async (e) => {
    e.preventDefault()
    setDatesSaving(true)
    setDatesError(null)
    setDatesSuccess(false)
    const payload = {}
    for (const [k, v] of Object.entries(datesForm)) {
      payload[k] = v !== '' ? v : null
    }
    try {
      const updated = await patchRealizedDates(id, payload)
      setField(updated)
      // Keep form in sync with returned data
      setDatesForm({
        realized_farm_prep_date:  updated.realized_farm_prep_date  ?? '',
        realized_planting_date:   updated.realized_planting_date   ?? '',
        realized_emergence_date:  updated.realized_emergence_date  ?? '',
        realized_harvest_date:    updated.realized_harvest_date    ?? '',
        realized_ready_date:      updated.realized_ready_date      ?? '',
      })
      setDatesSuccess(true)
    } catch (err) {
      const body = err?.response?.data
      setDatesError(
        typeof body === 'string'
          ? body
          : Object.values(body || {}).flat().join(' ') || 'Could not save dates.'
      )
    } finally {
      setDatesSaving(false)
    }
  }, [id, datesForm])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout>
        <Navbar title="Field Detail" />
        <main style={contentArea}><p style={s.stateMsg}>Loading…</p></main>
      </PageLayout>
    )
  }

  if (error || !field) {
    return (
      <PageLayout>
        <Navbar title="Field Detail" />
        <main style={contentArea}>
          <Link to="/agent" style={styles.backLink}>← Back to Dashboard</Link>
          <div style={s.errorBanner}>{error || 'Field not found.'}</div>
        </main>
      </PageLayout>
    )
  }

  const statusKey   = computeFieldStatus(field)
  const statusCfg   = STATUS_CONFIG[statusKey]
  const badgeStyle  = {
    ...styles.badge,
    backgroundColor: statusCfg.bg,
    color:           statusCfg.color,
    borderColor:     statusCfg.border,
  }

  return (
    <PageLayout>
      <Navbar title="Field Detail" />

      <main style={contentArea}>

        {/* Back link */}
        <Link to="/agent" style={styles.backLink}>← Back to Dashboard</Link>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.cropChip}>{field.crop_type}</span>
            <h1 style={styles.pageTitle}>{field.name}</h1>
            <p style={styles.subtitle}>📍 {field.location}</p>
          </div>
          <span style={badgeStyle}>{statusCfg.label}</span>
        </div>

        <div style={styles.twoCol}>

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div style={styles.leftCol}>

            {/* Field Info (read-only) */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Field Info</h2>
              <div style={styles.infoGrid}>
                <InfoRow label="Location"    value={field.location} />
                <InfoRow label="Crop Type"   value={field.crop_type} />
                {field.size_in_acres && (
                  <InfoRow label="Size" value={`${Number(field.size_in_acres).toFixed(2)} acres`} />
                )}
                <InfoRow label="Coordinator" value={field.coordinator?.full_name || '—'} />
              </div>
            </section>

            {/* Field Stage */}
            {stageForm && (
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Field Stage</h2>
              <p style={styles.sectionNote}>
                Advance the stage when you complete a milestone and record the realized date of that stage.
              </p>

              {/* Visual stepper */}
              <div style={styles.stageStepper}>
                {STAGE_ORDER.map((stage, idx) => {
                  const currentIdx = STAGE_ORDER.indexOf(field.current_stage || 'not_started')
                  const isDone     = idx < currentIdx
                  const isCurrent  = idx === currentIdx
                  return (
                    <>
                      <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.72rem', fontWeight: '700',
                          backgroundColor: isDone ? '#2E7D32' : isCurrent ? '#81C784' : '#E8E8E8',
                          color: isDone || isCurrent ? '#FFFFFF' : '#9E9E9E',
                          border: isCurrent ? '2px solid #1B5E20' : '2px solid transparent',
                          flexShrink: 0,
                        }}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span style={{
                          fontSize: '0.64rem', textAlign: 'center', maxWidth: '58px', lineHeight: 1.2,
                          color: isCurrent ? '#1B5E20' : isDone ? '#388E3C' : '#9E9E9E',
                          fontWeight: isCurrent ? '700' : '400',
                        }}>
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>
                      {idx < STAGE_ORDER.length - 1 && (
                        <div style={{
                          flex: 1, height: '2px', marginBottom: '1.35rem', alignSelf: 'flex-start', marginTop: '12px',
                          backgroundColor: idx < STAGE_ORDER.indexOf(field.current_stage || 'not_started') ? '#2E7D32' : '#E0E0E0',
                        }} />
                      )}
                    </>
                  )
                })}
              </div>

              {stageError   && <div style={s.errorBanner}>{stageError}</div>}
              {stageSuccess && <div style={styles.successBanner}>Stage updated!</div>}

              <form onSubmit={handleSaveStage} style={{ marginTop: '1rem' }}>
                <label style={s.label}>Set Stage</label>
                <select
                  style={{ ...s.input, marginBottom: '0.75rem' }}
                  value={stageForm.current_stage}
                  onChange={e => setStageForm(p => ({ ...p, current_stage: e.target.value, realized_date: '' }))}
                >
                  {STAGE_ORDER.map(stage => (
                    <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                  ))}
                </select>

                {stageForm.current_stage !== 'not_started' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={s.label}>
                      {STAGE_LABELS[stageForm.current_stage]} Date (realized)
                    </label>
                    <DateInput
                      style={s.input}
                      value={stageForm.realized_date}
                      onChange={e => setStageForm(p => ({ ...p, realized_date: e.target.value }))}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    style={{ ...s.submitBtn, opacity: stageSaving ? 0.65 : 1 }}
                    disabled={stageSaving}
                  >
                    {stageSaving ? 'Saving…' : 'Save Stage'}
                  </button>
                </div>
              </form>
            </section>
            )}

            {/* Crop Timeline — Expected vs Realized */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Crop Timeline</h2>
              <p style={styles.sectionNote}>
                Enter the actual dates you observed in the field. Expected dates were set by your coordinator.
              </p>

              {datesError   && <div style={s.errorBanner}>{datesError}</div>}
              {datesSuccess && <div style={styles.successBanner}>Dates saved!</div>}

              <form onSubmit={handleSaveDates}>
                <table style={styles.datesTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Milestone</th>
                      <th style={styles.th}>Expected (by coordinator)</th>
                      <th style={styles.th}>Realized (your input)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Farm Prep',  expKey: 'expected_farm_prep_date',  realKey: 'realized_farm_prep_date' },
                      { label: 'Planting',  expKey: 'expected_planting_date',  realKey: 'realized_planting_date' },
                      { label: 'Emergence (Growth Visibility)', expKey: 'expected_emergence_date', realKey: 'realized_emergence_date' },
                      { label: 'Ready',     expKey: 'expected_ready_date',     realKey: 'realized_ready_date' },
                      { label: 'Harvest',   expKey: 'expected_harvest_date',   realKey: 'realized_harvest_date' },
                    ].map(row => (
                      <tr key={row.label}>
                        <td style={styles.tdLabel}>{row.label}</td>
                        <td style={styles.tdExpected}>
                          {field[row.expKey]
                            ? <span style={styles.expectedDate}>{field[row.expKey]}</span>
                            : <span style={styles.noDate}>—</span>}
                        </td>
                        <td style={styles.td}>
                          <DateInput
                            value={datesForm[row.realKey]}
                            onChange={e => setDatesForm(p => ({ ...p, [row.realKey]: e.target.value }))}
                            style={styles.dateInput}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    style={{ ...s.submitBtn, opacity: datesSaving ? 0.65 : 1 }}
                    disabled={datesSaving}
                  >
                    {datesSaving ? 'Saving…' : 'Save Realized Dates'}
                  </button>
                </div>
              </form>
            </section>

          </div>

          {/* ── Right column ────────────────────────────────────────────── */}
          <div style={styles.rightCol}>

            {/* My Reports for this field */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>
                My Reports
                <span style={styles.reportCount}>{reportsLoading ? '…' : reports.length}</span>
              </h2>

              {reportsLoading && <p style={s.stateMsg}>Loading reports…</p>}
              {!reportsLoading && reportsError && (
                <div style={s.errorBanner}>{reportsError}</div>
              )}
              {!reportsLoading && !reportsError && reports.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <p style={{ fontSize: '0.88rem', color: '#9E9E9E', margin: '0 0 0.75rem' }}>
                    No reports submitted for this field yet.
                  </p>
                  <Link to="/agent/submit" style={styles.submitLink}>+ Submit Report</Link>
                </div>
              )}
              {!reportsLoading && !reportsError && reports.length > 0 && (
                <>
                  <div style={styles.reportList}>
                    {reports.map(r => <ReportRow key={r.id} report={r} />)}
                  </div>
                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <Link to="/agent/submit" style={styles.submitLink}>+ Submit New Report</Link>
                  </div>
                </>
              )}
            </section>

          </div>
        </div>

      </main>
    </PageLayout>
  )
}

// ── InfoRow (read-only field info) ────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  )
}

// ── ReportRow ─────────────────────────────────────────────────────────────────
function ReportRow({ report }) {
  const hc = HEALTH_COLORS[report.crop_health] || HEALTH_COLORS.fair
  const badgeStyle = {
    fontSize: '0.75rem', fontWeight: '700',
    padding: '0.18rem 0.55rem', borderRadius: '20px',
    backgroundColor: hc.bg, color: hc.color, border: `1px solid ${hc.border}`,
  }
  return (
    <div style={styles.reportRow}>
      <div style={styles.reportMeta}>
        <span style={styles.reportDate}>📅 {report.report_date}</span>
        <span style={badgeStyle}>
          {report.crop_health.charAt(0).toUpperCase() + report.crop_health.slice(1)}
        </span>
        <span style={styles.reportMoisture}>💧 {report.soil_moisture}%</span>
        {report.pest_observed && (
          <span style={styles.pestBadge}>⚠️ Pest</span>
        )}
      </div>
      {report.notes && <p style={styles.reportNotes}>{report.notes}</p>}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  stageStepper:  { display: 'flex', alignItems: 'flex-start', gap: '0.25rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' },

  backLink:     { display: 'inline-block', marginBottom: '1.25rem', color: '#2E7D32', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', gap: '1rem' },
  headerLeft:   { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  cropChip:     { fontSize: '0.78rem', fontWeight: '700', color: '#2E7D32', backgroundColor: '#E8F5E9', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #A5D6A7', alignSelf: 'flex-start' },
  pageTitle:    { margin: 0, fontSize: '1.7rem', fontWeight: '800', color: '#1B5E20' },
  subtitle:     { margin: 0, fontSize: '0.9rem', color: '#4A6741' },
  badge:        { fontSize: '0.8rem', fontWeight: '700', padding: '0.3rem 0.85rem', borderRadius: '30px', border: '1px solid transparent', whiteSpace: 'nowrap' },

  twoCol:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' },
  leftCol:  { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },

  card:          { backgroundColor: '#FFFFFF', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(27, 94, 32, 0.07)' },
  sectionTitle:  { margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: '700', color: '#1B5E20', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  sectionNote:   { margin: '-0.5rem 0 1rem', fontSize: '0.83rem', color: '#4A6741' },
  successBanner: { backgroundColor: '#E8F5E9', color: '#1B5E20', border: '1px solid #A5D6A7', borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', fontWeight: '600' },

  infoGrid: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  infoRow:  { display: 'flex', gap: '1rem', padding: '0.4rem 0', borderBottom: '1px solid #F1F8E9' },
  infoLabel:{ fontSize: '0.82rem', fontWeight: '700', color: '#4A6741', minWidth: '100px' },
  infoValue:{ fontSize: '0.88rem', color: '#1B2E1B' },

  datesTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th:         { textAlign: 'left', padding: '0.5rem 0.75rem', backgroundColor: '#F1F8E9', color: '#4A6741', fontWeight: '700', borderBottom: '1px solid #C8E6C9', fontSize: '0.8rem' },
  tdLabel:    { padding: '0.6rem 0.75rem', borderBottom: '1px solid #E8F5E9', fontWeight: '700', color: '#1B2E1B', fontSize: '0.88rem' },
  tdExpected: { padding: '0.6rem 0.75rem', borderBottom: '1px solid #E8F5E9' },
  td:         { padding: '0.4rem 0.75rem', borderBottom: '1px solid #E8F5E9' },
  expectedDate:{ fontSize: '0.88rem', color: '#2E7D32', fontWeight: '600' },
  noDate:      { color: '#BDBDBD' },
  dateInput:   { border: '1px solid #C8E6C9', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', color: '#1B2E1B', backgroundColor: '#F9FBF9', width: '100%' },

  reportCount:    { backgroundColor: '#E8F5E9', color: '#2E7D32', borderRadius: '12px', padding: '0.1rem 0.55rem', fontSize: '0.8rem', fontWeight: '700' },
  reportList:     { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  reportRow:      { backgroundColor: '#F9FBF9', border: '1px solid #E8F5E9', borderRadius: '8px', padding: '0.65rem 0.85rem' },
  reportMeta:     { display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' },
  reportDate:     { fontWeight: '600', fontSize: '0.82rem', color: '#1B2E1B' },
  reportMoisture: { fontSize: '0.8rem', color: '#4A6741' },
  pestBadge:      { fontSize: '0.75rem', fontWeight: '700', color: '#C62828', backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', padding: '0.15rem 0.5rem', borderRadius: '20px' },
  reportNotes:    { margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#5A7A5A', borderLeft: '3px solid #A5D6A7', paddingLeft: '0.65rem', lineHeight: 1.5 },

  submitLink: { padding: '0.45rem 1.1rem', backgroundColor: '#2E7D32', color: '#FFFFFF', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.88rem' },
}

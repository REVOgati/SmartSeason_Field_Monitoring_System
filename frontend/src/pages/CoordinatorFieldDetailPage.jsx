import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getFieldById, patchField } from '../api/fieldsApi'
import { getAgentPool, getMyTeam, assignAgent, dropAgent } from '../api/agentsApi'
import { getFieldReports } from '../api/reportsApi'
import Navbar      from '../components/Navbar'
import PageLayout, { contentArea } from '../components/PageLayout'
import { sharedStyles as s } from '../components/sharedStyles'
import DateInput   from '../components/DateInput'
import { computeFieldStatus, STATUS_CONFIG, STAGE_LABELS } from '../utils/fieldStatus'

/*
  CoordinatorFieldDetailPage — /coordinator/field/:id

  Dedicated detail view for a single field.  Replaces the inline
  FieldDetailPanel that used to expand inside CoordinatorDashboard.

  Sections:
    1. Header — field name, back link, status badge, crop chip
    2. Field Details panel — edit name, location, crop_type, size, is_active
    3. Crop Timeline — edit the 4 expected dates (coordinator-controlled)
    4. Assigned Agent — view agent info; Assign / Drop Agent buttons
    5. Reports — all monitoring reports submitted for this field
*/

// ── Health badge colours ──────────────────────────────────────────────────────
const HEALTH_COLORS = {
  excellent: { bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7' },
  good:      { bg: '#F1F8E9', color: '#33691E', border: '#C5E1A5' },
  fair:      { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  poor:      { bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
}

export default function CoordinatorFieldDetailPage() {
  const { id } = useParams()

  // ── Field data ────────────────────────────────────────────────────────────
  const [field,   setField]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Field details edit panel ──────────────────────────────────────────────
  const [detailsForm,    setDetailsForm]    = useState(null)
  const [detailsSaving,  setDetailsSaving]  = useState(false)
  const [detailsError,   setDetailsError]   = useState(null)
  const [detailsSuccess, setDetailsSuccess] = useState(false)

  // ── Crop Timeline (expected dates) edit panel ─────────────────────────────
  const [datesForm,    setDatesForm]    = useState(null)
  const [datesSaving,  setDatesSaving]  = useState(false)
  const [datesError,   setDatesError]   = useState(null)
  const [datesSuccess, setDatesSuccess] = useState(false)

  // ── Assign Agent panel ────────────────────────────────────────────────────
  const [showAssign,    setShowAssign]    = useState(false)
  const [poolAgents,    setPoolAgents]    = useState([])
  const [teamAgents,    setTeamAgents]    = useState([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [assignError,   setAssignError]   = useState(null)
  const [assigningId,   setAssigningId]   = useState(null)
  const [dropping,      setDropping]      = useState(false)

  // ── Reports ───────────────────────────────────────────────────────────────
  const [reports,        setReports]        = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError,   setReportsError]   = useState(null)

  // ── Mount: load field + reports in parallel ────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const [fieldData, reportsData] = await Promise.all([
          getFieldById(id),
          getFieldReports(id),
        ])
        setField(fieldData)
        setDetailsForm({
          name:          fieldData.name,
          location:      fieldData.location,
          crop_type:     fieldData.crop_type,
          size_in_acres: fieldData.size_in_acres ?? '',
          is_active:     fieldData.is_active,
        })
        setDatesForm({
          expected_farm_prep_date:  fieldData.expected_farm_prep_date  ?? '',
          expected_planting_date:   fieldData.expected_planting_date   ?? '',
          expected_emergence_date:  fieldData.expected_emergence_date  ?? '',
          expected_harvest_date:    fieldData.expected_harvest_date    ?? '',
          expected_ready_date:      fieldData.expected_ready_date      ?? '',
        })
        setReports(reportsData.results ?? reportsData)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load field.')
      } finally {
        setLoading(false)
        setReportsLoading(false)
      }
    }
    loadAll()
  }, [id])

  // ── Save field details ─────────────────────────────────────────────────────
  const handleSaveDetails = useCallback(async (e) => {
    e.preventDefault()
    setDetailsSaving(true)
    setDetailsError(null)
    setDetailsSuccess(false)
    try {
      const updated = await patchField(id, {
        name:          detailsForm.name,
        location:      detailsForm.location,
        crop_type:     detailsForm.crop_type,
        size_in_acres: detailsForm.size_in_acres !== '' ? Number(detailsForm.size_in_acres) : null,
        is_active:     detailsForm.is_active,
      })
      setField(updated)
      setDetailsSuccess(true)
    } catch (err) {
      const body = err?.response?.data
      setDetailsError(
        typeof body === 'string'
          ? body
          : Object.values(body || {}).flat().join(' ') || 'Could not save changes.'
      )
    } finally {
      setDetailsSaving(false)
    }
  }, [id, detailsForm])

  // ── Save expected dates ───────────────────────────────────────────────────
  const handleSaveDates = useCallback(async (e) => {
    e.preventDefault()
    setDatesSaving(true)
    setDatesError(null)
    setDatesSuccess(false)
    // Build payload — only send non-empty values; convert '' to null to allow clearing
    const payload = {}
    for (const [k, v] of Object.entries(datesForm)) {
      payload[k] = v !== '' ? v : null
    }
    try {
      const updated = await patchField(id, payload)
      setField(updated)
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

  // ── Open Assign Agent panel ────────────────────────────────────────────────
  const handleOpenAssign = useCallback(async () => {
    setShowAssign(true)
    setAssignError(null)
    setAgentsLoading(true)
    try {
      const [poolRes, teamRes] = await Promise.all([getAgentPool(), getMyTeam()])
      setPoolAgents(poolRes.results ?? poolRes)
      setTeamAgents(teamRes.results ?? teamRes)
    } catch (err) {
      setAssignError(err?.response?.data?.detail || 'Could not load agents.')
    } finally {
      setAgentsLoading(false)
    }
  }, [])

  const handleAssignAgent = useCallback(async (agentPk, agentObj, isFromPool) => {
    setAssigningId(agentPk)
    setAssignError(null)
    try {
      if (isFromPool) {
        await assignAgent(agentPk)
        setPoolAgents(prev => prev.filter(a => a.id !== agentPk))
        setTeamAgents(prev => [...prev, agentObj])
      }
      const updated = await patchField(id, { assigned_agent_id: agentPk })
      setField(updated)
      setShowAssign(false)
    } catch (err) {
      const body = err?.response?.data
      setAssignError(
        typeof body === 'string'
          ? body
          : Object.values(body || {}).flat().join(' ') || 'Could not assign agent.'
      )
    } finally {
      setAssigningId(null)
    }
  }, [id])

  const handleDropAgent = useCallback(async () => {
    if (!window.confirm(
      'Drop this agent from your team? They will be unassigned from ALL their fields.'
    )) return
    setDropping(true)
    try {
      await dropAgent(field.assigned_agent.id)
      setField(prev => ({ ...prev, assigned_agent: null }))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not drop agent.')
    } finally {
      setDropping(false)
    }
  }, [field])

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
          <Link to="/coordinator" style={styles.backLink}>← Back to Dashboard</Link>
          <div style={s.errorBanner}>{error || 'Field not found.'}</div>
        </main>
      </PageLayout>
    )
  }

  const statusKey  = computeFieldStatus(field)
  const statusCfg  = STATUS_CONFIG[statusKey]
  const badgeStyle = {
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
        <Link to="/coordinator" style={styles.backLink}>← Back to Dashboard</Link>

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

            {/* Field Details */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Field Details</h2>
              {/* Read-only current stage */}
              <div style={styles.stageRow}>
                <span style={styles.stageRowLabel}>Current Stage</span>
                <span style={styles.stageRowValue}>
                  {STAGE_LABELS[field.current_stage || 'not_started']}
                </span>
              </div>
              {detailsError && <div style={s.errorBanner}>{detailsError}</div>}
              {detailsSuccess && <div style={styles.successBanner}>Saved successfully!</div>}
              <form onSubmit={handleSaveDetails} style={s.form}>
                <label style={s.label}>Field Name *</label>
                <input
                  style={s.input}
                  value={detailsForm.name}
                  onChange={e => setDetailsForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
                <label style={s.label}>Location *</label>
                <input
                  style={s.input}
                  value={detailsForm.location}
                  onChange={e => setDetailsForm(p => ({ ...p, location: e.target.value }))}
                  required
                />
                <label style={s.label}>Crop Type *</label>
                <input
                  style={s.input}
                  value={detailsForm.crop_type}
                  onChange={e => setDetailsForm(p => ({ ...p, crop_type: e.target.value }))}
                  required
                />
                <label style={s.label}>Size (acres)</label>
                <input
                  style={s.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={detailsForm.size_in_acres}
                  onChange={e => setDetailsForm(p => ({ ...p, size_in_acres: e.target.value }))}
                />
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={detailsForm.is_active}
                    onChange={e => setDetailsForm(p => ({ ...p, is_active: e.target.checked }))}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Active field
                </label>
                <div style={s.modalActions}>
                  <button
                    type="submit"
                    style={{ ...s.submitBtn, opacity: detailsSaving ? 0.65 : 1 }}
                    disabled={detailsSaving}
                  >
                    {detailsSaving ? 'Saving…' : 'Save Details'}
                  </button>
                </div>
              </form>
            </section>

            {/* Crop Timeline — Expected Dates */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Crop Timeline — Expected Dates</h2>
              <p style={styles.sectionNote}>
                Set the planned dates for this field's crop cycle.
                The field agent will record the actual realized dates from their side.
              </p>
              {datesError   && <div style={s.errorBanner}>{datesError}</div>}
              {datesSuccess && <div style={styles.successBanner}>Dates saved!</div>}
              <form onSubmit={handleSaveDates} style={s.form}>
                <div style={styles.datesGrid}>
                  <div>
                    <label style={s.label}>Expected Farm Prep Date</label>
                    <DateInput
                      style={s.input}
                      value={datesForm.expected_farm_prep_date}
                      onChange={e => setDatesForm(p => ({ ...p, expected_farm_prep_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={s.label}>Expected Planting Date</label>
                    <DateInput
                      style={s.input}
                      value={datesForm.expected_planting_date}
                      onChange={e => setDatesForm(p => ({ ...p, expected_planting_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={s.label}>Expected Emergence (Growth Visibility) Date</label>
                    <DateInput
                      style={s.input}
                      value={datesForm.expected_emergence_date}
                      onChange={e => setDatesForm(p => ({ ...p, expected_emergence_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={s.label}>Expected Ready Date</label>
                    <DateInput
                      style={s.input}
                      value={datesForm.expected_ready_date}
                      onChange={e => setDatesForm(p => ({ ...p, expected_ready_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={s.label}>Expected Harvest Date</label>
                    <DateInput
                      style={s.input}
                      value={datesForm.expected_harvest_date}
                      onChange={e => setDatesForm(p => ({ ...p, expected_harvest_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={s.modalActions}>
                  <button
                    type="submit"
                    style={{ ...s.submitBtn, opacity: datesSaving ? 0.65 : 1 }}
                    disabled={datesSaving}
                  >
                    {datesSaving ? 'Saving…' : 'Save Expected Dates'}
                  </button>
                </div>
              </form>
            </section>

          </div>

          {/* ── Right column ────────────────────────────────────────────── */}
          <div style={styles.rightCol}>

            {/* Assigned Agent */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Assigned Agent</h2>

              {field.assigned_agent ? (
                <div style={styles.agentCard}>
                  <div style={styles.agentAvatar}>{field.assigned_agent.full_name.charAt(0)}</div>
                  <div style={styles.agentInfo}>
                    <p style={styles.agentName}>{field.assigned_agent.full_name}</p>
                    <p style={styles.agentEmail}>{field.assigned_agent.email}</p>
                  </div>
                  <button
                    style={{ ...styles.dropBtn, opacity: dropping ? 0.55 : 1 }}
                    onClick={handleDropAgent}
                    disabled={dropping}
                  >
                    {dropping ? 'Dropping…' : 'Drop Agent'}
                  </button>
                </div>
              ) : (
                <div style={styles.unassigned}>
                  <p style={styles.unassignedText}>No agent assigned to this field yet.</p>
                  <button style={styles.assignBtn} onClick={handleOpenAssign}>
                    Assign Agent
                  </button>
                </div>
              )}

              {/* Assign Agent panel (inline) */}
              {showAssign && (
                <div style={styles.assignPanel}>
                  <div style={styles.assignPanelHeader}>
                    <h3 style={styles.assignPanelTitle}>Select an Agent</h3>
                    <button style={styles.closeBtn} onClick={() => setShowAssign(false)}>✕</button>
                  </div>
                  {assignError && <div style={s.errorBanner}>{assignError}</div>}
                  {agentsLoading && <p style={s.stateMsg}>Loading agents…</p>}

                  {!agentsLoading && teamAgents.length === 0 && poolAgents.length === 0 && (
                    <p style={{ fontSize: '0.88rem', color: '#9E9E9E' }}>
                      No agents available.
                    </p>
                  )}

                  {!agentsLoading && teamAgents.length > 0 && (
                    <>
                      <p style={styles.agentGroupLabel}>Your Team</p>
                      {teamAgents.map(agent => (
                        <div key={agent.id} style={styles.agentRow}>
                          <div>
                            <p style={styles.agentRowName}>{agent.full_name}</p>
                            <p style={styles.agentRowEmail}>{agent.email}</p>
                          </div>
                          <button
                            style={{ ...s.submitBtn, padding: '0.35rem 0.8rem', fontSize: '0.82rem', opacity: assigningId === agent.id ? 0.6 : 1 }}
                            onClick={() => handleAssignAgent(agent.id, agent, false)}
                            disabled={assigningId !== null}
                          >
                            {assigningId === agent.id ? 'Assigning…' : 'Assign'}
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {!agentsLoading && poolAgents.length > 0 && (
                    <>
                      <p style={styles.agentGroupLabel}>Agent Pool (unassigned)</p>
                      {poolAgents.map(agent => (
                        <div key={agent.id} style={styles.agentRow}>
                          <div>
                            <p style={styles.agentRowName}>{agent.full_name}</p>
                            <p style={styles.agentRowEmail}>{agent.email}</p>
                          </div>
                          <button
                            style={{ ...s.submitBtn, padding: '0.35rem 0.8rem', fontSize: '0.82rem', opacity: assigningId === agent.id ? 0.6 : 1 }}
                            onClick={() => handleAssignAgent(agent.id, agent, true)}
                            disabled={assigningId !== null}
                          >
                            {assigningId === agent.id ? 'Adding…' : 'Add + Assign'}
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Realized Dates (read-only for coordinator) */}
            {(field.realized_planting_date || field.realized_emergence_date ||
              field.realized_harvest_date  || field.realized_ready_date) && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Realized Dates (Agent-Recorded)</h2>
                <table style={styles.datesTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Milestone</th>
                      <th style={styles.th}>Expected</th>
                      <th style={styles.th}>Realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    <DateRow label="Planting"  expected={field.expected_planting_date}  realized={field.realized_planting_date} />
                    <DateRow label="Emergence (Growth Visibility)" expected={field.expected_emergence_date} realized={field.realized_emergence_date} />
                    <DateRow label="Ready"     expected={field.expected_ready_date}     realized={field.realized_ready_date} />
                    <DateRow label="Harvest"   expected={field.expected_harvest_date}   realized={field.realized_harvest_date} />
                  </tbody>
                </table>
              </section>
            )}

            {/* Reports */}
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>
                Field Reports
                <span style={styles.reportCount}>{reportsLoading ? '…' : reports.length}</span>
              </h2>

              {reportsLoading && <p style={s.stateMsg}>Loading reports…</p>}
              {!reportsLoading && reportsError && (
                <div style={s.errorBanner}>{reportsError}</div>
              )}
              {!reportsLoading && !reportsError && reports.length === 0 && (
                <p style={{ fontSize: '0.88rem', color: '#9E9E9E' }}>
                  No reports submitted for this field yet.
                </p>
              )}
              {!reportsLoading && !reportsError && reports.length > 0 && (
                <div style={styles.reportList}>
                  {reports.map(r => <ReportRow key={r.id} report={r} />)}
                </div>
              )}
            </section>

          </div>
        </div>

      </main>
    </PageLayout>
  )
}

// ── DateRow (for the comparison table) ───────────────────────────────────────
function DateRow({ label, expected, realized }) {
  const fmt = v => v || <span style={{ color: '#BDBDBD' }}>—</span>
  return (
    <tr>
      <td style={styles.td}>{label}</td>
      <td style={styles.td}>{fmt(expected)}</td>
      <td style={{ ...styles.td, fontWeight: '600', color: realized ? '#2E7D32' : undefined }}>
        {fmt(realized)}
      </td>
    </tr>
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
        <span style={styles.reportAgent}>by {report.agent?.full_name || '—'}</span>
      </div>
      <div style={styles.reportBadges}>
        <span style={badgeStyle}>
          {report.crop_health.charAt(0).toUpperCase() + report.crop_health.slice(1)}
        </span>
        <span style={styles.reportMeta2}>💧 {report.soil_moisture}%</span>
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

  card:         { backgroundColor: '#FFFFFF', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 10px rgba(27, 94, 32, 0.07)' },
  sectionTitle: { margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: '700', color: '#1B5E20', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  sectionNote:  { margin: '-0.5rem 0 1rem', fontSize: '0.83rem', color: '#4A6741' },
  stageRow:      { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', marginBottom: '0.75rem', borderBottom: '1px solid #F1F8E9' },
  stageRowLabel: { fontSize: '0.82rem', fontWeight: '700', color: '#4A6741', minWidth: '110px' },
  stageRowValue: { fontSize: '0.88rem', color: '#1B2E1B', fontWeight: '600' },
  successBanner:{ backgroundColor: '#E8F5E9', color: '#1B5E20', border: '1px solid #A5D6A7', borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', fontWeight: '600' },
  checkboxLabel:{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: '#1B2E1B', cursor: 'pointer', marginTop: '0.25rem' },

  datesGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' },

  agentCard:    { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#F9FBF9', border: '1px solid #E8F5E9', borderRadius: '10px' },
  agentAvatar:  { width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#C8E6C9', color: '#1B5E20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem', flexShrink: 0 },
  agentInfo:    { flex: 1 },
  agentName:    { margin: 0, fontWeight: '700', fontSize: '0.92rem', color: '#1B2E1B' },
  agentEmail:   { margin: '2px 0 0', fontSize: '0.78rem', color: '#4A6741' },
  dropBtn:      { padding: '0.35rem 0.9rem', backgroundColor: 'transparent', color: '#E65100', border: '1.5px solid #FFCC80', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap' },
  unassigned:   { textAlign: 'center', padding: '1rem 0' },
  unassignedText:{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#9E9E9E' },
  assignBtn:    { padding: '0.5rem 1.25rem', backgroundColor: '#1B5E20', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' },

  assignPanel:      { marginTop: '1rem', padding: '1rem', backgroundColor: '#F9FBF9', border: '1px dashed #C8E6C9', borderRadius: '10px' },
  assignPanelHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  assignPanelTitle: { margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#1B5E20' },
  closeBtn:         { background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#9E9E9E' },
  agentGroupLabel:  { margin: '0.75rem 0 0.35rem', fontSize: '0.78rem', fontWeight: '700', color: '#4A6741', textTransform: 'uppercase', letterSpacing: '0.05em' },
  agentRow:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #E8F5E9' },
  agentRowName:     { margin: 0, fontWeight: '600', fontSize: '0.88rem', color: '#1B2E1B' },
  agentRowEmail:    { margin: '2px 0 0', fontSize: '0.75rem', color: '#4A6741' },

  datesTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th:         { textAlign: 'left', padding: '0.5rem 0.75rem', backgroundColor: '#F1F8E9', color: '#4A6741', fontWeight: '700', borderBottom: '1px solid #C8E6C9' },
  td:         { padding: '0.5rem 0.75rem', borderBottom: '1px solid #E8F5E9', color: '#1B2E1B' },

  reportCount:  { backgroundColor: '#E8F5E9', color: '#2E7D32', borderRadius: '12px', padding: '0.1rem 0.55rem', fontSize: '0.8rem', fontWeight: '700' },
  reportList:   { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  reportRow:    { backgroundColor: '#F9FBF9', border: '1px solid #E8F5E9', borderRadius: '8px', padding: '0.65rem 0.85rem' },
  reportMeta:   { display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', alignItems: 'center' },
  reportDate:   { fontWeight: '600', fontSize: '0.82rem', color: '#1B2E1B' },
  reportAgent:  { fontSize: '0.78rem', color: '#4A6741' },
  reportBadges: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  reportMeta2:  { fontSize: '0.8rem', color: '#4A6741' },
  pestBadge:    { fontSize: '0.75rem', fontWeight: '700', color: '#C62828', backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', padding: '0.15rem 0.5rem', borderRadius: '20px' },
  reportNotes:  { margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#5A7A5A', borderLeft: '3px solid #A5D6A7', paddingLeft: '0.65rem', lineHeight: 1.5 },
}

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getFields, createField, deleteField, patchField } from '../api/fieldsApi'
import { getAgentPool, getMyTeam, assignAgent, dropAgent } from '../api/agentsApi'
import { getFieldReports } from '../api/reportsApi'
import Navbar      from '../components/Navbar'
import StatCard    from '../components/StatCard'
import PageLayout, { contentArea } from '../components/PageLayout'
import FormModal   from '../components/FormModal'
import { sharedStyles as s } from '../components/sharedStyles'

/*
  CoordinatorDashboard.jsx â€” The main view for logged-in coordinators.

  Responsibilities:
  1. Navigation bar â€” brand name, coordinator's name, logout button
  2. Stats bar â€” at-a-glance totals: all fields, active, agents assigned
  3. Fields grid â€” one card per field, showing key info
  4. Add Field modal â€” form to POST a new field, no page reload needed
  5. Delete field â€” removes a field with a confirm prompt

  Data flow:
  â”Œâ”€ useEffect (mount) â”€â”€â”€â”€ getFields() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ setFields() â”€â”
  â”‚  Only runs once. Each card then lives in local state from that point. â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
  â”Œâ”€ handleAddField â”€â”€â”€ createField() â”€â”€â”€â”€ prepend to setFields() â”€â”€â”€â”€â”€â”€â”€â”
  â”‚  No re-fetch â€” backend returns the new object, we insert it locally. â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
  â”Œâ”€ handleDelete â”€â”€â”€â”€ deleteField() â”€â”€â”€â”€ filter out of setFields() â”€â”€â”€â”€â”€â”
  â”‚  Same principle: remove from local state on success, no re-fetch.    â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

  Styling: uses shared components (Navbar, StatCard, PageLayout, FormModal)
  and sharedStyles for form inputs/buttons.
*/

// â”€â”€ Empty form defaults â€” extracted as constant so we can reset easily â”€â”€â”€â”€â”€â”€â”€â”€
const EMPTY_FORM = { name: '', location: '', crop_type: '', size_in_acres: '' }

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function CoordinatorDashboard() {
  /*
    user   â€” decoded JWT payload: { id, email, full_name, role, ... }
    logout â€” clears tokens from localStorage and resets AuthContext state
  */

  // â”€â”€ Fields list state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [fields,  setFields]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // â”€â”€ Add Field modal state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showModal,   setShowModal]   = useState(false)
  const [formData,    setFormData]    = useState(EMPTY_FORM)
  const [formError,   setFormError]   = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  // â”€â”€ Delete tracking â€” which field ID is currently being deleted â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [deletingId, setDeletingId] = useState(null)

  // -- Assign Agent modal state -----------------------------------------------
  const [assignTarget,    setAssignTarget]    = useState(null)  // fieldId or null
  const [poolAgents,      setPoolAgents]      = useState([])
  const [teamAgents,      setTeamAgents]      = useState([])
  const [agentsLoading,   setAgentsLoading]   = useState(false)
  const [assignError,     setAssignError]     = useState(null)
  const [assigningId,     setAssigningId]     = useState(null)
  const [droppingFieldId, setDroppingFieldId] = useState(null)

  // -- Field detail panel state -----------------------------------------------
  const [selectedField,   setSelectedField]   = useState(null)  // full field object or null
  const [fieldReports,    setFieldReports]    = useState([])
  const [reportsLoading,  setReportsLoading]  = useState(false)
  const [reportsError,    setReportsError]    = useState(null)

  // â”€â”€ Fetch all fields on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    async function fetchFields() {
      try {
        const data = await getFields()
        /*
          The backend returns a StandardResultsPagination envelope:
            { count: N, next: "...", previous: null, results: [...] }
          We only display the first page for now (page_size=20).
          The `?? data` fallback handles the edge case where pagination
          is removed in the future and the response is a plain array.
        */
        setFields(data.results ?? data)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load fields.')
      } finally {
        setLoading(false)
      }
    }

    fetchFields()
  }, [])
  // Empty deps array â†’ runs once after the initial render.
  // We do NOT include `user` because coordinators cannot switch accounts
  // mid-session; a page reload would trigger a new mount anyway.

  // ── Field detail panel handlers ───────────────────────────────────────────
  /*
    handleSelectField — opens the detail panel for a field.
    Clicking the same field again toggles it closed.
    Fetches reports for the selected field from GET /api/reports/?field=<id>
  */
  const handleSelectField = useCallback(async (field) => {
    if (selectedField?.id === field.id) {
      setSelectedField(null)
      setFieldReports([])
      return
    }
    setSelectedField(field)
    setReportsLoading(true)
    setReportsError(null)
    setFieldReports([])
    try {
      const data = await getFieldReports(field.id)
      setFieldReports(data.results ?? data)
    } catch (err) {
      setReportsError(err?.response?.data?.detail || 'Could not load reports.')
    } finally {
      setReportsLoading(false)
    }
  }, [selectedField])

  function closeDetail() {
    setSelectedField(null)
    setFieldReports([])
    setReportsError(null)
  }

  // ── Add Field handler ─────────────────────────────────────────────────────
  const handleAddField = useCallback(async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)

    try {
      const newField = await createField({
        name:          formData.name,
        location:      formData.location,
        crop_type:     formData.crop_type,
        // Only send size_in_acres if the user typed something; send null otherwise.
        // The backend FieldSerializer accepts null (the model column is nullable).
        size_in_acres: formData.size_in_acres !== '' ? Number(formData.size_in_acres) : null,
      })

      /*
        Prepend the new field to the list instead of re-fetching the whole page.
        This is faster (no round-trip) and keeps the UI responsive.
        The backend returns the fully-populated field object so we have all
        nested data (coordinator, etc.) without a separate GET.
      */
      setFields(prev => [newField, ...prev])
      setShowModal(false)
      setFormData(EMPTY_FORM)

    } catch (err) {
      /*
        DRF validation errors come as:
          { "name": ["This field is required."], "location": [...] }
        We flatten all messages into one string for the error banner.
        If the error is a plain string (e.g. a detail message), we show that.
      */
      const body = err?.response?.data
      const message =
        typeof body === 'string'
          ? body
          : Object.values(body || {}).flat().join(' ') || 'Could not add field.'
      setFormError(message)

    } finally {
      setFormLoading(false)
    }
  }, [formData])

  // â”€â”€ Delete handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this field? This action cannot be undone.')) return

    setDeletingId(id)
    try {
      await deleteField(id)
      /*
        Filter the deleted field out of local state.
        The component re-renders instantly without a full re-fetch.
      */
      setFields(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not delete field.')
    } finally {
      setDeletingId(null)
    }
  }, [])

  // â”€â”€ Closemodal helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function closeModal() {
    setShowModal(false)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }

  // -- Open Assign Agent modal: load pool + team in one shot ------------------
  const handleOpenAssign = useCallback(async (fieldId) => {
    setAssignTarget(fieldId)
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

  function closeAssignModal() {
    setAssignTarget(null)
    setPoolAgents([])
    setTeamAgents([])
    setAssignError(null)
  }

  /*
    handleAssignAgent — pick an agent from the modal and assign them to the field.

    Pool agents  (isFromPool=true):
      1. POST /api/agents/{pk}/assign/ — adds them to the coordinator's team
      2. PATCH /api/fields/{id}/ with assigned_agent_id — links to the field
    Team agents (already on team):
      Only step 2.

    On success the field card re-renders via local state — no re-fetch needed.
  */
  const handleAssignAgent = useCallback(async (agentPk, agentObj, isFromPool) => {
    setAssigningId(agentPk)
    setAssignError(null)
    try {
      if (isFromPool) {
        await assignAgent(agentPk)
        setPoolAgents(prev => prev.filter(a => a.id !== agentPk))
        setTeamAgents(prev => [...prev, agentObj])
      }
      const updated = await patchField(assignTarget, { assigned_agent_id: agentPk })
      setFields(prev => prev.map(f => f.id === assignTarget ? updated : f))
      // Keep detail panel in sync if this field is currently selected
      if (selectedField?.id === assignTarget) setSelectedField(updated)
      closeAssignModal()
    } catch (err) {
      const body = err?.response?.data
      const msg  = typeof body === 'string'
        ? body
        : Object.values(body || {}).flat().join(' ') || 'Could not assign agent.'
      setAssignError(msg)
    } finally {
      setAssigningId(null)
    }
  }, [assignTarget])

  /*
    handleDropAgent — releases the agent from the coordinator's team.

    POST /api/agents/{agentPk}/drop/ clears:
      - agent.coordinator  (agent goes back to pool)
      - assigned_agent on ALL fields they were assigned to

    We mirror this in local state: map through fields and null out
    assigned_agent wherever it matched this agent.
  */
  const handleDropAgent = useCallback(async (fieldId, agentPk) => {
    if (!window.confirm(
      'Drop this agent from your team? They will be unassigned from ALL their fields.'
    )) return

    setDroppingFieldId(fieldId)
    try {
      await dropAgent(agentPk)
      setFields(prev => prev.map(f =>
        f.assigned_agent?.id === agentPk ? { ...f, assigned_agent: null } : f
      ))
      // Sync detail panel if the selected field had this agent
      if (selectedField?.assigned_agent?.id === agentPk) {
        setSelectedField(prev => ({ ...prev, assigned_agent: null }))
      }
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not drop agent.')
    } finally {
      setDroppingFieldId(null)
    }
  }, [])

  // â”€â”€ Derived stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const activeCount   = fields.filter(f => f.is_active).length
  const assignedCount = fields.filter(f => f.assigned_agent !== null).length

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <PageLayout>
      <Navbar title="Coordinator Dashboard" />

      <main style={contentArea}>

        {/* Stats row */}
        <div style={styles.statsBar}>
          <StatCard label="Total Fields"    value={fields.length}  />
          <StatCard label="Active"          value={activeCount}    />
          <StatCard label="Agents Assigned" value={assignedCount}  />
        </div>

        {/* Section header */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>My Fields</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/coordinator/reports" style={styles.reportsLink}>
              📊 View Reports
            </Link>
            <button style={s.primaryBtn} onClick={() => setShowModal(true)}>
              + Add Field
            </button>
          </div>
        </div>

        {/* Content states */}
        {loading && <p style={s.stateMsg}>Loading fieldsâ€¦</p>}

        {!loading && error && (
          <div style={s.errorBanner}>{error}</div>
        )}

        {!loading && !error && fields.length === 0 && (
          <div style={s.emptyState}>
            <p>No fields yet.</p>
            <p>Click <strong>+ Add Field</strong> to register your first field.</p>
          </div>
        )}

        {!loading && !error && fields.length > 0 && (
          <div style={styles.grid}>
            {fields.map(field => (
              <FieldCard
                key={field.id}
                field={field}
                onDelete={handleDelete}
                isDeleting={deletingId === field.id}
                onAssign={handleOpenAssign}
                onDrop={handleDropAgent}
                isDropping={droppingFieldId === field.id}
                onSelect={handleSelectField}
                isSelected={selectedField?.id === field.id}
              />
            ))}
          </div>
        )}

        {/* Field detail panel — shown inline below the grid when a field is selected */}
        {selectedField && (
          <FieldDetailPanel
            field={selectedField}
            reports={fieldReports}
            reportsLoading={reportsLoading}
            reportsError={reportsError}
            onClose={closeDetail}
          />
        )}

      </main>

      {/* Add Field modal */}
      {showModal && (
        <FormModal title="Add New Field" onClose={closeModal} error={formError}>
          <form onSubmit={handleAddField} style={s.form}>

            <label style={s.label}>Field Name *</label>
            <input
              style={s.input}
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              required
              placeholder="e.g. Alpha Farm"
            />

            <label style={s.label}>Location *</label>
            <input
              style={s.input}
              value={formData.location}
              onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
              required
              placeholder="e.g. Nakuru, Kenya"
            />

            <label style={s.label}>Crop Type *</label>
            <input
              style={s.input}
              value={formData.crop_type}
              onChange={e => setFormData(p => ({ ...p, crop_type: e.target.value }))}
              required
              placeholder="e.g. Maize"
            />

            <label style={s.label}>Size (acres)</label>
            <input
              style={s.input}
              type="number"
              min="0"
              step="0.01"
              value={formData.size_in_acres}
              onChange={e => setFormData(p => ({ ...p, size_in_acres: e.target.value }))}
              placeholder="e.g. 12.50"
            />

            <div style={s.modalActions}>
              <button type="button" style={s.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button
                type="submit"
                style={{ ...s.submitBtn, opacity: formLoading ? 0.65 : 1 }}
                disabled={formLoading}
              >
                {formLoading ? 'Addingâ€¦' : 'Add Field'}
              </button>
            </div>

          </form>
        </FormModal>
      )}

      {/* Assign Agent modal */}
      {assignTarget !== null && (
        <FormModal title="Assign Agent" onClose={closeAssignModal} error={assignError}>
          {agentsLoading && <p style={s.stateMsg}>Loading agents…</p>}

          {!agentsLoading && teamAgents.length === 0 && poolAgents.length === 0 && (
            <p style={s.emptyState}>No agents available. Add agents to your team first via the agent pool.</p>
          )}

          {/* Your team agents (already on team, just patch the field) */}
          {!agentsLoading && teamAgents.length > 0 && (
            <>
              <p style={styles.agentGroupLabel}>Your Team</p>
              {teamAgents.map(agent => (
                <div key={agent.id} style={styles.agentRow}>
                  <div>
                    <p style={styles.agentName}>{agent.full_name}</p>
                    <p style={styles.agentEmail}>{agent.email}</p>
                  </div>
                  <button
                    style={{ ...s.submitBtn, padding: '0.4rem 0.9rem', fontSize: '0.82rem', opacity: assigningId === agent.id ? 0.6 : 1 }}
                    onClick={() => handleAssignAgent(agent.id, agent, false)}
                    disabled={assigningId !== null}
                  >
                    {assigningId === agent.id ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Pool agents (unassigned globally — adding them also joins your team) */}
          {!agentsLoading && poolAgents.length > 0 && (
            <>
              <p style={styles.agentGroupLabel}>Agent Pool (unassigned)</p>
              {poolAgents.map(agent => (
                <div key={agent.id} style={styles.agentRow}>
                  <div>
                    <p style={styles.agentName}>{agent.full_name}</p>
                    <p style={styles.agentEmail}>{agent.email}</p>
                  </div>
                  <button
                    style={{ ...s.submitBtn, padding: '0.4rem 0.9rem', fontSize: '0.82rem', opacity: assigningId === agent.id ? 0.6 : 1 }}
                    onClick={() => handleAssignAgent(agent.id, agent, true)}
                    disabled={assigningId !== null}
                  >
                    {assigningId === agent.id ? 'Adding…' : 'Add + Assign'}
                  </button>
                </div>
              ))}
            </>
          )}
        </FormModal>
      )}

    </PageLayout>
  )
}

// -- FieldCard ----------------------------------------------------------------
/*
  Renders one field as a card.
  Status badge colour: Active -> green | Inactive -> amber.
  Agent actions:
    Assign Agent button — shown when assigned_agent is null
    Drop Agent button   — shown when an agent is assigned
*/
function FieldCard({ field, onDelete, isDeleting, onAssign, onDrop, isDropping, onSelect, isSelected }) {
  const badgeStyle = {
    ...styles.badge,
    backgroundColor: field.is_active ? '#E8F5E9' : '#FFF3E0',
    color:           field.is_active ? '#2E7D32' : '#E65100',
    borderColor:     field.is_active ? '#A5D6A7' : '#FFCC80',
  }

  const cardStyle = {
    ...styles.card,
    ...(isSelected ? { borderColor: '#2E7D32', boxShadow: '0 0 0 2px #A5D6A7, 0 2px 12px rgba(27, 94, 32, 0.15)' } : {}),
  }

  return (
    <div style={cardStyle}>
      <div style={styles.cardTop}>
        <span style={styles.cropChip}>{field.crop_type}</span>
        <span style={badgeStyle}>{field.is_active ? 'Active' : 'Inactive'}</span>
      </div>

      {/* Clickable field name — opens/closes the detail panel */}
      <h3
        style={{ ...styles.fieldName, cursor: 'pointer', textDecoration: isSelected ? 'underline' : 'none' }}
        onClick={() => onSelect(field)}
        title="Click to view reports"
      >
        {field.name}
      </h3>
      <p style={styles.metaRow}>📍 {field.location}</p>

      {field.size_in_acres && (
        <p style={styles.metaRow}>📐 {Number(field.size_in_acres).toFixed(2)} acres</p>
      )}

      <p style={styles.metaRow}>
        👤 {field.assigned_agent ? field.assigned_agent.full_name : 'Unassigned'}
      </p>

      <div style={styles.cardFooter}>
        {!field.assigned_agent && (
          <button
            style={styles.assignBtn}
            onClick={() => onAssign(field.id)}
          >
            Assign Agent
          </button>
        )}

        {field.assigned_agent && (
          <button
            style={{ ...styles.dropBtn, opacity: isDropping ? 0.55 : 1 }}
            onClick={() => onDrop(field.id, field.assigned_agent.id)}
            disabled={isDropping}
          >
            {isDropping ? 'Dropping…' : 'Drop Agent'}
          </button>
        )}

        <button
          style={{ ...styles.deleteBtn, opacity: isDeleting ? 0.55 : 1 }}
          onClick={() => onDelete(field.id)}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

// â”€â”€ Page-local styles (only what isn't covered by shared components) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = {
  statsBar:     { display: 'flex', gap: '1rem', marginBottom: '2rem' },
  sectionHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  sectionTitle: { margin: 0, color: '#1B5E20', fontSize: '1.3rem', fontWeight: '700' },
  reportsLink:  { padding: '0.5rem 1rem', backgroundColor: '#E8F5E9', color: '#1B5E20', border: '1.5px solid #A5D6A7', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '0.88rem' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' },
  card:         { backgroundColor: '#FFFFFF', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(27, 94, 32, 0.08)' },
  cardTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' },
  cropChip:     { fontSize: '0.78rem', fontWeight: '700', color: '#2E7D32', backgroundColor: '#E8F5E9', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #A5D6A7' },
  badge:        { fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.65rem', borderRadius: '30px', border: '1px solid transparent' },
  fieldName:    { margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: '700', color: '#1B2E1B' },
  metaRow:      { margin: '0.3rem 0', fontSize: '0.85rem', color: '#4A6741' },
  cardFooter:      { marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' },
  deleteBtn:       { padding: '0.35rem 0.9rem', backgroundColor: 'transparent', color: '#C62828', border: '1.5px solid #FFCDD2', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' },
  assignBtn:       { padding: '0.35rem 0.9rem', backgroundColor: 'transparent', color: '#1565C0', border: '1.5px solid #90CAF9', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' },
  dropBtn:         { padding: '0.35rem 0.9rem', backgroundColor: 'transparent', color: '#E65100', border: '1.5px solid #FFCC80', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' },
  agentGroupLabel: { margin: '1rem 0 0.4rem', fontSize: '0.8rem', fontWeight: '700', color: '#4A6741', textTransform: 'uppercase', letterSpacing: '0.05em' },
  agentRow:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid #E8F5E9' },
  agentName:       { margin: 0, fontWeight: '600', fontSize: '0.9rem', color: '#1B2E1B' },
  agentEmail:      { margin: '2px 0 0', fontSize: '0.78rem', color: '#4A6741' },
}

// ── FieldDetailPanel ──────────────────────────────────────────────────────────
/*
  Full-width panel rendered below the fields grid when a coordinator clicks a
  field name. Shows:
    • Field metadata (location, crop, size, status, agent)
    • All monitoring reports submitted for that field, newest first

  Health badge colour scheme mirrors AgentDashboard's ReportCard.
*/
const HEALTH_COLORS = {
  excellent: { bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7' },
  good:      { bg: '#F1F8E9', color: '#33691E', border: '#C5E1A5' },
  fair:      { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  poor:      { bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
}

function FieldDetailPanel({ field, reports, reportsLoading, reportsError, onClose }) {
  return (
    <div style={detailStyles.panel}>

      {/* Panel header */}
      <div style={detailStyles.panelHeader}>
        <div>
          <h2 style={detailStyles.panelTitle}>{field.name}</h2>
          <p style={detailStyles.panelSub}>📍 {field.location} &nbsp;·&nbsp; 🌾 {field.crop_type}</p>
        </div>
        <button style={detailStyles.closeBtn} onClick={onClose} title="Close">✕</button>
      </div>

      {/* Field meta row */}
      <div style={detailStyles.metaBar}>
        {field.size_in_acres && (
          <span style={detailStyles.metaChip}>📐 {Number(field.size_in_acres).toFixed(2)} acres</span>
        )}
        <span style={{
          ...detailStyles.metaChip,
          backgroundColor: field.is_active ? '#E8F5E9' : '#FFF3E0',
          color:           field.is_active ? '#2E7D32' : '#E65100',
        }}>
          {field.is_active ? '● Active' : '● Inactive'}
        </span>
        {field.assigned_agent ? (
          <span style={detailStyles.metaChip}>
            👤 {field.assigned_agent.full_name} ({field.assigned_agent.email})
          </span>
        ) : (
          <span style={{...detailStyles.metaChip, color: '#9E9E9E'}}>👤 Unassigned</span>
        )}
      </div>

      {/* Reports section */}
      <h3 style={detailStyles.reportsTitle}>
        Field Reports
        <span style={detailStyles.reportsCount}>{reportsLoading ? '…' : reports.length}</span>
      </h3>

      {reportsLoading && <p style={{color: '#4A6741', fontSize: '0.9rem'}}>Loading reports…</p>}

      {!reportsLoading && reportsError && (
        <p style={{color: '#C62828', fontSize: '0.9rem'}}>{reportsError}</p>
      )}

      {!reportsLoading && !reportsError && reports.length === 0 && (
        <p style={{color: '#9E9E9E', fontSize: '0.9rem'}}>No reports submitted for this field yet.</p>
      )}

      {!reportsLoading && !reportsError && reports.length > 0 && (
        <div style={detailStyles.reportList}>
          {reports.map(r => {
            const hc = HEALTH_COLORS[r.crop_health] || HEALTH_COLORS.fair
            return (
              <div key={r.id} style={detailStyles.reportRow}>
                <div style={detailStyles.reportLeft}>
                  <span style={detailStyles.reportDate}>📅 {r.report_date}</span>
                  <span style={{ fontSize: '0.8rem', color: '#4A6741' }}>
                    by {r.agent?.full_name || 'Unknown'}
                  </span>
                </div>
                <div style={detailStyles.reportMid}>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: '700',
                    padding: '0.2rem 0.6rem', borderRadius: '20px',
                    backgroundColor: hc.bg, color: hc.color, border: `1px solid ${hc.border}`,
                  }}>
                    {r.crop_health.charAt(0).toUpperCase() + r.crop_health.slice(1)}
                  </span>
                  <span style={{fontSize: '0.8rem', color: '#4A6741'}}>
                    💧 {r.soil_moisture}%
                  </span>
                  {r.pest_observed && (
                    <span style={{fontSize: '0.8rem', color: '#C62828', fontWeight: '700'}}>
                      ⚠️ Pest
                    </span>
                  )}
                </div>
                {r.notes && (
                  <p style={detailStyles.reportNotes}>{r.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

const detailStyles = {
  panel: {
    marginTop: '2rem',
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #2E7D32',
    borderRadius: '14px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(27, 94, 32, 0.12)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  panelTitle: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: '800',
    color: '#1B5E20',
  },
  panelSub: {
    margin: '0.25rem 0 0',
    fontSize: '0.88rem',
    color: '#4A6741',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: '#9E9E9E',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
  },
  metaBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  metaChip: {
    fontSize: '0.83rem',
    padding: '0.3rem 0.75rem',
    borderRadius: '20px',
    backgroundColor: '#F1F8E9',
    color: '#2E7D32',
    border: '1px solid #C8E6C9',
    fontWeight: '500',
  },
  reportsTitle: {
    margin: '0 0 0.85rem',
    fontSize: '1rem',
    fontWeight: '700',
    color: '#1B5E20',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  reportsCount: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: '12px',
    padding: '0.1rem 0.55rem',
    fontSize: '0.82rem',
    fontWeight: '700',
  },
  reportList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  reportRow: {
    backgroundColor: '#F9FBF9',
    border: '1px solid #E8F5E9',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'center',
  },
  reportLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: '130px',
  },
  reportDate: {
    fontWeight: '600',
    fontSize: '0.83rem',
    color: '#1B2E1B',
  },
  reportMid: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flex: 1,
  },
  reportNotes: {
    margin: 0,
    width: '100%',
    fontSize: '0.8rem',
    color: '#5A7A5A',
    borderLeft: '3px solid #A5D6A7',
    paddingLeft: '0.65rem',
    lineHeight: 1.5,
  },
}

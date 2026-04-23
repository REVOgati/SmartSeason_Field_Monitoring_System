import { useState, useEffect, useCallback } from 'react'
import { getFields, createField, deleteField } from '../api/fieldsApi'
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

  // â”€â”€ Add Field handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          <button style={s.primaryBtn} onClick={() => setShowModal(true)}>
            + Add Field
          </button>
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
              />
            ))}
          </div>
        )}

      </main>

      {/* Add Field modal â€” uses shared FormModal */}
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

    </PageLayout>
  )
}

// â”€â”€ FieldCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/*
  Renders one field as a card. Status badge colour: Active â†’ green | Inactive â†’ amber.
*/
function FieldCard({ field, onDelete, isDeleting }) {
  const badgeStyle = {
    ...styles.badge,
    backgroundColor: field.is_active ? '#E8F5E9' : '#FFF3E0',
    color:           field.is_active ? '#2E7D32' : '#E65100',
    borderColor:     field.is_active ? '#A5D6A7' : '#FFCC80',
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <span style={styles.cropChip}>{field.crop_type}</span>
        <span style={badgeStyle}>{field.is_active ? 'Active' : 'Inactive'}</span>
      </div>

      <h3 style={styles.fieldName}>{field.name}</h3>
      <p style={styles.metaRow}>ðŸ“ {field.location}</p>

      {field.size_in_acres && (
        <p style={styles.metaRow}>ðŸ“ {Number(field.size_in_acres).toFixed(2)} acres</p>
      )}

      <p style={styles.metaRow}>
        ðŸ‘¤ {field.assigned_agent ? field.assigned_agent.full_name : 'Unassigned'}
      </p>

      <div style={styles.cardFooter}>
        <button
          style={{ ...styles.deleteBtn, opacity: isDeleting ? 0.55 : 1 }}
          onClick={() => onDelete(field.id)}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deletingâ€¦' : 'Delete'}
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
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' },
  card:         { backgroundColor: '#FFFFFF', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(27, 94, 32, 0.08)' },
  cardTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' },
  cropChip:     { fontSize: '0.78rem', fontWeight: '700', color: '#2E7D32', backgroundColor: '#E8F5E9', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #A5D6A7' },
  badge:        { fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.65rem', borderRadius: '30px', border: '1px solid transparent' },
  fieldName:    { margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: '700', color: '#1B2E1B' },
  metaRow:      { margin: '0.3rem 0', fontSize: '0.85rem', color: '#4A6741' },
  cardFooter:   { marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' },
  deleteBtn:    { padding: '0.35rem 0.9rem', backgroundColor: 'transparent', color: '#C62828', border: '1.5px solid #FFCDD2', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' },
}

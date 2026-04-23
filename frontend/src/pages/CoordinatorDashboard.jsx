import { useState, useEffect, useCallback } from 'react'
import useAuth from '../hooks/useAuth'
import { getFields, createField, deleteField } from '../api/fieldsApi'

/*
  CoordinatorDashboard.jsx — The main view for logged-in coordinators.

  Responsibilities:
  1. Navigation bar — brand name, coordinator's name, logout button
  2. Stats bar — at-a-glance totals: all fields, active, agents assigned
  3. Fields grid — one card per field, showing key info
  4. Add Field modal — form to POST a new field, no page reload needed
  5. Delete field — removes a field with a confirm prompt

  Data flow:
  ┌─ useEffect (mount) ──── getFields() ──────────────────── setFields() ─┐
  │  Only runs once. Each card then lives in local state from that point. │
  └────────────────────────────────────────────────────────────────────────┘
  ┌─ handleAddField ─── createField() ──── prepend to setFields() ───────┐
  │  No re-fetch — backend returns the new object, we insert it locally. │
  └───────────────────────────────────────────────────────────────────────┘
  ┌─ handleDelete ──── deleteField() ──── filter out of setFields() ─────┐
  │  Same principle: remove from local state on success, no re-fetch.    │
  └───────────────────────────────────────────────────────────────────────┘

  Styling: green/white palette. No external CSS framework — all inline styles.
  Color tokens (defined in `styles` object at the bottom):
    GREEN_900  #1B5E20  nav background, primary heading
    GREEN_800  #2E7D32  buttons, label text
    GREEN_50   #E8F5E9  page background
    MINT       #A5D6A7  borders, soft accents
    BORDER     #C8E6C9  card and input borders
    WHITE      #FFFFFF  cards, modal
    OFF_WHITE  #F9FBF9  input backgrounds
    TEXT_DARK  #1B2E1B  body text
    TEXT_MID   #4A6741  secondary text
*/

// ── Empty form defaults — extracted as constant so we can reset easily ────────
const EMPTY_FORM = { name: '', location: '', crop_type: '', size_in_acres: '' }

// ── Main component ────────────────────────────────────────────────────────────
export default function CoordinatorDashboard() {
  const { user, logout } = useAuth()
  /*
    user   — decoded JWT payload: { id, email, full_name, role, ... }
    logout — clears tokens from localStorage and resets AuthContext state
  */

  // ── Fields list state ─────────────────────────────────────────────────────
  const [fields,  setFields]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Add Field modal state ─────────────────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false)
  const [formData,    setFormData]    = useState(EMPTY_FORM)
  const [formError,   setFormError]   = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  // ── Delete tracking — which field ID is currently being deleted ───────────
  const [deletingId, setDeletingId] = useState(null)

  // ── Fetch all fields on mount ─────────────────────────────────────────────
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
  // Empty deps array → runs once after the initial render.
  // We do NOT include `user` because coordinators cannot switch accounts
  // mid-session; a page reload would trigger a new mount anyway.

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

  // ── Delete handler ────────────────────────────────────────────────────────
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

  // ── Closemodal helper ────────────────────────────────────────────────────
  function closeModal() {
    setShowModal(false)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeCount   = fields.filter(f => f.is_active).length
  const assignedCount = fields.filter(f => f.assigned_agent !== null).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <nav style={styles.nav}>
        <span style={styles.navLogo}>🌿 SmartSeason</span>
        <div style={styles.navRight}>
          <span style={styles.navUser}>
            {user?.full_name || user?.email}
          </span>
          <button style={styles.logoutBtn} onClick={logout}>
            Log out
          </button>
        </div>
      </nav>
      {/*
        The nav bar is a fixed context anchor: the user always knows which
        app they're in (brand) and who they're logged in as (user name).
        Logout calls AuthContext.logout() which clears tokens and redirects
        via ProtectedRoute to /login.
      */}

      {/* ── Page body ───────────────────────────────────────────────────── */}
      <main style={styles.main}>

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <div style={styles.statsBar}>
          <StatCard label="Total Fields"    value={fields.length}  />
          <StatCard label="Active"          value={activeCount}    />
          <StatCard label="Agents Assigned" value={assignedCount}  />
        </div>
        {/*
          StatCards show live totals derived from local state.
          They update in real time as fields are added or removed —
          no extra API call needed because they are computed from the
          same `fields` array the grid renders.
        */}

        {/* ── Section header ─────────────────────────────────────────────── */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>My Fields</h2>
          <button style={styles.addBtn} onClick={() => setShowModal(true)}>
            + Add Field
          </button>
        </div>

        {/* ── Content area — one of three states ────────────────────────── */}
        {loading && (
          <p style={styles.stateMsg}>Loading fields…</p>
        )}

        {!loading && error && (
          <div style={styles.errorBanner}>{error}</div>
        )}

        {!loading && !error && fields.length === 0 && (
          <div style={styles.emptyState}>
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
        {/*
          Three mutually exclusive states kept clean with the
          !loading && !error && pattern. Only one block renders at a time.
        */}

      </main>

      {/* ── Add Field modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div style={styles.overlay} onClick={closeModal}>
          {/*
            Clicking the semi-transparent overlay closes the modal.
            e.stopPropagation() on the inner div prevents a click inside
            the modal from bubbling up and triggering this handler.
          */}
          <div style={styles.modal} onClick={e => e.stopPropagation()}>

            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add New Field</h3>
              <button style={styles.closeBtn} onClick={closeModal}>✕</button>
            </div>

            {formError && (
              <div style={styles.formError}>{formError}</div>
            )}

            <form onSubmit={handleAddField} style={styles.modalForm}>

              <label style={styles.label}>Field Name *</label>
              <input
                style={styles.input}
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                required
                placeholder="e.g. Alpha Farm"
              />
              {/*
                The spread-and-override pattern `{ ...p, name: e.target.value }`
                leaves all other form fields untouched and only updates `name`.
                Using EMPTY_FORM as the reset value keeps this pattern consistent.
              */}

              <label style={styles.label}>Location *</label>
              <input
                style={styles.input}
                value={formData.location}
                onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                required
                placeholder="e.g. Nakuru, Kenya"
              />

              <label style={styles.label}>Crop Type *</label>
              <input
                style={styles.input}
                value={formData.crop_type}
                onChange={e => setFormData(p => ({ ...p, crop_type: e.target.value }))}
                required
                placeholder="e.g. Maize"
              />

              <label style={styles.label}>Size (acres)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={formData.size_in_acres}
                onChange={e => setFormData(p => ({ ...p, size_in_acres: e.target.value }))}
                placeholder="e.g. 12.50"
              />
              {/* Size is optional — the backend model allows null for size_in_acres */}

              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ ...styles.submitBtn, opacity: formLoading ? 0.65 : 1 }}
                  disabled={formLoading}
                >
                  {formLoading ? 'Adding…' : 'Add Field'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// ── StatCard sub-component ────────────────────────────────────────────────────
/*
  Renders a single stat tile in the stats bar.
  Kept as a separate function (not a separate file) because it is small
  and only used here — extracting it to its own file would add unnecessary
  indirection without benefit.
*/
function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  )
}

// ── FieldCard sub-component ───────────────────────────────────────────────────
/*
  Renders one field as a card in the grid.
  Accepts field (the API object), onDelete (callback), isDeleting (boolean flag).
  The status badge colour changes based on is_active:
    Active   → green background / green text
    Inactive → amber background / amber text
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

      <p style={styles.metaRow}>📍 {field.location}</p>

      {field.size_in_acres && (
        <p style={styles.metaRow}>
          📐 {Number(field.size_in_acres).toFixed(2)} acres
        </p>
      )}
      {/*
        Number(field.size_in_acres).toFixed(2) formats the decimal:
        "12" → "12.00", "12.5" → "12.50"  — consistent presentation.
      */}

      <p style={styles.metaRow}>
        👤 {field.assigned_agent ? field.assigned_agent.full_name : 'Unassigned'}
      </p>

      <div style={styles.cardFooter}>
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

// ── Styles ────────────────────────────────────────────────────────────────────
/*
  All sizes in rem/px, all colours from the green/white palette:
    GREEN_900 #1B5E20  — nav bg, major headings
    GREEN_800 #2E7D32  — buttons, label text, stat values
    GREEN_50  #E8F5E9  — page bg, active badge bg
    MINT      #A5D6A7  — active badge border
    BORDER    #C8E6C9  — card/input borders
    WHITE     #FFFFFF  — card/modal backgrounds
    OFF_WHITE #F9FBF9  — input backgrounds
    TEXT_DARK #1B2E1B  — primary text
    TEXT_MID  #4A6741  — secondary/meta text
    AMBER_50  #FFF3E0  — inactive badge bg
    AMBER_300 #FFCC80  — inactive badge border
    AMBER_700 #E65100  — inactive badge text
    ERROR_BG  #FFEBEE
    ERROR_BDR #FFCDD2
    ERROR_TXT #C62828
*/
const styles = {

  // ── Layout ────────────────────────────────────────────────────────────────
  page: {
    minHeight: '100vh',
    backgroundColor: '#E8F5E9',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },

  // ── Nav bar ───────────────────────────────────────────────────────────────
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1B5E20',
    padding: '0 2rem',
    height: '60px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
  },
  navLogo: {
    color: '#FFFFFF',
    fontSize: '1.2rem',
    fontWeight: '800',
    letterSpacing: '0.4px',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navUser: {
    color: '#C8E6C9',
    fontSize: '0.875rem',
  },
  logoutBtn: {
    padding: '0.38rem 1rem',
    backgroundColor: 'transparent',
    color: '#FFFFFF',
    border: '1.5px solid #A5D6A7',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
  },

  // ── Main content area ─────────────────────────────────────────────────────
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },

  // ── Stats bar ─────────────────────────────────────────────────────────────
  statsBar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '10px',
    padding: '1.25rem',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(27, 94, 32, 0.08)',
  },
  statValue: {
    display: 'block',
    fontSize: '2.2rem',
    fontWeight: '800',
    color: '#1B5E20',
    lineHeight: 1.1,
  },
  statLabel: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#5A7A5A',
    marginTop: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  sectionTitle: {
    margin: 0,
    color: '#1B5E20',
    fontSize: '1.3rem',
    fontWeight: '700',
  },
  addBtn: {
    padding: '0.5rem 1.25rem',
    backgroundColor: '#2E7D32',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '0.9rem',
    boxShadow: '0 2px 6px rgba(27, 94, 32, 0.25)',
  },

  // ── Fields grid ───────────────────────────────────────────────────────────
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '1.25rem',
  },

  // ── Field card ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 2px 12px rgba(27, 94, 32, 0.08)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.6rem',
  },
  cropChip: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    padding: '0.2rem 0.6rem',
    borderRadius: '4px',
    border: '1px solid #A5D6A7',
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '0.2rem 0.65rem',
    borderRadius: '30px',
    border: '1px solid transparent',
  },
  fieldName: {
    margin: '0 0 0.75rem',
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#1B2E1B',
  },
  metaRow: {
    margin: '0.3rem 0',
    fontSize: '0.85rem',
    color: '#4A6741',
  },
  cardFooter: {
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  deleteBtn: {
    padding: '0.35rem 0.9rem',
    backgroundColor: 'transparent',
    color: '#C62828',
    border: '1.5px solid #FFCDD2',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
  },

  // ── State feedback ────────────────────────────────────────────────────────
  stateMsg: {
    textAlign: 'center',
    color: '#5A7A5A',
    padding: '3rem',
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    border: '1px solid #FFCDD2',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  emptyState: {
    textAlign: 'center',
    color: '#5A7A5A',
    padding: '3rem 1rem',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1.5px dashed #A5D6A7',
    lineHeight: 1.8,
  },

  // ── Modal overlay ─────────────────────────────────────────────────────────
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '460px',
    padding: '2rem',
    boxShadow: '0 10px 48px rgba(0, 0, 0, 0.20)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  modalTitle: {
    margin: 0,
    color: '#1B5E20',
    fontSize: '1.15rem',
    fontWeight: '700',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.2rem',
    color: '#5A7A5A',
    lineHeight: 1,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },

  // ── Shared form elements (modal + any future forms) ────────────────────
  label: {
    fontWeight: '600',
    fontSize: '0.85rem',
    color: '#2E7D32',
    marginTop: '0.35rem',
  },
  input: {
    padding: '0.65rem 0.85rem',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: '#1B2E1B',
    outline: 'none',
    backgroundColor: '#F9FBF9',
    width: '100%',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  cancelBtn: {
    padding: '0.6rem 1.2rem',
    backgroundColor: 'transparent',
    color: '#5A7A5A',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  submitBtn: {
    padding: '0.6rem 1.4rem',
    backgroundColor: '#2E7D32',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '0.95rem',
    boxShadow: '0 2px 6px rgba(27, 94, 32, 0.25)',
  },
  formError: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    border: '1px solid #FFCDD2',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
  },
}

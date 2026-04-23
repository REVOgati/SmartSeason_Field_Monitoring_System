import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getAssignedFields } from '../api/fieldsApi'
import { submitReport } from '../api/reportsApi'
import Navbar from '../components/Navbar'
import PageLayout, { contentArea } from '../components/PageLayout'
import { sharedStyles as s } from '../components/sharedStyles'

/*
  SubmitReportPage.jsx — Field agents submit a monitoring report here.

  Responsibilities:
  1. On mount: fetch the agent's assigned fields to populate the field selector.
  2. Form: field, date, crop health, soil moisture, pest observed, notes, photo.
  3. On submit:
     - If photo is attached  → build FormData (multipart) and POST.
     - If no photo          → POST plain JSON (no unnecessary multipart overhead).
  4. On success: show a green confirmation card and a "Submit another" reset link.
  5. On error: show flattened DRF validation errors.

  Why no AuthContext usage here?
  The Navbar component reads useAuth() internally for the user greeting.
  This page only needs the API layer — no direct role checks required
  because the backend enforces IsFieldAgent on POST /api/reports/.

  Why plain JSON vs FormData split?
  Sending FormData when there is no file forces the backend to parse
  multipart unnecessarily and sets Content-Type: multipart/form-data
  even for text-only submissions. Axios sets Content-Type: application/json
  automatically for plain objects — cleaner and more efficient.
*/

// Today's date as a default for report_date (YYYY-MM-DD format required by the backend)
const TODAY = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  field_id:       '',
  report_date:    TODAY,
  crop_health:    '',
  soil_moisture:  '',
  pest_observed:  false,
  notes:          '',
  photo:          null,   // File object or null
}

const CROP_HEALTH_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good',      label: 'Good'      },
  { value: 'fair',      label: 'Fair'      },
  { value: 'poor',      label: 'Poor'      },
]

export default function SubmitReportPage() {
  const [fields,       setFields]       = useState([])
  const [fieldsLoading, setFieldsLoading] = useState(true)
  const [fieldsError,  setFieldsError]  = useState(null)

  const [form,         setForm]         = useState(EMPTY_FORM)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [submitted,    setSubmitted]    = useState(false)

  const navigate = useNavigate()

  // ── Fetch the agent's assigned fields on mount ─────────────────────────────
  useEffect(() => {
    async function loadFields() {
      try {
        const data = await getAssignedFields()
        /*
          getAssignedFields() calls GET /api/fields/my-assigned/ — a custom
          @action on FieldViewSet that returns fields where assigned_agent=request.user.
          Returns a plain array (no pagination envelope on this endpoint).
        */
        setFields(data)
      } catch (err) {
        setFieldsError(err?.response?.data?.detail || 'Could not load your assigned fields.')
      } finally {
        setFieldsLoading(false)
      }
    }
    loadFields()
  }, [])

  // ── Generic change handler (works for all input types) ────────────────────
  function handleChange(e) {
    const { name, value, type, checked, files } = e.target
    if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'file') {
      setForm(prev => ({ ...prev, photo: files[0] ?? null }))
      /*
        We store the File object in state. If the user clears the input,
        files[0] is undefined so we fall back to null.
        The File is converted to FormData only at submit time.
      */
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  // ── Submit handler ─────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let payload

      if (form.photo) {
        /*
          Photo present: use FormData so Axios sends multipart/form-data.
          Django REST Framework's ImageField / FileField expects the binary
          data as a multipart part, not a base64 string inside JSON.
        */
        payload = new FormData()
        payload.append('field_id',      form.field_id)
        payload.append('report_date',   form.report_date)
        payload.append('crop_health',   form.crop_health)
        payload.append('soil_moisture', form.soil_moisture)
        payload.append('pest_observed', form.pest_observed)
        payload.append('notes',         form.notes)
        payload.append('photo',         form.photo)
      } else {
        /*
          No photo: send a plain JSON object.
          Axios automatically sets Content-Type: application/json for
          plain objects, which is slightly more efficient than multipart.
        */
        payload = {
          field_id:      Number(form.field_id),
          report_date:   form.report_date,
          crop_health:   form.crop_health,
          soil_moisture: Number(form.soil_moisture),
          pest_observed: form.pest_observed,
          notes:         form.notes,
        }
      }

      await submitReport(payload)
      setSubmitted(true)

    } catch (err) {
      const body = err?.response?.data
      const msg  = typeof body === 'string'
        ? body
        : Object.values(body || {}).flat().join(' ') || 'Could not submit report. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Reset form for another submission ─────────────────────────────────────
  function handleReset() {
    setForm(EMPTY_FORM)
    setError(null)
    setSubmitted(false)
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <PageLayout>
        <Navbar title="Submit Report" />
        <main style={contentArea}>
          <div style={localStyles.successCard}>
            <div style={localStyles.successIcon}>✅</div>
            <h2 style={localStyles.successTitle}>Report submitted!</h2>
            <p style={localStyles.successMsg}>
              Your monitoring report has been recorded successfully.
              The coordinator will be able to review it shortly.
            </p>
            <div style={localStyles.successActions}>
              <button style={s.submitBtn} onClick={handleReset}>
                Submit another report
              </button>
              <Link to="/agent" style={localStyles.backLink}>
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      </PageLayout>
    )
  }

  // ── Report form ────────────────────────────────────────────────────────────
  return (
    <PageLayout>
      <Navbar title="Submit Report" />
      <main style={contentArea}>

        <div style={localStyles.formCard}>
          <h2 style={localStyles.formTitle}>Field Monitoring Report</h2>
          <p style={localStyles.formSubtitle}>
            Fill in the details from your latest field visit.
          </p>

          {error && <div style={s.errorBanner} role="alert">{error}</div>}

          {fieldsError && (
            <div style={s.errorBanner} role="alert">
              {fieldsError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.form}>

            {/* ── Field selector ───────────────────────────────────────── */}
            <label style={s.label} htmlFor="field_id">Field *</label>
            {fieldsLoading ? (
              <p style={s.stateMsg}>Loading your fields…</p>
            ) : (
              <select
                id="field_id"
                name="field_id"
                value={form.field_id}
                onChange={handleChange}
                style={s.select}
                required
              >
                <option value="">Select a field…</option>
                {fields.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.location}
                  </option>
                ))}
              </select>
            )}
            {!fieldsLoading && fields.length === 0 && !fieldsError && (
              <p style={{ ...s.stateMsg, fontSize: '0.85rem' }}>
                You have no fields assigned. Contact your coordinator.
              </p>
            )}

            {/* ── Report date ───────────────────────────────────────────── */}
            <label style={s.label} htmlFor="report_date">Report Date *</label>
            <input
              id="report_date"
              name="report_date"
              type="date"
              value={form.report_date}
              onChange={handleChange}
              style={s.input}
              required
              max={TODAY}
            />
            {/*
              max={TODAY} prevents future dates — you can't file a report
              for a field visit that hasn't happened yet.
            */}

            {/* ── Crop health ───────────────────────────────────────────── */}
            <label style={s.label} htmlFor="crop_health">Crop Health *</label>
            <select
              id="crop_health"
              name="crop_health"
              value={form.crop_health}
              onChange={handleChange}
              style={s.select}
              required
            >
              <option value="">Select health status…</option>
              {CROP_HEALTH_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* ── Soil moisture ─────────────────────────────────────────── */}
            <label style={s.label} htmlFor="soil_moisture">Soil Moisture (%) *</label>
            <input
              id="soil_moisture"
              name="soil_moisture"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.soil_moisture}
              onChange={handleChange}
              style={s.input}
              required
              placeholder="e.g. 62.5"
            />

            {/* ── Pest observed (checkbox) ──────────────────────────────── */}
            <label style={localStyles.checkRow}>
              <input
                name="pest_observed"
                type="checkbox"
                checked={form.pest_observed}
                onChange={handleChange}
                style={localStyles.checkbox}
              />
              <span style={localStyles.checkLabel}>Pest activity observed</span>
            </label>

            {/* ── Notes ────────────────────────────────────────────────── */}
            <label style={s.label} htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              style={s.textarea}
              rows={4}
              placeholder="Describe what you observed — growth stage, irrigation status, any concerns…"
            />

            {/* ── Photo upload ──────────────────────────────────────────── */}
            <label style={s.label} htmlFor="photo">Photo (optional)</label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              onChange={handleChange}
              style={localStyles.fileInput}
            />
            {form.photo && (
              <p style={localStyles.fileHint}>
                Selected: {form.photo.name}
              </p>
            )}

            {/* ── Actions ───────────────────────────────────────────────── */}
            <div style={s.modalActions}>
              <Link to="/agent" style={localStyles.cancelLink}>
                Cancel
              </Link>
              <button
                type="submit"
                style={{ ...s.submitBtn, opacity: loading ? 0.65 : 1 }}
                disabled={loading || fieldsLoading || fields.length === 0}
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>

          </form>
        </div>

      </main>
    </PageLayout>
  )
}

// ── Page-specific styles ───────────────────────────────────────────────────────
const localStyles = {
  formCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #C8E6C9',
    borderRadius: '14px',
    padding: '2rem',
    maxWidth: '580px',
    boxShadow: '0 2px 16px rgba(27, 94, 32, 0.08)',
  },
  formTitle: {
    margin: '0 0 4px',
    color: '#1B5E20',
    fontSize: '1.3rem',
    fontWeight: '700',
  },
  formSubtitle: {
    margin: '0 0 1.5rem',
    color: '#4A6741',
    fontSize: '0.875rem',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  checkbox: {
    width: '1.1rem',
    height: '1.1rem',
    accentColor: '#2E7D32',
    cursor: 'pointer',
    flexShrink: 0,
  },
  checkLabel: {
    fontSize: '0.9rem',
    color: '#1B2E1B',
    fontWeight: '500',
  },
  fileInput: {
    fontSize: '0.875rem',
    color: '#4A6741',
    cursor: 'pointer',
  },
  fileHint: {
    margin: '0.2rem 0 0',
    fontSize: '0.8rem',
    color: '#2E7D32',
  },
  cancelLink: {
    padding: '0.6rem 1.2rem',
    backgroundColor: 'transparent',
    color: '#5A7A5A',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.9rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #A5D6A7',
    borderRadius: '14px',
    padding: '2.5rem',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(27, 94, 32, 0.08)',
  },
  successIcon: {
    fontSize: '2.5rem',
    marginBottom: '0.5rem',
  },
  successTitle: {
    margin: '0 0 0.5rem',
    color: '#1B5E20',
    fontWeight: '700',
    fontSize: '1.3rem',
  },
  successMsg: {
    margin: '0 0 1.5rem',
    color: '#4A6741',
    fontSize: '0.9rem',
    lineHeight: 1.6,
  },
  successActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  backLink: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: '0.875rem',
    textDecoration: 'none',
  },
}

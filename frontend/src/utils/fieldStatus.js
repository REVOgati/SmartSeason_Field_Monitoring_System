// ── Stage metadata ────────────────────────────────────────────────────────────

export const STAGE_LABELS = {
  not_started:  'Not Started',
  farm_prepped: 'Farm Prepped',
  planted:      'Planted',
  growing:      'Growing',
  ready:        'Ready',
  harvested:    'Harvested',
}

// When an agent marks a stage, which realized date field gets populated?
export const STAGE_REALIZED_DATE_KEY = {
  farm_prepped: 'realized_farm_prep_date',
  planted:      'realized_planting_date',
  growing:      'realized_emergence_date',
  ready:        'realized_ready_date',
  harvested:    'realized_harvest_date',
}

// When at a given stage, which NEXT expected date do we check for overdue?
const STAGE_NEXT_EXPECTED = {
  not_started:  'expected_farm_prep_date',
  farm_prepped: 'expected_planting_date',
  planted:      'expected_emergence_date',
  growing:      'expected_ready_date',
  ready:        'expected_harvest_date',
}

// ── Status config — colours used by status badges everywhere ─────────────────

export const STATUS_CONFIG = {
  inactive:  { label: 'Inactive',   bg: '#F5F5F5', color: '#757575', border: '#E0E0E0' },
  active:    { label: 'Active',     bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  at_risk:   { label: 'At Risk',    bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  danger:    { label: 'Danger',     bg: '#FFEBEE', color: '#C62828', border: '#FFCDD2' },
  completed: { label: 'Completed',  bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
}

// ── Compute status from a field object ────────────────────────────────────────

/**
 * Returns a status key: 'inactive' | 'active' | 'at_risk' | 'danger' | 'completed'
 *
 * Rules:
 *   not_started           → inactive
 *   harvested             → completed
 *   any active stage + no next expected date → active
 *   overdue > 7 days      → danger
 *   overdue 1–7 days      → at_risk
 *   on schedule or future → active
 */
export function computeFieldStatus(field) {
  const stage = field.current_stage || 'not_started'

  if (stage === 'not_started') return 'inactive'
  if (stage === 'harvested')   return 'completed'

  const nextDateKey      = STAGE_NEXT_EXPECTED[stage]
  const expectedDateStr  = nextDateKey ? field[nextDateKey] : null

  if (!expectedDateStr) return 'active'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expectedDate = new Date(expectedDateStr)
  expectedDate.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today - expectedDate) / (1000 * 60 * 60 * 24))

  if (diffDays > 7)  return 'danger'
  if (diffDays >= 1) return 'at_risk'
  return 'active'
}

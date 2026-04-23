/*
  sharedStyles.js — Design-token style objects shared across all pages.

  Exported as a named export `sharedStyles` (aliased as `s` in consumers):
    import { sharedStyles as s } from '../components/sharedStyles'
    <button style={s.primaryBtn}>Save</button>

  What belongs here:
  - Form primitives: label, input, textarea, select
  - Action buttons: primaryBtn, cancelBtn, submitBtn
  - State feedback: stateMsg, errorBanner, emptyState
  - Modal form layout: form, modalActions

  What does NOT belong here:
  - Page/layout structure (that's PageLayout.jsx)
  - Nav chrome (that's Navbar.jsx)
  - Card-specific styles (stay co-located in each page component)

  Color palette reference:
    GREEN_900  #1B5E20  major headings, primary actions
    GREEN_800  #2E7D32  buttons, active elements
    GREEN_50   #E8F5E9  backgrounds
    MINT       #A5D6A7  borders, soft accents
    BORDER     #C8E6C9  input/card borders
    OFF_WHITE  #F9FBF9  input backgrounds
    TEXT_DARK  #1B2E1B  body text
    TEXT_MID   #5A7A5A  secondary/meta text
    ERROR_BG   #FFEBEE
    ERROR_BDR  #FFCDD2
    ERROR_TXT  #C62828
*/

export const sharedStyles = {

  // ── Form container ────────────────────────────────────────────────────────
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },

  // ── Form fields ───────────────────────────────────────────────────────────
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
  select: {
    padding: '0.65rem 0.85rem',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: '#1B2E1B',
    outline: 'none',
    backgroundColor: '#F9FBF9',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  textarea: {
    padding: '0.65rem 0.85rem',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: '#1B2E1B',
    outline: 'none',
    backgroundColor: '#F9FBF9',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  primaryBtn: {
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

  // ── Modal form footer ─────────────────────────────────────────────────────
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },

  // ── State feedback ────────────────────────────────────────────────────────
  stateMsg: {
    textAlign: 'center',
    color: '#5A7A5A',
    padding: '3rem',
    fontFamily: "inherit",
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    border: '1px solid #FFCDD2',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    fontSize: '0.9rem',
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
}

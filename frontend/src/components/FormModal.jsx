/*
  FormModal.jsx — Generic modal overlay shell.

  Used by: CoordinatorDashboard (Add Field), RegisterPage, any future modal form.

  Props:
    title      (string)    — heading shown in the modal header
    onClose    (function)  — called when the user closes the modal
                             (✕ button OR clicking the dark overlay)
    error      (string|null) — if truthy, renders a red error banner inside the modal
    children   — the <form> or any other content goes here

  What this handles so the parent does NOT need to:
  - Dark overlay (clicking it calls onClose)
  - stopPropagation on the inner box so clicks inside don't close the modal
  - Green modal header with title + close button
  - Red error banner block

  What this does NOT handle (intentionally left to the parent):
  - The form fields themselves
  - Submit logic
  - Form state (controlled inputs, loading flag)
  - Modal visibility (the parent conditionally renders <FormModal> at all)

  Usage:
    {showModal && (
      <FormModal title="Add New Field" onClose={closeModal} error={formError}>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
          ...inputs...
          <button type="submit">Add</button>
        </form>
      </FormModal>
    )}
*/
export default function FormModal({ title, onClose, error, children }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      {/*
        onClick on the overlay: clicking outside the box triggers onClose.
        e.stopPropagation() on the inner box prevents that bubbling up.
      */}
      <div style={styles.box} onClick={e => e.stopPropagation()}>

        {/* Header: title on the left, close button on the right */}
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Error banner — only rendered when error is truthy */}
        {error && (
          <div style={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* The form (or any other content) goes here */}
        {children}

      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  box: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '460px',
    padding: '2rem',
    boxShadow: '0 10px 48px rgba(0,0,0,0.20)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  title: {
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
  errorBanner: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    border: '1px solid #FFCDD2',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
  },
}

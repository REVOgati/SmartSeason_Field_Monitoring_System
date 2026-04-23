import { useRef } from 'react'

/**
 * DateInput — native <input type="date"> with a visible calendar icon button.
 * Clicking the icon calls showPicker() to open the browser's date picker,
 * making year / month / day navigation obvious and accessible.
 *
 * Props mirror a regular <input>: value, onChange, style, disabled, ...rest.
 */
export default function DateInput({ value, onChange, style, disabled, ...rest }) {
  const ref = useRef(null)

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ ...style, paddingRight: '2.2rem', boxSizing: 'border-box' }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => ref.current?.showPicker?.()}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Open date picker"
        style={{
          position: 'absolute',
          right: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          padding: 0,
          lineHeight: 1,
          fontSize: '1rem',
          color: '#4A6741',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        📅
      </button>
    </div>
  )
}

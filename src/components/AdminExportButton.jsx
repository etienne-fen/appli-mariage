import { useState } from 'react'

// Admin-only box with one "download Excel" button.
// `run` performs the export and resolves to the number of guests exported.
export default function AdminExportButton({ label, busyLabel, doneLabel, run }) {
  const [state, setState] = useState(null) // null | 'busy' | { count } | { error }

  async function handleClick() {
    setState('busy')
    try {
      setState({ count: await run() })
    } catch (e) {
      setState({ error: e.message })
    }
  }

  return (
    <div style={s.box}>
      <p style={s.label}>Admin</p>
      <button onClick={handleClick} disabled={state === 'busy'} style={{ ...s.btn, opacity: state === 'busy' ? 0.6 : 1 }}>
        {state === 'busy' ? busyLabel : `⬇️ ${label}`}
      </button>
      {state?.count !== undefined && <p style={s.ok}>{doneLabel(state.count)}</p>}
      {state?.error && <p style={s.err}>{state.error}</p>}
    </div>
  )
}

const s = {
  box: { border: '1.5px dashed #bbb', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem' },
  label: { margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' },
  btn: {
    width: '100%', padding: '0.65rem 1rem', borderRadius: '0.5rem', border: 'none',
    background: '#1E4A2E', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
  },
  ok: { margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#27ae60' },
  err: { margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#c0392b' },
}

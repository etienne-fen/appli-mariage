// Normalise a raw phone input to E.164 format.
// Assumes +33 (France) when no country code is present.
export function normalizePhone(raw) {
  const stripped = raw.replace(/[\s\-().]/g, '')
  if (stripped.startsWith('+')) return stripped
  if (stripped.startsWith('00')) return '+' + stripped.slice(2)
  if (stripped.startsWith('0')) return '+33' + stripped.slice(1)
  return '+33' + stripped
}

// Display an E.164 number: French numbers as "06 12 34 56 78", others as stored.
export function formatPhone(e164) {
  if (!e164) return ''
  const m = e164.match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/)
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164
}

// Normalise a raw phone input to E.164 format.
// Assumes +33 (France) when no country code is present.
export function normalizePhone(raw) {
  const stripped = raw.replace(/[\s\-().]/g, '')
  if (stripped.startsWith('+')) return stripped
  if (stripped.startsWith('00')) return '+' + stripped.slice(2)
  if (stripped.startsWith('0')) return '+33' + stripped.slice(1)
  return '+33' + stripped
}

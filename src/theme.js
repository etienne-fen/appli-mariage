// Shared look taken from the invitation poster (public/main_picture.jpg).
export const CREAM    = '#F5ECDD' // page background, every page
export const GREEN    = '#1F5135'
export const PINK     = '#C9748B'
export const SKY      = '#EBB9AE'
export const SUN      = '#E89C2E'
export const LAVENDER = '#9D8DCB'
export const SEA      = '#5D70B5'
export const SALMON   = '#E7957F'

export const FRIEZE_HEIGHT = 18

// Orange scallop "frise" pinned to the bottom of every page (rendered once in _app.js).
export function Frieze() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: FRIEZE_HEIGHT,
        display: 'flex', justifyContent: 'center', overflow: 'hidden', lineHeight: 0,
        pointerEvents: 'none',
      }}
    >
      {Array.from({ length: 60 }, (_, i) => (
        <div key={i} style={{
          flexShrink: 0, width: FRIEZE_HEIGHT * 2, height: FRIEZE_HEIGHT,
          borderRadius: `${FRIEZE_HEIGHT}px ${FRIEZE_HEIGHT}px 0 0`, background: SUN,
        }} />
      ))}
    </div>
  )
}

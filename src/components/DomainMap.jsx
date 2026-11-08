// Illustrated plan of the Domaine du Possible (redrawn from "Plan du domaine.pdf",
// positions traced from the satellite view, same 615×590 frame).
// `highlight` = a rooms.batiment value ("Escoubet" | "Escoubas" | "Yourtes");
// that building gets a pulsing halo, a "you sleep here" callout and a highlighted
// legend row. Numbers on the map match the legend under it (labels are kept out
// of the SVG so they stay readable on a phone).

const C = {
  lawn: '#DCE3C6', meadow: '#C9D6A6', road: '#EFE6D3', roadEdge: '#CDBFA3', path: '#9C8B6C',
  sleep: '#2F4A66', sleepFill: '#E1E8F0', party: '#A64B2E', partyFill: '#F3E3D8',
  annex: '#E7E0D1', annexEdge: '#B5AA94', ink: '#24221E', muted: '#5C574E', paper: '#FFFDF8',
  here: '#E8A020',
}
const TREE_GREENS = ['#5F7A4E', '#6A8455', '#6F8A5B', '#7E9867', '#8AA371']

const MEADOW = [[285, 0], [615, 0], [615, 330], [540, 335], [470, 310], [420, 285], [360, 250], [330, 215], [300, 160], [282, 90]]
// Positions traced from the satellite view (same 615×590 frame).
const YURTS = [[332, 408], [366, 385], [428, 383]]
const ESCOUBAS = '206,400 220,390 304,462 292,476'
const FOOTPATH = 'M238,168 C215,205 182,255 160,298 C165,335 178,370 196,394 C226,428 262,458 296,480 C318,492 340,498 362,504'

// Normalise a rooms.batiment value to a map zone.
export function zoneFor(batiment) {
  const b = (batiment ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (b.startsWith('escoubet')) return 'escoubet'
  if (b.startsWith('escoubas')) return 'escoubas'
  if (b.includes('yourte')) return 'yourtes'
  return null
}

const ZONES = {
  escoubet: {
    n: 1, kind: 'sleep',
    halo: <polygon points="165,32 220,52 192,136 138,114" />,
    callout: { x: 228, y: 122 },
  },
  bar:      { n: 2, kind: 'party' },
  chapiteau:{ n: 3, kind: 'party' },
  yourtes: {
    n: 4, kind: 'sleep',
    halo: <ellipse cx="381" cy="395" rx="66" ry="30" />,
    callout: { x: 330, y: 326 },
  },
  escoubas: {
    n: 5, kind: 'sleep',
    halo: <polygon points={ESCOUBAS} />,
    callout: { x: 300, y: 436 },
  },
}

const LEGEND = {
  FR: {
    party: 'Dîner & fête', sleep: 'Dormir', here: 'Vous dormez ici',
    items: {
      chapiteau: ['Chapiteau', 'Le dîner'],
      bar: ['Bar & Dance Floor', 'Piste de danse, terrasse et bar'],
      escoubet: ['Bâtiment Escoubet', 'Chambres · en haut, à côté du bar'],
      escoubas: ['Bâtiment Escoubas', 'Chambres · en bas, à côté des yourtes'],
      yourtes: ['Yourtes', 'Sur la pelouse, au pied de la haie d’arbres'],
    },
  },
  EN: {
    party: 'Dinner & party', sleep: 'Sleeping', here: 'You sleep here',
    items: {
      chapiteau: ['Marquee', 'Dinner'],
      bar: ['Bar & Dance Floor', 'Dance floor, terrace and bar'],
      escoubet: ['Escoubet building', 'Rooms · at the top, next to the bar'],
      escoubas: ['Escoubas building', 'Rooms · at the bottom, next to the yurts'],
      yourtes: ['Yurts', 'On the lawn, by the line of trees'],
    },
  },
}

// ── Trees: generated once, deterministically, away from buildings and paths ──

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function inPolygon([x, y], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function distToPolyline([x, y], pts) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)))
  }
  return best
}
const KEEP_CLEAR = [
  [128, 22, 232, 146],  // Escoubet
  [64, 118, 192, 250],  // bar + pool
  [226, 158, 326, 242], // chapiteau
  [10, 244, 116, 330],  // west outbuilding
  [312, 236, 368, 296], // small outbuilding
  [165, 236, 285, 300], // open lawn north
  [190, 300, 280, 380], // open lawn centre
  [194, 382, 312, 484], // Escoubas
  [312, 362, 450, 424], // yurt lawn
  [306, 424, 455, 472], // open lawn south of the yurts
  [140, 488, 292, 560], // lawn south of Escoubas
  [440, 396, 470, 420], // yurt badge
  [535, 20, 610, 85],   // compass
]
const PATHS = [
  [[262, 0], [256, 90], [238, 168], [200, 230], [160, 298], [178, 370], [196, 394], [262, 458], [296, 480], [362, 504]],
  [[296, 228], [340, 320], [360, 372]],
]
const TREES = (() => {
  const r = rng(7), out = []
  for (let i = 0; i < 2400 && out.length < 330; i++) {
    const p = [r() * 615, r() * 590]
    if (inPolygon(p, MEADOW)) continue
    if (KEEP_CLEAR.some(([x1, y1, x2, y2]) => p[0] > x1 && p[0] < x2 && p[1] > y1 && p[1] < y2)) continue
    if (PATHS.some(path => distToPolyline(p, path) < 12)) continue
    out.push({ x: p[0], y: p[1], r: 7 + r() * 5, c: TREE_GREENS[Math.floor(r() * TREE_GREENS.length)] })
  }
  return out
})()

// ── Map ───────────────────────────────────────────────────────────────────────

function Badge({ x, y, n, kind, active }) {
  const color = kind === 'sleep' ? C.sleep : C.party
  return (
    <g>
      {active && <circle cx={x} cy={y} r="17" fill={C.here} opacity="0.35" />}
      <circle cx={x} cy={y} r="12" fill={color} stroke={C.paper} strokeWidth="2.5" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff"
        fontFamily="system-ui, sans-serif">{n}</text>
    </g>
  )
}

export default function DomainMap({ highlight = null, lang = 'FR' }) {
  const zone = zoneFor(highlight)
  const t = LEGEND[lang] ?? LEGEND.FR
  const hz = zone ? ZONES[zone] : null

  return (
    <figure style={s.figure}>
      <svg viewBox="0 0 615 590" style={s.svg} role="img"
        aria-label={lang === 'FR' ? 'Plan du Domaine du Possible' : 'Map of the Domaine du Possible'}>
        <defs>
          <pattern id="dm-dance" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="3" height="3" fill={C.party} opacity="0.35" />
            <rect x="3" y="3" width="3" height="3" fill={C.party} opacity="0.35" />
          </pattern>
          <pattern id="dm-stripes" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <rect width="7" height="22" fill="#fff" opacity="0.18" />
          </pattern>
          <style>{`
            .dm-pulse { animation: dmPulse 1.8s ease-in-out infinite; }
            @keyframes dmPulse { 0%,100% { opacity: .95 } 50% { opacity: .3 } }
            @media (prefers-reduced-motion: reduce) { .dm-pulse { animation: none } }
          `}</style>
        </defs>

        {/* ground */}
        <rect width="615" height="590" fill={C.lawn} />
        <polygon points={MEADOW.join(' ')} fill={C.meadow} />
        <polygon points={MEADOW.join(' ')} fill="url(#dm-stripes)" />
        <text x="425" y="150" fontFamily="Georgia, serif" fontStyle="italic" fontSize="22" fill="#5E7046" opacity="0.8">
          {lang === 'FR' ? 'La grande prairie' : 'The great meadow'}
        </text>

        {/* access road + footpaths */}
        <path d="M262,-5 C258,60 252,120 238,168" fill="none" stroke={C.roadEdge} strokeWidth="9" strokeLinecap="round" />
        <path d="M262,-5 C258,60 252,120 238,168" fill="none" stroke={C.road} strokeWidth="6.5" strokeLinecap="round" />
        <path d={FOOTPATH} fill="none" stroke={C.road} strokeWidth="5" strokeLinecap="round" />
        <path d={FOOTPATH} fill="none" stroke={C.path} strokeWidth="1.3" strokeDasharray="1 4" strokeLinecap="round" />
        <path d="M296,228 C314,268 336,318 358,372" fill="none" stroke={C.path} strokeWidth="1.3" strokeDasharray="1 4" strokeLinecap="round" />

        {/* trees */}
        {TREES.map((tr, i) => (
          <g key={i}>
            <circle cx={tr.x + 2} cy={tr.y + 2.5} r={tr.r} fill="#3F5434" opacity="0.18" />
            <circle cx={tr.x} cy={tr.y} r={tr.r} fill={tr.c} />
          </g>
        ))}

        {/* outbuildings */}
        <polygon points="22,252 108,262 104,322 18,312" fill={C.annex} stroke={C.annexEdge} />
        <polygon points="326,244 360,250 356,288 320,282" fill={C.annex} stroke={C.annexEdge} />

        {/* bar & dance floor + pool */}
        <polygon points="78,128 150,140 182,168 166,214 120,206 74,196" fill={C.partyFill} stroke={C.party} strokeWidth="1.6" />
        <rect x="96" y="150" width="44" height="34" fill="url(#dm-dance)" stroke={C.party} strokeWidth="0.8" transform="rotate(10 118 167)" />
        <polygon points="122,208 168,216 160,240 116,232" fill={C.road} stroke="#C9B996" strokeWidth="0.8" />
        <rect x="134" y="214" width="22" height="13" rx="2" fill="#8EC5D6" stroke="#5E9AB0" strokeWidth="0.8" transform="rotate(10 145 220)" />

        {/* chapiteau */}
        <polygon points="250,168 316,193 302,232 236,207" fill={C.paper} stroke={C.party} strokeWidth="1.6" />
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1={261 + 11 * i} y1={172.2 + 4.17 * i} x2={247 + 11 * i} y2={211.2 + 4.17 * i}
            stroke={C.party} strokeWidth="0.8" opacity="0.55" />
        ))}

        {/* highlight halo — under the building so its outline stays crisp */}
        {hz && (
          <g className="dm-pulse" fill={C.here} fillOpacity="0.35" stroke={C.here} strokeWidth="10" strokeLinejoin="round">
            {hz.halo}
          </g>
        )}

        {/* sleeping buildings */}
        <polygon points="165,32 220,52 192,136 138,114" fill={C.sleepFill} stroke={C.sleep} strokeWidth="1.6" />
        <line x1="192" y1="42" x2="165" y2="125" stroke={C.sleep} strokeWidth="0.8" opacity="0.5" />
        <polygon points={ESCOUBAS} fill={C.sleepFill} stroke={C.sleep} strokeWidth="1.6" />
        <line x1="213" y1="395" x2="298" y2="469" stroke={C.sleep} strokeWidth="0.8" opacity="0.5" />
        {YURTS.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x + 1.5} cy={y + 2} r="11" fill={C.sleep} opacity="0.2" />
            <circle cx={x} cy={y} r="11" fill="#EEF2F6" stroke={C.sleep} strokeWidth="1.4" />
            {[0, 45, 90, 135].map(a => (
              <line key={a} x1={x - 8 * Math.cos(a * Math.PI / 180)} y1={y - 8 * Math.sin(a * Math.PI / 180)}
                x2={x + 8 * Math.cos(a * Math.PI / 180)} y2={y + 8 * Math.sin(a * Math.PI / 180)}
                stroke={C.sleep} strokeWidth="0.7" opacity="0.6" />
            ))}
            <circle cx={x} cy={y} r="3" fill={C.sleep} />
          </g>
        ))}

        {/* numbered badges (see legend) */}
        <Badge x={208} y={30} n={1} kind="sleep" active={zone === 'escoubet'} />
        <Badge x={64} y={136} n={2} kind="party" />
        <Badge x={330} y={186} n={3} kind="party" />
        <Badge x={455} y={408} n={4} kind="sleep" active={zone === 'yourtes'} />
        <Badge x={192} y={432} n={5} kind="sleep" active={zone === 'escoubas'} />

        {/* compass */}
        <g transform="translate(572,52)">
          <circle r="22" fill={C.paper} opacity="0.85" stroke="#8A7D63" strokeWidth="0.8" />
          <polygon points="0,-17 5,0 0,4 -5,0" fill={C.ink} />
          <polygon points="0,17 5,0 0,-4 -5,0" fill={C.annexEdge} />
          <text y="-26" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fontWeight="600" fill={C.ink}>N</text>
        </g>

        {/* "you sleep here" callout */}
        {hz && (
          <g transform={`translate(${hz.callout.x},${hz.callout.y})`}>
            <rect width={t.here.length * 9.6 + 34} height="34" rx="17" fill={C.here} stroke={C.paper} strokeWidth="2.5" />
            <text x="16" y="23" fontFamily="system-ui, sans-serif" fontSize="17" fontWeight="700" fill={C.ink}>
              ★ {t.here}
            </text>
          </g>
        )}
      </svg>

      {/* legend */}
      <div style={s.legend}>
        <p style={{ ...s.group, color: C.party }}>{t.party}</p>
        {['chapiteau', 'bar'].map(k => <LegendRow key={k} zoneKey={k} t={t} active={false} />)}
        <p style={{ ...s.group, color: C.sleep }}>{t.sleep}</p>
        {['escoubet', 'escoubas', 'yourtes'].map(k => <LegendRow key={k} zoneKey={k} t={t} active={zone === k} />)}
      </div>
    </figure>
  )
}

function LegendRow({ zoneKey, t, active }) {
  const z = ZONES[zoneKey]
  const [name, desc] = t.items[zoneKey]
  return (
    <div style={{ ...s.row, ...(active ? s.rowActive : {}) }}>
      <span style={{ ...s.num, background: z.kind === 'sleep' ? C.sleep : C.party }}>{z.n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={s.name}>{name}{active && <span style={s.hereTag}>★ {t.here}</span>}</div>
        <div style={s.desc}>{desc}</div>
      </div>
    </div>
  )
}

const s = {
  figure: { margin: '0 0 1.5rem' },
  svg: { display: 'block', width: '100%', height: 'auto', borderRadius: '0.75rem', border: '1px solid #D8CDB6' },
  legend: { marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  group: { margin: '0.6rem 0 0.1rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' },
  row: { display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1.5px solid transparent' },
  rowActive: { background: '#E8A0201f', borderColor: C.here },
  num: { flexShrink: 0, width: 24, height: 24, borderRadius: 12, color: '#fff', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: '0.95rem', fontWeight: 600, color: C.ink, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' },
  hereTag: { fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: C.here, color: C.ink },
  desc: { fontSize: '0.8rem', color: C.muted, marginTop: '0.1rem' },
}

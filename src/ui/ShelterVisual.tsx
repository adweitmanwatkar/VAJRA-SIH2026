import { useEffect, useMemo, useState } from 'react'
import type { Shelter } from '../domain/types'

/* ------------------------------------------------------------------
   Simplified engineering visualization of the shelter: cross-section
   with dimension labels, sun, wind arrows, insulation layer and an
   animated heat-flow overlay for the results screen.
   ------------------------------------------------------------------ */

export function ShelterVisual({ shelter, live }: { shelter: Shelter; live?: { tempIn: number; tempOut: number; solar: boolean } }) {
  const aspect = shelter.lengthM / Math.max(0.5, shelter.widthM)
  const w = 260
  const d = Math.max(80, Math.min(150, 240 / Math.max(1, aspect) + 40))

  return (
    <svg viewBox="0 0 380 240" className="w-full h-auto select-none" role="img" aria-label="Shelter schematic">
      <defs>
        <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#122741" />
          <stop offset="100%" stopColor="#2f5175" />
        </linearGradient>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8eef4" />
          <stop offset="100%" stopColor="#c9d6e2" />
        </linearGradient>
        <marker id="arrowTeal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#0d9488" />
        </marker>
        <marker id="arrowAmber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#d97706" />
        </marker>
        <marker id="arrowBlue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#2563eb" />
        </marker>
      </defs>

      {/* sun */}
      {(!live || live.solar) && (
        <g>
          <circle cx="322" cy="38" r="14" fill="#f59e0b" opacity="0.9" />
          <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
            <line x1="322" y1="14" x2="322" y2="20" />
            <line x1="322" y1="56" x2="322" y2="62" />
            <line x1="298" y1="38" x2="304" y2="38" />
            <line x1="340" y1="38" x2="346" y2="38" />
          </g>
          <line x1="310" y1="52" x2="252" y2="96" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 4" markerEnd="url(#arrowAmber)" className="animate-pulseDot" />
        </g>
      )}

      {/* wind */}
      <g stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" opacity="0.75">
        <line x1="12" y1="60" x2="52" y2="60" markerEnd="url(#arrowBlue)" />
        <line x1="20" y1="74" x2="60" y2="74" markerEnd="url(#arrowBlue)" />
        <line x1="12" y1="88" x2="46" y2="88" markerEnd="url(#arrowBlue)" />
      </g>
      <text x="14" y="52" fontSize="9" fill="#2563eb" fontWeight="600">WIND</text>

      {/* shelter body (isometric-ish box) */}
      <g>
        {/* side wall */}
        <polygon points={`80,${110 + d * 0} ${80 + w},${110} ${80 + w},${110 + d * 0.55} 80,${110 + d * 0.55}`} fill="url(#wallGrad)" stroke="#a9bccf" strokeWidth="1" />
        {/* front facade with door + window */}
        <polygon points={`80,110 80,${110 + d * 0.55} ${80 + 150},${110 + d * 0.55} ${80 + 150},110`} fill="#f4f7fa" stroke="#a9bccf" strokeWidth="1" />
        {/* roof */}
        <polygon points={`80,110 ${80 + w},110 ${80 + w + 24},${96} ${104},96`} fill="url(#roofGrad)" stroke="#0b1526" strokeWidth="1" />

        {/* insulation band */}
        {shelter.insulationThicknessM > 0 && (
          <polygon
            points={`80,${110 + d * 0.55} ${80 + 150},${110 + d * 0.55} ${80 + 150},${110 + d * 0.55 + 6} 80,${110 + d * 0.55 + 6}`}
            fill="#0d9488"
            opacity="0.55"
          />
        )}

        {/* door */}
        <rect x={92} y={110 + d * 0.55 - 46} width="26" height="46" fill="#122741" opacity="0.85" rx="1" />
        {/* windows */}
        <rect x={138} y={110 + d * 0.55 - 40} width="30" height="22" fill="#bae6fd" stroke="#7492ac" strokeWidth="1" opacity="0.9" />
        {shelter.windowCount > 1 && (
          <rect x={182} y={110 + d * 0.55 - 40} width="30" height="22" fill="#bae6fd" stroke="#7492ac" strokeWidth="1" opacity="0.9" />
        )}
      </g>

      {/* interior temperature glow / heat arrows */}
      {live && (
        <g>
          {live.tempIn > live.tempOut + 1 ? (
            <>
              <text x="180" y="150" textAnchor="middle" fontSize="11" fontWeight="700" fill="#b45309">
                HEAT LOSS →
              </text>
              <line x1="150" y1="160" x2="40" y2="160" stroke="#d97706" strokeWidth="2.5" markerEnd="url(#arrowAmber)" className="animate-pulseDot" />
            </>
          ) : live.tempOut > live.tempIn + 1 ? (
            <>
              <text x="180" y="150" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">
                ← COLD INGRESS
              </text>
              <line x1="40" y1="160" x2="150" y2="160" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrowBlue)" className="animate-pulseDot" />
            </>
          ) : (
            <text x="180" y="156" textAnchor="middle" fontSize="11" fontWeight="600" fill="#4a6b8a">EQUILIBRIUM</text>
          )}
        </g>
      )}

      {/* dimension annotations */}
      <g fontSize="9" fill="#4a6b8a" fontWeight="600" fontFamily="IBM Plex Mono, monospace">
        <line x1="80" y1="212" x2={80 + w} y2="212" stroke="#a9bccf" strokeWidth="1" markerStart="url(#arrowTeal)" markerEnd="url(#arrowTeal)" />
        <text x={80 + w / 2} y="226" textAnchor="middle">{shelter.lengthM.toFixed(1)} m</text>
        <line x1={80 + w + 8} y1="110" x2={80 + w + 8} y2={110 + d * 0.55} stroke="#a9bccf" strokeWidth="1" />
        <text x={80 + w + 14} y={110 + d * 0.28}>{shelter.widthM.toFixed(1)} m</text>
        <line x1="70" y1="110" x2="70" y2={110 + d * 0.55} stroke="#a9bccf" strokeWidth="1" />
        <text x="76" y={110 + d * 0.3}>{shelter.heightM.toFixed(1)} m</text>
      </g>

      {/* orientation compass */}
      <g transform="translate(40, 34)">
        <circle r="14" fill="white" stroke="#d3dee8" />
        <text y="-3" textAnchor="middle" fontSize="8" fill="#122741" fontWeight="700">N</text>
        <text y="11" textAnchor="middle" fontSize="8" fill="#7492ac">S</text>
        <path d={`M0 0 L${Math.sin(azRad(shelter.orientation)) * 10} ${-Math.cos(azRad(shelter.orientation)) * 10}`} stroke="#0d9488" strokeWidth="2" markerEnd="url(#arrowTeal)" />
      </g>
    </svg>
  )
}

function azRad(o: string): number {
  const map: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }
  return ((map[o] ?? 0) * Math.PI) / 180
}

/** Compact animated energy-flow strip for the results screen */
export function EnergyFlowStrip({ solar, internal, conduction, ventilation }: {
  solar: number; internal: number; conduction: number; ventilation: number
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 3), 700)
    return () => clearInterval(id)
  }, [])
  const items = useMemo(
    () => [
      { label: 'Solar gain', value: solar, color: '#d97706', dir: 'in' as const },
      { label: 'Internal gain', value: internal, color: '#16a34a', dir: 'in' as const },
      { label: 'Conduction', value: conduction, color: '#122741', dir: 'out' as const },
      { label: 'Ventilation', value: ventilation, color: '#2563eb', dir: 'out' as const },
    ],
    [solar, internal, conduction, ventilation],
  )
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((it) => {
        const pct = Math.round((it.value / max) * 100)
        return (
          <div key={it.label} className="bg-white border border-ink-200/80 rounded-xl px-3 py-2.5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-500">{it.label}</span>
              <span className="text-[11px] font-mono text-ink-400">{it.dir === 'in' ? '↓ in' : '↑ out'}</span>
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums" style={{ color: it.color }}>
              {Math.round(it.value)} <span className="text-[11px] text-ink-400 font-medium">W</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: it.color, opacity: tick >= 0 ? 0.85 : 1 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

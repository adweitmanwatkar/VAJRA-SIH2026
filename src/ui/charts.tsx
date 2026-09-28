import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { SeriesPoint } from '../domain/types'

/* ------------------------------------------------------------------
   Chart components for the results dashboard. All charts consume
   SimulationResult.series — no invented numbers.
   ------------------------------------------------------------------ */

export const CHART_COLORS = {
  teal: '#0d9488',
  navy: '#122741',
  blue: '#2563eb',
  amber: '#d97706',
  red: '#dc2626',
  green: '#16a34a',
  slate: '#94a3b8',
}

const axisStyle = { fontSize: 11, fill: '#7492ac' } as const

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #d3dee8',
    boxShadow: '0 8px 24px -12px rgba(11,21,38,0.25)',
    fontSize: 12,
  },
  labelStyle: { fontWeight: 700, fontSize: 11, color: '#122741' },
}

function fmtHour(t: string): string {
  // '2023-01-05T13:00' -> 'D3 13:00'
  const day = Number(t.slice(8, 10))
  return `D${day} ${t.slice(11, 16)}`
}

export function TempChart({ series, minC, maxC }: { series: SeriesPoint[]; minC: number; maxC: number }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmtHour} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d3dee8' }} minTickGap={40} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit="°" width={48} />
        <Tooltip {...tooltipStyle} formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(1)} °C`, String(n)]} labelFormatter={(l) => fmtHour(String(l))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceArea y1={minC} y2={maxC} fill="#0d9488" fillOpacity={0.07} />
        <ReferenceLine y={minC} stroke="#0d9488" strokeDasharray="4 4" strokeOpacity={0.5} />
        <ReferenceLine y={maxC} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.5} />
        <Line type="monotone" dataKey="tempOut" name="Outdoor" stroke={CHART_COLORS.slate} strokeWidth={1.6} dot={false} />
        <Line type="monotone" dataKey="tempIn" name="Indoor" stroke={CHART_COLORS.teal} strokeWidth={2.4} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function HeatFlowChart({ series }: { series: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmtHour} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d3dee8' }} minTickGap={40} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} unit=" W" />
        <Tooltip {...tooltipStyle} formatter={(v: unknown, n: unknown) => [`${Math.round(Number(v))} W`, String(n)]} labelFormatter={(l) => fmtHour(String(l))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="solarGain" name="Solar gain" stroke={CHART_COLORS.amber} fill="#d9770622" strokeWidth={1.6} />
        <Area type="monotone" dataKey="internal" name="Internal gain" stroke={CHART_COLORS.green} fill="#16a34a22" strokeWidth={1.6} />
        <Line type="monotone" dataKey="conduction" name="Conduction loss" stroke={CHART_COLORS.navy} strokeWidth={1.8} dot={false} />
        <Line type="monotone" dataKey="ventilation" name="Ventilation loss" stroke={CHART_COLORS.blue} strokeWidth={1.8} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function ComfortTimeline({ series }: { series: SeriesPoint[] }) {
  const data = series.map((p) => ({
    t: p.t,
    band: p.comfort.band,
    y: p.comfort.band === 'in' ? 1 : p.comfort.band === 'above' ? 2 : 0,
    tempIn: p.tempIn,
  }))
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmtHour} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d3dee8' }} minTickGap={48} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v) => (v === 0 ? 'Below' : v === 1 ? 'In band' : 'Above')} />
        <Tooltip {...tooltipStyle} formatter={(v: unknown, _n: unknown, entry: { payload?: { tempIn?: number; band?: string } }) => [`Tin ${entry?.payload?.tempIn} °C · ${entry?.payload?.band}`, 'Status']} labelFormatter={(l) => fmtHour(String(l))} />
        <Bar dataKey="y" name="Comfort" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.y === 1 ? CHART_COLORS.teal : d.y === 0 ? CHART_COLORS.blue : CHART_COLORS.amber} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function EnergyBalanceChart({ series }: { series: SeriesPoint[] }) {
  // cumulative energy flows over the window
  let sSolar = 0, sCond = 0, sVent = 0, sInt = 0
  const data = series.map((p) => {
    sSolar += p.solarGain / 1000
    sCond += p.conduction / 1000
    sVent += p.ventilation / 1000
    sInt += p.internal / 1000
    return { t: p.t, solar: +sSolar.toFixed(2), losses: +(sCond + sVent).toFixed(2), internal: +sInt.toFixed(2) }
  })
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmtHour} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d3dee8' }} minTickGap={40} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} unit=" kWh" />
        <Tooltip {...tooltipStyle} formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(1)} kWh`, String(n)]} labelFormatter={(l) => fmtHour(String(l))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="solar" name="Solar (cumulative)" stroke={CHART_COLORS.amber} fill="#d9770618" strokeWidth={1.8} />
        <Area type="monotone" dataKey="internal" name="Internal (cumulative)" stroke={CHART_COLORS.green} fill="#16a34a18" strokeWidth={1.8} />
        <Area type="monotone" dataKey="losses" name="Losses (cumulative)" stroke={CHART_COLORS.navy} fill="#12274114" strokeWidth={1.8} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ClimateTempChart({ series }: { series: { t: string; temp: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmtHour} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d3dee8' }} minTickGap={48} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} unit="°" />
        <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${Number(v).toFixed(1)} °C`, 'Ambient']} labelFormatter={(l) => fmtHour(String(l))} />
        <Area type="monotone" dataKey="temp" name="Ambient temperature" stroke={CHART_COLORS.blue} fill="#2563eb18" strokeWidth={1.8} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ClimateSolarChart({ series }: { series: { t: string; ghi: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="t" tickFormatter={fmtHour} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d3dee8' }} minTickGap={48} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} unit=" W/m²" />
        <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${Math.round(Number(v))} W/m²`, 'Solar (GHI)']} labelFormatter={(l) => fmtHour(String(l))} />
        <Area type="monotone" dataKey="ghi" name="GHI" stroke={CHART_COLORS.amber} fill="#d9770618" strokeWidth={1.6} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ComparisonBar({ data, unit, label }: { data: { name: string; value: number }[]; unit: string; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7492ac' }} tickLine={false} axisLine={{ stroke: '#d3dee8' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} />
        <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${Number(v).toFixed(1)} ${unit}`, label]} />
        <Bar dataKey="value" name={label} radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={['#0d9488', '#b45309', '#1d4ed8', '#9333ea', '#be123c'][i % 5]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

import type { ReactNode } from 'react'

/* ------------------------------------------------------------------
   UI primitives — restrained engineering styling: thin borders, white
   surfaces, navy text, teal accents. No neon, no gradient soup.
   ------------------------------------------------------------------ */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-ink-200/80 rounded-xl shadow-card ${className}`}>
      {children}
    </div>
  )
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-ink-100">
      <div>
        <h3 className="text-[15px] font-semibold text-ink-800 leading-tight">{title}</h3>
        {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'teal' | 'amber' | 'red' | 'blue' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-500 border-ink-200',
    teal: 'bg-teal-soft text-teal-accent border-teal-accent/20',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', disabled, className = '', type = 'button', title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  title?: string
}) {
  const variants: Record<string, string> = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-300',
    ghost: 'text-ink-500 hover:text-ink-800 hover:bg-ink-100',
    outline: 'border border-ink-300 text-ink-700 bg-white hover:border-ink-400 hover:bg-ink-50 disabled:opacity-50',
    danger: 'border border-red-200 text-red-600 bg-white hover:bg-red-50',
    subtle: 'bg-teal-accent/10 text-teal-accent hover:bg-teal-accent/20',
  }
  const sizes: Record<string, string> = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg',
    md: 'text-sm px-4 py-2 rounded-lg',
    lg: 'text-[15px] px-5 py-2.5 rounded-lg',
  }
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-ink-500 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-400 mt-1">{hint}</span>}
    </label>
  )
}

export function NumInput({
  value, onChange, min, max, step = 1, suffix, disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-accent/30 focus:border-teal-accent/50 disabled:bg-ink-50 disabled:text-ink-400"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value === '' ? NaN : Number(e.target.value)
          onChange(v)
        }}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">{suffix}</span>}
    </div>
  )
}

export function Select<T extends string>({ value, onChange, options, disabled }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-accent/30 focus:border-teal-accent/50 disabled:bg-ink-50"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-accent/30 focus:border-teal-accent/50"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function StatTile({ label, value, unit, tone = 'default', hint }: {
  label: string
  value: string
  unit?: string
  tone?: 'default' | 'teal' | 'amber' | 'red'
  hint?: string
}) {
  const tones: Record<string, string> = {
    default: 'text-ink-900',
    teal: 'text-teal-accent',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }
  return (
    <div className="bg-white border border-ink-200/80 rounded-xl shadow-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</span>
        {unit && <span className="text-xs text-ink-400 font-medium">{unit}</span>}
      </div>
      {hint && <div className="text-[11px] text-ink-400 mt-0.5">{hint}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-8 mb-3 first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-wider text-ink-400">{children}</h2>
      {right}
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-ink-100 my-4" />
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'teal'; children: ReactNode }) {
  const tones: Record<string, string> = {
    info: 'bg-ink-50 border-ink-200 text-ink-600',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    teal: 'bg-teal-soft border-teal-accent/20 text-ink-700',
  }
  return (
    <div className={`border rounded-lg px-4 py-3 text-[13px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  )
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="mx-auto w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center text-ink-400 text-xl mb-3">∅</div>
      <h3 className="text-ink-800 font-semibold">{title}</h3>
      {sub && <p className="text-sm text-ink-400 mt-1 max-w-md mx-auto">{sub}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

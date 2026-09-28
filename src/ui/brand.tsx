import logoMark from '../assets/logo-mark.png'

/* ------------------------------------------------------------------
   VAJRA brand assets — single source of truth for the diamond mark.
   The mark is the cropped diamond emblem (sun + shelter + mountains)
   from the official logo lockup; it carries its own transparency, so
   it sits cleanly on the dark sidebar and on white surfaces alike.
   ------------------------------------------------------------------ */

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={logoMark}
      width={size}
      height={size}
      alt="VAJRA — diamond emblem with sun, shelter and mountains"
      className={`shrink-0 select-none ${className}`}
      draggable={false}
    />
  )
}

/** Sidebar lockup: mark + spaced-caps wordmark + descriptor. */
export function VajraLogo({ markSize = 36 }: { markSize?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={markSize} className="drop-shadow-[0_2px_10px_rgba(56,189,248,0.35)]" />
      <div>
        <div className="text-[15px] font-extrabold tracking-[0.16em] text-white leading-tight">VAJRA</div>
        <div className="text-[9px] text-ink-400 tracking-[0.08em] uppercase -mt-0.5">Climate Smart Shelter Design</div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { PILOT_MAILTO } from '../constants'

const links = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Institutions', href: '#for-institutions' },
  { label: 'For Venues', href: '#for-venues' },
  { label: 'For Artists', href: '#for-artists' },
  { label: 'Transparency Ledger', href: '#ledger' },
  { label: 'About', href: '#about' },
  { label: 'Awards', href: '/awards' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-ink/80 backdrop-blur-md border-b border-line">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#hero" className="flex flex-col leading-none transition-transform duration-200 ease-out hover:scale-105" onClick={() => setOpen(false)}>
          <span className="text-xl font-extrabold tracking-tight text-gold">Sautify</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative text-sm font-medium text-muted hover:text-fg transition-colors"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-gold transition-transform duration-200 ease-out group-hover:scale-x-100" />
            </a>
          ))}
          <a
            href={PILOT_MAILTO}
            className="inline-flex items-center rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 ease-out hover:bg-gold/90 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            Request Pilot
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 text-fg active:scale-90 transition-transform duration-150"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" className={`origin-center transition-transform duration-200 ease-out ${open ? 'translate-y-[6px] rotate-45' : ''}`} />
            <line x1="3" y1="12" x2="21" y2="12" className={`transition-opacity duration-150 ${open ? 'opacity-0' : 'opacity-100'}`} />
            <line x1="3" y1="18" x2="21" y2="18" className={`origin-center transition-transform duration-200 ease-out ${open ? '-translate-y-[6px] -rotate-45' : ''}`} />
          </svg>
        </button>
      </nav>

      <div
        className={`md:hidden overflow-hidden border-t border-line bg-ink transition-all duration-300 ease-out ${
          open ? 'max-h-[30rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 py-4 flex flex-col gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="py-3 text-base font-medium text-muted hover:text-fg hover:translate-x-1 transition-all duration-200 ease-out"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <a
            href={PILOT_MAILTO}
            className="mt-2 inline-flex justify-center rounded-md bg-gold px-4 py-3 text-sm font-semibold text-ink transition-transform duration-150 ease-out active:scale-95"
            onClick={() => setOpen(false)}
          >
            Request Pilot
          </a>
        </div>
      </div>
    </header>
  )
}

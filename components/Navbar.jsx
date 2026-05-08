'use client'
import Link from 'next/link'
import { useApp } from '@/lib/AppContext'
import { ShoppingBag, Sun, Moon, Menu as MenuIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function Navbar() {
  const { t, lang, setLang, theme, setTheme, cartCount } = useApp()
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/menu', label: t('nav.menu') },
    { href: '/reservations', label: t('nav.reservations') },
    { href: '/track', label: t('nav.track') },
  ]

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-2xl font-semibold tracking-wide">
            Aukštaitija
          </span>
          <span className="hidden md:inline text-xs uppercase tracking-[0.3em] text-muted-foreground">Kaunas</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'en' ? 'lt' : 'en')}
            className="hidden md:inline px-2 py-1 text-xs font-semibold tracking-wider border border-border rounded hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'LT' : 'EN'}
          </button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link href="/cart" className="relative">
            <Button variant="ghost" size="icon" aria-label="Cart">
              <ShoppingBag className="h-4 w-4" />
            </Button>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container mx-auto py-4 flex flex-col gap-4">
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-medium">
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => setLang(lang === 'en' ? 'lt' : 'en')}
              className="text-left text-xs font-semibold tracking-wider"
            >
              {lang === 'en' ? 'Lietuvių' : 'English'}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

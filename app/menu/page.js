'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import RequestWaiterButton from '@/components/RequestWaiterButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/AppContext'
import { Search, Plus, Flame, Leaf, WheatOff, Beef, Star, Clock, Heart, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'

function MenuPage() {
  const searchParams = useSearchParams()
  const { t, lang, addToCart, tableId, tableNumber, setTableId, user, toggleFavorite } = useApp()
  const [dishes, setDishes] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [dietary, setDietary] = useState('all')
  const [sort, setSort] = useState('popular')
  const [loading, setLoading] = useState(true)
  // Mobile compact sticky bar — appears only after user scrolls past the
  // primary filter section so it never overlays the hero / first dish.
  const [showCompactBar, setShowCompactBar] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const filtersRef = useRef(null)

  useEffect(() => {
    const onScroll = () => {
      if (!filtersRef.current) return
      const rect = filtersRef.current.getBoundingClientRect()
      // Show compact bar once filters block has scrolled above the navbar (h-16)
      setShowCompactBar(rect.bottom < 64)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Handle table parameter from QR code
  useEffect(() => {
    const tableParam = searchParams.get('table')
    if (tableParam && tableParam !== tableId) {
      // Extract table number from ID (e.g., "t4" -> 4)
      const tableNum = tableParam.replace(/^t/, '')
      setTableId(tableParam, parseInt(tableNum))
      toast.success(`Seated at Table ${tableNum}`)
    }
  }, [searchParams, tableId, setTableId])

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams({ search, category, dietary, sort }).toString()
    fetch(`/api/dishes?${qs}`).then(r => r.json()).then(d => {
      setDishes(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [search, category, dietary, sort])

  const dietaryFilters = [
    { key: 'all', label: t('menu.all'), icon: null },
    { key: 'veg', label: t('menu.veg'), icon: Leaf },
    { key: 'gluten-free', label: t('menu.gluten-free'), icon: WheatOff },
    { key: 'non-veg', label: t('menu.non-veg'), icon: Beef },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* HERO */}
      <section className="container mx-auto pt-8 sm:pt-16 pb-6 sm:pb-12 text-center">
        <p className="text-primary text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-2 sm:mb-3">Carte du Jour</p>
        <h1 className="font-serif text-3xl sm:text-5xl md:text-7xl mb-2 sm:mb-4">{t('menu.title')}</h1>
        <p className="text-muted-foreground text-sm sm:text-lg max-w-xl mx-auto px-4 sm:px-0">{t('menu.subtitle')}</p>
        {tableId && (
          <div className="mt-4 sm:mt-6 inline-flex items-center gap-2 sm:gap-3 bg-primary/15 border border-primary/30 px-4 sm:px-6 py-2 sm:py-3 rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs sm:text-sm">Dine-in at <strong className="font-serif text-base sm:text-lg">Table {tableNumber}</strong></span>
          </div>
        )}
      </section>

      {/* FILTERS — sticky only on desktop; scroll naturally on mobile */}
      <section
        ref={filtersRef}
        className="container mx-auto md:sticky md:top-16 md:z-40 md:bg-background/95 md:backdrop-blur-md py-3 sm:py-4 md:border-y md:border-border"
      >
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('menu.search')}
              className="pl-10 h-11"
            />
          </div>
          {/* Categories — horizontal scroll on mobile, wrap on desktop */}
          <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible scrollbar-hide">
            <div className="flex gap-2 md:flex-wrap min-w-max md:min-w-0">
              <button
                onClick={() => setCategory('all')}
                className={`shrink-0 px-3.5 md:px-4 h-9 md:h-11 rounded-full md:rounded-md text-xs md:text-sm border transition whitespace-nowrap ${category === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent hover:text-accent-foreground'}`}
              >
                {t('menu.all')}
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`shrink-0 px-3.5 md:px-4 h-9 md:h-11 rounded-full md:rounded-md text-xs md:text-sm border transition whitespace-nowrap ${category === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent hover:text-accent-foreground'}`}
                >
                  {lang === 'lt' ? c.name_lt : c.name}
                </button>
              ))}
            </div>
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="hidden md:block h-11 px-3 rounded-md text-sm bg-background border border-border"
          >
            <option value="popular">{t('menu.sort_popular')}</option>
            <option value="price_asc">{t('menu.sort_price_asc')}</option>
            <option value="price_desc">{t('menu.sort_price_desc')}</option>
          </select>
        </div>
        {/* Dietary chips — horizontal scroll on mobile + sort selector inline */}
        <div className="mt-3 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible scrollbar-hide">
          <div className="flex gap-2 md:flex-wrap min-w-max md:min-w-0 items-center">
            {dietaryFilters.map(f => {
              const Icon = f.icon
              return (
                <button
                  key={f.key}
                  onClick={() => setDietary(f.key)}
                  className={`shrink-0 px-3 h-8 rounded-full text-xs flex items-center gap-1.5 border transition whitespace-nowrap ${dietary === f.key ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-accent'}`}
                >
                  {Icon && <Icon className="h-3 w-3" />} {f.label}
                </button>
              )
            })}
            {/* Mobile-only sort: compact pill */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="md:hidden shrink-0 h-8 pl-3 pr-7 rounded-full text-xs bg-background border border-border"
              aria-label="Sort"
            >
              <option value="popular">{t('menu.sort_popular')}</option>
              <option value="price_asc">{t('menu.sort_price_asc')}</option>
              <option value="price_desc">{t('menu.sort_price_desc')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* MOBILE COMPACT STICKY BAR — appears only after primary filters scroll off */}
      <div
        className={`md:hidden fixed left-0 right-0 top-16 z-40 transition-all duration-300 ${
          showCompactBar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-background/95 backdrop-blur-md border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('menu.search')}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="shrink-0 h-9 px-3 rounded-md border border-border bg-background flex items-center gap-1.5 text-xs"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {category !== 'all' || dietary !== 'all' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              ) : null}
            </button>
          </div>
          {/* Horizontal category chips inside compact bar */}
          <div className="-mx-4 px-4 mt-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 min-w-max">
              <button
                onClick={() => setCategory('all')}
                className={`shrink-0 px-3 h-7 rounded-full text-[11px] border transition whitespace-nowrap ${category === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
              >
                {t('menu.all')}
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`shrink-0 px-3 h-7 rounded-full text-[11px] border transition whitespace-nowrap ${category === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
                >
                  {lang === 'lt' ? c.name_lt : c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE FILTERS BOTTOM SHEET */}
      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label="Close filters"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-full bg-background border-t border-border rounded-t-2xl p-5 pb-8 space-y-5 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg">Filters</h3>
              <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close" className="p-1 rounded-full hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Dietary</p>
              <div className="flex gap-2 flex-wrap">
                {dietaryFilters.map(f => {
                  const Icon = f.icon
                  return (
                    <button
                      key={f.key}
                      onClick={() => setDietary(f.key)}
                      className={`px-3 h-9 rounded-full text-xs flex items-center gap-1.5 border transition ${dietary === f.key ? 'bg-foreground text-background border-foreground' : 'border-border'}`}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />} {f.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Sort by</p>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="w-full h-11 px-3 rounded-md text-sm bg-background border border-border"
              >
                <option value="popular">{t('menu.sort_popular')}</option>
                <option value="price_asc">{t('menu.sort_price_asc')}</option>
                <option value="price_desc">{t('menu.sort_price_desc')}</option>
              </select>
            </div>
            <Button onClick={() => setMobileFiltersOpen(false)} className="w-full h-11">
              Show dishes
            </Button>
          </div>
        </div>
      )}

      {/* DISHES */}
      <section className="container mx-auto py-8 sm:py-12 pb-32 sm:pb-24">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-sm bg-muted shimmer" />
            ))}
          </div>
        ) : dishes.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">{t('menu.empty')}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dishes.map(d => (
              <Card key={d.id} className="group overflow-hidden bg-card border-border hover:luxury-shadow transition-all duration-500">
                <Link href={`/menu/${d.id}`}>
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img src={d.image_url} alt={d.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    {d.bestseller && (
                      <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-1 rounded-sm flex items-center gap-1">
                        <Star className="h-3 w-3" /> {t('menu.bestseller')}
                      </span>
                    )}
                    <div className="absolute top-3 right-3 flex gap-1">
                      {d.dietary_tags?.includes('veg') && <span className="bg-green-700/90 text-white p-1 rounded-sm"><Leaf className="h-3 w-3" /></span>}
                      {d.dietary_tags?.includes('gluten-free') && <span className="bg-amber-700/90 text-white p-1 rounded-sm"><WheatOff className="h-3 w-3" /></span>}
                      {d.spice_level > 0 && <span className="bg-red-700/90 text-white p-1 rounded-sm"><Flame className="h-3 w-3" /></span>}
                    </div>
                    {/* Favorite heart — visible to all but only persists for logged-in users */}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!user) { toast('Log in to save favorites', { description: 'Create an account to keep dishes for later.' }); return }
                        const res = await toggleFavorite(d.id)
                        toast.success(res?.favorited ? 'Saved to favorites' : 'Removed from favorites')
                      }}
                      aria-label="Toggle favorite"
                      className="absolute bottom-3 right-3 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                    >
                      <Heart className={`h-4 w-4 ${user && (user.favorites || []).includes(d.id) ? 'fill-primary text-primary' : 'text-foreground'}`} />
                    </button>
                  </div>
                </Link>
                <div className="p-5">
                  <Link href={`/menu/${d.id}`}>
                    <h3 className="font-serif text-2xl mb-2 group-hover:text-primary transition-colors">{lang === 'lt' ? d.name_lt : d.name}</h3>
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">{lang === 'lt' ? d.description_lt : d.description}</p>
                  <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {d.prep_time} {t('menu.prep')}</span>
                    <span className="font-serif text-2xl text-primary">€{d.price.toFixed(2)}</span>
                  </div>
                  <Button onClick={() => { addToCart(d); toast.success(`${lang === 'lt' ? d.name_lt : d.name} → ${t('nav.cart')}`) }} className="w-full">
                    <Plus className="h-4 w-4" /> {t('menu.add')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Footer />
      <RequestWaiterButton />
    </div>
  )
}

export default MenuPage

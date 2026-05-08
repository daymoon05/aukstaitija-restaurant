'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useApp } from '@/lib/AppContext'
import { Plus, Minus, Heart, ArrowLeft, Flame, Leaf, WheatOff, Clock, ChefHat } from 'lucide-react'
import { toast } from 'sonner'

function DishDetail() {
  const params = useParams()
  const router = useRouter()
  const { t, lang, addToCart } = useApp()
  const [dish, setDish] = useState(null)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    fetch(`/api/dishes/${params.id}`).then(r => r.json()).then(d => {
      if (!d.error) setDish(d)
      try {
        const favs = JSON.parse(localStorage.getItem('aukstaitija_favs') || '[]')
        setFavorite(favs.includes(params.id))
      } catch {}
    })
  }, [params.id])

  const toggleFavorite = () => {
    try {
      const favs = JSON.parse(localStorage.getItem('aukstaitija_favs') || '[]')
      const next = favs.includes(params.id) ? favs.filter(f => f !== params.id) : [...favs, params.id]
      localStorage.setItem('aukstaitija_favs', JSON.stringify(next))
      setFavorite(next.includes(params.id))
    } catch {}
  }

  if (!dish) return (
    <div className="min-h-screen bg-background"><Navbar /><div className="container py-32 text-center text-muted-foreground">Loading...</div></div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-10">
        <button onClick={() => router.back()} className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="grid md:grid-cols-2 gap-12">
          <div className="aspect-square rounded-sm overflow-hidden luxury-shadow">
            <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              {dish.bestseller && <span className="text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-1 rounded-sm">{t('menu.bestseller')}</span>}
              {dish.dietary_tags?.map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-widest border border-border px-2 py-1 rounded-sm">{t(`menu.${tag}`)}</span>
              ))}
            </div>
            <h1 className="font-serif text-5xl md:text-6xl mb-3">{lang === 'lt' ? dish.name_lt : dish.name}</h1>
            <p className="text-2xl text-primary font-serif mb-6">€{dish.price.toFixed(2)}</p>
            <p className="text-muted-foreground leading-relaxed mb-6">{lang === 'lt' ? dish.description_lt : dish.description}</p>

            <div className="flex gap-6 mb-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {dish.prep_time} {t('menu.prep')}</span>
              {dish.spice_level > 0 && <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-red-500" /> Spice {dish.spice_level}/3</span>}
              <span className="flex items-center gap-2"><ChefHat className="h-4 w-4 text-primary" /> Chef’s pick</span>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <Card className="p-4 bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ingredients</p>
                <ul className="text-sm space-y-1">
                  {dish.ingredients?.map(i => <li key={i}>• {i}</li>)}
                </ul>
              </Card>
              <Card className="p-4 bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Allergens</p>
                <ul className="text-sm space-y-1">
                  {dish.allergens?.length ? dish.allergens.map(i => <li key={i}>• {i}</li>) : <li className="text-muted-foreground">None</li>}
                </ul>
              </Card>
            </div>

            {dish.nutrition && (
              <div className="grid grid-cols-4 gap-2 mb-8">
                {Object.entries(dish.nutrition).map(([k, v]) => (
                  <div key={k} className="text-center p-3 border border-border rounded-sm">
                    <p className="font-serif text-xl">{v}{k !== 'calories' ? 'g' : ''}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('cart.notes')}
              className="w-full p-3 mb-4 bg-background border border-border rounded-md text-sm min-h-[60px]"
            />

            <div className="flex items-center gap-4">
              <div className="flex items-center border border-border rounded-md">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-12 hover:bg-accent"><Minus className="h-4 w-4 mx-auto" /></button>
                <span className="w-12 text-center font-medium">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-10 h-12 hover:bg-accent"><Plus className="h-4 w-4 mx-auto" /></button>
              </div>
              <Button size="lg" className="flex-1 h-12" onClick={() => { addToCart({ ...dish }, qty, notes); toast.success('Added to cart') }}>
                {t('menu.add')} — €{(dish.price * qty).toFixed(2)}
              </Button>
              <Button size="icon" variant="outline" className="h-12 w-12" onClick={toggleFavorite}>
                <Heart className={`h-4 w-4 ${favorite ? 'fill-primary text-primary' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default DishDetail

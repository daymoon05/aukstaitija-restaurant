'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApp } from '@/lib/AppContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Utensils, MapPin, ArrowRight, X, CheckCircle2, AlertTriangle } from 'lucide-react'

function TableQrPage() {
  const params = useParams()
  const router = useRouter()
  const { setTableId } = useApp()
  const [state, setState] = useState({ loading: true, table: null, session: null, error: null, created: false })

  useEffect(() => {
    // Auto-occupy: hit start-session as soon as the QR is scanned.
    fetch(`/api/tables/${params.id}/start-session`, { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setState({ loading: false, error: d.error })
          return
        }
        setTableId(d.table.id, d.table.number)
        setState({ loading: false, table: d.table, session: d.session, created: d.created })
      })
      .catch(err => setState({ loading: false, error: 'Network error' }))
  }, [params.id])

  if (state.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-primary/15 rounded-full flex items-center justify-center mb-4">
            <Utensils className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Welcoming you to your table…</p>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-3" />
          <h1 className="font-serif text-2xl mb-2">We couldn't seat you</h1>
          <p className="text-sm text-muted-foreground mb-6">{state.error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.push('/menu')}>Browse menu anyway</Button>
            <Button onClick={() => router.push('/')}>Home</Button>
          </div>
        </Card>
      </div>
    )
  }

  const { table, created } = state

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-md w-full text-center luxury-shadow">
        <div className="w-20 h-20 mx-auto bg-primary/15 rounded-full flex items-center justify-center mb-5">
          {created ? <CheckCircle2 className="h-10 w-10 text-primary" /> : <Utensils className="h-10 w-10 text-primary" />}
        </div>
        <p className="text-primary text-xs uppercase tracking-[0.4em] mb-2">Welcome to</p>
        <h1 className="font-serif text-5xl mb-2">Aukštaitija</h1>
        <p className="text-muted-foreground mb-6">Modern Lithuanian Fine Dining · Kaunas</p>

        <div className="py-4 border-y border-border my-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">You are seated at</p>
          <p className="font-serif text-7xl gold-gradient my-2">Table {table.number}</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" /> {table.section} · seats {table.capacity}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          {created ? 'Your table is now reserved for you' : 'Session resumed — welcome back'}
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Browse the menu, build your order, and we'll bring it directly to <strong>Table {table.number}</strong>.
        </p>

        <Button size="lg" className="w-full h-12" onClick={() => router.push('/menu')}>
          Open Menu <ArrowRight className="h-4 w-4 ml-1" />
        </Button>

        <p className="text-xs text-muted-foreground mt-4">Need help? Wave to your server.</p>
      </Card>
    </div>
  )
}

export default TableQrPage

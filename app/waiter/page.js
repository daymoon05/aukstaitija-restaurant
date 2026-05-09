'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Utensils, Clock, Bell, BellOff, Volume2, LogOut, ArrowLeft, Hand, CheckCircle2, PackageCheck, Flame, ChefHat } from 'lucide-react'
import { toast } from 'sonner'

function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function OrderCard({ order, now, onPickUp, onServe }) {
  const readyMs = order.ready_at ? now - new Date(order.ready_at).getTime() : 0
  const createdMs = now - new Date(order.created_at).getTime()
  const inService = order.serve_status === 'picked_up_by_waiter'
  const pickedMs = order.waiter_picked_up_at ? now - new Date(order.waiter_picked_up_at).getTime() : 0

  const isLate = readyMs > 5 * 60 * 1000 && !inService
  const isUrgent = readyMs > 8 * 60 * 1000 && !inService

  const accent = inService
    ? 'border-l-blue-500'
    : (isUrgent ? 'border-l-destructive' : isLate ? 'border-l-amber-500' : 'border-l-green-500')

  return (
    <Card className={`p-4 border-l-4 ${accent} ${isUrgent ? 'ring-2 ring-destructive animate-pulse' : isLate ? 'ring-1 ring-amber-500' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-sm font-bold tracking-wide text-sm">
              TABLE {order.table_number || '?'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">#{order.order_number}</span>
            {order.priority && (
              <span className="text-destructive flex items-center gap-1 text-xs font-semibold">
                <Flame className="h-3 w-3" /> PRIORITY
              </span>
            )}
            {inService && (
              <span className="bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-sm text-[11px] font-bold tracking-wide flex items-center gap-1">
                <Hand className="h-3 w-3" /> IN SERVICE
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {order.customer?.name || 'Guest'}
          </p>
        </div>
        <div className="text-right">
          {!inService ? (
            <>
              <div className={`flex items-center gap-1 font-mono text-xl ${isUrgent ? 'text-destructive' : isLate ? 'text-amber-500' : 'text-foreground'}`}>
                <Clock className="h-4 w-4" />
                {formatElapsed(readyMs)}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">since ready</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 font-mono text-xl text-blue-500">
                <Hand className="h-4 w-4" />
                {formatElapsed(pickedMs)}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">in your hand</p>
            </>
          )}
        </div>
      </div>

      <div className="my-3 space-y-1.5">
        {order.items?.map((i, idx) => (
          <div key={idx} className="flex items-baseline gap-2 text-sm">
            <span className="font-bold text-primary text-base w-6">{i.quantity}×</span>
            <span className="flex-1">{i.name}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="my-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-sm text-xs">
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠ Notes:</p>
          <p className="italic">{order.notes}</p>
        </div>
      )}
      {order.items?.some(i => i.notes) && (
        <div className="my-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-sm text-xs">
          {order.items.filter(i => i.notes).map((i, idx) => (
            <p key={idx} className="italic">"{i.notes}" <span className="text-muted-foreground">— {i.name}</span></p>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mb-2">
        Ordered {formatElapsed(createdMs)} ago
      </p>

      <div className="flex gap-2 mt-3">
        {!inService ? (
          <Button onClick={() => onPickUp(order.id)} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white">
            <Hand className="h-4 w-4 mr-1" /> Pick Up
          </Button>
        ) : (
          <Button onClick={() => onPickUp(order.id)} variant="outline" className="h-11" title="Put back on pass">
            ← Back
          </Button>
        )}
        <Button
          onClick={() => onServe(order.id)}
          className={`flex-1 h-11 ${inService ? 'bg-primary hover:bg-primary/90' : 'bg-green-600 hover:bg-green-700 text-white'}`}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Served
        </Button>
      </div>
    </Card>
  )
}

function WaiterPage() {
  const [token, setToken] = useState('')
  const [pwd, setPwd] = useState('')
  const [orders, setOrders] = useState([])
  const [now, setNow] = useState(Date.now())
  const [audioOn, setAudioOn] = useState(true)
  const prevReadyIdsRef = useRef(new Set())
  const audioCtxRef = useRef(null)

  useEffect(() => {
    const t = localStorage.getItem('aukstaitija_admin_token') || ''
    if (t) setToken(t)
  }, [])

  // Tick every second so the "since ready" timer stays alive without re-fetch.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  const playChime = () => {
    if (!audioOn) return
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioCtxRef.current
      // Two-tone "ding" — distinct from kitchen's single tone so staff can tell apart.
      const tones = [660, 990]
      tones.forEach((freq, idx) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq
        g.gain.value = 0.0001
        o.start(ctx.currentTime + idx * 0.18)
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + idx * 0.18 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.18 + 0.25)
        o.stop(ctx.currentTime + idx * 0.18 + 0.3)
      })
    } catch (e) {}
  }

  const fetchOrders = async (tk = token) => {
    if (!tk) return
    const res = await fetch('/api/waiter/orders', { headers: { 'x-admin-token': tk } })
    if (res.status === 401) { setToken(''); localStorage.removeItem('aukstaitija_admin_token'); return }
    const data = await res.json()
    if (Array.isArray(data)) {
      // Detect new freshly-ready orders to chime — only count orders not yet
      // picked up by a waiter; once "in service" we shouldn't keep dinging.
      const readyIds = new Set(data.filter(o => o.serve_status !== 'picked_up_by_waiter').map(o => o.id))
      const prev = prevReadyIdsRef.current
      let hasNew = false
      readyIds.forEach(id => { if (!prev.has(id)) hasNew = true })
      if (hasNew && prev.size > 0) {
        playChime()
        toast.success('🍽️ New plate ready to serve!')
      }
      prevReadyIdsRef.current = readyIds
      setOrders(data)
    }
  }

  // Poll every 4s (same cadence as kitchen so they stay in sync).
  useEffect(() => {
    if (!token) return
    fetchOrders(token)
    const i = setInterval(() => fetchOrders(token), 4000)
    return () => clearInterval(i)
  }, [token])

  const pickUp = async (id) => {
    const res = await fetch(`/api/orders/${id}/waiter-pickup`, {
      method: 'POST', headers: { 'x-admin-token': token },
    })
    if (res.ok) { toast.success('Picked up'); fetchOrders() }
    else toast.error('Failed to pick up')
  }

  const serve = async (id) => {
    const res = await fetch(`/api/orders/${id}/served`, {
      method: 'POST', headers: { 'x-admin-token': token },
    })
    if (res.ok) { toast.success('Served — enjoy!'); fetchOrders() }
    else toast.error('Failed to mark served')
  }

  const login = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) })
    const data = await res.json()
    if (data.token) {
      setToken(data.token); localStorage.setItem('aukstaitija_admin_token', data.token)
    } else { toast.error('Invalid password') }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6">
          <div className="text-center mb-6">
            <Utensils className="h-12 w-12 mx-auto text-primary mb-3" />
            <h1 className="font-serif text-3xl">Waiter</h1>
            <p className="text-xs text-muted-foreground mt-1">Aukštaitija · Service floor</p>
          </div>
          <form onSubmit={login} className="space-y-3">
            <div><Label>Password</Label><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="mt-2" required /></div>
            <Button type="submit" className="w-full h-11">Sign in</Button>
            <p className="text-xs text-muted-foreground text-center">Demo: <code className="text-primary">admin123</code></p>
          </form>
        </Card>
      </div>
    )
  }

  const readyToServe = orders.filter(o => o.serve_status !== 'picked_up_by_waiter')
  const inService = orders.filter(o => o.serve_status === 'picked_up_by_waiter')

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <Utensils className="h-6 w-6 text-primary" />
            <h1 className="font-serif text-2xl">Waiter</h1>
            <span className="hidden md:inline text-xs uppercase tracking-[0.3em] text-muted-foreground">{new Date(now).toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/kitchen" className="hidden sm:block">
              <Button variant="outline" size="sm"><ChefHat className="h-4 w-4 mr-1" /> Kitchen</Button>
            </Link>
            <Button variant="outline" size="icon" onClick={() => setAudioOn(!audioOn)} title="Toggle alert sound">
              {audioOn ? <Volume2 className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => { setToken(''); localStorage.removeItem('aukstaitija_admin_token') }}>
              <LogOut className="h-4 w-4 mr-1" /> Exit
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4 border-l-4 border-l-green-500">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ready to serve</p>
            <p className="font-serif text-4xl">{readyToServe.length}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-blue-500">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">In service</p>
            <p className="font-serif text-4xl">{inService.length}</p>
          </Card>
        </div>

        {/* Two column board */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-serif text-2xl flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-green-500" /> Ready to serve
              </h2>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{readyToServe.length}</span>
            </div>
            <div className="space-y-3">
              {readyToServe.length === 0 && (
                <div className="text-center text-sm text-muted-foreground p-12 border border-dashed border-border rounded-md">
                  <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Nothing on the pass right now
                </div>
              )}
              {readyToServe.map(o => (
                <OrderCard key={o.id} order={o} now={now} onPickUp={pickUp} onServe={serve} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-serif text-2xl flex items-center gap-2">
                <Hand className="h-5 w-5 text-blue-500" /> In service
              </h2>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{inService.length}</span>
            </div>
            <div className="space-y-3">
              {inService.length === 0 && (
                <p className="text-sm text-muted-foreground p-12 text-center border border-dashed border-border rounded-md">
                  No plates in hand
                </p>
              )}
              {inService.map(o => (
                <OrderCard key={o.id} order={o} now={now} onPickUp={pickUp} onServe={serve} />
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Live · auto-refreshes every 4s · Ready &gt; 5min amber, &gt; 8min flashes red
        </p>
      </div>
    </div>
  )
}

export default WaiterPage

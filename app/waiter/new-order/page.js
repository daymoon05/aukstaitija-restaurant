'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, AlertTriangle, Flame, Gift,
  Users, MapPin, Clock, Utensils, ChevronRight, Check, Loader2, X,
} from 'lucide-react'
import { toast } from 'sonner'

// Two-step waiter-assisted ordering flow.
// Step 1 — pick the table the order is for.
// Step 2 — build the basket (search/filter dishes, set qty + per-item notes,
//          optional ticket-level flags) and submit. The backend will either
//          create a new dine-in order or merge into the table's still-open
//          ticket; the success toast makes the distinction explicit.

function StateBadge({ state }) {
  const palette = {
    seated: 'bg-rose-500/20 text-rose-200 ring-rose-500/30',
    occupied: 'bg-amber-500/20 text-amber-200 ring-amber-500/30',
    arrived: 'bg-sky-500/20 text-sky-200 ring-sky-500/30',
    available: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30',
  }[state] || 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/30'
  return (
    <span className={`text-[10px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full ring-1 ${palette}`}>
      {state}
    </span>
  )
}

function TablePicker({ token, onPick }) {
  const [tables, setTables] = useState([])
  const [includeAvailable, setIncludeAvailable] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const qs = includeAvailable ? '?include=available' : ''
      const res = await fetch(`/api/waiter/active-tables${qs}`, {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      setTables(Array.isArray(data?.tables) ? data.tables : [])
    } catch {
      setTables([])
    } finally { setLoading(false) }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [includeAvailable])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-serif text-3xl text-zinc-50">Pick a table</h2>
          <p className="text-sm text-zinc-400 mt-1">Select where the order is going.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-amber-400 h-4 w-4"
            checked={includeAvailable}
            onChange={e => setIncludeAvailable(e.target.checked)}
          />
          Show empty tables (walk-in)
        </label>
      </div>

      {loading && (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-zinc-500">
          <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" /> Loading tables…
        </div>
      )}

      {!loading && tables.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-zinc-300 font-medium">No active tables right now.</p>
          <p className="text-zinc-500 text-sm mt-1">
            Toggle <span className="text-amber-300">Show empty tables</span> to seat a walk-in.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map(t => {
          const customer = t.session?.customer_name || t.reservation?.name
          const guests = t.session?.guests || t.reservation?.guests
          return (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="text-left p-5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-900 border border-white/10 hover:border-amber-400/50 transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-serif text-3xl text-zinc-50 leading-none">Table {t.number}</p>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 mt-1.5 flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> {t.section} · <Users className="h-3 w-3" /> {t.capacity}
                  </p>
                </div>
                <StateBadge state={t.state} />
              </div>

              {customer && (
                <p className="text-sm text-zinc-300">
                  {customer} {guests ? <span className="text-zinc-500">· {guests} guests</span> : null}
                </p>
              )}

              {t.active_order && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs flex items-center justify-between">
                  <span className="text-zinc-400">
                    #{t.active_order.order_number} · {t.active_order.item_count} items
                    {t.active_order.order_source === 'qr' && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wider text-sky-300/90">via QR</span>
                    )}
                  </span>
                  {t.active_order.mergeable && (
                    <span className="text-amber-300 text-[10px] uppercase tracking-wider">Mergeable</span>
                  )}
                </div>
              )}

              {!t.active_order && t.state === 'available' && (
                <p className="text-xs text-zinc-500 mt-3 italic">Empty — start a walk-in.</p>
              )}

              <div className="mt-4 flex items-center justify-end text-amber-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition">
                Take order <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OrderBuilder({ token, table, waiterName, onBack, onSubmitted }) {
  const [dishes, setDishes] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [cart, setCart] = useState([]) // { id, name, price, quantity, notes }
  const [flags, setFlags] = useState({ urgent: false, allergy: false, complimentary: false })
  const [submitting, setSubmitting] = useState(false)
  const [editingNotesFor, setEditingNotesFor] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/dishes').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()).catch(() => []),
    ]).then(([d, c]) => {
      setDishes(Array.isArray(d) ? d : [])
      setCategories(Array.isArray(c) ? c : [])
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dishes.filter(d => {
      if (d.is_available === false) return false
      if (activeCat !== 'all' && d.category_id !== activeCat) return false
      if (q && !(d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q))) return false
      return true
    })
  }, [dishes, search, activeCat])

  const addItem = (dish) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === dish.id && !c.notes)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, { id: dish.id, name: dish.name, price: dish.price, quantity: 1, notes: '' }]
    })
  }

  const updateQty = (idx, delta) => {
    setCart(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], quantity: Math.max(1, next[idx].quantity + delta) }
      return next
    })
  }

  const removeItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx))

  const updateNotes = (idx, notes) => {
    setCart(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], notes }
      return next
    })
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = +(subtotal * 0.21).toFixed(2)
  const total = +(subtotal + tax).toFixed(2)

  const submit = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one item')
      return
    }
    if (!waiterName) {
      toast.error('Set your waiter name first')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          table_id: table.id,
          order_source: 'waiter',
          waiter: { name: waiterName },
          flags,
          merge_active: true,
          items: cart,
          customer: table.session?.customer_name
            ? { name: table.session.customer_name }
            : (table.reservation?.name ? { name: table.reservation.name } : undefined),
          guests: table.session?.guests || table.reservation?.guests || 2,
        }),
      })
      const data = await res.json()
      if (data.id) {
        if (data.merged) {
          toast.success(`Items appended to active order #${data.order_number}`)
        } else {
          toast.success(`Order #${data.order_number} sent to kitchen`)
        }
        onSubmitted(data)
      } else {
        toast.error(data.error || 'Could not place order')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div>
        {/* Table summary */}
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <button onClick={onBack} className="text-xs text-zinc-400 hover:text-amber-300 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="h-3 w-3" /> Change table
            </button>
            <h2 className="font-serif text-3xl text-zinc-50">Table {table.number}</h2>
            <p className="text-sm text-zinc-400 mt-1">
              {table.section} · {table.capacity} seats
              {table.session?.customer_name && (
                <span> · <span className="text-zinc-200">{table.session.customer_name}</span></span>
              )}
              {table.active_order?.mergeable && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300">
                  · will merge into #{table.active_order.order_number}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search + categories */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search dishes…"
              className="pl-9 bg-zinc-900/60 border-white/10 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveCat('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              activeCat === 'all'
                ? 'bg-amber-400 text-zinc-950'
                : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/10'
            }`}
          >All</button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeCat === c.id
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/10'
              }`}
            >{c.name}</button>
          ))}
        </div>

        {/* Dish grid */}
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-zinc-500 py-12">No dishes match.</p>
          )}
          {filtered.map(d => (
            <button
              key={d.id}
              onClick={() => addItem(d)}
              className="text-left p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 hover:border-amber-400/40 transition flex gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-100 truncate">{d.name}</p>
                {d.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{d.description}</p>
                )}
                <p className="text-amber-300 font-mono text-sm mt-2">€{Number(d.price).toFixed(2)}</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-amber-400/15 ring-1 ring-amber-400/30 flex items-center justify-center shrink-0 self-center">
                <Plus className="h-4 w-4 text-amber-300" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart side panel */}
      <Card className="bg-zinc-900/60 border-white/10 p-5 h-fit lg:sticky lg:top-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-zinc-50 flex items-center gap-2">
            <Utensils className="h-4 w-4 text-amber-300" /> Order
          </h3>
          <span className="text-xs text-zinc-500">{cart.length} {cart.length === 1 ? 'line' : 'lines'}</span>
        </div>

        {cart.length === 0 && (
          <p className="text-sm text-zinc-500 italic py-4 text-center">Tap a dish to add it.</p>
        )}

        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 -mr-1">
          {cart.map((it, idx) => (
            <div key={idx} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-zinc-100 flex-1">{it.name}</p>
                <button onClick={() => removeItem(idx)} className="text-zinc-500 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 bg-zinc-950/60 border border-white/10 rounded-lg p-0.5">
                  <button onClick={() => updateQty(idx, -1)} className="h-7 w-7 rounded-md text-zinc-300 hover:bg-white/10 flex items-center justify-center">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center font-mono text-sm text-zinc-100">{it.quantity}</span>
                  <button onClick={() => updateQty(idx, 1)} className="h-7 w-7 rounded-md text-zinc-300 hover:bg-white/10 flex items-center justify-center">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="font-mono text-sm text-amber-300">€{(it.price * it.quantity).toFixed(2)}</span>
              </div>
              {editingNotesFor === idx ? (
                <Textarea
                  autoFocus
                  value={it.notes}
                  onChange={e => updateNotes(idx, e.target.value)}
                  onBlur={() => setEditingNotesFor(null)}
                  placeholder="No onions, extra spicy…"
                  className="mt-2 text-xs bg-zinc-950/60 border-white/10 text-zinc-100 min-h-[60px]"
                />
              ) : (
                <button
                  onClick={() => setEditingNotesFor(idx)}
                  className={`mt-2 w-full text-left text-xs px-2 py-1.5 rounded border border-dashed transition ${
                    it.notes
                      ? 'border-amber-400/30 bg-amber-400/5 text-amber-200 italic'
                      : 'border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20'
                  }`}
                >
                  {it.notes || '+ Add note'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Flags */}
        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Order flags</p>
          <FlagToggle
            active={flags.urgent}
            onClick={() => setFlags(f => ({ ...f, urgent: !f.urgent }))}
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Urgent"
            color="red"
          />
          <FlagToggle
            active={flags.allergy}
            onClick={() => setFlags(f => ({ ...f, allergy: !f.allergy }))}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Allergy"
            color="amber"
          />
          <FlagToggle
            active={flags.complimentary}
            onClick={() => setFlags(f => ({ ...f, complimentary: !f.complimentary }))}
            icon={<Gift className="h-3.5 w-3.5" />}
            label="Complimentary"
            color="emerald"
          />
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t border-white/10 text-sm space-y-1.5">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span className="font-mono">€{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>VAT 21%</span>
            <span className="font-mono">€{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-50 font-semibold pt-1.5 border-t border-white/10">
            <span>Total</span>
            <span className="font-mono text-amber-300 text-lg">€{total.toFixed(2)}</span>
          </div>
        </div>

        <Button
          onClick={submit}
          disabled={submitting || cart.length === 0}
          className="w-full mt-4 h-12 bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/25 border-0"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
          ) : (
            <><Check className="h-4 w-4 mr-2" />
              {table.active_order?.mergeable ? 'Append to order' : 'Send to kitchen'}
            </>
          )}
        </Button>
      </Card>
    </div>
  )
}

function FlagToggle({ active, onClick, icon, label, color }) {
  const palette = {
    red: active ? 'bg-red-500/20 text-red-200 ring-red-500/40' : 'bg-white/[0.03] text-zinc-400 ring-white/10',
    amber: active ? 'bg-amber-500/20 text-amber-200 ring-amber-500/40' : 'bg-white/[0.03] text-zinc-400 ring-white/10',
    emerald: active ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40' : 'bg-white/[0.03] text-zinc-400 ring-white/10',
  }[color]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg ring-1 transition text-xs font-medium ${palette}`}
    >
      {icon} {label}
      {active && <Check className="h-3 w-3 ml-auto" />}
    </button>
  )
}

function NewOrderPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [pwd, setPwd] = useState('')
  const [waiterName, setWaiterName] = useState('')
  const [waiterPrompt, setWaiterPrompt] = useState(false)
  const [pickedTable, setPickedTable] = useState(null)
  const [submitted, setSubmitted] = useState(null)

  useEffect(() => {
    const t = localStorage.getItem('aukstaitija_admin_token') || ''
    if (t) setToken(t)
    const w = localStorage.getItem('aukstaitija_waiter_name') || ''
    setWaiterName(w)
    if (!w && t) setWaiterPrompt(true)
  }, [])

  const saveWaiter = (name) => {
    const trimmed = name.trim().slice(0, 60)
    if (!trimmed) return
    localStorage.setItem('aukstaitija_waiter_name', trimmed)
    setWaiterName(trimmed)
    setWaiterPrompt(false)
  }

  const login = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    })
    const d = await res.json()
    if (d.token) {
      localStorage.setItem('aukstaitija_admin_token', d.token)
      setToken(d.token)
      if (!waiterName) setWaiterPrompt(true)
    } else {
      toast.error('Wrong password')
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm bg-zinc-900/80 border-white/10 p-8">
          <h1 className="font-serif text-2xl text-zinc-50 mb-1">Waiter access</h1>
          <p className="text-sm text-zinc-500 mb-5">Enter your staff PIN to take an order.</p>
          <Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="PIN" className="mb-3" />
          <Button onClick={login} className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950">Sign in</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-white/10 bg-zinc-950/90 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/waiter" className="text-zinc-400 hover:text-amber-300 inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex-1 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80">Aukštaitija</p>
            <p className="font-serif text-lg text-zinc-50 leading-tight">New Order</p>
          </div>
          <button
            onClick={() => setWaiterPrompt(true)}
            className="text-xs text-zinc-400 hover:text-amber-300"
            title="Change waiter name"
          >
            {waiterName ? <>👤 {waiterName}</> : 'Set name'}
          </button>
        </div>
      </header>

      {/* Waiter-name prompt */}
      {waiterPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-zinc-900 border-white/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-xl text-zinc-50">Who's taking this order?</h3>
              {waiterName && (
                <button onClick={() => setWaiterPrompt(false)} className="text-zinc-500 hover:text-zinc-200">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Your name</Label>
            <Input
              autoFocus
              defaultValue={waiterName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveWaiter(e.target.value) }}
              placeholder="e.g. Petras"
              id="waiter-name-input"
            />
            <Button
              onClick={() => saveWaiter(document.getElementById('waiter-name-input').value)}
              className="w-full mt-4 bg-amber-400 hover:bg-amber-300 text-zinc-950"
            >Save</Button>
            <p className="text-[10px] text-zinc-500 mt-3">
              Stored on this device only. Used for the order activity log.
            </p>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-6 py-6">
        {submitted ? (
          <Card className="max-w-md mx-auto bg-zinc-900/70 border-emerald-500/20 ring-1 ring-emerald-500/30 p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40 flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-emerald-300" />
            </div>
            <h2 className="font-serif text-2xl text-zinc-50 mb-1">
              {submitted.merged ? 'Items appended' : 'Order sent'}
            </h2>
            <p className="text-sm text-zinc-400">
              #{submitted.order_number} · Table {submitted.table_number || pickedTable?.number}
              {submitted.merged && (
                <span className="block mt-1 text-amber-300 text-xs uppercase tracking-wider">
                  Merged into existing dine-in ticket
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => router.push('/waiter')}
                className="bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
              >Back to dashboard</Button>
              <Button
                onClick={() => { setSubmitted(null); setPickedTable(null) }}
                className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold"
              >Take another order</Button>
            </div>
          </Card>
        ) : !pickedTable ? (
          <TablePicker token={token} onPick={setPickedTable} />
        ) : (
          <OrderBuilder
            token={token}
            table={pickedTable}
            waiterName={waiterName}
            onBack={() => setPickedTable(null)}
            onSubmitted={setSubmitted}
          />
        )}
      </div>
    </div>
  )
}

export default NewOrderPage

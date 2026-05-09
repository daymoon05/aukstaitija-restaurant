'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, Users, Receipt, Brush, X, UserPlus, CheckCircle2, QrCode, Printer,
  RefreshCcw, LogOut, Pencil, Plus, Trash2, Check, MapPin, ChefHat,
} from 'lucide-react'
import { toast } from 'sonner'

const STATUS = {
  available:      { label: 'Available',     dot: 'bg-emerald-500', tile: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300' },
  reserved:       { label: 'Reserved',      dot: 'bg-sky-500',     tile: 'bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/40 text-sky-900 dark:text-sky-300' },
  occupied:       { label: 'Occupied',      dot: 'bg-rose-500',    tile: 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300' },
  cleaning:      { label: 'Cleaning',      dot: 'bg-amber-500',   tile: 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300' },
  out_of_service: { label: 'Out of Service', dot: 'bg-zinc-400',    tile: 'bg-zinc-100 dark:bg-zinc-500/10 border-zinc-300 dark:border-zinc-500/40 text-zinc-500 line-through' },
}

const SECTIONS_DEFAULT = ['Window', 'Main Hall', 'Private Room', 'Terrace', 'Bar']

function FloorPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [tables, setTables] = useState([])
  const [selected, setSelected] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [showQr, setShowQr] = useState(null)
  const [showWalkin, setShowWalkin] = useState(null)
  const [showBill, setShowBill] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)

  useEffect(() => {
    const t = localStorage.getItem('aukstaitija_admin_token') || ''
    if (!t) { router.push('/admin'); return }
    setToken(t)
  }, [router])

  const adminFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token, ...(options.headers || {}) },
    })
    if (res.status === 401) { localStorage.removeItem('aukstaitija_admin_token'); router.push('/admin'); return null }
    return res.json().catch(() => ({}))
  }

  const load = async () => {
    if (!token) return
    const r = await fetch('/api/tables', { headers: { 'x-admin-token': token } })
    const d = await r.json()
    if (Array.isArray(d)) setTables(d)
  }

  useEffect(() => {
    if (!token) return
    load()
    if (editMode) return
    const i = setInterval(load, 8000)
    return () => clearInterval(i)
  }, [token, editMode])

  const action = async (tableId, action) => {
    const r = await adminFetch(`/api/tables/${tableId}/${action}`, { method: 'POST', body: '{}' })
    if (r?.error) toast.error(r.error); else toast.success('Done')
    load()
    if (selected) {
      const fresh = await fetch(`/api/tables/${tableId}`).then(r => r.json())
      setSelected(fresh)
    }
  }

  const openTable = async (table) => {
    if (editMode) { setShowEdit(table); return }
    const r = await fetch(`/api/tables/${table.id}`)
    const d = await r.json()
    setSelected(d)
  }

  const deleteTable = async (table) => {
    if (!confirm(`Delete Table ${table.number}? This cannot be undone.`)) return
    const r = await adminFetch(`/api/tables/${table.id}`, { method: 'DELETE' })
    if (r?.error) toast.error(r.error)
    else { toast.success('Table deleted'); load() }
  }

  // Group by section preserving the ordered set
  const sections = {}
  tables.forEach(t => { (sections[t.section || 'Other'] = sections[t.section || 'Other'] || []).push(t) })
  Object.keys(sections).forEach(k => sections[k].sort((a, b) => a.x - b.x || a.number - b.number))

  const stats = Object.fromEntries(Object.keys(STATUS).map(k => [k, tables.filter(t => t.status === k).length]))

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="container mx-auto h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <div>
              <h1 className="font-serif text-2xl leading-none">Floor Map</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{tables.length} tables · {Object.keys(sections).length} sections</p>
            </div>
          </div>
          <div className="flex gap-2">
            {editMode && (
              <Button onClick={() => setShowAdd(true)} className="bg-primary"><Plus className="h-4 w-4 mr-1" /> Add Table</Button>
            )}
            <Button variant={editMode ? 'default' : 'outline'} onClick={() => { setEditMode(!editMode); setSelected(null) }}>
              {editMode ? <><Check className="h-4 w-4 mr-1" /> Done</> : <><Pencil className="h-4 w-4 mr-1" /> Edit Layout</>}
            </Button>
            {!editMode && (
              <>
                <Link href="/admin/qr-sheet"><Button variant="outline" size="icon" title="Print QR codes"><QrCode className="h-4 w-4" /></Button></Link>
                <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCcw className="h-4 w-4" /></Button>
                <Link href="/kitchen"><Button variant="outline" size="icon" title="Kitchen"><ChefHat className="h-4 w-4" /></Button></Link>
              </>
            )}
          </div>
        </div>

        {/* Compact status bar */}
        <div className="border-t border-border bg-card/40">
          <div className="container mx-auto py-2 flex items-center gap-6 overflow-x-auto text-xs">
            {Object.entries(STATUS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 whitespace-nowrap">
                <span className={`h-2 w-2 rounded-full ${v.dot}`} />
                <span className="text-muted-foreground">{v.label}</span>
                <span className="font-semibold">{stats[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto py-8">
        {editMode && (
          <div className="mb-6 p-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-sm flex items-center gap-3">
            <Pencil className="h-4 w-4 text-primary" />
            <span>Edit mode — click any table to edit its details, or use the trash icon to remove.</span>
          </div>
        )}

        {Object.keys(sections).length === 0 && (
          <div className="text-center py-24">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No tables yet</p>
            <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add your first table</Button>
          </div>
        )}

        {Object.entries(sections).map(([section, ts]) => (
          <div key={section} className="mb-10">
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="font-serif text-2xl">{section}</h2>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{ts.length} {ts.length === 1 ? 'table' : 'tables'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {ts.map(t => {
                const s = STATUS[t.status] || STATUS.available
                return (
                  <div key={t.id} className="relative group">
                    <button
                      onClick={() => openTable(t)}
                      className={`w-full aspect-square p-3 rounded-lg border-2 text-left transition hover:scale-[1.02] ${s.tile}`}
                    >
                      <div className="flex flex-col h-full">
                        <p className="font-serif text-3xl leading-none">T{t.number}</p>
                        <div className="flex items-center gap-1 text-xs mt-1 opacity-80">
                          <Users className="h-3 w-3" /> {t.capacity}
                        </div>
                        <div className="mt-auto pt-1">
                          <p className="text-[10px] uppercase tracking-wider opacity-80">{s.label}</p>
                        </div>
                      </div>
                    </button>
                    {t.active_orders > 0 && !editMode && (
                      <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold shadow">
                        {t.active_orders}
                      </span>
                    )}
                    {t.upcoming_reservation && t.status === 'reserved' && !editMode && (
                      <span className="absolute top-2 right-2 text-[9px] bg-sky-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">{t.upcoming_reservation.time}</span>
                    )}
                    {editMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTable(t) }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
              {editMode && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="aspect-square rounded-lg border-2 border-dashed border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition flex flex-col items-center justify-center"
                  title="Add table"
                >
                  <Plus className="h-6 w-6 mb-1" />
                  <span className="text-xs">Add</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected table modal — view/action mode */}
      {selected && !editMode && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-primary text-xs uppercase tracking-[0.4em]">{selected.section}</p>
                <h2 className="font-serif text-4xl">Table {selected.number}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                  <span><Users className="h-3 w-3 inline mr-1" /> seats {selected.capacity}</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${STATUS[selected.status]?.dot}`} /> {STATUS[selected.status]?.label}
                  </span>
                </p>
              </div>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>

            {selected.active_session && (
              <div className="p-4 mb-4 rounded-lg bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/30">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Active session</p>
                <p className="font-serif text-xl">{selected.active_session.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.active_session.guests || '?'} guests · since {new Date(selected.active_session.started_at).toLocaleTimeString()} · origin: {selected.active_session.origin}
                </p>
                {selected.orders?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{selected.orders.length} orders</p>
                    {selected.orders.map(o => (
                      <div key={o.id} className="text-sm flex justify-between">
                        <span>#{o.order_number} · {o.status}</span>
                        <span className="font-serif">€{o.total?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selected.upcoming_reservations?.length > 0 && (
              <div className="p-4 mb-4 rounded-lg bg-sky-50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/30">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Upcoming reservations</p>
                {selected.upcoming_reservations.map(r => (
                  <div key={r.id} className="text-sm py-1 flex justify-between">
                    <span>{r.date} {r.time} · {r.name}</span>
                    <span className="text-muted-foreground">{r.guests}p</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {selected.status === 'available' && (
                <>
                  <Button onClick={() => setShowWalkin(selected.id)} className="col-span-2 h-11"><UserPlus className="h-4 w-4 mr-1" /> Seat Walk-in</Button>
                  <Button variant="outline" onClick={() => setShowQr(selected)} className="h-11"><QrCode className="h-4 w-4 mr-1" /> Show QR</Button>
                  <Button variant="outline" onClick={async () => { await adminFetch(`/api/tables/${selected.id}`, { method: 'PUT', body: JSON.stringify({ status: 'out_of_service' }) }); load(); setSelected(null) }} className="h-11">Set Out of Service</Button>
                </>
              )}
              {selected.status === 'occupied' && (
                <>
                  <Button onClick={() => setShowBill(selected.id)} className="h-11"><Receipt className="h-4 w-4 mr-1" /> Generate Bill</Button>
                  <Button variant="outline" onClick={() => action(selected.id, 'close')} className="h-11"><LogOut className="h-4 w-4 mr-1" /> Close (no payment)</Button>
                </>
              )}
              {selected.status === 'cleaning' && (
                <Button onClick={() => action(selected.id, 'cleaned')} className="col-span-2 h-11 bg-emerald-600 hover:bg-emerald-700"><Brush className="h-4 w-4 mr-1" /> Cleaning Complete</Button>
              )}
              {selected.status === 'reserved' && selected.upcoming_reservations?.[0] && (
                <Button onClick={async () => { await adminFetch(`/api/reservations/${selected.upcoming_reservations[0].id}/checkin`, { method: 'POST', body: JSON.stringify({ table_id: selected.id }) }); load(); setSelected(null); toast.success('Checked in') }} className="col-span-2 h-11 bg-sky-600 hover:bg-sky-700">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Check-in {selected.upcoming_reservations[0].name}
                </Button>
              )}
              {selected.status === 'out_of_service' && (
                <Button onClick={async () => { await adminFetch(`/api/tables/${selected.id}`, { method: 'PUT', body: JSON.stringify({ status: 'available' }) }); load(); setSelected(null) }} className="col-span-2 h-11">Set Back Available</Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {showAdd && <AddTableModal token={token} sections={Object.keys(sections)} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load() }} />}
      {showEdit && <EditTableModal table={showEdit} token={token} sections={Object.keys(sections)} onClose={() => setShowEdit(null)} onDone={() => { setShowEdit(null); load() }} />}
      {showWalkin && <WalkinModal tableId={showWalkin} token={token} onClose={() => setShowWalkin(null)} onDone={() => { setShowWalkin(null); setSelected(null); load() }} />}
      {showQr && <QrModal table={showQr} onClose={() => setShowQr(null)} />}
      {showBill && <BillModal tableId={showBill} token={token} onClose={() => setShowBill(null)} onPaid={() => { setShowBill(null); setSelected(null); load() }} />}
    </div>
  )
}

function AddTableModal({ token, sections, onClose, onDone }) {
  const [form, setForm] = useState({ number: '', capacity: 4, section: sections[0] || 'Main Hall', x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    const res = await fetch('/api/tables', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) toast.error(d.error); else { toast.success(`Table ${d.number} added`); onDone() }
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-2xl mb-1">Add Table</h3>
        <p className="text-xs text-muted-foreground mb-5">Leave number blank to auto-assign the next number.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Table number</Label><Input type="number" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="auto" className="mt-2" /></div>
          <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="mt-2" /></div>
          <div className="col-span-2"><Label>Section</Label>
            <Input list="sections" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="mt-2" placeholder="e.g. Main Hall" />
            <datalist id="sections">
              {[...new Set([...SECTIONS_DEFAULT, ...sections])].map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div><Label>Position X (col)</Label><Input type="number" value={form.x} onChange={e => setForm({ ...form, x: e.target.value })} className="mt-2" /></div>
          <div><Label>Position Y (row)</Label><Input type="number" value={form.y} onChange={e => setForm({ ...form, y: e.target.value })} className="mt-2" /></div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="flex-1">{saving ? 'Saving...' : 'Add Table'}</Button>
        </div>
      </Card>
    </div>
  )
}

function EditTableModal({ table, token, sections, onClose, onDone }) {
  const [form, setForm] = useState({ number: table.number, capacity: table.capacity, section: table.section || 'Main Hall', x: table.x ?? 0, y: table.y ?? 0, status: table.status })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    const res = await fetch(`/api/tables/${table.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) toast.error(d.error); else { toast.success('Saved'); onDone() }
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-2xl mb-1">Edit Table {table.number}</h3>
        <p className="text-xs text-muted-foreground mb-5">{table.id}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Number</Label><Input type="number" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="mt-2" /></div>
          <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="mt-2" /></div>
          <div className="col-span-2"><Label>Section</Label>
            <Input list="sections-edit" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="mt-2" />
            <datalist id="sections-edit">
              {[...new Set([...SECTIONS_DEFAULT, ...sections])].map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div><Label>Position X</Label><Input type="number" value={form.x} onChange={e => setForm({ ...form, x: e.target.value })} className="mt-2" /></div>
          <div><Label>Position Y</Label><Input type="number" value={form.y} onChange={e => setForm({ ...form, y: e.target.value })} className="mt-2" /></div>
          <div className="col-span-2"><Label>Status</Label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-2 h-9 w-full px-3 bg-background border border-border rounded-md text-sm">
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="flex-1">{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </Card>
    </div>
  )
}

function WalkinModal({ tableId, token, onClose, onDone }) {
  const [guests, setGuests] = useState(2)
  const [name, setName] = useState('Walk-in')
  const submit = async () => {
    const res = await fetch(`/api/tables/${tableId}/walkin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ guests, customer_name: name })
    })
    const d = await res.json()
    if (d.ok) { toast.success('Seated!'); onDone() } else { toast.error(d.error || 'Failed') }
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-2xl mb-4">Seat Walk-in</h3>
        <div className="space-y-3">
          <div><Label>Customer name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-2" /></div>
          <div><Label>Guests</Label>
            <select value={guests} onChange={e => setGuests(parseInt(e.target.value))} className="mt-2 h-9 w-full px-3 bg-background border border-border rounded-md text-sm">
              {[1,2,3,4,5,6,7,8,10,12].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} className="flex-1">Seat</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function QrModal({ table, onClose }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/table/${table.id}` : `/table/${table.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-3xl mb-1">Table {table.number}</h3>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Scan to order</p>
        <div className="bg-white p-4 rounded-md inline-block">
          <img src={qrUrl} alt="QR Code" className="w-64 h-64" />
        </div>
        <p className="text-xs text-muted-foreground mt-3 break-all">{url}</p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => window.print()} className="flex-1"><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button onClick={onClose} className="flex-1">Close</Button>
        </div>
      </Card>
    </div>
  )
}

function BillModal({ tableId, token, onClose, onPaid }) {
  const [bill, setBill] = useState(null)
  const [paying, setPaying] = useState(false)
  useEffect(() => {
    fetch(`/api/tables/${tableId}/bill`, { headers: { 'x-admin-token': token } }).then(r => r.json()).then(setBill)
  }, [tableId, token])
  const pay = async (method) => {
    setPaying(true)
    const res = await fetch(`/api/tables/${tableId}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ payment_method: method }) })
    const d = await res.json()
    setPaying(false)
    if (d.ok) { toast.success('Paid! Table set to cleaning.'); onPaid() } else toast.error(d.error || 'Failed')
  }
  if (!bill) return null
  if (bill.error) return <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}><Card className="p-6"><p>{bill.error}</p><Button onClick={onClose} className="mt-3">Close</Button></Card></div>
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <p className="text-primary text-xs uppercase tracking-[0.4em] mb-1">Aukštaitija · Kaunas</p>
          <p className="font-serif text-2xl">Bill — Table {bill.table.number}</p>
          <p className="text-xs text-muted-foreground">Invoice {bill.invoice_number}</p>
          <p className="text-xs text-muted-foreground">{bill.session.customer_name} · {bill.session.guests} guests</p>
        </div>
        <div className="border-y border-border py-4 space-y-1.5 my-4">
          {bill.items.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{i.quantity}× {i.name}</span>
              <span>€{(i.price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>€{bill.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>VAT (21%)</span><span>€{bill.tax.toFixed(2)}</span></div>
        </div>
        <div className="flex justify-between font-serif text-3xl mt-4 pt-4 border-t border-border">
          <span>Total</span><span className="text-primary">€{bill.total.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-6">
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button onClick={() => pay('cash')} disabled={paying} className="bg-emerald-600 hover:bg-emerald-700">Mark Paid (Cash)</Button>
          <Button onClick={() => pay('card')} disabled={paying} className="bg-emerald-600 hover:bg-emerald-700">Mark Paid (Card)</Button>
        </div>
      </Card>
    </div>
  )
}

export default FloorPage

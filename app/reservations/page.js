'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useApp } from '@/lib/AppContext'
import { Calendar, Users, Clock, Check, Phone } from 'lucide-react'
import { toast } from 'sonner'

function ReservationsPage() {
  const { t } = useApp()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('')
  const [guests, setGuests] = useState(2)
  const [form, setForm] = useState({ name: '', phone: '', email: '', special_requests: '' })
  const [slots, setSlots] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(null)

  useEffect(() => {
    fetch(`/api/reservations/availability?date=${date}`).then(r => r.json()).then(d => {
      setSlots(d.slots || [])
      setTime('')
    })
  }, [date])

  const submit = async (e) => {
    e.preventDefault()
    if (!time || !form.name || !form.phone) { toast.error('Please complete all required fields'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, date, time, guests })
      })
      const data = await res.json()
      if (data.id) { setConfirmed(data) } else { toast.error(data.error) }
    } finally { setSubmitting(false) }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-20 max-w-xl text-center">
          <div className="w-20 h-20 mx-auto bg-primary/15 rounded-full flex items-center justify-center mb-6">
            <Check className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-serif text-5xl mb-3">{t('res.success')}</h1>
          <p className="text-muted-foreground mb-6">{t('res.conf')} {confirmed.confirmation}</p>
          <Card className="p-6 text-left">
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {confirmed.date} at {confirmed.time}</p>
              <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {confirmed.guests} guests</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {confirmed.phone}</p>
              {confirmed.special_requests && <p className="italic text-muted-foreground">"{confirmed.special_requests}"</p>}
            </div>
          </Card>
          <Button className="mt-8" onClick={() => { setConfirmed(null); setForm({ name: '', phone: '', email: '', special_requests: '' }); setTime('') }}>Make another reservation</Button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-12">
        <div className="text-center mb-12">
          <p className="text-primary text-xs uppercase tracking-[0.4em] mb-3">Reserve</p>
          <h1 className="font-serif text-5xl md:text-7xl mb-4">{t('res.title')}</h1>
          <p className="text-muted-foreground text-lg">{t('res.subtitle')}</p>
        </div>
        <form onSubmit={submit} className="max-w-3xl mx-auto">
          <Card className="p-8 bg-card">
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div>
                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {t('res.date')}</Label>
                <Input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> {t('res.guests')}</Label>
                <select value={guests} onChange={e => setGuests(parseInt(e.target.value))} className="mt-2 h-9 w-full px-3 bg-background border border-input rounded-md text-sm">
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <Label className="flex items-center gap-2 mb-3"><Clock className="h-4 w-4" /> {t('res.time')}</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 mb-6">
              {slots.length === 0 && <p className="col-span-full text-sm text-muted-foreground">{t('res.no_slots')}</p>}
              {slots.map(s => (
                <button key={s.time} type="button" disabled={s.available === 0}
                  onClick={() => setTime(s.time)}
                  className={`p-2 text-sm rounded-md border transition ${time === s.time ? 'bg-primary text-primary-foreground border-primary' : s.available === 0 ? 'opacity-30 cursor-not-allowed border-border' : 'border-border hover:bg-accent hover:text-accent-foreground'}`}>
                  {s.time}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div><Label>{t('res.name')} *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-2" /></div>
              <div><Label>{t('res.phone')} *</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required className="mt-2" /></div>
              <div className="sm:col-span-2"><Label>{t('res.email')}</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-2" /></div>
              <div className="sm:col-span-2"><Label>{t('res.special')}</Label>
                <textarea value={form.special_requests} onChange={e => setForm({...form, special_requests: e.target.value})} className="w-full mt-2 p-3 bg-background border border-border rounded-md text-sm min-h-[80px]" />
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full h-12" disabled={submitting || !time}>
              {submitting ? t('res.booking') : t('res.book')}
            </Button>
          </Card>
        </form>
      </div>
      <Footer />
    </div>
  )
}

export default ReservationsPage

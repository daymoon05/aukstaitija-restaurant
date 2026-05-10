'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/AppContext'
import { toast } from 'sonner'
import {
  Bell, BellOff, Check, Clock, MapPin, Users, Calendar,
  Hourglass, ShieldCheck, Table as TableIcon, UserCheck, Flag, ChevronLeft,
  Sparkles, BadgeCheck,
} from 'lucide-react'

// The customer-visible reservation lifecycle. Order matters — used to
// compute "current step" indices and decide what to reveal in the UI.
const TIMELINE_STEPS = [
  { key: 'pending', label: 'Pending', icon: Hourglass, blurb: 'We\'ve got your request' },
  { key: 'confirmed', label: 'Confirmed', icon: ShieldCheck, blurb: 'Reservation locked in' },
  { key: 'table_assigned', label: 'Table Assigned', icon: TableIcon, blurb: 'Your table is ready' },
  { key: 'arrived', label: 'Arrived', icon: UserCheck, blurb: 'Welcome to Aukštaitija' },
  { key: 'checked_in', label: 'Checked In', icon: BadgeCheck, blurb: 'Seated and dining' },
  { key: 'completed', label: 'Completed', icon: Flag, blurb: 'Thank you for visiting' },
]

const REVEAL_AFTER_INDEX = TIMELINE_STEPS.findIndex(s => s.key === 'table_assigned')

// Map raw status → the subtitle the customer should see at the top of the
// reservation card. Keep this concise — full details live in the body.
const STATUS_HEADLINES = {
  pending: 'Reservation received',
  confirmed: 'Reservation confirmed. Table will be assigned shortly.',
  table_assigned: 'Your table is ready',
  arrived: 'You\'ve arrived — welcome',
  checked_in: 'You\'re seated. Enjoy your meal',
  completed: 'Visit complete — thank you',
  cancelled: 'Reservation cancelled',
  no_show: 'Marked as no-show',
}

function statusIndex(status) {
  const idx = TIMELINE_STEPS.findIndex(s => s.key === status)
  return idx === -1 ? 0 : idx
}

function formatRelative(dt) {
  if (!dt) return ''
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dt).toLocaleDateString()
}

function ReservationTimeline({ reservation }) {
  const currentIdx = statusIndex(reservation.status)
  const interrupted = reservation.status === 'cancelled' || reservation.status === 'no_show'

  return (
    <div className="relative">
      {/* connector line */}
      <div className="absolute left-0 right-0 top-5 h-0.5 bg-border" />
      <div
        className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-700 ease-out"
        style={{ width: `${(Math.max(currentIdx, 0) / (TIMELINE_STEPS.length - 1)) * 100}%` }}
      />

      <ol className="relative grid grid-cols-6 gap-2">
        {TIMELINE_STEPS.map((step, idx) => {
          const Icon = step.icon
          const isDone = idx < currentIdx && !interrupted
          const isCurrent = idx === currentIdx && !interrupted
          const isUpcoming = idx > currentIdx || interrupted

          return (
            <li key={step.key} className="flex flex-col items-center text-center">
              <div
                className={[
                  'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  isDone && 'bg-primary border-primary text-primary-foreground shadow-md',
                  isCurrent && 'bg-primary/15 border-primary text-primary ring-4 ring-primary/20 animate-pulse',
                  isUpcoming && 'bg-background border-border text-muted-foreground',
                ].filter(Boolean).join(' ')}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <p
                className={[
                  'mt-2 text-[10px] sm:text-xs font-medium uppercase tracking-wider leading-tight',
                  isCurrent && 'text-primary',
                  isDone && 'text-foreground',
                  isUpcoming && 'text-muted-foreground/60',
                ].filter(Boolean).join(' ')}
              >
                {step.label}
              </p>
            </li>
          )
        })}
      </ol>

      {interrupted && (
        <p className="mt-4 text-center text-xs uppercase tracking-wider text-destructive">
          {reservation.status === 'cancelled' ? 'Reservation cancelled' : 'Marked as no-show'}
        </p>
      )}
    </div>
  )
}

function ReservationCard({ reservation, onUpdate }) {
  const statusIdx = statusIndex(reservation.status)
  const tableRevealed = statusIdx >= REVEAL_AFTER_INDEX &&
    reservation.status !== 'cancelled' &&
    reservation.status !== 'no_show'
  const headline = STATUS_HEADLINES[reservation.status] || 'Reservation'

  // Pull table number from id (`t4` → `T4`). Section comes from notification meta
  // when present, otherwise from the embedded table doc if backend ever attaches it.
  const tableLabel = reservation.table_id
    ? `T${reservation.table_id.replace(/^t/, '')}`
    : null
  const sectionLabel = reservation.table_section || reservation.section || null

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
              #{reservation.confirmation}
            </p>
            <h3 className="font-serif text-2xl">{headline}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {reservation.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {reservation.time}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                {reservation.guests} {reservation.guests === 1 ? 'guest' : 'guests'}
              </span>
            </div>
          </div>

          {!tableRevealed && reservation.status !== 'cancelled' && reservation.status !== 'no_show' && (
            <div className="px-3 py-2 rounded-md border border-dashed border-primary/40 bg-primary/5 text-xs text-primary flex items-center gap-2 max-w-[260px]">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Table will be revealed once our manager assigns one.</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 border-b border-border">
        <ReservationTimeline reservation={reservation} />
      </div>

      {/* Reveal block — table number + section + time + guest count */}
      {tableRevealed && tableLabel && (
        <div className="p-6 border-b border-border bg-primary/5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary mb-3">
            Your table
          </p>
          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Table</p>
              <p className="font-serif text-3xl text-primary">{tableLabel}</p>
            </div>
            {sectionLabel && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Section
                </p>
                <p className="font-medium">{sectionLabel}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Time
              </p>
              <p className="font-medium">{reservation.time}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Party
              </p>
              <p className="font-medium">
                {reservation.guests} {reservation.guests === 1 ? 'guest' : 'guests'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer — extra info */}
      <div className="p-6 grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Seating preference</p>
          <p>{reservation.seating_preference || 'No preference'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Occasion</p>
          <p>{reservation.occasion || 'Casual dining'}</p>
        </div>
        {(reservation.special_requests || reservation.notes) && (
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
            <p className="italic text-muted-foreground">
              "{reservation.special_requests || reservation.notes}"
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

function NotificationCenter({ notifications, unreadCount, onMarkRead, onMarkAllRead, loading }) {
  const hasUnread = unreadCount > 0
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className={`h-5 w-5 ${hasUnread ? 'text-primary' : 'text-muted-foreground'}`} />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-serif text-lg">Notifications</h2>
            <p className="text-xs text-muted-foreground">
              {hasUnread ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {hasUnread && (
          <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Loading…</p>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <BellOff className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              You're all caught up. We'll notify you the moment your table is assigned.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map(n => (
              <li
                key={n.id}
                className={`p-4 transition-colors ${!n.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/30'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{n.title}</p>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {formatRelative(n.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    {!n.read && (
                      <button
                        onClick={() => onMarkRead(n.id)}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function ProfileReservationsPage() {
  const router = useRouter()
  const { user, authChecked } = useApp()
  const [reservations, setReservations] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotif, setLoadingNotif] = useState(true)
  const [loadingRes, setLoadingRes] = useState(true)

  useEffect(() => {
    if (authChecked && !user) router.replace('/login?next=/profile/reservations')
  }, [user, authChecked, router])

  const loadReservations = useCallback(async () => {
    setLoadingRes(true)
    try {
      const res = await fetch('/api/users/me/reservations', { credentials: 'include' })
      if (res.ok) setReservations(await res.json())
    } finally {
      setLoadingRes(false)
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } finally {
      setLoadingNotif(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadReservations()
    loadNotifications()
    // Poll every 20s so a freshly-assigned table appears without a manual refresh.
    const id = setInterval(() => {
      loadReservations()
      loadNotifications()
    }, 20000)
    return () => clearInterval(id)
  }, [user, loadReservations, loadNotifications])

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    const res = await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
    if (res.ok) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    }
  }

  // Hydrate reservation cards with section info pulled from the matching
  // table-assigned notification (the backend stores section in meta).
  const reservationsWithSection = useMemo(() => {
    return reservations.map(r => {
      const note = notifications.find(n => n.reservation_id === r.id && n.type === 'reservation_table_assigned')
      if (note?.meta?.section && !r.table_section) {
        return { ...r, table_section: note.meta.section }
      }
      return r
    })
  }, [reservations, notifications])

  const upcoming = useMemo(() => {
    return reservationsWithSection.filter(r => {
      const past = new Date(`${r.date}T${r.time}`).getTime() < Date.now() - 4 * 60 * 60 * 1000
      return !past && !['cancelled', 'no_show', 'completed'].includes(r.status)
    })
  }, [reservationsWithSection])

  const past = useMemo(() => {
    return reservationsWithSection.filter(r => {
      const isPast = new Date(`${r.date}T${r.time}`).getTime() < Date.now() - 4 * 60 * 60 * 1000
      return isPast || ['cancelled', 'no_show', 'completed'].includes(r.status)
    })
  }, [reservationsWithSection])

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-12 max-w-5xl px-4">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/profile" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-sm">
            <ChevronLeft className="h-4 w-4" /> Back to profile
          </Link>
        </div>
        <div className="mb-10">
          <p className="text-primary text-xs uppercase tracking-[0.4em] mb-2">My reservations</p>
          <h1 className="font-serif text-4xl md:text-5xl">Your dining timeline</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Track each booking from request to seated. Your table number appears here the moment our manager assigns it.
          </p>
        </div>

        {/* Notification center */}
        <div className="mb-10">
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            loading={loadingNotif}
          />
        </div>

        {/* Upcoming reservations */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Upcoming
          </h2>
          {loadingRes ? (
            <Card className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></Card>
          ) : upcoming.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No upcoming reservations yet.
              </p>
              <Link href="/reservations">
                <Button>Book a table</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-6">
              {upcoming.map(r => (
                <ReservationCard key={r.id} reservation={r} onUpdate={loadReservations} />
              ))}
            </div>
          )}
        </section>

        {/* Past reservations */}
        {past.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl mb-4 flex items-center gap-2 text-muted-foreground">
              <Flag className="h-5 w-5" />
              Past
            </h2>
            <div className="space-y-4">
              {past.slice(0, 10).map(r => (
                <Card key={r.id} className="p-5 opacity-80">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                        #{r.confirmation}
                      </p>
                      <p className="font-medium">{r.date} at {r.time}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.guests} {r.guests === 1 ? 'guest' : 'guests'} · {r.seating_preference || 'No preference'}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-accent text-accent-foreground">
                      {r.status?.replace('_', ' ')}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default ProfileReservationsPage

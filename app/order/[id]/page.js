'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Card } from '@/components/ui/card'
import { useApp } from '@/lib/AppContext'
import { CheckCircle2, ChefHat, Clock, Truck, PackageCheck, Circle } from 'lucide-react'

const STAGES = ['received', 'preparing', 'ready', 'out', 'delivered']
const ICONS = { received: Clock, preparing: ChefHat, ready: PackageCheck, out: Truck, delivered: CheckCircle2 }

function OrderTrack() {
  const params = useParams()
  const { t, lang } = useApp()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(false)

  const fetchOrder = async () => {
    const res = await fetch(`/api/orders/${params.id}`)
    const data = await res.json()
    if (data.error) setError(true)
    else setOrder(data)
  }

  useEffect(() => {
    fetchOrder()
    const i = setInterval(fetchOrder, 5000)
    return () => clearInterval(i)
  }, [params.id])

  if (error) return (
    <div className="min-h-screen bg-background"><Navbar /><div className="container py-32 text-center text-muted-foreground">Order not found</div></div>
  )
  if (!order) return <div className="min-h-screen bg-background"><Navbar /></div>

  const filteredStages = order.type === 'delivery' ? STAGES : STAGES.filter(s => s !== 'out')
  const currentIdx = filteredStages.indexOf(order.status === 'cancelled' ? 'received' : order.status)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-primary text-xs uppercase tracking-[0.4em] mb-3">Order #{order.order_number}</p>
            <h1 className="font-serif text-5xl mb-3">{t(`status.${order.status}`)}</h1>
            <p className="text-muted-foreground">Estimated time: {order.items.reduce((m, i) => Math.max(m, 30), 30)} minutes</p>
          </div>

          {/* Progress */}
          <Card className="p-8 mb-6 bg-card">
            <div className="flex items-center justify-between">
              {filteredStages.map((s, i) => {
                const Icon = ICONS[s]
                const active = i <= currentIdx
                const isCurrent = i === currentIdx
                return (
                  <div key={s} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && <div className={`absolute right-1/2 top-5 h-px w-full ${active ? 'bg-primary' : 'bg-border'}`} />}
                    <div className={`relative w-10 h-10 rounded-full flex items-center justify-center z-10 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-4 ring-primary/30 animate-pulse' : ''}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className={`mt-2 text-[10px] uppercase tracking-wider text-center ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{t(`status.${s}`)}</p>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Items */}
          <Card className="p-6 bg-card">
            <h3 className="font-serif text-2xl mb-4">Order Details</h3>
            <div className="space-y-2 text-sm mb-4">
              {order.items.map(i => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.quantity}× {lang === 'lt' ? i.name_lt : i.name}</span>
                  <span>€{(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Subtotal</span><span>€{order.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>VAT (21%)</span><span>€{order.tax.toFixed(2)}</span></div>
              {order.delivery_fee > 0 && <div className="flex justify-between"><span>Delivery</span><span>€{order.delivery_fee.toFixed(2)}</span></div>}
              {order.discount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>-€{order.discount.toFixed(2)}</span></div>}
            </div>
            <div className="flex justify-between font-serif text-xl mt-4 pt-4 border-t border-border">
              <span>Total</span><span className="text-primary">€{order.total.toFixed(2)}</span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Payment: {order.payment_method === 'cash' ? 'Cash on delivery / Pay at restaurant' : order.payment_method}</p>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">This page updates live every 5 seconds.</p>
          <div className="text-center mt-4">
            <Link href="/menu" className="text-sm text-primary hover:underline">Order again →</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default OrderTrack

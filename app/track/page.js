'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useApp } from '@/lib/AppContext'

function TrackPage() {
  const { t } = useApp()
  const router = useRouter()
  const [id, setId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!id && !orderNumber) return
    if (id) { router.push(`/order/${id}`); return }
    // Try by order number
    setErr(t('track.not_found') + ' — use the full order ID from your confirmation page')
  }
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-20 max-w-md">
        <h1 className="font-serif text-5xl mb-8 text-center">{t('track.title')}</h1>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Input value={id} onChange={e => setId(e.target.value)} placeholder="Order ID (UUID from confirmation)" />
            <Button type="submit" className="w-full h-11">{t('track.track')}</Button>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </form>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default TrackPage

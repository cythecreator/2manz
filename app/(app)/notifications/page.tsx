'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { DuoNotification } from '@/lib/types'
import { formatDistanceToNow } from '@/lib/utils'

export default function NotificationsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('duo_notifications')
        .select(`
          *,
          triggered_by:triggered_by_user_id(id, name, photos, age),
          target:target_user_id(id, name, photos, age, two_man_id)
        `)
        .eq('notified_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data || [])

      // Mark all as seen
      await supabase
        .from('duo_notifications')
        .update({ seen: true })
        .eq('notified_user_id', user.id)
        .eq('seen', false)

      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'duo_notifications',
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#1E90FF] animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 py-4 border-b border-[#1E90FF10]">
        <h1 className="text-xl font-black">Notifications</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="text-5xl mb-4">🔔</div>
          <h2 className="text-lg font-bold mb-2">No notifications yet</h2>
          <p className="text-white/40 text-sm">When your 2man likes someone, you&apos;ll see it here</p>
        </div>
      ) : (
        <div className="divide-y divide-[#1E90FF08]">
          {notifications.map(n => (
            <NotificationItem key={n.id} notification={n} onTap={() => {
              // Navigate to target profile — we pass as query param and load on discover
              router.push(`/profile/${n.target?.id}`)
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationItem({ notification: n, onTap }: { notification: any; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-start gap-3 px-4 py-4 text-left hover:bg-[#0F2040] transition-colors ${
        !n.seen ? 'bg-[#1E90FF08]' : ''
      }`}
    >
      {/* Avatar stack */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#0F2040] border-2 border-[#0A1628] overflow-hidden absolute top-0 left-0">
          {n.triggered_by?.photos?.[0] ? (
            <Image src={n.triggered_by.photos[0]} alt="" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-[#0F2040] border-2 border-[#0A1628] overflow-hidden absolute bottom-0 right-0">
          {n.target?.photos?.[0] ? (
            <Image src={n.target.photos[0]} alt="" fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">👤</div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm leading-snug">
          <span className="font-bold text-[#1E90FF]">{n.triggered_by?.name || 'Your 2man'}</span>
          {' '}liked someone — check out their 2man{' '}
          <span className="font-bold text-white">{n.target?.name || 'them'}</span>
        </p>
        <p className="text-white/30 text-xs mt-1">{formatDistanceToNow(n.created_at)}</p>
      </div>

      {!n.seen && (
        <div className="w-2 h-2 rounded-full bg-[#1E90FF] flex-shrink-0 mt-1" />
      )}
    </button>
  )
}

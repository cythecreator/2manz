'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav() {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function loadUnread() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('duo_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('notified_user_id', user.id)
        .eq('seen', false)
      setUnread(count || 0)
    }
    loadUnread()

    const channel = supabase
      .channel('nav-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duo_notifications' }, loadUnread)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const tabs = [
    { href: '/discover', label: 'Discover', icon: '🔥' },
    { href: '/notifications', label: 'Alerts', icon: '🔔', badge: unread },
    { href: '/matches', label: 'Matches', icon: '💬' },
    { href: '/profile', label: 'Profile', icon: '👤' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0A1628] border-t border-[#1E90FF15] z-50">
      <div className="flex items-center justify-around px-2 py-3 max-w-md mx-auto">
        {tabs.map(tab => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all relative ${
                active ? 'text-[#1E90FF]' : 'text-white/30'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-1 bg-[#1E90FF] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

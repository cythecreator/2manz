'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from '@/lib/utils'

export default function MatchesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('matches')
        .select(`
          *,
          duo1_user1:duo1_user1_id(id, name, photos, age),
          duo1_user2:duo1_user2_id(id, name, photos, age),
          duo2_user1:duo2_user1_id(id, name, photos, age),
          duo2_user2:duo2_user2_id(id, name, photos, age)
        `)
        .or(`duo1_user1_id.eq.${user.id},duo1_user2_id.eq.${user.id},duo2_user1_id.eq.${user.id},duo2_user2_id.eq.${user.id}`)
        .eq('status', 'matched')
        .order('created_at', { ascending: false })

      setMatches(data || [])
      setLoading(false)
    }
    load()
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
        <h1 className="text-xl font-black">Matches</h1>
        <p className="text-white/40 text-sm mt-0.5">Your double date squad</p>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-lg font-bold mb-2">No matches yet</h2>
          <p className="text-white/40 text-sm">Keep swiping — when all 4 like each other, it&apos;s a match!</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              onTap={() => router.push(`/chat/${match.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, onTap }: { match: any; onTap: () => void }) {
  const users = [match.duo1_user1, match.duo1_user2, match.duo2_user1, match.duo2_user2].filter(Boolean)

  return (
    <button
      onClick={onTap}
      className="w-full bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15] text-left hover:border-[#1E90FF40] transition-colors"
    >
      <div className="flex items-center gap-4">
        {/* 2x2 photo grid */}
        <div className="grid grid-cols-2 gap-1 w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden">
          {users.slice(0, 4).map((u: any, i: number) => (
            <div key={i} className="relative bg-[#0A1628]">
              {u?.photos?.[0] ? (
                <Image src={u.photos[0]} alt="" fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg">👤</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
            <span className="text-[#1E90FF] text-xs font-bold uppercase tracking-wide">Double Date</span>
          </div>
          <div className="flex gap-1 flex-wrap mb-1">
            {[match.duo1_user1, match.duo1_user2].filter(Boolean).map((u: any) => (
              <span key={u.id} className="text-white font-bold text-sm">{u.name}</span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/30 text-xs">×</span>
            {[match.duo2_user1, match.duo2_user2].filter(Boolean).map((u: any) => (
              <span key={u.id} className="text-white/50 text-sm">{u.name}</span>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-1">{formatDistanceToNow(match.created_at)}</p>
        </div>

        <div className="text-[#1E90FF] text-lg">→</div>
      </div>
    </button>
  )
}

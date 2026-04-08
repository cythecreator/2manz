'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserWithPrompts } from '@/lib/types'
import ProfileCard from '@/components/ProfileCard'
import toast from 'react-hot-toast'

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<UserWithPrompts | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [alreadySwiped, setAlreadySwiped] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      const { data } = await supabase
        .from('users')
        .select('*, prompts(*), two_man:two_man_id(*)')
        .eq('id', userId)
        .single()

      setProfile(data as unknown as UserWithPrompts)

      const { data: swipe } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', user.id)
        .eq('swiped_id', userId)
        .maybeSingle()

      setAlreadySwiped(!!swipe)
      setLoading(false)
    }
    load()
  }, [userId, supabase])

  async function handleSwipe(direction: 'like' | 'pass') {
    if (!currentUser || !profile) return
    await supabase.from('swipes').upsert({
      swiper_id: currentUser.id,
      swiped_id: profile.id,
      direction,
    })

    if (direction === 'like') {
      toast.success('Liked!')
    } else {
      toast('Passed')
    }
    setAlreadySwiped(true)
    router.back()
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[#1E90FF] animate-pulse">Loading...</div></div>
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Profile not found</p></div>
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E90FF10]">
        <button onClick={() => router.back()} className="text-white/50 text-xl">←</button>
        <h1 className="text-lg font-black">{profile.name}&apos;s Profile</h1>
      </div>

      <div className="px-4 py-4 max-w-sm mx-auto">
        {alreadySwiped ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">✓</div>
            <p className="text-white/60">Already swiped on this person</p>
          </div>
        ) : (
          <ProfileCard
            user={profile}
            onLike={() => handleSwipe('like')}
            onPass={() => handleSwipe('pass')}
          />
        )}
      </div>
    </div>
  )
}

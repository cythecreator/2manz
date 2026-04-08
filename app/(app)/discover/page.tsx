'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserWithPrompts } from '@/lib/types'
import ProfileCard from '@/components/ProfileCard'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function DiscoverPage() {
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profiles, setProfiles] = useState<UserWithPrompts[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)

  const loadProfiles = useCallback(async (user: any) => {
    // Get already swiped IDs
    const { data: swipes } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', user.id)
    const swipedIds = swipes?.map(s => s.swiped_id) || []

    // Opposite gender
    const oppositeGender = user.gender === 'male' ? 'female' : 'male'

    let query = supabase
      .from('users')
      .select('*, prompts(*), two_man:two_man_id(*)')
      .eq('gender', oppositeGender)
      .eq('onboarding_complete', true)
      .neq('id', user.id)

    if (swipedIds.length > 0) {
      query = query.not('id', 'in', `(${swipedIds.join(',')})`)
    }

    const { data, error } = await query.limit(20)
    if (error) { toast.error('Failed to load profiles'); return }
    setProfiles((data as unknown as UserWithPrompts[]) || [])
    setIndex(0)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile?.onboarding_complete) {
        router.push('/onboarding')
        return
      }

      setCurrentUser(profile)
      await loadProfiles(profile)
      setLoading(false)
    }
    init()
  }, [router, loadProfiles, supabase])

  async function handleSwipe(direction: 'like' | 'pass') {
    if (swiping || !currentUser || !profiles[index]) return
    setSwiping(true)

    const target = profiles[index]

    // Save swipe
    await supabase.from('swipes').upsert({
      swiper_id: currentUser.id,
      swiped_id: target.id,
      direction,
    })

    if (direction === 'like') {
      // Notify current user's 2man about the target's 2man
      if (currentUser.two_man_id && target.two_man_id) {
        await supabase.from('duo_notifications').insert({
          notified_user_id: currentUser.two_man_id,
          triggered_by_user_id: currentUser.id,
          target_user_id: target.two_man_id,
        })
      }

      // Check for full 4-way match
      await checkForMatch(currentUser, target)
    }

    setIndex(i => i + 1)
    setSwiping(false)
  }

  async function checkForMatch(me: any, target: UserWithPrompts) {
    if (!me.two_man_id || !target.two_man_id) return

    // Need: me→target, myTwoMan→targetTwoMan, target→me, targetTwoMan→myTwoMan
    const { data: swipes } = await supabase
      .from('swipes')
      .select('swiper_id, swiped_id, direction')
      .in('swiper_id', [me.id, me.two_man_id, target.id, target.two_man_id])
      .in('swiped_id', [me.id, me.two_man_id, target.id, target.two_man_id])
      .eq('direction', 'like')

    const hasSwipe = (from: string, to: string) =>
      swipes?.some(s => s.swiper_id === from && s.swiped_id === to)

    const allLiked =
      hasSwipe(me.id, target.id) &&
      hasSwipe(me.two_man_id, target.two_man_id) &&
      hasSwipe(target.id, me.id) &&
      hasSwipe(target.two_man_id, me.two_man_id)

    if (allLiked) {
      // Create group chat
      const { data: chat } = await supabase
        .from('group_chats')
        .insert({})
        .select()
        .single()

      // Create match
      await supabase.from('matches').insert({
        duo1_user1_id: me.id,
        duo1_user2_id: me.two_man_id,
        duo2_user1_id: target.id,
        duo2_user2_id: target.two_man_id,
        status: 'matched',
        group_chat_id: chat.id,
      })

      toast.success("🎉 It's a match! Check your matches.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#1E90FF] text-lg font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  // No 2man linked
  if (!currentUser?.two_man_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🤝</div>
        <h2 className="text-2xl font-black mb-3">Link your 2man first</h2>
        <p className="text-white/40 mb-8 leading-relaxed">
          You need to link up with your boy before you can start matching. Find him and send a request.
        </p>
        <Link
          href="/twoman"
          className="bg-[#1E90FF] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#1a7fe0] transition-colors"
        >
          Find My 2Man
        </Link>
      </div>
    )
  }

  const profile = profiles[index]

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🔥</div>
        <h2 className="text-2xl font-black mb-3">You&apos;ve seen everyone</h2>
        <p className="text-white/40 mb-8">Check back later for new profiles</p>
        <button
          onClick={() => loadProfiles(currentUser)}
          className="bg-[#0F2040] border border-[#1E90FF33] text-white font-bold px-8 py-4 rounded-2xl"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1E90FF10]">
        <h1 className="text-xl font-black">
          <span className="text-white">2</span><span className="text-[#1E90FF]"> Manz</span>
        </h1>
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <span>{profiles.length - index} left</span>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 pt-4 pb-4">
        <div className="w-full max-w-sm">
          <ProfileCard
            user={profile}
            onLike={() => handleSwipe('like')}
            onPass={() => handleSwipe('pass')}
          />
        </div>
      </div>
    </div>
  )
}

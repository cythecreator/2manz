'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserWithPrompts } from '@/lib/types'
import { get2ManIds, attachTwoMans } from '@/lib/twoManHelpers'
import ProfileCard from '@/components/ProfileCard'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function DiscoverPage() {
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [myTwoManIds, setMyTwoManIds] = useState<string[]>([])
  const [profiles, setProfiles] = useState<UserWithPrompts[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)

  const loadProfiles = useCallback(async (user: any) => {
    const { data: swipes } = await supabase
      .from('swipes')
      .select('swiped_id')
      .eq('swiper_id', user.id)
    const swipedIds = swipes?.map((s: any) => s.swiped_id) || []

    const oppositeGender = user.gender === 'male' ? 'female' : 'male'

    let query = supabase
      .from('users')
      .select('*, prompts(*)')
      .eq('gender', oppositeGender)
      .eq('onboarding_complete', true)
      .neq('id', user.id)

    if (swipedIds.length > 0) {
      query = query.not('id', 'in', `(${swipedIds.join(',')})`)
    }

    const { data, error } = await query.limit(20)
    if (error) { toast.error('Failed to load profiles'); return }

    // Batch-attach 2mans to all profiles
    const withTwoMans = await attachTwoMans(supabase, data || [])
    setProfiles(withTwoMans as UserWithPrompts[])
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

      const twoManIds = await get2ManIds(supabase, user.id)
      setCurrentUser(profile)
      setMyTwoManIds(twoManIds)
      await loadProfiles(profile)
      setLoading(false)
    }
    init()
  }, [router, loadProfiles, supabase])

  async function handleSwipe(direction: 'like' | 'pass') {
    if (swiping || !currentUser || !profiles[index]) return
    setSwiping(true)

    const target = profiles[index]

    await supabase.from('swipes').upsert({
      swiper_id: currentUser.id,
      swiped_id: target.id,
      direction,
    })

    if (direction === 'like') {
      // Notify ALL of current user's 2mans — target_user_id = target (C)
      // so they can view C's profile and swipe on C's 2mans
      for (const twoManId of myTwoManIds) {
        await supabase.from('duo_notifications').insert({
          notified_user_id: twoManId,
          triggered_by_user_id: currentUser.id,
          target_user_id: target.id,
        })
      }

      // Check if this swipe completes a 4-way match
      await checkForMatch(currentUser.id, target.id)
    }

    setIndex(i => i + 1)
    setSwiping(false)
  }

  /**
   * Check if swiperId→swipedId completes any 4-way match.
   *
   * A match requires: A→C, B→D, C→A, D→B
   * where (A,B) are 2man-linked and (C,D) are 2man-linked.
   *
   * The current swipe can be any of those 4 swipes, so we check both:
   *   - swiper is A (primary), swiped is C: check each B in A's 2mans × D in C's 2mans
   *   - swiper is B (2man), swiped is D: check each A in B's 2mans × C in D's 2mans
   */
  async function checkForMatch(swiperId: string, swipedId: string) {
    const swiperMans = await get2ManIds(supabase, swiperId)
    const swipedMans = await get2ManIds(supabase, swipedId)

    if (swiperMans.length === 0 && swipedMans.length === 0) return

    const allRelevantIds = [swiperId, swipedId, ...swiperMans, ...swipedMans]

    const { data: swipesData } = await supabase
      .from('swipes')
      .select('swiper_id, swiped_id')
      .in('swiper_id', allRelevantIds)
      .in('swiped_id', allRelevantIds)
      .eq('direction', 'like')

    const hasLike = (from: string, to: string) =>
      swipesData?.some((s: any) => s.swiper_id === from && s.swiped_id === to) ?? false

    // Case 1: swiper=A, swiped=C → check B→D, C→A, D→B
    for (const B of swiperMans) {
      for (const D of swipedMans) {
        if (
          hasLike(swiperId, swipedId) &&
          hasLike(B, D) &&
          hasLike(swipedId, swiperId) &&
          hasLike(D, B)
        ) {
          await createMatch(swiperId, B, swipedId, D)
          return
        }
      }
    }

    // Case 2: swiper=B, swiped=D → A is one of B's 2mans, C is one of D's 2mans
    for (const A of swiperMans) {
      for (const C of swipedMans) {
        if (
          hasLike(A, C) &&
          hasLike(swiperId, swipedId) &&
          hasLike(C, A) &&
          hasLike(swipedId, swiperId)
        ) {
          await createMatch(A, swiperId, C, swipedId)
          return
        }
      }
    }
  }

  async function createMatch(a: string, b: string, c: string, d: string) {
    // Prevent duplicate matches
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(duo1_user1_id.eq.${a},duo1_user2_id.eq.${b},duo2_user1_id.eq.${c},duo2_user2_id.eq.${d}),` +
        `and(duo1_user1_id.eq.${c},duo1_user2_id.eq.${d},duo2_user1_id.eq.${a},duo2_user2_id.eq.${b})`
      )
      .limit(1)

    if (existing && existing.length > 0) return

    const { data: chat } = await supabase
      .from('group_chats')
      .insert({})
      .select()
      .single()

    await supabase.from('matches').insert({
      duo1_user1_id: a,
      duo1_user2_id: b,
      duo2_user1_id: c,
      duo2_user2_id: d,
      status: 'matched',
      group_chat_id: chat.id,
    })

    toast.success("🎉 It's a match! Check your matches.")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#1E90FF] text-lg font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  // Gate: must have at least one linked 2man
  if (myTwoManIds.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🤝</div>
        <h2 className="text-2xl font-black mb-3">Link your 2man first</h2>
        <p className="text-white/40 mb-8 leading-relaxed">
          You need to link up with your boy before you can start matching.
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
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1E90FF10]">
        <h1 className="text-xl font-black">
          <span className="text-white">2</span><span className="text-[#1E90FF]"> Manz</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-xs">
            {myTwoManIds.length} 2man{myTwoManIds.length !== 1 ? 's' : ''}
          </span>
          <span className="text-white/40 text-sm">{profiles.length - index} left</span>
        </div>
      </div>

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

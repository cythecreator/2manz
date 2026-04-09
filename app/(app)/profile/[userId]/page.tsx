'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { UserWithPrompts, User } from '@/lib/types'
import { attachTwoMans, get2ManIds } from '@/lib/twoManHelpers'
import ProfileCard from '@/components/ProfileCard'
import toast from 'react-hot-toast'

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<UserWithPrompts | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [alreadySwiped, setAlreadySwiped] = useState(false)
  // Track which of the target's 2mans the current user has already swiped on
  const [swipedTwoManIds, setSwipedTwoManIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data } = await supabase
        .from('users')
        .select('*, prompts(*)')
        .eq('id', userId)
        .single()

      if (!data) { setLoading(false); return }

      // Attach 2mans
      const [withTwoMans] = await attachTwoMans(supabase, [data])
      setProfile(withTwoMans as UserWithPrompts)

      // Check if current user already swiped on the main profile
      const { data: swipe } = await supabase
        .from('swipes')
        .select('id')
        .eq('swiper_id', user.id)
        .eq('swiped_id', userId)
        .maybeSingle()
      setAlreadySwiped(!!swipe)

      // Check which of the target's 2mans current user has swiped on
      const twoManIds = await get2ManIds(supabase, userId)
      if (twoManIds.length > 0) {
        const { data: twoManSwipes } = await supabase
          .from('swipes')
          .select('swiped_id')
          .eq('swiper_id', user.id)
          .in('swiped_id', twoManIds)
        setSwipedTwoManIds(new Set(twoManSwipes?.map((s: any) => s.swiped_id) || []))
      }

      setLoading(false)
    }
    load()
  }, [userId, supabase])

  async function swipeOnMain(direction: 'like' | 'pass') {
    if (!currentUserId || !profile) return
    await supabase.from('swipes').upsert({
      swiper_id: currentUserId,
      swiped_id: profile.id,
      direction,
    })
    if (direction === 'like') toast.success('Liked!')
    else toast('Passed')
    setAlreadySwiped(true)
  }

  async function swipeOnTwoMan(twoMan: User, direction: 'like' | 'pass') {
    if (!currentUserId) return
    await supabase.from('swipes').upsert({
      swiper_id: currentUserId,
      swiped_id: twoMan.id,
      direction,
    })
    setSwipedTwoManIds(prev => new Set(Array.from(prev).concat(twoMan.id)))

    if (direction === 'like') {
      toast.success(`Liked ${twoMan.name}!`)
      // Trigger match check via the discover logic — notify current user's 2mans
      const myTwoManIds = await get2ManIds(supabase, currentUserId)
      for (const myTwoManId of myTwoManIds) {
        await supabase.from('duo_notifications').insert({
          notified_user_id: myTwoManId,
          triggered_by_user_id: currentUserId,
          target_user_id: twoMan.id,
        })
      }
      // Check for a completed 4-way match
      await checkForMatch(currentUserId, twoMan.id)
    } else {
      toast('Passed')
    }
  }

  async function checkForMatch(swiperId: string, swipedId: string) {
    const swiperMans = await get2ManIds(supabase, swiperId)
    const swipedMans = await get2ManIds(supabase, swipedId)
    if (swiperMans.length === 0 && swipedMans.length === 0) return

    const all = [swiperId, swipedId, ...swiperMans, ...swipedMans]
    const { data: swipesData } = await supabase
      .from('swipes')
      .select('swiper_id, swiped_id')
      .in('swiper_id', all)
      .in('swiped_id', all)
      .eq('direction', 'like')

    const hasLike = (from: string, to: string) =>
      swipesData?.some((s: any) => s.swiper_id === from && s.swiped_id === to) ?? false

    for (const B of swiperMans) {
      for (const D of swipedMans) {
        if (hasLike(swiperId, swipedId) && hasLike(B, D) && hasLike(swipedId, swiperId) && hasLike(D, B)) {
          await createMatch(swiperId, B, swipedId, D)
          return
        }
      }
    }
    for (const A of swiperMans) {
      for (const C of swipedMans) {
        if (hasLike(A, C) && hasLike(swiperId, swipedId) && hasLike(C, A) && hasLike(swipedId, swiperId)) {
          await createMatch(A, swiperId, C, swipedId)
          return
        }
      }
    }
  }

  async function createMatch(a: string, b: string, c: string, d: string) {
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(duo1_user1_id.eq.${a},duo1_user2_id.eq.${b},duo2_user1_id.eq.${c},duo2_user2_id.eq.${d}),` +
        `and(duo1_user1_id.eq.${c},duo1_user2_id.eq.${d},duo2_user1_id.eq.${a},duo2_user2_id.eq.${b})`
      )
      .limit(1)
    if (existing && existing.length > 0) return

    const { data: chat } = await supabase.from('group_chats').insert({}).select().single()
    await supabase.from('matches').insert({
      duo1_user1_id: a, duo1_user2_id: b,
      duo2_user1_id: c, duo2_user2_id: d,
      status: 'matched', group_chat_id: chat.id,
    })
    toast.success("🎉 It's a match!")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[#1E90FF] animate-pulse">Loading...</div></div>
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-white/40">Profile not found</p></div>
  }

  const twoMans = profile.two_mans || []

  return (
    <div className="min-h-screen pb-8">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E90FF10]">
        <button onClick={() => router.back()} className="text-white/50 text-xl">←</button>
        <h1 className="text-lg font-black">{profile.name}&apos;s Profile</h1>
      </div>

      <div className="px-4 py-4 max-w-sm mx-auto space-y-4">
        {/* Main profile card */}
        {alreadySwiped ? (
          <div className="bg-[#0F2040] rounded-3xl p-6 border border-[#1E90FF15] text-center">
            <p className="text-5xl mb-3">✓</p>
            <p className="text-white/50 text-sm">Already swiped on {profile.name}</p>
          </div>
        ) : (
          <ProfileCard
            user={profile}
            onLike={() => swipeOnMain('like')}
            onPass={() => swipeOnMain('pass')}
          />
        )}

        {/* 2Man swipe section */}
        {twoMans.length > 0 && (
          <div className="bg-[#0F2040] rounded-3xl p-4 border border-[#1E90FF15]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#1E90FF] text-xs font-bold uppercase tracking-wider">
                {profile.name}&apos;s 2Man Crew
              </span>
              <span className="bg-[#1E90FF22] text-[#1E90FF] text-[10px] font-bold px-2 py-0.5 rounded-full">
                {twoMans.length}
              </span>
            </div>
            <p className="text-white/30 text-xs mb-4">
              Like one of their 2mans to work towards a match
            </p>
            <div className="space-y-3">
              {twoMans.map(tm => (
                <TwoManSwipeRow
                  key={tm.id}
                  user={tm}
                  alreadySwiped={swipedTwoManIds.has(tm.id)}
                  onLike={() => swipeOnTwoMan(tm, 'like')}
                  onPass={() => swipeOnTwoMan(tm, 'pass')}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TwoManSwipeRow({
  user: u,
  alreadySwiped,
  onLike,
  onPass,
}: {
  user: User
  alreadySwiped: boolean
  onLike: () => void
  onPass: () => void
}) {
  return (
    <div className="flex items-center gap-3 bg-[#0A1628] rounded-2xl p-3 border border-[#1E90FF10]">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-[#0F2040] flex-shrink-0">
        {u.photos?.[0] ? (
          <Image src={u.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{u.name}</p>
        <p className="text-white/40 text-xs">{u.age}{u.location ? ` · ${u.location}` : ''}</p>
      </div>
      {alreadySwiped ? (
        <span className="text-white/30 text-xs">Swiped ✓</span>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onPass}
            className="w-9 h-9 bg-[#0F2040] border border-red-500/20 text-red-400 rounded-xl text-sm hover:bg-red-500/10 transition-colors"
          >
            ✕
          </button>
          <button
            onClick={onLike}
            className="w-9 h-9 bg-[#1E90FF] text-white rounded-xl text-sm hover:bg-[#1a7fe0] transition-colors"
          >
            ♥
          </button>
        </div>
      )}
    </div>
  )
}

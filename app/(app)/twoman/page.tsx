'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { TwoManLink, User } from '@/lib/types'
import toast from 'react-hot-toast'

export default function TwoManPage() {
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [linkedMans, setLinkedMans] = useState<(TwoManLink & { partner: User })[]>([])
  const [incomingRequests, setIncomingRequests] = useState<(TwoManLink & { partner: User })[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<(TwoManLink & { partner: User })[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (userId: string) => {
    const { data: links } = await supabase
      .from('two_man_links')
      .select('*, user1:user1_id(id,name,email,photos,age,location), user2:user2_id(id,name,email,photos,age,location)')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (!links) return

    const resolve = (link: any): TwoManLink & { partner: User } => {
      const partner = link.user1_id === userId ? link.user2 : link.user1
      return { ...link, partner }
    }

    setLinkedMans(links.filter((l: any) => l.status === 'accepted').map(resolve))
    setIncomingRequests(
      links.filter((l: any) => l.status === 'pending' && l.requester_id !== userId).map(resolve)
    )
    setOutgoingRequests(
      links.filter((l: any) => l.status === 'pending' && l.requester_id === userId).map(resolve)
    )
    setPendingIds(new Set(
      links
        .filter((l: any) => l.status === 'pending')
        .map((l: any) => l.user1_id === userId ? l.user2_id : l.user1_id)
    ))
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
      setCurrentUser(profile)
      await loadData(user.id)
      setLoading(false)
    }
    init()
  }, [router, supabase, loadData])

  async function searchUsers() {
    if (!search.trim() || !currentUser) return

    // Get IDs already linked or pending to exclude
    const { data: existingLinks } = await supabase
      .from('two_man_links')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
    const excludeIds = new Set<string>([currentUser.id])
    for (const l of existingLinks || []) {
      excludeIds.add(l.user1_id)
      excludeIds.add(l.user2_id)
    }

    const { data } = await supabase
      .from('users')
      .select('id, name, email, photos, age, location')
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(20)

    setResults((data || []).filter((u: any) => !excludeIds.has(u.id)) as User[])
  }

  async function sendRequest(receiverId: string) {
    if (!currentUser) return
    const { error } = await supabase.from('two_man_links').insert({
      user1_id: currentUser.id,
      user2_id: receiverId,
      requester_id: currentUser.id,
      status: 'pending',
    })
    if (error) {
      toast.error(error.code === '23505' ? 'Request already sent' : error.message)
    } else {
      toast.success('Request sent!')
      setResults(r => r.filter(u => u.id !== receiverId))
      await loadData(currentUser.id)
    }
  }

  async function acceptRequest(linkId: string) {
    const { error } = await supabase
      .from('two_man_links')
      .update({ status: 'accepted' })
      .eq('id', linkId)
    if (error) { toast.error('Failed to accept'); return }
    toast.success("2man linked! Let's go 🔥")
    await loadData(currentUser.id)
  }

  async function declineRequest(linkId: string) {
    await supabase.from('two_man_links').delete().eq('id', linkId)
    await loadData(currentUser.id)
    toast('Request declined')
  }

  async function cancelRequest(linkId: string) {
    await supabase.from('two_man_links').delete().eq('id', linkId)
    await loadData(currentUser.id)
    toast('Request cancelled')
  }

  async function unlinkTwoMan(linkId: string, partnerName: string) {
    if (!confirm(`Unlink ${partnerName}?`)) return
    await supabase.from('two_man_links').delete().eq('id', linkId)
    await loadData(currentUser.id)
    toast.success('Unlinked')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[#1E90FF] animate-pulse">Loading...</div></div>
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E90FF10]">
        <button onClick={() => router.back()} className="text-white/50 text-xl">←</button>
        <div>
          <h1 className="text-xl font-black">Your 2Man Crew</h1>
          <p className="text-white/30 text-xs">
            {linkedMans.length} linked · {incomingRequests.length} pending
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6 max-w-sm mx-auto">

        {/* ── LINKED 2MANS ── */}
        {linkedMans.length > 0 && (
          <section>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">
              Linked ({linkedMans.length})
            </h3>
            <div className="space-y-2">
              {linkedMans.map(link => (
                <LinkedManRow
                  key={link.id}
                  link={link}
                  onUnlink={() => unlinkTwoMan(link.id, link.partner?.name || 'them')}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── INCOMING REQUESTS ── */}
        {incomingRequests.length > 0 && (
          <section>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">
              Incoming Requests ({incomingRequests.length})
            </h3>
            <div className="space-y-3">
              {incomingRequests.map(link => (
                <IncomingRequestRow
                  key={link.id}
                  link={link}
                  onAccept={() => acceptRequest(link.id)}
                  onDecline={() => declineRequest(link.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── OUTGOING REQUESTS ── */}
        {outgoingRequests.length > 0 && (
          <section>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">
              Sent ({outgoingRequests.length})
            </h3>
            <div className="space-y-2">
              {outgoingRequests.map(link => (
                <OutgoingRequestRow
                  key={link.id}
                  link={link}
                  onCancel={() => cancelRequest(link.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── SEARCH ── */}
        <section>
          <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">
            Add a 2Man
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              placeholder="Search by name or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUsers()}
              className="flex-1 bg-[#0F2040] border border-[#1E90FF22] rounded-2xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#1E90FF] transition-colors text-sm"
            />
            <button
              onClick={searchUsers}
              className="bg-[#1E90FF] text-white font-bold px-4 rounded-2xl"
            >
              Go
            </button>
          </div>

          <div className="space-y-2">
            {results.map(u => (
              <SearchResultRow
                key={u.id}
                user={u}
                isPending={pendingIds.has(u.id)}
                onAdd={() => sendRequest(u.id)}
              />
            ))}
            {results.length === 0 && search.trim() && (
              <p className="text-white/30 text-sm text-center py-4">No users found</p>
            )}
          </div>
        </section>

        {/* Empty state */}
        {linkedMans.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 && !search && (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">🤝</div>
            <p className="text-white/40 text-sm">Search above to link your first 2man</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────── Sub-components ──────────────────────── */

function Avatar({ user }: { user: User }) {
  return (
    <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden flex-shrink-0">
      {user.photos?.[0] ? (
        <Image src={user.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
      )}
    </div>
  )
}

function LinkedManRow({ link, onUnlink }: { link: TwoManLink & { partner: User }; onUnlink: () => void }) {
  const u = link.partner
  return (
    <div className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF22]">
      <Avatar user={u} />
      <div className="flex-1 min-w-0">
        <p className="font-bold">{u.name || u.email}</p>
        <p className="text-white/40 text-xs">{u.location || u.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#1E90FF] text-xs font-bold bg-[#1E90FF15] px-2 py-1 rounded-full">Linked</span>
        <button onClick={onUnlink} className="text-red-400/60 text-xs hover:text-red-400 transition-colors">
          Unlink
        </button>
      </div>
    </div>
  )
}

function IncomingRequestRow({
  link,
  onAccept,
  onDecline,
}: {
  link: TwoManLink & { partner: User }
  onAccept: () => void
  onDecline: () => void
}) {
  const u = link.partner
  return (
    <div className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF33]">
      <Avatar user={u} />
      <div className="flex-1 min-w-0">
        <p className="font-bold">{u.name || u.email}</p>
        {u.age && <p className="text-white/40 text-xs">{u.age} years old</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={onAccept} className="bg-[#1E90FF] text-white text-xs font-bold px-3 py-2 rounded-xl">
          Accept
        </button>
        <button onClick={onDecline} className="bg-[#0A1628] text-white/40 text-xs px-3 py-2 rounded-xl border border-[#ffffff10]">
          Decline
        </button>
      </div>
    </div>
  )
}

function OutgoingRequestRow({
  link,
  onCancel,
}: {
  link: TwoManLink & { partner: User }
  onCancel: () => void
}) {
  const u = link.partner
  return (
    <div className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
      <Avatar user={u} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{u.name || u.email}</p>
        <p className="text-white/30 text-xs">Waiting for response...</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        <button onClick={onCancel} className="text-white/30 text-xs hover:text-white/50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function SearchResultRow({
  user: u,
  isPending,
  onAdd,
}: {
  user: User
  isPending: boolean
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
      <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden flex-shrink-0">
        {u.photos?.[0] ? (
          <Image src={u.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold">{u.name || u.email}</p>
        <p className="text-white/40 text-xs">{u.location || u.email}</p>
      </div>
      {isPending ? (
        <span className="text-yellow-400/80 text-xs font-medium">Pending</span>
      ) : (
        <button
          onClick={onAdd}
          className="bg-[#1E90FF] text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-[#1a7fe0] transition-colors"
        >
          Add
        </button>
      )}
    </div>
  )
}

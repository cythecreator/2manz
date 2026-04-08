'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function TwoManPage() {
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [twoMan, setTwoMan] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [incomingRequests, setIncomingRequests] = useState<any[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (userId: string, twoManId?: string) => {
    // Incoming requests
    const { data: incoming } = await supabase
      .from('two_man_requests')
      .select('*, sender:sender_id(id, name, email, photos, age)')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
    setIncomingRequests(incoming || [])

    // Outgoing requests
    const { data: outgoing } = await supabase
      .from('two_man_requests')
      .select('*, receiver:receiver_id(id, name, email, photos, age)')
      .eq('sender_id', userId)
      .eq('status', 'pending')
    setOutgoingRequests(outgoing || [])

    // Current 2man
    if (twoManId) {
      const { data: tm } = await supabase.from('users').select('*').eq('id', twoManId).single()
      setTwoMan(tm)
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
      setCurrentUser(profile)
      await loadData(user.id, profile?.two_man_id)
      setLoading(false)
    }
    init()
  }, [router, supabase, loadData])

  async function searchUsers() {
    if (!search.trim() || !currentUser) return
    const { data } = await supabase
      .from('users')
      .select('id, name, email, photos, age, location')
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      .neq('id', currentUser.id)
      .is('two_man_id', null)
      .limit(10)
    setResults(data || [])
  }

  async function sendRequest(receiverId: string) {
    const { error } = await supabase.from('two_man_requests').insert({
      sender_id: currentUser.id,
      receiver_id: receiverId,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Request sent!')
      setResults(r => r.filter(u => u.id !== receiverId))
      await loadData(currentUser.id)
    }
  }

  async function acceptRequest(requestId: string, senderId: string) {
    // Update request
    await supabase.from('two_man_requests').update({ status: 'accepted' }).eq('id', requestId)

    // Link both users
    await supabase.from('users').update({ two_man_id: senderId, two_man_status: 'accepted' }).eq('id', currentUser.id)
    await supabase.from('users').update({ two_man_id: currentUser.id, two_man_status: 'accepted' }).eq('id', senderId)

    toast.success("2man linked! Let's go 🔥")
    setCurrentUser((u: any) => ({ ...u, two_man_id: senderId }))
    await loadData(currentUser.id, senderId)
  }

  async function declineRequest(requestId: string) {
    await supabase.from('two_man_requests').update({ status: 'declined' }).eq('id', requestId)
    await loadData(currentUser.id)
    toast('Request declined')
  }

  async function unlinkTwoMan() {
    if (!confirm('Unlink your 2man?')) return
    await supabase.from('users').update({ two_man_id: null, two_man_status: 'none' }).eq('id', currentUser.id)
    if (twoMan) {
      await supabase.from('users').update({ two_man_id: null, two_man_status: 'none' }).eq('id', twoMan.id)
    }
    setTwoMan(null)
    setCurrentUser((u: any) => ({ ...u, two_man_id: null }))
    toast.success('Unlinked')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[#1E90FF] animate-pulse">Loading...</div></div>
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E90FF10]">
        <button onClick={() => router.back()} className="text-white/50 text-xl">←</button>
        <h1 className="text-xl font-black">Link Your 2Man</h1>
      </div>

      <div className="px-4 py-4 space-y-6 max-w-sm mx-auto">
        {/* Current 2man */}
        {twoMan && (
          <div className="bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF33]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#1E90FF] text-xs font-bold uppercase tracking-wider">Your 2Man</p>
              <button onClick={unlinkTwoMan} className="text-red-400/70 text-xs">Unlink</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden">
                {twoMan.photos?.[0] ? (
                  <Image src={twoMan.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                )}
              </div>
              <div>
                <p className="font-bold">{twoMan.name}</p>
                <p className="text-white/40 text-sm">{twoMan.location}</p>
              </div>
            </div>
          </div>
        )}

        {/* Incoming requests */}
        {incomingRequests.length > 0 && (
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">
              Incoming Requests ({incomingRequests.length})
            </h3>
            <div className="space-y-3">
              {incomingRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF22]">
                  <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden flex-shrink-0">
                    {req.sender?.photos?.[0] ? (
                      <Image src={req.sender.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{req.sender?.name || req.sender?.email}</p>
                    {req.sender?.age && <p className="text-white/40 text-xs">{req.sender.age} years old</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(req.id, req.sender_id)}
                      className="bg-[#1E90FF] text-white text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineRequest(req.id)}
                      className="bg-[#0A1628] text-white/40 text-xs px-3 py-2 rounded-xl border border-[#ffffff10]"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing requests */}
        {outgoingRequests.length > 0 && (
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Pending Requests</h3>
            <div className="space-y-2">
              {outgoingRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
                  <div className="w-10 h-10 rounded-full bg-[#0A1628] overflow-hidden">
                    {req.receiver?.photos?.[0] ? (
                      <Image src={req.receiver.photos[0]} alt="" width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">👤</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{req.receiver?.name || req.receiver?.email}</p>
                    <p className="text-white/30 text-xs">Request pending...</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        {!twoMan && (
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Find Your Boy</h3>
            <div className="flex gap-2 mb-4">
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
                <div key={u.id} className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
                  <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden flex-shrink-0">
                    {u.photos?.[0] ? (
                      <Image src={u.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{u.name || u.email}</p>
                    <p className="text-white/40 text-xs">{u.location || u.email}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(u.id)}
                    className="bg-[#1E90FF] text-white text-sm font-bold px-3 py-2 rounded-xl"
                  >
                    Add
                  </button>
                </div>
              ))}
              {results.length === 0 && search && (
                <p className="text-white/30 text-sm text-center py-4">No users found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

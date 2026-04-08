'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Message } from '@/lib/types'
import { formatDistanceToNow } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [match, setMatch] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [dateLoading, setDateLoading] = useState(false)
  const [dateSpot, setDateSpot] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, name, photos)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }, [supabase, matchId])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)

      const { data: m } = await supabase
        .from('matches')
        .select(`
          *,
          duo1_user1:duo1_user1_id(id, name, photos, age, location, fav_date_place, bio),
          duo1_user2:duo1_user2_id(id, name, photos, age, location, fav_date_place, bio),
          duo2_user1:duo2_user1_id(id, name, photos, age, location, fav_date_place, bio),
          duo2_user2:duo2_user2_id(id, name, photos, age, location, fav_date_place, bio)
        `)
        .eq('id', matchId)
        .single()

      setMatch(m)
      await loadMessages()
      setLoading(false)
    }
    init()

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      }, () => loadMessages())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId, supabase, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content?: string) {
    const msg = content || text.trim()
    if (!msg || !currentUser || sending) return
    setSending(true)
    setText('')

    const { error } = await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: currentUser.id,
      content: msg,
    })
    if (error) toast.error('Failed to send')
    setSending(false)
  }

  async function getAiMessage() {
    if (!match) return
    setAiLoading(true)
    try {
      const users = [match.duo1_user1, match.duo1_user2, match.duo2_user1, match.duo2_user2].filter(Boolean)
      const res = await fetch('/api/ai-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      })
      const { message } = await res.json()
      if (message) setText(message)
    } catch {
      toast.error('AI unavailable')
    }
    setAiLoading(false)
  }

  async function pickDateSpot() {
    if (!match) return
    setDateLoading(true)
    setDateSpot(null)

    const users = [match.duo1_user1, match.duo1_user2, match.duo2_user1, match.duo2_user2].filter(Boolean)
    const favPlaces = users.map((u: any) => u.fav_date_place).filter(Boolean)

    // 50/50: use fav places or Google Maps
    if (favPlaces.length > 0 && Math.random() > 0.5) {
      const picked = favPlaces[Math.floor(Math.random() * favPlaces.length)]
      setDateSpot({ name: picked, type: 'From your favorites', mapsUrl: null })
    } else {
      // Try Google Maps
      const locations = users.map((u: any) => u.location).filter(Boolean)
      if (locations.length > 0) {
        const res = await fetch('/api/date-spot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations }),
        })
        const spot = await res.json()
        setDateSpot(spot)
      } else if (favPlaces.length > 0) {
        const picked = favPlaces[Math.floor(Math.random() * favPlaces.length)]
        setDateSpot({ name: picked, type: 'From your favorites', mapsUrl: null })
      }
    }
    setDateLoading(false)
  }

  const allUsers = match ? [match.duo1_user1, match.duo1_user2, match.duo2_user1, match.duo2_user2].filter(Boolean) : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#1E90FF] animate-pulse">Loading chat...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0A1628]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E90FF10] bg-[#0A1628]">
        <button onClick={() => router.back()} className="text-white/50 text-xl">←</button>
        <div className="flex -space-x-2">
          {allUsers.slice(0, 4).map((u: any, i: number) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0A1628] bg-[#0F2040] overflow-hidden">
              {u?.photos?.[0] ? (
                <Image src={u.photos[0]} alt="" width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
              )}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">
            {allUsers.map((u: any) => u?.name).filter(Boolean).join(', ')}
          </p>
          <p className="text-white/30 text-xs">Group chat</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-white/30 text-sm py-8">
            No messages yet. Say something! 👋
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUser?.id
          return (
            <div key={msg.id} className={`flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-[#0F2040] overflow-hidden flex-shrink-0 mb-1">
                  {msg.sender?.photos?.[0] ? (
                    <Image src={msg.sender.photos[0]} alt="" width={28} height={28} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
                  )}
                </div>
              )}
              <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!isMe && (
                  <p className="text-[#1E90FF] text-xs font-semibold px-1">{msg.sender?.name}</p>
                )}
                <div className={`px-4 py-3 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-[#1E90FF] text-white rounded-br-sm'
                    : 'bg-[#0F2040] text-white rounded-bl-sm border border-[#1E90FF15]'
                }`}>
                  {msg.content}
                </div>
                <p className="text-white/20 text-[10px] px-1">{formatDistanceToNow(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Date spot card */}
      {dateSpot && (
        <div className="mx-4 mb-2 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF33]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#1E90FF] text-xs font-bold mb-1">📍 DATE SPOT</p>
              <p className="text-white font-bold">{dateSpot.name}</p>
              {dateSpot.type && <p className="text-white/40 text-xs mt-0.5">{dateSpot.type}</p>}
              {dateSpot.address && <p className="text-white/40 text-xs">{dateSpot.address}</p>}
            </div>
            <div className="flex gap-2">
              {dateSpot.mapsUrl && (
                <a
                  href={dateSpot.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#1E90FF] text-white text-xs font-bold px-3 py-2 rounded-xl"
                >
                  Maps
                </a>
              )}
              <button
                onClick={() => {
                  sendMessage(`📍 Date spot idea: ${dateSpot.name}${dateSpot.address ? ` — ${dateSpot.address}` : ''}${dateSpot.mapsUrl ? `\n${dateSpot.mapsUrl}` : ''}`)
                  setDateSpot(null)
                }}
                className="bg-[#0A1628] text-white/60 text-xs px-3 py-2 rounded-xl border border-[#1E90FF22]"
              >
                Share
              </button>
              <button onClick={() => setDateSpot(null)} className="text-white/30 text-lg px-2">×</button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-2">
        <button
          onClick={getAiMessage}
          disabled={aiLoading}
          className="flex-1 bg-[#0F2040] border border-[#1E90FF33] text-[#1E90FF] text-xs font-bold py-2.5 rounded-xl hover:bg-[#1E90FF15] transition-colors disabled:opacity-50"
        >
          {aiLoading ? '✨ Thinking...' : '✨ AI Message'}
        </button>
        <button
          onClick={pickDateSpot}
          disabled={dateLoading}
          className="flex-1 bg-[#0F2040] border border-[#1E90FF33] text-[#1E90FF] text-xs font-bold py-2.5 rounded-xl hover:bg-[#1E90FF15] transition-colors disabled:opacity-50"
        >
          {dateLoading ? '📍 Finding...' : '📍 Pick Date Spot'}
        </button>
      </div>

      {/* Input */}
      <div className="flex gap-3 px-4 pb-6 pt-2 border-t border-[#1E90FF10]">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder="Type a message..."
          className="flex-1 bg-[#0F2040] border border-[#1E90FF22] rounded-2xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#1E90FF] transition-colors text-sm"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!text.trim() || sending}
          className="bg-[#1E90FF] text-white font-bold w-12 h-12 rounded-2xl flex items-center justify-center disabled:opacity-30 hover:bg-[#1a7fe0] transition-colors flex-shrink-0"
        >
          →
        </button>
      </div>
    </div>
  )
}

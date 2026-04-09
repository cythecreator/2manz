'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UserWithPrompts, User } from '@/lib/types'

interface Props {
  user: UserWithPrompts
  onLike: () => void
  onPass: () => void
}

export default function ProfileCard({ user, onLike, onPass }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const photos = user.photos?.length > 0 ? user.photos : []
  const twoMans = user.two_mans || []

  function prevPhoto(e: React.MouseEvent) {
    e.stopPropagation()
    setPhotoIndex(i => Math.max(0, i - 1))
  }
  function nextPhoto(e: React.MouseEvent) {
    e.stopPropagation()
    setPhotoIndex(i => Math.min(photos.length - 1, i + 1))
  }

  return (
    <div className="relative w-full max-w-sm mx-auto rounded-3xl overflow-hidden bg-[#0F2040] shadow-2xl shadow-black/40 border border-[#1E90FF15]">
      {/* Photo */}
      <div className="relative aspect-[3/4] bg-[#0A1628]">
        {photos.length > 0 ? (
          <Image
            src={photos[photoIndex]}
            alt={user.name || ''}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl text-white/10">
            👤
          </div>
        )}

        {/* Photo nav overlays */}
        {photos.length > 1 && (
          <>
            <button onClick={prevPhoto} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
            <button onClick={nextPhoto} className="absolute right-0 top-0 bottom-0 w-2/3 z-10" />
          </>
        )}

        {/* Photo dots */}
        {photos.length > 1 && (
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 z-20">
            {photos.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all ${i === photoIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'}`} />
            ))}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-[#0F2040] to-transparent z-10" />

        {/* Name + basics */}
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <h2 className="text-2xl font-black text-white leading-tight">
            {user.name}, {user.age}
          </h2>
          <p className="text-white/60 text-sm">{user.location}</p>
        </div>
      </div>

      {/* 2Man crew section */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#1E90FF] text-xs font-bold uppercase tracking-wider">2Man Crew</span>
          {twoMans.length > 0 && (
            <span className="bg-[#1E90FF22] text-[#1E90FF] text-[10px] font-bold px-2 py-0.5 rounded-full">
              {twoMans.length}
            </span>
          )}
        </div>
        {twoMans.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {twoMans.map(tm => (
              <TwoManAvatar key={tm.id} user={tm} />
            ))}
          </div>
        ) : (
          <p className="text-white/25 text-xs italic pb-1">No 2man yet</p>
        )}
      </div>

      {/* Info section */}
      <div className="p-4 pt-2 space-y-3">
        {/* Stats row */}
        <div className="flex gap-2 flex-wrap">
          {user.height && <Chip label="📏" value={user.height} />}
          {user.salary && <Chip label="💰" value={user.salary} />}
          {user.forty_yard_dash && <Chip label="⚡" value={user.forty_yard_dash} />}
        </div>

        {/* Quote */}
        {user.fav_quote && (
          <div className="bg-[#0A1628] rounded-2xl px-4 py-3 border border-[#1E90FF15]">
            <p className="text-white/70 text-sm italic">&quot;{user.fav_quote}&quot;</p>
          </div>
        )}

        {/* Prompts */}
        {user.prompts?.filter(p => p.answer).slice(0, 2).map(p => (
          <div key={p.id} className="bg-[#0A1628] rounded-2xl px-4 py-3 border border-[#1E90FF15]">
            <p className="text-[#1E90FF] text-xs font-semibold mb-1">{p.question}</p>
            <p className="text-white/80 text-sm">{p.answer}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 px-6 pb-6 pt-2">
        <button
          onClick={onPass}
          className="flex-1 bg-[#0A1628] border border-red-500/30 text-red-400 font-bold py-4 rounded-2xl text-2xl hover:bg-red-500/10 transition-colors"
        >
          ✕
        </button>
        <button
          onClick={onLike}
          className="flex-1 bg-[#1E90FF] text-white font-bold py-4 rounded-2xl text-2xl hover:bg-[#1a7fe0] transition-colors shadow-lg shadow-[#1E90FF]/20"
        >
          ♥
        </button>
      </div>
    </div>
  )
}

function TwoManAvatar({ user }: { user: User }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
      <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden border-2 border-[#1E90FF33]">
        {user.photos?.[0] ? (
          <Image
            src={user.photos[0]}
            alt={user.name || ''}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl text-white/30">👤</div>
        )}
      </div>
      <p className="text-white/70 text-[10px] text-center leading-tight truncate w-full">
        {user.name?.split(' ')[0]}
      </p>
    </div>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-[#0A1628] border border-[#1E90FF22] text-white/70 text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
      {label} <span className="text-white font-medium">{value}</span>
    </span>
  )
}

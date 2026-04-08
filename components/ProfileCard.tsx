'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UserWithPrompts } from '@/lib/types'

interface Props {
  user: UserWithPrompts
  onLike: () => void
  onPass: () => void
}

export default function ProfileCard({ user, onLike, onPass }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const photos = user.photos?.length > 0 ? user.photos : []

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

        {/* Photo nav overlay */}
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
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-white leading-tight">
                {user.name}, {user.age}
              </h2>
              <p className="text-white/60 text-sm">{user.location}</p>
            </div>
            {/* 2Man preview */}
            {user.two_man && (
              <div className="text-right">
                <p className="text-[#1E90FF] text-xs font-bold mb-1">2MAN</p>
                <div className="flex items-center gap-2 bg-[#0A1628]/80 rounded-2xl px-3 py-2">
                  {user.two_man.photos?.[0] ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      <Image src={user.two_man.photos[0]} alt="" width={32} height={32} className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#1E90FF22] flex items-center justify-center text-sm">👤</div>
                  )}
                  <div>
                    <p className="text-white text-xs font-bold">{user.two_man.name}</p>
                    {user.two_man.age && <p className="text-white/40 text-[10px]">{user.two_man.age}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="p-4 space-y-3">
        {/* Stats row */}
        <div className="flex gap-2 flex-wrap">
          {user.height && (
            <Chip label="📏" value={user.height} />
          )}
          {user.salary && (
            <Chip label="💰" value={user.salary} />
          )}
          {user.forty_yard_dash && (
            <Chip label="⚡" value={user.forty_yard_dash} />
          )}
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

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-[#0A1628] border border-[#1E90FF22] text-white/70 text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
      {label} <span className="text-white font-medium">{value}</span>
    </span>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PROMPT_QUESTIONS } from '@/lib/types'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [twoMan, setTwoMan] = useState<any>(null)
  const [prompts, setPrompts] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Editable fields
  const [form, setForm] = useState<any>({})
  const [editPrompts, setEditPrompts] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      const { data: promptData } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', authUser.id)

      setUser(profile)
      setPrompts(promptData || [])
      setForm({ ...profile })
      setEditPrompts(promptData?.length ? promptData : [
        { question: PROMPT_QUESTIONS[0], answer: '' },
        { question: PROMPT_QUESTIONS[1], answer: '' },
        { question: PROMPT_QUESTIONS[2], answer: '' },
      ])

      if (profile?.two_man_id) {
        const { data: tm } = await supabase.from('users').select('*').eq('id', profile.two_man_id).single()
        setTwoMan(tm)
      }
    }
    load()
  }, [supabase, router])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('users').update({
      name: form.name,
      age: form.age,
      gender: form.gender,
      location: form.location,
      height: form.height,
      salary: form.salary,
      forty_yard_dash: form.forty_yard_dash,
      fav_quote: form.fav_quote,
      fav_date_place: form.fav_date_place,
      bio: form.bio,
      photos: form.photos,
    }).eq('id', user.id)

    if (!error) {
      await supabase.from('prompts').delete().eq('user_id', user.id)
      const toInsert = editPrompts.filter(p => p.answer?.trim()).map(p => ({
        user_id: user.id, question: p.question, answer: p.answer
      }))
      if (toInsert.length) await supabase.from('prompts').insert(toInsert)
      setUser({ ...user, ...form })
      setPrompts(toInsert)
      setEditing(false)
      toast.success('Profile updated!')
    } else {
      toast.error('Save failed')
    }
    setSaving(false)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !user) return
    setUploadingPhoto(true)
    const photos = form.photos || []
    for (const file of Array.from(files)) {
      if (photos.length >= 6) break
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(path, file)
      if (error) { toast.error('Upload failed'); continue }
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      photos.push(data.publicUrl)
    }
    setForm((f: any) => ({ ...f, photos: [...photos] }))
    setUploadingPhoto(false)
  }

  async function unlinkTwoMan() {
    if (!confirm('Unlink your 2man?')) return
    await supabase.from('users').update({ two_man_id: null, two_man_status: 'none' }).eq('id', user.id)
    if (twoMan) {
      await supabase.from('users').update({ two_man_id: null, two_man_status: 'none' }).eq('id', twoMan.id)
    }
    setTwoMan(null)
    setUser((u: any) => ({ ...u, two_man_id: null }))
    toast.success('Unlinked')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[#1E90FF] animate-pulse">Loading...</div></div>
  }

  const photos = editing ? (form.photos || []) : (user.photos || [])

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1E90FF10]">
        <h1 className="text-xl font-black">Profile</h1>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="text-white/40 text-sm px-3 py-1.5">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-[#1E90FF] text-white text-sm font-bold px-4 py-1.5 rounded-xl disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="bg-[#0F2040] border border-[#1E90FF33] text-[#1E90FF] text-sm font-bold px-4 py-1.5 rounded-xl">
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-sm mx-auto">
        {/* Photos */}
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url: string, i: number) => (
            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-[#0F2040]">
              <Image src={url} alt="" fill className="object-cover" />
              {editing && (
                <button
                  onClick={() => setForm((f: any) => ({ ...f, photos: f.photos.filter((_: any, idx: number) => idx !== i) }))}
                  className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 text-white text-xs"
                >×</button>
              )}
            </div>
          ))}
          {editing && photos.length < 6 && (
            <button onClick={() => fileRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-[#1E90FF44] text-[#1E90FF] text-3xl flex items-center justify-center">
              {uploadingPhoto ? '...' : '+'}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />

        {/* Name + basic */}
        {editing ? (
          <div className="space-y-3">
            <input value={form.name || ''} onChange={e => setForm((f: any) => ({...f, name: e.target.value}))} placeholder="Name" className="input-field" />
            <div className="flex gap-3">
              <input value={form.age || ''} onChange={e => setForm((f: any) => ({...f, age: e.target.value}))} placeholder="Age" type="number" className="input-field flex-1" />
              <input value={form.location || ''} onChange={e => setForm((f: any) => ({...f, location: e.target.value}))} placeholder="Location" className="input-field flex-1" />
            </div>
            <div className="flex gap-3">
              {(['male', 'female', 'other'] as const).map(g => (
                <button key={g} onClick={() => setForm((f: any) => ({...f, gender: g}))} className={`flex-1 py-2 rounded-xl capitalize text-sm font-medium transition-all ${form.gender === g ? 'bg-[#1E90FF] text-white' : 'bg-[#0F2040] text-white/50 border border-[#1E90FF22]'}`}>{g}</button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-black">{user.name}, {user.age}</h2>
            <p className="text-white/40">{user.location}</p>
          </div>
        )}

        {/* Stats */}
        {editing ? (
          <div className="space-y-3">
            <h3 className="text-white/50 text-xs uppercase tracking-wider">Stats</h3>
            <input value={form.height || ''} onChange={e => setForm((f: any) => ({...f, height: e.target.value}))} placeholder="Height (e.g. 6'1)" className="input-field" />
            <input value={form.salary || ''} onChange={e => setForm((f: any) => ({...f, salary: e.target.value}))} placeholder="Salary (e.g. $80k-$100k)" className="input-field" />
            <input value={form.forty_yard_dash || ''} onChange={e => setForm((f: any) => ({...f, forty_yard_dash: e.target.value}))} placeholder="40-yard dash (e.g. 4.5s)" className="input-field" />
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {user.height && <StatChip icon="📏" val={user.height} />}
            {user.salary && <StatChip icon="💰" val={user.salary} />}
            {user.forty_yard_dash && <StatChip icon="⚡" val={user.forty_yard_dash} />}
          </div>
        )}

        {/* Favorites */}
        {editing ? (
          <div className="space-y-3">
            <h3 className="text-white/50 text-xs uppercase tracking-wider">Favorites</h3>
            <textarea value={form.fav_quote || ''} onChange={e => setForm((f: any) => ({...f, fav_quote: e.target.value}))} placeholder="Favorite quote" rows={2} className="input-field resize-none" />
            <input value={form.fav_date_place || ''} onChange={e => setForm((f: any) => ({...f, fav_date_place: e.target.value}))} placeholder="Favorite date place" className="input-field" />
          </div>
        ) : (
          <>
            {user.fav_quote && (
              <div className="bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
                <p className="text-white/50 text-xs mb-1">Favorite quote</p>
                <p className="text-white/80 text-sm italic">&quot;{user.fav_quote}&quot;</p>
              </div>
            )}
          </>
        )}

        {/* Prompts */}
        <div className="space-y-3">
          <h3 className="text-white/50 text-xs uppercase tracking-wider">Prompts</h3>
          {editing ? (
            editPrompts.map((p, i) => (
              <div key={i} className="bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF22]">
                <select value={p.question} onChange={e => { const updated = [...editPrompts]; updated[i].question = e.target.value; setEditPrompts(updated) }} className="w-full bg-transparent text-[#1E90FF] font-semibold text-sm mb-2 focus:outline-none">
                  {PROMPT_QUESTIONS.map(q => <option key={q} value={q} className="bg-[#0F2040]">{q}</option>)}
                </select>
                <textarea value={p.answer || ''} onChange={e => { const updated = [...editPrompts]; updated[i].answer = e.target.value; setEditPrompts(updated) }} placeholder="Your answer..." rows={2} className="w-full bg-transparent text-white placeholder-white/30 resize-none focus:outline-none text-sm" />
              </div>
            ))
          ) : (
            prompts.filter(p => p.answer).map(p => (
              <div key={p.id} className="bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
                <p className="text-[#1E90FF] text-xs font-semibold mb-1">{p.question}</p>
                <p className="text-white/80 text-sm">{p.answer}</p>
              </div>
            ))
          )}
        </div>

        {/* 2Man section */}
        <div className="bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF15]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">Your 2Man</h3>
            {twoMan ? (
              <button onClick={unlinkTwoMan} className="text-red-400/70 text-xs">Unlink</button>
            ) : (
              <Link href="/twoman" className="text-[#1E90FF] text-xs font-bold">Find one →</Link>
            )}
          </div>
          {twoMan ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0A1628] overflow-hidden">
                {twoMan.photos?.[0] ? (
                  <Image src={twoMan.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                )}
              </div>
              <div>
                <p className="font-bold">{twoMan.name}</p>
                <p className="text-white/40 text-sm">{twoMan.location}</p>
              </div>
            </div>
          ) : (
            <p className="text-white/30 text-sm">No 2man linked yet</p>
          )}
        </div>

        {/* Sign out */}
        <button onClick={signOut} className="w-full text-white/30 text-sm py-3 border border-[#ffffff10] rounded-2xl hover:text-white/50 transition-colors">
          Sign Out
        </button>
      </div>

      <style jsx global>{`
        .input-field {
          width: 100%;
          background: #0F2040;
          border: 1px solid #1E90FF22;
          border-radius: 1rem;
          padding: 0.875rem 1rem;
          color: white;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus { border-color: #1E90FF; }
        .input-field::placeholder { color: rgba(255,255,255,0.3); }
        option { background: #0F2040; }
      `}</style>
    </div>
  )
}

function StatChip({ icon, val }: { icon: string; val: string }) {
  return (
    <span className="bg-[#0F2040] border border-[#1E90FF22] text-white/70 text-xs px-3 py-1.5 rounded-full">
      {icon} <span className="text-white font-medium">{val}</span>
    </span>
  )
}

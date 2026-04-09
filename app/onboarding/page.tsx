'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PROMPT_QUESTIONS } from '@/lib/types'
import toast from 'react-hot-toast'
import Image from 'next/image'

const STEPS = [
  'Basics',
  'Stats',
  'Favorites',
  'Prompts',
  'Photos',
  'Link 2Man',
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [location, setLocation] = useState('')

  // Step 2
  const [height, setHeight] = useState('')
  const [salary, setSalary] = useState('')
  const [fortyYard, setFortyYard] = useState('')

  // Step 3
  const [favQuote, setFavQuote] = useState('')
  const [favDatePlace, setFavDatePlace] = useState('')

  // Step 4
  const [prompts, setPrompts] = useState([
    { question: PROMPT_QUESTIONS[0], answer: '' },
    { question: PROMPT_QUESTIONS[1], answer: '' },
    { question: PROMPT_QUESTIONS[2], answer: '' },
  ])

  // Step 5
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 6
  const [twoManSearch, setTwoManSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [requestSent, setRequestSent] = useState(false)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (photos.length >= 6) { toast.error('Max 6 photos'); return }

    setUploadingPhoto(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const file of Array.from(files)) {
      if (photos.length >= 6) break
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(path, file)
      if (error) { toast.error('Upload failed'); continue }
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      setPhotos(prev => [...prev, data.publicUrl])
    }
    setUploadingPhoto(false)
  }

  async function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  async function searchTwoMan() {
    if (!twoManSearch.trim()) return
    const { data } = await supabase
      .from('users')
      .select('id, name, email, photos')
      .or(`name.ilike.%${twoManSearch}%,email.ilike.%${twoManSearch}%`)
      .neq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .limit(5)
    setSearchResults(data || [])
  }

  async function sendTwoManRequest(receiverId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('two_man_links').insert({
      user1_id: user.id,
      user2_id: receiverId,
      requester_id: user.id,
      status: 'pending',
    })
    if (error) toast.error('Request failed')
    else { toast.success('2man request sent!'); setRequestSent(true) }
  }

  async function saveAndFinish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: userError } = await supabase.from('users').update({
      name, age: parseInt(age), gender, location,
      height, salary, forty_yard_dash: fortyYard,
      fav_quote: favQuote, fav_date_place: favDatePlace,
      photos, onboarding_complete: true,
    }).eq('id', user.id)

    if (userError) { toast.error('Save failed'); setLoading(false); return }

    // Delete existing prompts and re-insert
    await supabase.from('prompts').delete().eq('user_id', user.id)
    const promptsToInsert = prompts
      .filter(p => p.answer.trim())
      .map(p => ({ user_id: user.id, question: p.question, answer: p.answer }))
    if (promptsToInsert.length > 0) {
      await supabase.from('prompts').insert(promptsToInsert)
    }

    toast.success("You're all set!")
    router.push('/discover')
  }

  const canProceed = () => {
    if (step === 0) return name && age && location
    if (step === 1) return height
    if (step === 2) return true
    if (step === 3) return prompts.some(p => p.answer.trim())
    if (step === 4) return photos.length > 0
    return true
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else saveAndFinish()
  }

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-8 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-center">
          <span className="text-white">2</span><span className="text-[#1E90FF]"> Manz</span>
        </h1>
        {/* Progress bar */}
        <div className="flex gap-1 mt-6">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all ${i <= step ? 'bg-[#1E90FF]' : 'bg-white/10'}`}
            />
          ))}
        </div>
        <p className="text-center text-white/40 text-sm mt-2">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      <div className="flex-1 max-w-sm mx-auto w-full">
        {/* STEP 0: Basics */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-6">Tell us about yourself</h2>
            <input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field"
            />
            <input
              placeholder="Age"
              type="number"
              min="18"
              max="99"
              value={age}
              onChange={e => setAge(e.target.value)}
              className="input-field"
            />
            <div className="flex gap-3">
              {(['male', 'female', 'other'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-3 rounded-2xl capitalize font-medium transition-all ${
                    gender === g
                      ? 'bg-[#1E90FF] text-white'
                      : 'bg-[#0F2040] text-white/60 border border-[#1E90FF22]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <input
              placeholder="Location (e.g. Atlanta, GA)"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="input-field"
            />
          </div>
        )}

        {/* STEP 1: Stats */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-6">The stats</h2>
            <div>
              <label className="text-white/50 text-xs mb-2 block">Height</label>
              <input
                placeholder="e.g. 6'1"
                value={height}
                onChange={e => setHeight(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-2 block">Annual Salary</label>
              <input
                placeholder="e.g. $80k-$100k"
                value={salary}
                onChange={e => setSalary(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-2 block">40-Yard Dash Time</label>
              <input
                placeholder="e.g. 4.5s"
                value={fortyYard}
                onChange={e => setFortyYard(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Favorites */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-6">Your favorites</h2>
            <div>
              <label className="text-white/50 text-xs mb-2 block">Favorite Quote</label>
              <textarea
                placeholder="Drop your favorite quote..."
                value={favQuote}
                onChange={e => setFavQuote(e.target.value)}
                rows={3}
                className="input-field resize-none"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-2 block">Favorite Date Spot</label>
              <input
                placeholder="e.g. Rooftop bar, bowling alley..."
                value={favDatePlace}
                onChange={e => setFavDatePlace(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Prompts */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-2">Choose 3 prompts</h2>
            <p className="text-white/40 text-sm mb-6">Let people know what you&apos;re about</p>
            {prompts.map((p, i) => (
              <div key={i} className="bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF22]">
                <select
                  value={p.question}
                  onChange={e => {
                    const updated = [...prompts]
                    updated[i].question = e.target.value
                    setPrompts(updated)
                  }}
                  className="w-full bg-transparent text-[#1E90FF] font-semibold text-sm mb-3 focus:outline-none"
                >
                  {PROMPT_QUESTIONS.map(q => (
                    <option key={q} value={q} className="bg-[#0F2040]">{q}</option>
                  ))}
                </select>
                <textarea
                  placeholder="Your answer..."
                  value={p.answer}
                  onChange={e => {
                    const updated = [...prompts]
                    updated[i].answer = e.target.value
                    setPrompts(updated)
                  }}
                  rows={2}
                  className="w-full bg-transparent text-white placeholder-white/30 resize-none focus:outline-none text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* STEP 4: Photos */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2">Add your photos</h2>
            <p className="text-white/40 text-sm mb-6">Upload up to 6 photos</p>
            <div className="grid grid-cols-3 gap-3">
              {photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-[#0F2040]">
                  <Image src={url} alt="" fill className="object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-[#1E90FF44] flex flex-col items-center justify-center text-[#1E90FF] text-3xl hover:border-[#1E90FF] transition-colors"
                >
                  {uploadingPhoto ? <span className="text-base">...</span> : '+'}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        )}

        {/* STEP 5: Link 2Man */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2">Link your 2man</h2>
            <p className="text-white/40 text-sm mb-6">
              Find your boy and go double dates together
            </p>
            {!requestSent ? (
              <>
                <div className="flex gap-2">
                  <input
                    placeholder="Search by name or email"
                    value={twoManSearch}
                    onChange={e => setTwoManSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchTwoMan()}
                    className="input-field flex-1"
                  />
                  <button
                    onClick={searchTwoMan}
                    className="bg-[#1E90FF] px-4 rounded-2xl text-white font-bold"
                  >
                    Search
                  </button>
                </div>
                <div className="space-y-2">
                  {searchResults.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 bg-[#0F2040] rounded-2xl p-4 border border-[#1E90FF22]"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#1E90FF22] overflow-hidden flex-shrink-0">
                        {u.photos?.[0] && (
                          <Image src={u.photos[0]} alt="" width={48} height={48} className="object-cover w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{u.name || u.email}</p>
                        <p className="text-white/40 text-xs">{u.email}</p>
                      </div>
                      <button
                        onClick={() => sendTwoManRequest(u.id)}
                        className="bg-[#1E90FF] text-white text-sm font-bold px-3 py-2 rounded-xl"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <div className="text-5xl mb-4">✓</div>
                <p className="text-[#1E90FF] font-bold text-lg">Request sent!</p>
                <p className="text-white/40 text-sm mt-2">They&apos;ll accept it in the app</p>
              </div>
            )}
            <p className="text-white/30 text-xs text-center mt-4">
              You can also link later from your profile
            </p>
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div className="max-w-sm mx-auto w-full mt-8">
        <button
          onClick={next}
          disabled={!canProceed() || loading}
          className="w-full bg-[#1E90FF] hover:bg-[#1a7fe0] disabled:opacity-30 text-white font-bold py-4 rounded-2xl transition-all"
        >
          {loading ? 'Saving...' : step === STEPS.length - 1 ? "Let's Go" : 'Continue'}
        </button>
        {step === STEPS.length - 1 && (
          <button
            onClick={() => router.push('/discover')}
            className="w-full text-white/30 text-sm py-3 mt-2"
          >
            Skip for now
          </button>
        )}
      </div>

      <style jsx global>{`
        .input-field {
          width: 100%;
          background: #0F2040;
          border: 1px solid #1E90FF22;
          border-radius: 1rem;
          padding: 1rem;
          color: white;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus {
          border-color: #1E90FF;
        }
        .input-field::placeholder {
          color: rgba(255,255,255,0.3);
        }
        option {
          background: #0F2040;
        }
      `}</style>
    </div>
  )
}

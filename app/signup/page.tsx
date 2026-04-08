'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account created!')
      router.push('/onboarding')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0A1628]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-white">2</span>
            <span className="text-[#1E90FF]"> Manz</span>
          </h1>
          <p className="text-white/40 mt-2 text-sm">Double dates. Double the fun.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-[#0F2040] border border-[#1E90FF22] rounded-2xl px-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-[#1E90FF] transition-colors"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-[#0F2040] border border-[#1E90FF22] rounded-2xl px-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-[#1E90FF] transition-colors"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1E90FF] hover:bg-[#1a7fe0] disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#1E90FF] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

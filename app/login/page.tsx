'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      router.push('/discover')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0A1628]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-white">2</span>
            <span className="text-[#1E90FF]"> Manz</span>
          </h1>
          <p className="text-white/40 mt-2 text-sm">Double dates. Double the fun.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#0F2040] border border-[#1E90FF22] rounded-2xl px-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-[#1E90FF] transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#0F2040] border border-[#1E90FF22] rounded-2xl px-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-[#1E90FF] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1E90FF] hover:bg-[#1a7fe0] disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          No account?{' '}
          <Link href="/signup" className="text-[#1E90FF] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

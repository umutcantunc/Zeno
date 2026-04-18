'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.20455C17.64 8.56637 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  )
}

const STEPS = ['Hesap', 'Profil'] as const
type Step = 0 | 1

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(0)

  // Adım 0
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  // Adım 1 — profil (isteğe bağlı)
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [country, setCountry] = useState('TR')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleAccountStep(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) {
      setError(error.message === 'User already registered' ? 'Bu e-posta zaten kayıtlı.' : error.message)
      setLoading(false)
      return
    }

    setUserId(data.user?.id ?? null)
    setLoading(false)
    setStep(1)
  }

  async function handleProfileStep(skip = false) {
    setLoading(true)
    const supabase = createClient()

    if (!skip && userId) {
      await supabase.from('users').update({
        full_name: fullName || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        country: country || 'TR',
      }).eq('id', userId)
    }

    // Hard redirect → middleware session'ı güvenle okur
    window.location.href = '/dashboard'
  }

  if (step === 1) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
          <div>
            <div className="flex gap-2 mb-6">
              {STEPS.map((s, i) => (
                <div key={s} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-purple-500' : 'bg-white/10'}`} />
              ))}
            </div>
            <h2 className="text-xl font-bold text-white">Seni biraz tanıyalım</h2>
            <p className="text-slate-400 text-sm mt-1">Zeno sana daha iyi yardım edebilsin. İstersen atlayabilirsin.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">Yaş <span className="text-slate-500">(isteğe bağlı)</span></label>
              <input
                type="number" min="13" max="100" value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Örn: 28"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">Cinsiyet <span className="text-slate-500">(isteğe bağlı)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: 'Erkek' },
                  { value: 'female', label: 'Kadın' },
                  { value: 'other', label: 'Diğer' },
                  { value: 'prefer_not', label: 'Belirtmek istemiyorum' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      gender === opt.value
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">Ülke <span className="text-slate-500">(isteğe bağlı)</span></label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors"
              >
                <option value="TR">Türkiye</option>
                <option value="DE">Almanya</option>
                <option value="NL">Hollanda</option>
                <option value="GB">İngiltere</option>
                <option value="US">Amerika</option>
                <option value="OTHER">Diğer</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleProfileStep(true)}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl transition-colors text-sm"
            >
              Atla
            </button>
            <button
              onClick={() => handleProfileStep(false)}
              disabled={loading}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Kaydediliyor…' : 'Devam Et →'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
        <div>
          <div className="flex gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-purple-500' : 'bg-white/10'}`} />
            ))}
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">Z</div>
            <h1 className="text-2xl font-bold text-white">Hesap Oluştur</h1>
            <p className="text-slate-400 mt-1 text-sm">Zihinsel yolculuğunuza başlayın</p>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl transition-colors text-sm"
        >
          <GoogleIcon />
          {googleLoading ? 'Yönlendiriliyor…' : 'Google ile Kayıt Ol'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-500">ya da e-posta ile</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={handleAccountStep} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-slate-300 font-medium" htmlFor="fullName">Ad Soyad</label>
            <input
              id="fullName" type="text" autoComplete="name" required
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınız Soyadınız"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-slate-300 font-medium" htmlFor="email">E-posta</label>
            <input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="siz@sirket.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-slate-300 font-medium" htmlFor="password">Şifre</label>
            <input
              id="password" type="password" autoComplete="new-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit" disabled={loading || googleLoading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Hesap oluşturuluyor…' : 'Devam Et →'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm">
          Hesabınız var mı?{' '}
          <Link href="/auth/login" className="text-purple-400 hover:text-purple-300 transition-colors">Giriş yapın</Link>
        </p>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.20455C17.64 8.56637 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials'))  return 'E-posta veya şifre hatalı.'
  if (msg.includes('Email not confirmed'))         return 'E-posta adresinizi doğrulamanız gerekiyor. Lütfen gelen kutunuzu kontrol edin.'
  if (msg.includes('Too many requests'))           return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyin.'
  if (msg.includes('User not found'))              return 'Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.'
  if (msg.includes('Invalid email'))               return 'Geçersiz e-posta adresi.'
  if (msg.includes('signup is disabled'))          return 'Kayıt şu an devre dışı.'
  return msg
}

// useSearchParams Suspense gerektirir — ayrı iç bileşen
function LoginForm() {
  const searchParams = useSearchParams()

  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [error, setError]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [googleLoading, setGoogleLoading]     = useState(false)

  // ?error=oauth → callback'ten gelen OAuth hatası
  useEffect(() => {
    if (searchParams.get('error') === 'oauth') {
      setError('Google girişi sırasında bir hata oluştu. Lütfen tekrar dene.')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      console.error('[Login] signInWithPassword error:', signInError)
      setError(translateError(signInError.message))
      setLoading(false)
      return
    }

    // Session null ise (örn. email doğrulanmamış)
    if (!data.session) {
      console.warn('[Login] signInWithPassword returned no session')
      setError('Oturum açılamadı. E-posta adresinizi doğruladığınızdan emin olun.')
      setLoading(false)
      return
    }

    console.log('[Login] Giriş başarılı, dashboard\'a yönlendiriliyor…')
    // Hard redirect: browser cookie'yi bir sonraki istekle sunucuya güvenle gönderir
    window.location.href = '/dashboard'
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError('')
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) {
      console.error('[Login] Google OAuth error:', oauthError)
      setError(translateError(oauthError.message))
      setGoogleLoading(false)
    }
    // Başarılıysa Google'a yönlendirir, loading kalır
  }

  return (
    <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">Z</div>
        <h1 className="text-2xl font-bold text-white">Hoş Geldiniz</h1>
        <p className="text-slate-400 mt-1 text-sm">Zeno hesabınıza giriş yapın</p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl transition-colors duration-200 text-sm"
      >
        <GoogleIcon />
        {googleLoading ? 'Yönlendiriliyor…' : 'Google ile Giriş Yap'}
      </button>

      {/* Ayırıcı */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-slate-500">ya da e-posta ile</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm text-slate-300 font-medium" htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="siz@sirket.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-300 font-medium" htmlFor="password">Şifre</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors duration-200"
        >
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </form>

      <p className="text-center text-slate-500 text-sm">
        Hesabınız yok mu?{' '}
        <Link href="/auth/register" className="text-purple-400 hover:text-purple-300 transition-colors">
          Kayıt olun
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 flex items-center justify-center h-64">
          <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  )
}

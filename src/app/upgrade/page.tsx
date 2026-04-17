'use client'

import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

const PLANS = [
  {
    id: 'free',
    name: 'Ücretsiz',
    price: '₺0',
    period: 'sonsuza kadar',
    color: 'border-slate-700',
    badge: null,
    features: [
      { text: 'Zeno modu', ok: true },
      { text: 'Günlük ruh hali takibi', ok: true },
      { text: 'Son 3 sohbet geçmişi', ok: true },
      { text: 'Temel hafıza (10 madde)', ok: true },
      { text: 'Diğer 4 kişilik modu', ok: false },
      { text: 'Sınırsız sohbet geçmişi', ok: false },
      { text: 'Dinamik cevap önerileri', ok: false },
      { text: 'Haftalık AI özeti', ok: false },
    ],
    cta: null,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₺79',
    period: 'aylık',
    color: 'border-purple-500',
    badge: 'En Popüler',
    features: [
      { text: 'Zeno modu', ok: true },
      { text: 'Günlük ruh hali takibi', ok: true },
      { text: 'Sınırsız sohbet geçmişi', ok: true },
      { text: 'Sınırsız hafıza', ok: true },
      { text: 'Tüm 5 kişilik modu', ok: true },
      { text: 'Dinamik cevap önerileri', ok: true },
      { text: 'Haftalık AI özeti', ok: true },
      { text: 'Öncelikli destek', ok: false },
    ],
    cta: 'Premium\'a Geç',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₺149',
    period: 'aylık',
    color: 'border-amber-500',
    badge: 'Yakında',
    features: [
      { text: 'Premium\'ın her şeyi', ok: true },
      { text: 'Gelişmiş analitik', ok: true },
      { text: 'Öncelikli destek', ok: true },
      { text: 'Erken erişim özellikleri', ok: true },
      { text: 'AI kişilik raporu (aylık)', ok: true },
      { text: 'Dışa aktarma (PDF/JSON)', ok: true },
      { text: 'Özel mod oluşturma', ok: false },
      { text: 'Aile paylaşımı', ok: false },
    ],
    cta: 'Pro\'ya Geç',
  },
]

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors text-sm">← Geri</Link>
        <h1 className="text-base font-semibold text-white">Planlar</h1>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10">
        {/* Hero */}
        <div className="text-center mb-10 space-y-3">
          <div className="w-14 h-14 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            ✨
          </div>
          <h2 className="text-2xl font-bold text-white">Zeno&apos;nun tüm gücüne eriş</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
            Tüm kişilik modları, sınırsız hafıza ve haftalık özetlerle zihinsel iyiliğini bir adım öteye taşı.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-300 text-xs font-medium">Ödeme sistemi yakında aktif olacak</span>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-slate-800/60 border-2 rounded-2xl p-5 flex flex-col ${plan.color} ${plan.id === 'premium' ? 'ring-1 ring-purple-500/30' : ''}`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold rounded-full ${
                  plan.id === 'premium' ? 'bg-purple-600 text-white' : 'bg-amber-600 text-white'
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm">/ {plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f.text} className={`flex items-start gap-2 text-xs ${f.ok ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span className={`mt-0.5 shrink-0 text-sm ${f.ok ? 'text-emerald-400' : 'text-slate-700'}`}>
                      {f.ok ? '✓' : '✕'}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>

              {plan.cta && (
                <button
                  disabled
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all opacity-50 cursor-not-allowed ${
                    plan.id === 'premium'
                      ? 'bg-purple-600 text-white'
                      : 'bg-amber-600/50 text-white'
                  }`}
                >
                  {plan.cta} (Yakında)
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          Sorularınız için: <span className="text-slate-500">destek@getzen.app</span>
        </p>
      </div>

      <BottomNav />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PersonalityMode } from '@/lib/systemPrompt'

const MODES: { id: PersonalityMode; emoji: string; label: string; desc: string; opening: string }[] = [
  {
    id: 'zeno',
    emoji: '⚖️',
    label: 'Zeno',
    desc: 'Dengeli, analitik empati ile stoacı bilgelik. Ne çok soğuk ne çok sıcak.',
    opening: '"Bugün zihnini en çok ne yoruyor?"',
  },
  {
    id: 'dost',
    emoji: '☕',
    label: 'Dost',
    desc: 'Samimi, rahat ama sınırını biliyor. Sevinçte gerçekten sevinir, üzüntüde yanında oturur.',
    opening: '"Naber, bugün nasılsın gerçekten?"',
  },
  {
    id: 'koc',
    emoji: '🎯',
    label: 'Koç',
    desc: 'Direkt, aksiyona odaklı. Şımartmaz, netlik verir. Asıl odak: ilerleme.',
    opening: '"Bugün hangi konuda netlik arıyorsun?"',
  },
  {
    id: 'bilge',
    emoji: '🌙',
    label: 'Bilge',
    desc: 'Az konuşur, derin sorar. Cevap vermez, soruyla aydınlatır. Sabırlı.',
    opening: '"Seni buraya getiren ne?"',
  },
  {
    id: 'dinleyici',
    emoji: '🌊',
    label: 'Dinleyici',
    desc: 'Tavsiye vermez, sadece duyar ve doğrular. Asla çözüm üretmez, sadece var olur.',
    opening: '"Buradayım. Ne taşıyorsun bugün?"',
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [country, setCountry] = useState('TR')
  const [selectedMode, setSelectedMode] = useState<PersonalityMode>('zeno')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)

      const { data } = await supabase
        .from('users')
        .select('full_name, age, gender, country, personality_mode')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setFullName(data.full_name ?? '')
        setAge(data.age?.toString() ?? '')
        setGender(data.gender ?? '')
        setCountry(data.country ?? 'TR')
        setSelectedMode((data.personality_mode as PersonalityMode) ?? 'zeno')
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('users').update({
      full_name: fullName || null,
      age: age ? parseInt(age) : null,
      gender: gender || null,
      country: country || 'TR',
      personality_mode: selectedMode,
    }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-4">
        <Link href="/chat" className="text-slate-400 hover:text-white transition-colors text-sm">← Sohbete dön</Link>
        <h1 className="text-base font-semibold text-white">Ayarlar</h1>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-10">

        {/* Profil */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Profil</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">Ad Soyad</label>
              <input
                type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Adınız Soyadınız"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-300 font-medium">Yaş</label>
                <input
                  type="number" min="13" max="100" value={age} onChange={(e) => setAge(e.target.value)}
                  placeholder="Örn: 28"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-300 font-medium">Ülke</label>
                <select
                  value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors"
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
            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">Cinsiyet</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: 'Erkek' },
                  { value: 'female', label: 'Kadın' },
                  { value: 'other', label: 'Diğer' },
                  { value: 'prefer_not', label: 'Belirtmek istemiyorum' },
                ].map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setGender(opt.value)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      gender === opt.value
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Kişilik Modu */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Zeno Kişilik Modu</h2>
            <p className="text-slate-500 text-xs mt-1">Varsayılan mod — her sohbette bu kimlikle karşılaşırsın.</p>
          </div>
          <div className="space-y-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMode(m.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 ${
                  selectedMode === m.id
                    ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500/50'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{m.label}</span>
                      {selectedMode === m.id && (
                        <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">Seçili</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{m.desc}</p>
                    <p className="text-slate-500 text-xs mt-1.5 italic">{m.opening}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Hafıza */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Zeno Hafızası</h2>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Hafıza Yönetimi</p>
              <p className="text-slate-500 text-xs mt-0.5">Zeno&apos;nun senin hakkında öğrendiklerini gör ve düzenle</p>
            </div>
            <Link
              href="/memory"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              Görüntüle →
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}

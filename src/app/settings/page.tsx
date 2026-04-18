'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

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
  const [notifWeekly, setNotifWeekly] = useState(false)
  const [notifTips, setNotifTips] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceSpeed, setVoiceSpeed] = useState(1)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)

      const { data } = await supabase
        .from('users')
        .select('full_name, age, gender, country')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setFullName(data.full_name ?? '')
        setAge(data.age?.toString() ?? '')
        setGender(data.gender ?? '')
        setCountry(data.country ?? 'TR')
      }
      setLoading(false)
    })

    // Ses tercihlerini localStorage'dan yükle
    const storedVoice = localStorage.getItem('zeno_voice_enabled')
    if (storedVoice !== null) setVoiceEnabled(storedVoice !== 'false')
    const storedSpeed = localStorage.getItem('zeno_voice_speed')
    if (storedSpeed !== null) setVoiceSpeed(parseFloat(storedSpeed))
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
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors text-sm">← Ana Sayfa</Link>
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

        {/* Kişilik Modu — sohbet ekranındaki mod badge'inden değiştirilebilir */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Zeno Kişilik Modu</h2>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Mod Seçimi</p>
              <p className="text-slate-500 text-xs mt-0.5">Sohbet ekranındaki mod badge&apos;ine tıklayarak değiştirebilirsin</p>
            </div>
            <Link
              href="/chat"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium shrink-0"
            >
              Sohbete git →
            </Link>
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

        {/* Sesli Sohbet */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Sesli Sohbet</h2>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl divide-y divide-slate-700">
            {/* Ses açık/kapalı */}
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">Sesli Yanıt</p>
                <p className="text-slate-500 text-xs mt-0.5">Zeno sesli olarak yanıt versin</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !voiceEnabled
                  setVoiceEnabled(next)
                  localStorage.setItem('zeno_voice_enabled', String(next))
                }}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${voiceEnabled ? 'bg-purple-600' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${voiceEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {/* Hız slider */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Konuşma Hızı</p>
                  <p className="text-slate-500 text-xs mt-0.5">Zeno&apos;nun ses okuma hızı</p>
                </div>
                <span className="text-sm font-semibold text-purple-400">{voiceSpeed.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.1"
                value={voiceSpeed}
                disabled={!voiceEnabled}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setVoiceSpeed(val)
                  localStorage.setItem('zeno_voice_speed', String(val))
                }}
                className="w-full accent-purple-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-xs text-slate-600">
                <span>Yavaş (0.8×)</span>
                <span>Normal (1.0×)</span>
                <span>Hızlı (1.2×)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Bildirimler */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Bildirimler</h2>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl divide-y divide-slate-700">
            {/* Haftalık özet */}
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">Haftalık Özet</p>
                <p className="text-slate-500 text-xs mt-0.5">Her hafta ruh hali özetin gönderilsin</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifWeekly((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notifWeekly ? 'bg-purple-600' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${notifWeekly ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            {/* Günlük ipuçları */}
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">Günlük İpuçları</p>
                <p className="text-slate-500 text-xs mt-0.5">Stoacı alıntı ve kişisel gelişim önerileri</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifTips((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notifTips ? 'bg-purple-600' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${notifTips ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
          <p className="text-slate-600 text-xs px-1">Bildirimler yakında aktif olacak.</p>
        </section>

        {/* Hesap */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Hesap</h2>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium">Hesabımı Sil</p>
                <p className="text-xs text-red-500/70 mt-0.5">Tüm veriler kalıcı olarak silinir</p>
              </div>
            </button>
          </div>
        </section>

      </div>

      {/* Hesap silme onay modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-5">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="text-white font-semibold text-base">Hesabını silmek istediğinden emin misin?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Tüm sohbetlerin, hafıza bilgilerin ve ruh hali geçmişin kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 text-xs">Onaylamak için <span className="text-red-400 font-mono">SİL</span> yaz:</p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="SİL"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm outline-none focus:border-red-500 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                disabled={deleteInput !== 'SİL'}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                onClick={() => {
                  // TODO: gerçek silme işlemi
                  alert('Hesap silme özelliği yakında aktif olacak.')
                  setShowDeleteConfirm(false)
                  setDeleteInput('')
                }}
              >
                Hesabı Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

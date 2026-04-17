'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const Line = dynamic(() => import('react-chartjs-2').then((m) => m.Line), { ssr: false })

// ── 30 Stoacı alıntı ──────────────────────────────────────────────────────────
const STOIC_QUOTES = [
  { text: 'Başkalarının elinde olan şeyleri değil, kendi elinde olanları arzula.', author: 'Epiktetos' },
  { text: 'Bugün iyi yaşa. Çünkü yarın başka bir bugündür.', author: 'Marcus Aurelius' },
  { text: 'Dışarıdan gelen her şey geçicidir; zihnin derinliği ise kalıcıdır.', author: 'Seneca' },
  { text: 'Engel yolu tıkamaz, aksine yolu gösterir.', author: 'Marcus Aurelius' },
  { text: 'Düşüncelerini kontrol et; onlar karakterini şekillendirir.', author: 'Epiktetos' },
  { text: 'Ne kadar az şeye ihtiyacın olursa o kadar özgür olursun.', author: 'Seneca' },
  { text: 'Her sabah yeniden başlamak bir ayrıcalıktır.', author: 'Marcus Aurelius' },
  { text: 'Acı çekmek bir seçim değil; acıya nasıl tepki vereceğin ise bir seçimdir.', author: 'Epiktetos' },
  { text: 'Zamanı boşa harcama; bir daha geri gelmez.', author: 'Seneca' },
  { text: 'Kendini tanımak tüm bilgeliklerin başıdır.', author: 'Marcus Aurelius' },
  { text: 'Sadece bugünün yükünü taşı; dünü bırak, yarını bekleme.', author: 'Seneca' },
  { text: 'İnsanları şeyler değil, şeyler hakkındaki düşünceler rahatsız eder.', author: 'Epiktetos' },
  { text: 'Küçük şeylerde mükemmellik büyük şeyleri mümkün kılar.', author: 'Marcus Aurelius' },
  { text: 'En yüksek iyilik, bugün iyi olmaktır.', author: 'Seneca' },
  { text: 'Başkalarının seni ne zannettiği onların problemi; senin ne olduğun senin problemindir.', author: 'Epiktetos' },
  { text: 'Hayatın uzunluğunu değil derinliğini artır.', author: 'Seneca' },
  { text: 'Şüphelerin içinde bile bir şey kesindir: şu an bu anı yaşıyorsun.', author: 'Marcus Aurelius' },
  { text: 'Güçlü olan başkalarını yenen değil, kendini yenendir.', author: 'Epiktetos' },
  { text: 'Kaybetme korkusu, asla kazanamama riskini taşır.', author: 'Seneca' },
  { text: 'Yapamayacaklarını bırak; yapabileceklerine odaklan.', author: 'Marcus Aurelius' },
  { text: 'Huzur dışarıda değil, içindedir.', author: 'Seneca' },
  { text: 'Zihni sakin tutan, tüm fırtınaları atlatır.', author: 'Epiktetos' },
  { text: 'Her gün öğrenmeye hazır ol; hayat en büyük öğretmendir.', author: 'Marcus Aurelius' },
  { text: 'Ölümü düşünmek, yaşamayı öğretir.', author: 'Seneca' },
  { text: 'Başarısızlık, henüz tamamlanmamış bir derstir.', author: 'Epiktetos' },
  { text: 'Doğaya uygun yaşa; en büyük mutluluk budur.', author: 'Marcus Aurelius' },
  { text: 'Söylemek istediğini düşün, düşündüğünü söyleme.', author: 'Seneca' },
  { text: 'Korkularınla yüzleş; yoksa onlar seninle yüzleşecek.', author: 'Epiktetos' },
  { text: 'Geçmişe sızlanma; gelecekten korkma. Şimdiyi iyi kullan.', author: 'Marcus Aurelius' },
  { text: 'Kendi içindeki düzeni bul; dışarısı kendiliğinden düzelir.', author: 'Seneca' },
]

// Her gün için tutarlı alıntı (aynı gün aynı alıntı)
function getDailyQuote() {
  const d = new Date()
  const idx = (d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % STOIC_QUOTES.length
  return STOIC_QUOTES[idx]
}

// ── Saat dilimi ───────────────────────────────────────────────────────────────
function getGreeting(name: string | null): string {
  const hour = new Date().getHours()
  const suffix = name ? ` ${name}` : ''
  if (hour >= 6 && hour < 12)  return `Günaydın${suffix} ☀️`
  if (hour >= 12 && hour < 18) return `İyi öğlenler${suffix} 👋`
  if (hour >= 18 && hour < 22) return `İyi akşamlar${suffix} 🌙`
  return `İyi geceler${suffix} 🌙`
}

// ── Mod ───────────────────────────────────────────────────────────────────────
const MODE_SUBTITLE: Record<string, string> = {
  zeno:       'Zihnin bugün nerede?',
  dost:       'Nasıl gidiyor, gerçekten?',
  koc:        'Bugün ne başarmak istiyorsun?',
  bilge:      'Bugün seni düşündüren ne var?',
  dinleyici:  'Seni dinlemeye hazırım.',
}

const MODE_HEX: Record<string, string> = {
  zeno:       '#6D28D9',
  dost:       '#D97706',
  koc:        '#1D4ED8',
  bilge:      '#065F46',
  dinleyici:  '#9D174D',
}

const MODE_ACCENT: Record<string, string> = {
  zeno:       'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40',
  dost:       'bg-amber-600  hover:bg-amber-500  shadow-amber-900/40',
  koc:        'bg-blue-700   hover:bg-blue-600   shadow-blue-900/40',
  bilge:      'bg-emerald-800 hover:bg-emerald-700 shadow-emerald-900/40',
  dinleyici:  'bg-rose-800   hover:bg-rose-700   shadow-rose-900/40',
}

// ── Mood ──────────────────────────────────────────────────────────────────────
const MOOD_OPTIONS = [
  { emoji: '😔', score: 1,  label: 'Çok kötü', activeRing: 'ring-red-500',    activeBg: 'bg-red-500/20' },
  { emoji: '😟', score: 3,  label: 'Kötü',     activeRing: 'ring-orange-500', activeBg: 'bg-orange-500/20' },
  { emoji: '😐', score: 5,  label: 'Orta',     activeRing: 'ring-amber-500',  activeBg: 'bg-amber-500/20' },
  { emoji: '🙂', score: 7,  label: 'İyi',      activeRing: 'ring-lime-500',   activeBg: 'bg-lime-500/20' },
  { emoji: '😊', score: 10, label: 'Harika',   activeRing: 'ring-emerald-500', activeBg: 'bg-emerald-500/20' },
]

function scoreToMoodIndex(score: number): number {
  if (score <= 2) return 0
  if (score <= 4) return 1
  if (score <= 6) return 2
  if (score <= 8) return 3
  return 4
}

// ── Chart ─────────────────────────────────────────────────────────────────────
const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

interface MoodLog { score: number; created_at: string }
interface Conversation { title: string | null; created_at: string }

export default function DashboardPage() {
  const router = useRouter()

  const [greeting, setGreeting]             = useState('')
  const [userName, setUserName]             = useState<string | null>(null)
  const [userId, setUserId]                 = useState<string | null>(null)
  const [activeMode, setActiveMode]         = useState<string>('zeno')
  const [loading, setLoading]               = useState(true)
  const [isPremium, setIsPremium]           = useState(false)

  const [moodLogs, setMoodLogs]             = useState<MoodLog[]>([])
  const [todayMoodIdx, setTodayMoodIdx]     = useState<number | null>(null)
  const [moodSaving, setMoodSaving]         = useState(false)
  const [moodSaved, setMoodSaved]           = useState(false)

  const [memoryCount, setMemoryCount]       = useState(0)
  const [lastConv, setLastConv]             = useState<Conversation | null>(null)

  const [weekSummary, setWeekSummary]       = useState<string | null>(null)
  const [weekSummaryLoading, setWeekSummaryLoading] = useState(false)
  const [weekAvgMood, setWeekAvgMood]       = useState<string | null>(null)

  const quote = useMemo(() => getDailyQuote(), [])

  // Greeting: client-side only (avoids hydration mismatch)
  useEffect(() => {
    setGreeting(getGreeting(userName))
  }, [userName])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      const uid = session.user.id
      setUserId(uid)

      const { data: userData } = await supabase
        .from('users')
        .select('full_name, subscription_tier, is_admin, personality_mode')
        .eq('id', uid)
        .single()

      if (userData?.full_name) setUserName(userData.full_name.split(' ')[0])
      if (userData?.personality_mode) setActiveMode(userData.personality_mode)
      const premium = userData?.is_admin || userData?.subscription_tier === 'premium' || userData?.subscription_tier === 'pro'
      setIsPremium(!!premium)

      // Son 7 günün mood logları
      const since = new Date()
      since.setDate(since.getDate() - 6)
      since.setHours(0, 0, 0, 0)
      const { data: logs } = await supabase
        .from('mood_logs')
        .select('score, created_at')
        .eq('user_id', uid)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
      setMoodLogs(logs ?? [])

      // Bugünün mood'u
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayLog = (logs ?? []).find((l) => new Date(l.created_at) >= today)
      if (todayLog) setTodayMoodIdx(scoreToMoodIndex(todayLog.score))

      // Hafıza sayısı
      const { count } = await supabase
        .from('memory_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
      setMemoryCount(count ?? 0)

      // Son sohbet
      const { data: convData } = await supabase
        .from('conversations')
        .select('title, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (convData) setLastConv(convData)

      setLoading(false)
    })
  }, [router])

  async function handleMoodSelect(idx: number) {
    if (!userId || moodSaving) return
    setMoodSaving(true)
    setTodayMoodIdx(idx)
    const score = MOOD_OPTIONS[idx].score
    const supabase = createClient()
    await supabase.from('mood_logs').insert({ user_id: userId, score })
    setMoodLogs((prev) => {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const filtered = prev.filter((l) => new Date(l.created_at) < today)
      return [...filtered, { score, created_at: new Date().toISOString() }]
    })
    setMoodSaving(false)
    setMoodSaved(true)
    setTimeout(() => setMoodSaved(false), 2000)
  }

  async function fetchWeeklySummary() {
    setWeekSummaryLoading(true)
    try {
      const res = await fetch('/api/weekly-summary')
      const data = await res.json()
      setWeekSummary(data.summary ?? null)
      setWeekAvgMood(data.avgMood ?? null)
    } catch {
      setWeekSummary('Özet alınırken bir sorun oluştu.')
    } finally {
      setWeekSummaryLoading(false)
    }
  }

  function formatLastConv(conv: Conversation | null): string {
    if (!conv) return 'Henüz sohbet yok'
    const diff = Date.now() - new Date(conv.created_at).getTime()
    const days = Math.floor(diff / 86400000)
    const title = conv.title ? `"${conv.title.slice(0, 24)}…"` : 'bir sohbet'
    if (days === 0) return `Bugün ${title}`
    if (days === 1) return `Dün ${title}`
    return `${days} gün önce ${title}`
  }

  // Chart
  const { chartLabels, chartData } = useMemo(() => {
    const labels: string[] = []
    const data: (number | null)[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const nextDay = new Date(d); nextDay.setHours(23, 59, 59, 999)
      const found = moodLogs.find(
        (l) => new Date(l.created_at) >= d && new Date(l.created_at) <= nextDay
      )
      const dow = d.getDay()
      labels.push(DAY_LABELS[dow === 0 ? 6 : dow - 1])
      data.push(found ? found.score : null)
    }
    return { chartLabels: labels, chartData: data }
  }, [moodLogs])

  const hasChartData = chartData.some((v) => v !== null)

  const chartConfig = useMemo(() => ({
    labels: chartLabels,
    datasets: [{
      data: chartData,
      borderColor: MODE_HEX[activeMode] ?? '#7C3AED',
      backgroundColor: (MODE_HEX[activeMode] ?? '#7C3AED') + '20',
      borderWidth: 2,
      pointRadius: chartData.map((v) => (v !== null ? 4 : 0)),
      pointBackgroundColor: MODE_HEX[activeMode] ?? '#7C3AED',
      pointBorderColor: '#0f172a',
      pointBorderWidth: 2,
      tension: 0.4,
      fill: true,
      spanGaps: true,
    }],
  }), [chartLabels, chartData, activeMode])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${ctx.parsed.y}/10`
        }
      },
    },
    scales: {
      x: { grid: { color: 'rgba(51,65,85,0.4)' }, ticks: { color: '#475569', font: { size: 11 } } },
      y: { min: 0, max: 10, grid: { color: 'rgba(51,65,85,0.4)' }, ticks: { color: '#475569', stepSize: 5, font: { size: 11 } } },
    },
  }), [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const modeHex = MODE_HEX[activeMode] ?? '#6D28D9'
  const modeAccent = MODE_ACCENT[activeMode] ?? MODE_ACCENT.zeno

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">

      {/* ── BÖLÜM 1: KARŞILAMA ─────────────────────────────────────────────── */}
      <header
        className="px-5 pt-10 pb-7 transition-colors duration-700"
        style={{ background: `linear-gradient(to bottom, ${modeHex}12 0%, transparent 100%)` }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <h1 className="text-2xl font-bold text-white leading-snug">
              {greeting || 'Merhaba 👋'}
            </h1>
            <p className="text-base text-slate-400 mt-1 leading-relaxed">
              {MODE_SUBTITLE[activeMode] ?? MODE_SUBTITLE.zeno}
            </p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-colors mt-0.5"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        </div>
      </header>

      <div className="px-4 space-y-4">

        {/* ── BÖLÜM 2: ANA BUTON ──────────────────────────────────────────────── */}
        <Link
          href="/chat"
          className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl text-white font-semibold shadow-lg transition-all duration-150 active:scale-[0.98] ${modeAccent}`}
        >
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-base leading-tight">Zeno ile Konuş</p>
            <p className="text-white/60 text-xs mt-0.5 truncate">{formatLastConv(lastConv)}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 shrink-0">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        {/* ── BÖLÜM 3: BUGÜNÜN RUH HALİ ─────────────────────────────────────── */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {todayMoodIdx !== null ? 'Bugünkü ruh halin' : 'Şu an nasıl hissediyorsun?'}
            </p>
            {moodSaved && <span className="text-xs text-emerald-400 font-medium">✓ Kaydedildi</span>}
          </div>

          {/* 5 emoji seçici */}
          <div className="flex justify-between gap-2 mb-4">
            {MOOD_OPTIONS.map((opt, idx) => {
              const isSelected = todayMoodIdx === idx
              return (
                <button
                  key={idx}
                  onClick={() => handleMoodSelect(idx)}
                  disabled={moodSaving}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-150 ${
                    isSelected
                      ? `${opt.activeBg} ${opt.activeRing} ring-2 border-transparent`
                      : 'bg-slate-900/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <span className={`transition-all duration-200 ${isSelected ? 'text-3xl' : 'text-2xl'}`}>
                    {opt.emoji}
                  </span>
                  <span className={`text-[10px] font-medium leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 7 günlük grafik */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Son 7 Gün</p>
            {hasChartData ? (
              <div className="h-24">
                <Line data={chartConfig} options={chartOptions} />
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <p className="text-slate-700 text-xs">Ruh halin kaydedildikçe grafik oluşur</p>
              </div>
            )}
          </div>
        </div>

        {/* ── BÖLÜM 4: GÜNÜN DÜŞÜNCESİ ────────────────────────────────────────── */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">✦ Bugünün düşüncesi</p>
          <p className="text-slate-200 text-sm leading-relaxed italic font-light">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-slate-500 text-xs mt-3 font-medium">— {quote.author}</p>
        </div>

        {/* ── BÖLÜM 5: HIZLI ERİŞİM ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Hafıza */}
          <Link
            href="/memory"
            className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 hover:border-slate-600 hover:bg-slate-800/80 transition-all group"
          >
            <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="text-lg">🧠</span>
            </div>
            <p className="text-white font-semibold text-sm">Hafızam</p>
            <p className="text-slate-400 text-xs mt-0.5">
              {memoryCount > 0 ? `${memoryCount} bilgi maddesi` : 'Henüz boş'}
            </p>
          </Link>

          {/* Haftalık özet */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
            <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center mb-3">
              <span className="text-lg">📊</span>
            </div>
            <p className="text-white font-semibold text-sm">Haftalık Özet</p>
            {isPremium ? (
              weekSummary ? (
                <button
                  onClick={() => { setWeekSummary(null); setWeekAvgMood(null) }}
                  className="text-xs text-slate-500 hover:text-white mt-0.5 transition-colors"
                >
                  Kapat ✕
                </button>
              ) : (
                <button
                  onClick={fetchWeeklySummary}
                  disabled={weekSummaryLoading}
                  className="text-xs text-purple-400 hover:text-purple-300 mt-0.5 transition-colors disabled:opacity-50"
                >
                  {weekSummaryLoading ? 'Yükleniyor…' : 'Özet oluştur →'}
                </button>
              )
            ) : (
              <Link href="/upgrade" className="text-xs text-amber-400 mt-0.5 block">
                🔒 Premium
              </Link>
            )}
          </div>
        </div>

        {/* Haftalık özet içeriği (genişletilmiş) */}
        {weekSummary && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
            {weekAvgMood && (
              <p className="text-xs text-slate-500 mb-2">Haftalık ortalama: <span className="text-slate-300">{weekAvgMood}/10</span></p>
            )}
            <p className="text-slate-300 text-sm leading-relaxed">{weekSummary}</p>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  )
}

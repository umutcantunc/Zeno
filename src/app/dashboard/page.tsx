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

const STOIC_QUOTES = [
  { text: 'Başkalarının elinde olan şeyleri değil, kendi elinde olanları arzula.', author: 'Epiktetos' },
  { text: 'Bugün iyi yaşa. Çünkü yarın başka bir bugündür.', author: 'Marcus Aurelius' },
  { text: 'Dışarıdan gelen her şey geçicidir; ancak zihnin derinliği kalıcıdır.', author: 'Seneca' },
  { text: 'Engel, yolu tıkamaz. Aksine yolu gösterir.', author: 'Marcus Aurelius' },
  { text: 'Düşüncelerini kontrol et, çünkü onlar karakterini şekillendirir.', author: 'Epiktetos' },
  { text: 'Ne kadar az şeye ihtiyacın olursa, o kadar mutlu olursun.', author: 'Seneca' },
  { text: 'Her sabah yeniden başlamak bir ayrıcalıktır.', author: 'Marcus Aurelius' },
]

const DAY_LABELS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz']

function getGreeting(name: string | null): string {
  const hour = new Date().getHours()
  const suffix = name ? `, ${name}` : ''
  if (hour < 12) return 'Gunaydın' + suffix + ' ☀️'
  if (hour < 18) return 'İyi günler' + suffix + ' 👋'
  return 'İyi akşamlar' + suffix + ' 🌙'
}

function getMoodEmoji(score: number): string {
  if (score <= 2) return '😞'
  if (score <= 4) return '😕'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

function getMoodColor(score: number): string {
  if (score <= 3) return 'text-red-400'
  if (score <= 5) return 'text-amber-400'
  if (score <= 7) return 'text-yellow-400'
  return 'text-emerald-400'
}

interface MoodLog {
  score: number
  created_at: string
}

const MOOD_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([])
  const [todayMood, setTodayMood] = useState<number | null>(null)
  const [moodSaving, setMoodSaving] = useState(false)
  const [moodSaved, setMoodSaved] = useState(false)
  const [quote] = useState(() => STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)])
  const [memoryCount, setMemoryCount] = useState(0)
  const [weekSummary, setWeekSummary] = useState<string | null>(null)
  const [weekSummaryLoading, setWeekSummaryLoading] = useState(false)
  const [weekAvgMood, setWeekAvgMood] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      const uid = session.user.id
      setUserId(uid)

      const { data: userData } = await supabase
        .from('users').select('full_name, subscription_tier, is_admin').eq('id', uid).single()
      if (userData?.full_name) setUserName(userData.full_name.split(' ')[0])
      const premium = userData?.is_admin || userData?.subscription_tier === 'premium' || userData?.subscription_tier === 'pro'
      setIsPremium(!!premium)

      const since = new Date()
      since.setDate(since.getDate() - 6)
      since.setHours(0, 0, 0, 0)
      const { data: logs } = await supabase
        .from('mood_logs').select('score, created_at').eq('user_id', uid)
        .gte('created_at', since.toISOString()).order('created_at', { ascending: true })
      setMoodLogs(logs ?? [])

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayLog = (logs ?? []).find((l) => new Date(l.created_at) >= today)
      if (todayLog) setTodayMood(todayLog.score)

      const { count } = await supabase
        .from('memory_items').select('id', { count: 'exact', head: true }).eq('user_id', uid)
      setMemoryCount(count ?? 0)
      setLoading(false)
    })
  }, [router])

  async function handleMoodSelect(score: number) {
    if (!userId || moodSaving) return
    setMoodSaving(true)
    setTodayMood(score)
    const supabase = createClient()
    await supabase.from('mood_logs').insert({ user_id: userId, score })
    // Grafik verisini güncelle
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

  const { chartLabels, chartData } = useMemo(() => {
    const labels: string[] = []
    const data: (number | null)[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const nextDay = new Date(d)
      nextDay.setHours(23, 59, 59, 999)
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
    datasets: [
      {
        data: chartData,
        borderColor: '#7C3AED',
        backgroundColor: 'rgba(109,40,217,0.12)',
        borderWidth: 2,
        pointRadius: chartData.map((v) => (v !== null ? 5 : 0)),
        pointBackgroundColor: '#7C3AED',
        pointBorderColor: '#1e1b4b',
        pointBorderWidth: 2,
        tension: 0.4,
        fill: true,
        spanGaps: true,
      },
    ],
  }), [chartLabels, chartData])

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
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(51,65,85,0.5)' },
        ticks: { color: '#64748b' },
      },
      y: {
        min: 0,
        max: 10,
        grid: { color: 'rgba(51,65,85,0.5)' },
        ticks: { color: '#64748b', stepSize: 2 },
      },
    },
  }), [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="px-5 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{getGreeting(userName)}</h1>
            <p className="text-slate-500 text-sm mt-1">Bugün nasıl hissediyorsun?</p>
          </div>
          <Link href="/settings" className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
        </div>
      </header>

      <div className="px-5 space-y-4">
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Bugünkü Ruh Halin</p>
            {moodSaved && <span className="text-xs text-emerald-400 font-medium">✓ Kaydedildi</span>}
          </div>

          {todayMood && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{getMoodEmoji(todayMood)}</span>
              <div className="flex items-baseline gap-1">
                <span className={'text-2xl font-bold ' + getMoodColor(todayMood)}>{todayMood}</span>
                <span className="text-slate-500 text-sm">/10</span>
              </div>
              <span className="text-slate-500 text-xs ml-auto">Güncelle:</span>
            </div>
          )}

          {!todayMood && (
            <p className="text-slate-400 text-sm mb-3">Bugün nasıl hissediyorsun?</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {MOOD_SCORES.map((n) => (
              <button
                key={n}
                onClick={() => handleMoodSelect(n)}
                disabled={moodSaving}
                className={[
                  'w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 border',
                  todayMood === n
                    ? n <= 3 ? 'bg-red-500 text-white border-red-400'
                    : n <= 6 ? 'bg-amber-500 text-white border-amber-400'
                    : 'bg-emerald-500 text-white border-emerald-400'
                    : n <= 3 ? 'bg-red-500/20 text-red-300 hover:bg-red-500/40 border-red-500/30'
                    : n <= 6 ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 border-emerald-500/30',
                ].join(' ')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-2">1 = çok kötü · 10 = harika</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">Son 7 Gün</p>
          {hasChartData ? (
            <div className="h-36">
              <Line data={chartConfig} options={chartOptions} />
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center gap-2">
              <p className="text-slate-600 text-sm">Henüz veri yok</p>
              <p className="text-slate-700 text-xs">Zeno ile sohbet ettikçe grafik dolacak</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/chat" className="bg-purple-600/20 border border-purple-500/40 rounded-2xl p-5 hover:bg-purple-600/30 transition-colors group">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="text-lg">💬</span>
            </div>
            <p className="text-white font-semibold text-sm">Zeno ile konuş</p>
            <p className="text-purple-300 text-xs mt-0.5">Sohbet başlat</p>
          </Link>
          <Link href="/memory" className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-colors group">
            <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <span className="text-lg">🧠</span>
            </div>
            <p className="text-white font-semibold text-sm">Hafızam</p>
            <p className="text-slate-400 text-xs mt-0.5">{memoryCount > 0 ? memoryCount + ' bilgi' : 'Henüz boş'}</p>
          </Link>
        </div>

        {/* Haftalık Özet */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Bu Haftanın Özeti</p>
              {weekAvgMood && (
                <p className="text-slate-600 text-xs mt-0.5">Haftalık ortalama: {weekAvgMood}/10</p>
              )}
            </div>
            {isPremium && !weekSummary && (
              <button
                onClick={fetchWeeklySummary}
                disabled={weekSummaryLoading}
                className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-medium rounded-lg hover:bg-purple-600/30 transition-colors disabled:opacity-50"
              >
                {weekSummaryLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                    Hazırlanıyor…
                  </span>
                ) : 'Özet oluştur'}
              </button>
            )}
            {weekSummary && (
              <button
                onClick={() => { setWeekSummary(null); setWeekAvgMood(null) }}
                className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          {weekSummary ? (
            <p className="text-slate-300 text-sm leading-relaxed">{weekSummary}</p>
          ) : isPremium ? (
            <p className="text-slate-600 text-xs">Son 7 günün yansıması — butona bas, Zeno özetlesin.</p>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-slate-600 text-xs">Son 7 günün AI özeti</p>
              <Link
                href="/upgrade"
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors"
              >
                🔒 Premium
              </Link>
            </div>
          )}
        </div>

        {/* Günün Sözü */}
        <div className="bg-gradient-to-br from-purple-900/30 to-slate-800/60 border border-purple-500/20 rounded-2xl p-5">
          <p className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-3">✨ Günün Sözü</p>
          <p className="text-slate-200 text-sm leading-relaxed italic">&ldquo;{quote.text}&rdquo;</p>
          <p className="text-purple-400 text-xs mt-3 font-medium">— {quote.author}</p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

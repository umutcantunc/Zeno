'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface Conversation {
  id: string
  title: string | null
  mode: string | null
  created_at: string
  message_count: number
}

const MODE_EMOJIS: Record<string, string> = {
  zeno: '⚖️', dost: '☕', koc: '🎯', bilge: '🌙', dinleyici: '🌊',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Dün'
  if (days < 7) return `${days} gün önce`
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function ChatsPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }

      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('id', session.user.id)
        .single()
      const premium = userData?.is_admin || userData?.subscription_tier === 'premium' || userData?.subscription_tier === 'pro'
      setIsPremium(!!premium)

      await loadConversations(session.user.id, !!premium)
    })
  }, [router])

  async function loadConversations(uid: string, premium: boolean) {
    const supabase = createClient()
    let query = supabase
      .from('conversations')
      .select('id, title, mode, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    // Ücretsiz kullanıcılar sadece son 3 sohbeti görür
    if (!premium) {
      query = query.limit(3)
    }

    const { data: convs } = await query

    if (!convs) { setLoading(false); return }

    const withCounts = await Promise.all(
      convs.map(async (c) => {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
        return { ...c, message_count: count ?? 0 }
      })
    )
    setConversations(withCounts)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('messages').delete().eq('conversation_id', id)
    await supabase.from('conversations').delete().eq('id', id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-4">
        <Link href="/chat" className="text-slate-400 hover:text-white transition-colors text-sm">← Sohbete dön</Link>
        <h1 className="text-base font-semibold text-white">Sohbetlerim</h1>
        <div className="flex-1" />
        <Link
          href="/chat"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-300 hover:text-white hover:bg-purple-600/20 border border-purple-500/30 rounded-xl transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Yeni Sohbet
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-3xl">💬</p>
            <p className="text-slate-400 text-sm">Henüz sohbet yok</p>
            <Link href="/chat" className="inline-block px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm rounded-xl hover:bg-purple-600/30 transition-colors">
              İlk sohbeti başlat →
            </Link>
          </div>
        )}

        <div className="space-y-2">
          {conversations.map((conv) => (
            <div key={conv.id} className="group relative bg-slate-800/60 border border-slate-700 rounded-xl hover:border-slate-600 hover:bg-slate-800/80 transition-all duration-150">
              <Link
                href={`/chat/${conv.id}`}
                className="flex items-center gap-3 px-4 py-3.5 pr-12"
              >
                <span className="text-xl shrink-0">{MODE_EMOJIS[conv.mode ?? 'zeno'] ?? '⚖️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 text-sm font-medium truncate">
                    {conv.title || 'Başlıksız sohbet'}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {formatDate(conv.created_at)} · {conv.message_count} mesaj
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); setDeleteTarget(conv.id) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Sil"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Premium kilit banner — sadece ücretsiz kullanıcılara */}
        {!loading && !isPremium && conversations.length > 0 && (
          <div className="mt-4 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-900/20 to-slate-800/40 p-5 text-center space-y-3">
            <p className="text-2xl">🔒</p>
            <p className="text-sm font-semibold text-white">Tüm sohbet geçmişine erişmek için Premium</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Ücretsiz hesapta yalnızca son 3 sohbet görünür.<br />Premium&apos;a geç, tüm geçmişine eriş.
            </p>
            <Link
              href="/upgrade"
              className="inline-block px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Premium&apos;a Geç →
            </Link>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold text-base">Bu sohbeti sil</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Bu sohbet kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="space-y-2">
              <button
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget)}
                className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 border border-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors"
              >
                {deleting ? 'Siliniyor…' : '🗑️ Sohbeti sil'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

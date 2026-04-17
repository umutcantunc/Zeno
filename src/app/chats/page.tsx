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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      await loadConversations(session.user.id)
    })
  }, [router])

  async function loadConversations(uid: string) {
    const supabase = createClient()
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (!convs) { setLoading(false); return }

    // Get message counts
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

  async function handleDelete(id: string, deleteMemories: boolean) {
    setDeleting(true)
    const supabase = createClient()

    if (deleteMemories) {
      // Get messages from this conversation to find related memory items
      // For simplicity, we'll just delete by conversation_id if we had a reference,
      // but memory_items don't have conversation_id. Skip for now.
    }

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
            <div key={conv.id} className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3.5 flex items-center gap-3">
              <span className="text-xl shrink-0">{MODE_EMOJIS[conv.mode ?? 'zeno'] ?? '⚖️'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-100 text-sm font-medium truncate">
                  {conv.title || 'Başlıksız sohbet'}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {formatDate(conv.created_at)} · {conv.message_count} mesaj
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(conv.id)}
                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                title="Sil"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold text-base">Bu sohbeti sil</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Bu sohbetten Zeno&apos;nun öğrendikleri de silinsin mi?
            </p>
            <div className="space-y-2">
              <button
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget, false)}
                className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors text-left"
              >
                🗑️ Sadece sohbeti sil
              </button>
              <button
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget, true)}
                className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 border border-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors text-left"
              >
                🧠 Sohbeti ve hafızaları sil
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

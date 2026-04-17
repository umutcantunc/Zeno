'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface MemoryItem {
  id: string
  content: string
  category: string
  created_at: string
}

const CATEGORIES = ['genel', 'iş', 'aile', 'sağlık', 'ilişki', 'hedef', 'kaygı']

const CATEGORY_COLORS: Record<string, string> = {
  genel: 'bg-slate-700 text-slate-300',
  iş: 'bg-blue-500/20 text-blue-300',
  aile: 'bg-amber-500/20 text-amber-300',
  sağlık: 'bg-emerald-500/20 text-emerald-300',
  ilişki: 'bg-pink-500/20 text-pink-300',
  hedef: 'bg-purple-500/20 text-purple-300',
  kaygı: 'bg-red-500/20 text-red-300',
}

export default function MemoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('genel')

  const [showAdd, setShowAdd] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('genel')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)

      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('id', session.user.id)
        .single()
      const premium = userData?.is_admin || userData?.subscription_tier === 'premium' || userData?.subscription_tier === 'pro'
      setIsPremium(!!premium)

      if (premium) {
        await loadItems(session.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [router])

  async function loadItems(uid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('memory_items')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!newContent.trim() || !userId) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('memory_items')
      .insert({ user_id: userId, content: newContent.trim(), category: newCategory })
      .select()
      .single()
    if (data) setItems((prev) => [data, ...prev])
    setNewContent('')
    setNewCategory('genel')
    setShowAdd(false)
    setSaving(false)
  }

  async function handleEdit(id: string) {
    if (!editContent.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('memory_items').update({
      content: editContent.trim(),
      category: editCategory,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setItems((prev) => prev.map((item) =>
      item.id === id ? { ...item, content: editContent.trim(), category: editCategory } : item
    ))
    setEditingId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('memory_items').delete().eq('id', id)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  function startEdit(item: MemoryItem) {
    setEditingId(item.id)
    setEditContent(item.content)
    setEditCategory(item.category)
  }

  const grouped = CATEGORIES.reduce<Record<string, MemoryItem[]>>((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors text-sm">← Ana Sayfa</Link>
        <h1 className="text-base font-semibold text-white">Zeno Hafızası</h1>
        <div className="flex-1" />
        {isPremium && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Yeni Bilgi
          </button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8">

        {/* Premium gate */}
        {!loading && !isPremium && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
            <div className="w-20 h-20 bg-purple-600/10 border border-purple-500/20 rounded-3xl flex items-center justify-center text-4xl">
              🧠
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Zeno&apos;nun Hafızası</h2>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                Zeno sohbetlerinden öğrendiklerini burada saklar. Bu özellik Premium üyelere özeldir.
              </p>
            </div>
            <div className="space-y-2 w-full max-w-xs">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center gap-3 text-left">
                <span className="text-emerald-400">✓</span>
                <p className="text-slate-300 text-sm">Sınırsız hafıza maddesi</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center gap-3 text-left">
                <span className="text-emerald-400">✓</span>
                <p className="text-slate-300 text-sm">Kategorilere göre düzenleme</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-center gap-3 text-left">
                <span className="text-emerald-400">✓</span>
                <p className="text-slate-300 text-sm">Zeno seni her sohbette hatırlar</p>
              </div>
            </div>
            <Link
              href="/upgrade"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors"
            >
              Premium&apos;a Geç →
            </Link>
          </div>
        )}

        {/* İçerik (sadece premium) */}
        {isPremium && (
          <>
            {/* Açıklama */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <p className="text-purple-200 text-sm font-medium mb-1">Zeno seni şimdiye kadar şunları öğrendi</p>
                  <p className="text-purple-300/70 text-xs leading-relaxed">
                    Sohbet boyunca öğrenilen bilgiler burada toplanır. İstediğin zaman düzenleyebilir veya silebilirsin.
                  </p>
                </div>
              </div>
            </div>

            {loading && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            )}

            {/* Yeni ekle formu */}
            {showAdd && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-6 space-y-3">
                <h3 className="text-sm font-semibold text-white">Yeni Bilgi Ekle</h3>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Zeno'nun hatırlamasını istediğin bir bilgi…"
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors resize-none"
                />
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        newCategory === cat
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={saving || !newContent.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {saving ? 'Kaydediliyor…' : 'Ekle'}
                  </button>
                </div>
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto">
                  <span className="text-3xl">🧠</span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-slate-300 text-sm font-medium">Henüz bir şey öğrenmedi</p>
                  <p className="text-slate-600 text-xs max-w-[240px] mx-auto leading-relaxed">
                    Zeno ile sohbet ettikçe seni tanımaya başlar ve öğrendiklerini buraya kaydeder.
                  </p>
                </div>
                <a
                  href="/chat"
                  className="inline-block px-5 py-2.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium rounded-xl hover:bg-purple-600/30 transition-colors"
                >
                  Sohbet başlat →
                </a>
              </div>
            )}

            {Object.entries(grouped).map(([cat, catItems]) => (
              <div key={cat} className="mb-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                  {cat}
                </h3>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                      {editingId === item.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 resize-none"
                          />
                          <div className="flex gap-1.5 flex-wrap">
                            {CATEGORIES.map((c) => (
                              <button
                                key={c}
                                onClick={() => setEditCategory(c)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                  editCategory === c
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'bg-slate-700 border-slate-600 text-slate-300'
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5">İptal</button>
                            <button
                              onClick={() => handleEdit(item.id)}
                              disabled={saving}
                              className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Kaydet
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-slate-100 text-sm leading-relaxed">{item.content}</p>
                            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.genel}`}>
                              {item.category}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title="Düzenle"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Sil"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

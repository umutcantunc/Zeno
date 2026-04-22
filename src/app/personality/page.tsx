'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'

interface MemoryEvent {
  id: string
  content: string
  importance: 'critical' | 'high' | 'normal'
  event_date: string | null
  created_at: string
}

interface PersonalityTrait {
  trait: string
  evidence: string
}

interface MemoryPreference {
  id: string
  content: string
  created_at: string
}

const IMP = {
  critical: { label: 'Kritik',  dot: '🔴', color: 'text-red-400',   border: 'border-red-500/30',   bg: 'bg-red-500/5'   },
  high:     { label: 'Önemli',  dot: '🟠', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  normal:   { label: 'Normal',  dot: '⚪', color: 'text-slate-500', border: 'border-slate-700',    bg: 'bg-slate-800/60' },
}

export default function PersonalityPage() {
  const router = useRouter()
  const [userId, setUserId]     = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading]   = useState(true)

  // Events state
  const [events, setEvents]               = useState<MemoryEvent[]>([])
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editEvContent, setEditEvContent] = useState('')
  const [editEvImportance, setEditEvImportance] = useState<'critical'|'high'|'normal'>('normal')
  const [editEvDate, setEditEvDate]       = useState('')
  const [showAddEvent, setShowAddEvent]   = useState(false)
  const [newEvContent, setNewEvContent]   = useState('')
  const [newEvImportance, setNewEvImportance] = useState<'critical'|'high'|'normal'>('normal')
  const [newEvDate, setNewEvDate]         = useState('')

  // Personality state
  const [profileId, setProfileId] = useState<string | null>(null)
  const [traits, setTraits]       = useState<PersonalityTrait[]>([])
  const [editingTraitIdx, setEditingTraitIdx] = useState<number | null>(null)
  const [editTraitName, setEditTraitName]     = useState('')
  const [editTraitEvidence, setEditTraitEvidence] = useState('')

  // Preferences state
  const [preferences, setPreferences]       = useState<MemoryPreference[]>([])
  const [editingPrefId, setEditingPrefId]   = useState<string | null>(null)
  const [editPrefContent, setEditPrefContent] = useState('')
  const [showAddPref, setShowAddPref]       = useState(false)
  const [newPrefContent, setNewPrefContent] = useState('')

  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async (uid: string) => {
    const supabase = createClient()
    const [eventsRes, profileRes, prefsRes] = await Promise.all([
      supabase
        .from('memory_items')
        .select('id, content, importance, event_date, created_at')
        .eq('user_id', uid)
        .eq('memory_type', 'event')
        .order('event_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('personality_profiles')
        .select('id, traits')
        .eq('user_id', uid)
        .maybeSingle(),
      supabase
        .from('memory_items')
        .select('id, content, created_at')
        .eq('user_id', uid)
        .eq('memory_type', 'preference')
        .order('created_at', { ascending: false }),
    ])
    setEvents(eventsRes.data ?? [])
    setProfileId(profileRes.data?.id ?? null)
    setTraits(profileRes.data?.traits ?? [])
    setPreferences(prefsRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)
      const { data: ud } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('id', session.user.id)
        .single()
      const premium = ud?.is_admin || ud?.subscription_tier === 'premium' || ud?.subscription_tier === 'pro'
      setIsPremium(!!premium)
      if (premium) await loadAll(session.user.id)
      else setLoading(false)
    })
  }, [router, loadAll])

  // ── Events ─────────────────────────────────────────────────────────
  function startEditEvent(ev: MemoryEvent) {
    setEditingEventId(ev.id)
    setEditEvContent(ev.content)
    setEditEvImportance(ev.importance ?? 'normal')
    setEditEvDate(ev.event_date ?? '')
  }

  async function saveEvent(id: string) {
    if (!editEvContent.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('memory_items').update({
      content:    editEvContent.trim(),
      importance: editEvImportance,
      event_date: editEvDate || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, content: editEvContent.trim(), importance: editEvImportance, event_date: editEvDate || null } : e))
    setEditingEventId(null)
    setSaving(false)
  }

  async function deleteEvent(id: string) {
    const supabase = createClient()
    await supabase.from('memory_items').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  async function addEvent() {
    if (!newEvContent.trim() || !userId) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('memory_items').insert({
      user_id:     userId,
      content:     newEvContent.trim(),
      category:    'olay',
      memory_type: 'event',
      importance:  newEvImportance,
      event_date:  newEvDate || null,
    }).select('id, content, importance, event_date, created_at').single()
    if (data) setEvents(prev => [data, ...prev])
    setNewEvContent(''); setNewEvImportance('normal'); setNewEvDate(''); setShowAddEvent(false)
    setSaving(false)
  }

  // ── Traits ─────────────────────────────────────────────────────────
  function startEditTrait(idx: number) {
    setEditingTraitIdx(idx)
    setEditTraitName(traits[idx].trait)
    setEditTraitEvidence(traits[idx].evidence ?? '')
  }

  async function updateTraits(updatedTraits: PersonalityTrait[]) {
    const supabase = createClient()
    if (profileId) {
      await supabase.from('personality_profiles').update({ traits: updatedTraits, updated_at: new Date().toISOString() }).eq('id', profileId)
    } else {
      const { data } = await supabase.from('personality_profiles').insert({ user_id: userId, traits: updatedTraits }).select('id').single()
      if (data) setProfileId(data.id)
    }
    setTraits(updatedTraits)
  }

  async function saveTrait(idx: number) {
    if (!editTraitName.trim()) return
    setSaving(true)
    await updateTraits(traits.map((t, i) => i === idx ? { trait: editTraitName.trim(), evidence: editTraitEvidence.trim() } : t))
    setEditingTraitIdx(null)
    setSaving(false)
  }

  async function deleteTrait(idx: number) {
    setSaving(true)
    await updateTraits(traits.filter((_, i) => i !== idx))
    setSaving(false)
  }

  // ── Preferences ────────────────────────────────────────────────────
  function startEditPref(pref: MemoryPreference) {
    setEditingPrefId(pref.id)
    setEditPrefContent(pref.content)
  }

  async function savePref(id: string) {
    if (!editPrefContent.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('memory_items').update({ content: editPrefContent.trim(), updated_at: new Date().toISOString() }).eq('id', id)
    setPreferences(prev => prev.map(p => p.id === id ? { ...p, content: editPrefContent.trim() } : p))
    setEditingPrefId(null)
    setSaving(false)
  }

  async function deletePref(id: string) {
    const supabase = createClient()
    await supabase.from('memory_items').delete().eq('id', id)
    setPreferences(prev => prev.filter(p => p.id !== id))
  }

  async function addPref() {
    if (!newPrefContent.trim() || !userId) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('memory_items').insert({
      user_id:     userId,
      content:     newPrefContent.trim(),
      category:    'tercih',
      memory_type: 'preference',
    }).select('id, content, created_at').single()
    if (data) setPreferences(prev => [data, ...prev])
    setNewPrefContent(''); setShowAddPref(false)
    setSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-24">
        <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">← Ana Sayfa</Link>
          <h1 className="text-base font-semibold">Kişilik Profilim</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center px-6">
          <div className="w-20 h-20 bg-purple-600/10 border border-purple-500/20 rounded-3xl flex items-center justify-center text-4xl">🧬</div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Zeno Seni Nasıl Tanıyor?</h2>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Zeno sohbet boyunca seni tanır, önemli olaylarını kaydeder ve kişiliğini anlamaya çalışır. Bu özellik Premium üyelere özeldir.
            </p>
          </div>
          <Link href="/upgrade" className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors">
            Premium&apos;a Geç →
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  const editIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
  const trashIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
    </svg>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="border-b border-slate-800 px-5 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">← Ana Sayfa</Link>
        <h1 className="text-base font-semibold text-white">Zeno Seni Nasıl Tanıyor?</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-10">

        {/* ── BÖLÜM 1 — Önemli Olaylar ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-center justify-center text-base">📅</div>
              <h2 className="text-sm font-bold text-white tracking-wide">Önemli Olaylar</h2>
              {events.length > 0 && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{events.length}</span>}
            </div>
            <button
              onClick={() => setShowAddEvent(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 text-xs font-medium rounded-lg transition-colors"
            >
              + Olay Ekle
            </button>
          </div>

          {showAddEvent && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-4 space-y-3">
              <textarea
                value={newEvContent}
                onChange={e => setNewEvContent(e.target.value)}
                placeholder="Ne oldu? Kısaca anlat…"
                rows={3}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 transition-colors resize-none"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newEvDate}
                  onChange={e => setNewEvDate(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                />
                <select
                  value={newEvImportance}
                  onChange={e => setNewEvImportance(e.target.value as 'critical'|'high'|'normal')}
                  className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500"
                >
                  <option value="normal">Normal</option>
                  <option value="high">Önemli</option>
                  <option value="critical">Kritik</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddEvent(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">İptal</button>
                <button onClick={addEvent} disabled={saving || !newEvContent.trim()} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                  {saving ? 'Kaydediliyor…' : 'Ekle'}
                </button>
              </div>
            </div>
          )}

          {events.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-sm">Henüz olay kaydedilmedi.</p>
              <p className="text-slate-600 text-xs mt-1">Zeno sohbet ederken önemli olayları otomatik kaydeder.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const imp = IMP[ev.importance ?? 'normal']
                return (
                  <div key={ev.id} className={`border rounded-2xl p-4 transition-colors ${imp.bg} ${imp.border}`}>
                    {editingEventId === ev.id ? (
                      <div className="space-y-3">
                        <textarea value={editEvContent} onChange={e => setEditEvContent(e.target.value)} rows={3}
                          className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 resize-none" />
                        <div className="flex gap-2">
                          <input type="date" value={editEvDate} onChange={e => setEditEvDate(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500" />
                          <select value={editEvImportance} onChange={e => setEditEvImportance(e.target.value as 'critical'|'high'|'normal')}
                            className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none">
                            <option value="normal">Normal</option>
                            <option value="high">Önemli</option>
                            <option value="critical">Kritik</option>
                          </select>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingEventId(null)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 transition-colors">İptal</button>
                          <button onClick={() => saveEvent(ev.id)} disabled={saving}
                            className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">Kaydet</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="text-base shrink-0 mt-0.5">{imp.dot}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-100 text-sm leading-relaxed">{ev.content}</p>
                          <div className="flex items-center gap-2.5 mt-1.5">
                            {ev.event_date && (
                              <span className="text-xs text-slate-500">{new Date(ev.event_date + 'T00:00:00').toLocaleDateString('tr-TR')}</span>
                            )}
                            <span className={`text-xs font-medium ${imp.color}`}>{imp.label}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => startEditEvent(ev)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">{editIcon}</button>
                          <button onClick={() => deleteEvent(ev.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">{trashIcon}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── BÖLÜM 2 — Kişilik Profilin ───────────────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 bg-purple-500/15 border border-purple-500/30 rounded-lg flex items-center justify-center text-base">🧬</div>
            <h2 className="text-sm font-bold text-white tracking-wide">Kişilik Profilin</h2>
            {traits.length > 0 && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{traits.length} özellik</span>}
          </div>

          {traits.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-sm">Henüz kişilik özelliği belirlenmedi.</p>
              <p className="text-slate-600 text-xs mt-1">Zeno seni tanıdıkça burası dolacak.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {traits.map((trait, idx) => (
                <div key={idx} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
                  {editingTraitIdx === idx ? (
                    <div className="space-y-3">
                      <input value={editTraitName} onChange={e => setEditTraitName(e.target.value)}
                        placeholder="Kişilik özelliği…"
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 transition-colors" />
                      <textarea value={editTraitEvidence} onChange={e => setEditTraitEvidence(e.target.value)}
                        placeholder="Bu özelliği neden düşünüyorsun?…" rows={2}
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 resize-none transition-colors" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingTraitIdx(null)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 transition-colors">İptal</button>
                        <button onClick={() => saveTrait(idx)} disabled={saving}
                          className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">Kaydet</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">{trait.trait}</p>
                        {trait.evidence && (
                          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                            <span className="text-slate-600">Bunu şundan anladım: </span>
                            {trait.evidence}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEditTrait(idx)}
                          className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap">
                          Düzelt
                        </button>
                        <button onClick={() => deleteTrait(idx)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">{trashIcon}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── BÖLÜM 3 — Tercihlerim ────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-center text-base">💬</div>
              <h2 className="text-sm font-bold text-white tracking-wide">Tercihlerim</h2>
              {preferences.length > 0 && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{preferences.length}</span>}
            </div>
            <button
              onClick={() => setShowAddPref(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 text-xs font-medium rounded-lg transition-colors"
            >
              + Ekle
            </button>
          </div>

          {showAddPref && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-4 space-y-3">
              <textarea value={newPrefContent} onChange={e => setNewPrefContent(e.target.value)}
                placeholder="Konuşma tercihin, sevdiğin/sevmediğin bir şey…" rows={2}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 resize-none transition-colors" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddPref(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">İptal</button>
                <button onClick={addPref} disabled={saving || !newPrefContent.trim()} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                  {saving ? 'Kaydediliyor…' : 'Ekle'}
                </button>
              </div>
            </div>
          )}

          {preferences.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-sm">Henüz tercih kaydedilmedi.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {preferences.map(pref => (
                <div key={pref.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
                  {editingPrefId === pref.id ? (
                    <div className="space-y-2">
                      <textarea value={editPrefContent} onChange={e => setEditPrefContent(e.target.value)} rows={2}
                        className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 resize-none" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingPrefId(null)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 transition-colors">İptal</button>
                        <button onClick={() => savePref(pref.id)} disabled={saving}
                          className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">Kaydet</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-500/70 text-base shrink-0">💬</span>
                      <p className="flex-1 text-slate-200 text-sm leading-relaxed">{pref.content}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEditPref(pref)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">{editIcon}</button>
                        <button onClick={() => deletePref(pref.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">{trashIcon}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
      <BottomNav />
    </div>
  )
}

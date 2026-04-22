'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import type { PersonalityMode } from '@/lib/systemPrompt'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES: Record<PersonalityMode, string[]> = {
  zeno:      ['İş Yükü', 'Aile & İlişkiler', 'Kendimle Baş Başa', 'Sadece Yorgunum', 'Sevinçli Bir Şey Var'],
  dost:      ['Bi şeyler oldu', 'İyi haberler var!', 'Kafam karışık', 'Sadece sohbet', 'Berbat bir gün'],
  koc:       ['Karar vermem lazım', 'Hedeflerime odaklan', 'Erteliyorum', 'Motivasyon lazım'],
  bilge:     ['Anlam arıyorum', 'Bir şeyi sorguluyorum', 'Geçmişle yüzleşmek', 'Geleceğim hakkında'],
  dinleyici: ['Sadece dinle beni', 'Çok ağır hissediyorum', 'Anlatmam lazım', 'Sessizce burada ol'],
}

const MODE_OPTIONS: { id: PersonalityMode; emoji: string; label: string; desc: string }[] = [
  { id: 'zeno',       emoji: '⚖️', label: 'Zeno',      desc: 'Dengeli, analitik, stoacı bilgelik.' },
  { id: 'dost',       emoji: '☕', label: 'Dost',      desc: 'Samimi, sıcak, sevinçte sevinir.' },
  { id: 'koc',        emoji: '🎯', label: 'Koç',       desc: 'Direkt, aksiyona odaklı, şımartmaz.' },
  { id: 'bilge',      emoji: '🌙', label: 'Bilge',     desc: 'Az konuşur, soruyla aydınlatır.' },
  { id: 'dinleyici',  emoji: '🌊', label: 'Dinleyici', desc: 'Tavsiye vermez, sadece duyar.' },
]

const MODE_OPENINGS: Record<PersonalityMode, string> = {
  zeno:       'Bugün zihnini en çok ne yoruyor?',
  dost:       'Naber, bugün nasılsın gerçekten?',
  koc:        'Bugün hangi konuda netlik arıyorsun?',
  bilge:      'Seni buraya getiren ne?',
  dinleyici:  'Buradayım. Ne taşıyorsun bugün?',
}

const MODE_COLORS: Record<PersonalityMode, {
  hex: string; avatarBg: string; userBubble: string
  qText: string; qBorder: string; qBg: string; qHoverBg: string
  activeBorder: string; activeBg: string
}> = {
  zeno:      { hex: '#6D28D9', avatarBg: 'bg-purple-700',  userBubble: 'bg-purple-600',  qText: 'text-purple-300',  qBorder: 'border-purple-500/30',  qBg: 'bg-purple-500/10',  qHoverBg: 'hover:bg-purple-500/25',  activeBorder: 'border-purple-500',  activeBg: 'bg-purple-600/15' },
  dost:      { hex: '#D97706', avatarBg: 'bg-amber-600',   userBubble: 'bg-amber-500',   qText: 'text-amber-300',   qBorder: 'border-amber-500/30',   qBg: 'bg-amber-500/10',   qHoverBg: 'hover:bg-amber-500/25',   activeBorder: 'border-amber-500',   activeBg: 'bg-amber-600/15'  },
  koc:       { hex: '#1D4ED8', avatarBg: 'bg-blue-700',    userBubble: 'bg-blue-700',    qText: 'text-blue-300',    qBorder: 'border-blue-500/30',    qBg: 'bg-blue-500/10',    qHoverBg: 'hover:bg-blue-500/25',    activeBorder: 'border-blue-500',    activeBg: 'bg-blue-700/15'   },
  bilge:     { hex: '#065F46', avatarBg: 'bg-emerald-800', userBubble: 'bg-emerald-800', qText: 'text-emerald-300', qBorder: 'border-emerald-500/30', qBg: 'bg-emerald-500/10', qHoverBg: 'hover:bg-emerald-500/25', activeBorder: 'border-emerald-600', activeBg: 'bg-emerald-900/20'},
  dinleyici: { hex: '#9D174D', avatarBg: 'bg-rose-800',    userBubble: 'bg-rose-800',    qText: 'text-rose-300',    qBorder: 'border-rose-500/30',    qBg: 'bg-rose-500/10',    qHoverBg: 'hover:bg-rose-500/25',    activeBorder: 'border-rose-600',    activeBg: 'bg-rose-900/20'   },
}

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages]           = useState<Message[]>([{ role: 'assistant', content: MODE_OPENINGS['zeno'] }])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const [dynamicReplies, setDynamicReplies]     = useState<string[]>([])
  const [isLoggedIn, setIsLoggedIn]       = useState(false)
  const [userId, setUserId]               = useState<string | null>(null)
  const [activeMode, setActiveMode]       = useState<PersonalityMode>('zeno')
  const [userName, setUserName]           = useState<string | null>(null)
  const [waveActive, setWaveActive]       = useState(false)
  const [waveColor, setWaveColor]         = useState('#6D28D9')
  const [showModePopup, setShowModePopup] = useState(false)
  const [memoryToast, setMemoryToast]     = useState<string | null>(null)
  const [isPremium, setIsPremium]         = useState(false)
  const [voiceError, setVoiceError]       = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const modeColors       = MODE_COLORS[activeMode]
  const activeModeOption = MODE_OPTIONS.find((m) => m.id === activeMode)!

  // Sesli mesaj callback'i — hook içinden çağrılır
  function handleVoiceMessage(userText: string, assistantText: string, newConvId?: string) {
    setMessages((prev) => [
      ...prev,
      { role: 'user',      content: userText      },
      { role: 'assistant', content: assistantText },
    ])
    setShowQuickReplies(false)
    if (newConvId) setConversationId(newConvId)
  }

  // Ses hata toast'u — 4 sn sonra kapanır
  useEffect(() => {
    if (!voiceError) return
    const t = setTimeout(() => setVoiceError(null), 4000)
    return () => clearTimeout(t)
  }, [voiceError])

  const { voicePhase, handleMicClick } = useVoiceChat(
    activeMode,
    conversationId,
    { onMessageSent: handleVoiceMessage, onError: setVoiceError }
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session?.user)
      if (session?.user) {
        setUserId(session.user.id)
        const { data } = await supabase
          .from('users')
          .select('personality_mode, full_name, subscription_tier, is_admin')
          .eq('id', session.user.id)
          .single()
        if (data?.personality_mode) {
          const mode = data.personality_mode as PersonalityMode
          setActiveMode(mode)
          setMessages([{ role: 'assistant', content: MODE_OPENINGS[mode] }])
        }
        if (data?.full_name) setUserName(data.full_name)
        const premium = data?.is_admin || data?.subscription_tier === 'premium' || data?.subscription_tier === 'pro'
        setIsPremium(!!premium)
      }
    })
    const supabase2 = createClient()
    const { data: { subscription } } = supabase2.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!showModePopup) return
    function handleClick(e: MouseEvent) {
      const popup = document.getElementById('mode-popup')
      if (popup && !popup.contains(e.target as Node)) setShowModePopup(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showModePopup])

  function triggerWave(mode: PersonalityMode) {
    setWaveColor(MODE_COLORS[mode].hex)
    setWaveActive(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWaveActive(true)
        setTimeout(() => setWaveActive(false), 800)
      })
    })
  }

  async function handleModeSelect(mode: PersonalityMode) {
    if (!isPremium && mode !== 'zeno') { router.push('/upgrade'); return }
    setShowModePopup(false)
    triggerWave(mode)
    setActiveMode(mode)
    setMessages([{ role: 'assistant', content: MODE_OPENINGS[mode] }])
    setShowQuickReplies(true)
    setDynamicReplies([])
    setConversationId(null)
    if (userId) {
      const supabase = createClient()
      await supabase.from('users').update({ personality_mode: mode }).eq('id', userId)
    }
  }

  function startNewConversation() {
    triggerWave(activeMode)
    setMessages([{ role: 'assistant', content: MODE_OPENINGS[activeMode] }])
    setShowQuickReplies(true)
    setDynamicReplies([])
    setConversationId(null)
  }

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setShowQuickReplies(false)
    setLoading(true)
    try {
      const history = updatedMessages.slice(1, -1)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId, history, mode: activeMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const reply = data.reply
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      if (data.conversationId) setConversationId(data.conversationId)
      setDynamicReplies([])
      if (isPremium && reply.includes('?')) {
        fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zenoMessage: reply }) })
          .then((r) => r.json()).then((d) => { if (d.suggestions?.length) setDynamicReplies(d.suggestions) }).catch(() => {})
      }
      const lastExchange = `Kullanıcı: ${text}\nZeno: ${reply}`
      fetch('/api/memory/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastExchange }) })
        .then((r) => r.json()).then((d) => { if (d.saved && d.content) { setMemoryToast(d.content); setTimeout(() => setMemoryToast(null), 3000) } }).catch(() => {})
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Bağlantıda bir sorun oluştu. Lütfen tekrar dene.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const showNormalInput  = voicePhase === 'idle' || voicePhase === 'speaking'
  const showRecordingUI  = voicePhase === 'recording'
  const showProcessingUI = voicePhase === 'processing'

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Dalga animasyonu (mod geçişi) */}
      {waveActive && (
        <div className="wave-sweep" style={{ background: `linear-gradient(to bottom, ${waveColor}50 0%, ${waveColor}20 50%, transparent 100%)` }} />
      )}

      {/* Mod seçici popup */}
      {showModePopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div id="mode-popup" className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">Zeno Modunu Seç</h3>
              <button onClick={() => setShowModePopup(false)} className="text-slate-500 hover:text-white transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="space-y-2">
              {MODE_OPTIONS.map((m) => {
                const isActive = activeMode === m.id
                const locked   = !isPremium && m.id !== 'zeno'
                const colors   = MODE_COLORS[m.id]
                return (
                  <button key={m.id} onClick={() => locked ? router.push('/upgrade') : handleModeSelect(m.id)}
                    className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 text-left',
                      isActive ? `${colors.activeBg} ${colors.activeBorder}` : locked
                        ? 'bg-slate-800/40 border-slate-700/50 opacity-60'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                    )}
                  >
                    <span className="text-xl shrink-0">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{m.label}</span>
                        {isActive && <span className="text-xs px-1.5 py-0.5 bg-white/10 text-slate-300 rounded-md font-medium">Aktif</span>}
                        {locked   && <span className="text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-md font-medium">🔒 Premium</span>}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{m.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {!isPremium && (
              <div className="mt-4 pt-4 border-t border-slate-800 text-center">
                <p className="text-slate-500 text-xs mb-2">Tüm modlara erişmek için</p>
                <Link href="/upgrade" onClick={() => setShowModePopup(false)} className="inline-block px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-semibold rounded-lg transition-all">
                  Premium&apos;a Geç →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0 backdrop-blur-sm transition-colors duration-500"
        style={{ backgroundColor: `color-mix(in srgb, ${modeColors.hex} 8%, #020617 92%)` }}>
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0 transition-colors duration-300', modeColors.avatarBg)}>Z</div>
        <button onClick={() => setShowModePopup(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors" title="Modu değiştir">
          <span className="text-sm">{activeModeOption.emoji}</span>
          <span className="text-xs text-slate-200 font-medium">{activeModeOption.label}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 ml-0.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div className="flex-1" />
        <Link href="/chats" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span className="hidden sm:block">Sohbetlerim</span>
        </Link>
        <button onClick={startNewConversation} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors" title="Yeni sohbet başlat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          <span className="hidden sm:block">Yeni</span>
        </button>
        {isLoggedIn ? (
          <div className="flex items-center gap-1">
            {userName && <span className="text-xs text-slate-500 max-w-[80px] truncate">{userName}</span>}
            <button onClick={handleSignOut} className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-800">Çıkış</button>
          </div>
        ) : (
          <a href="/auth/login" className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800">Giriş Yap</a>
        )}
      </header>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 pb-2">
        {messages.map((msg, i) => {
          const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
          return (
            <div key={i} className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5 transition-colors duration-300', modeColors.avatarBg)}>Z</div>
              )}
              <div className={cn('max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? cn(modeColors.userBubble, 'text-white rounded-br-md shadow-md')
                  : 'bg-slate-800 text-slate-100 rounded-bl-md border border-slate-700/60 shadow-sm'
              )}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={{
                    p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                    em:     ({ children }) => <em className="italic text-slate-300">{children}</em>,
                    ul:     ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                    ol:     ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                    li:     ({ children }) => <li className="text-slate-100">{children}</li>,
                    code:   ({ children }) => <code className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono text-purple-300">{children}</code>,
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                ) : msg.content}
              </div>
              {/* Ses çalarken son Zeno mesajının yanında küçük dalga */}
              {isLastAssistant && voicePhase === 'speaking' && (
                <div className="flex items-center gap-0.5 mb-0.5 self-end">
                  {[0,1,2,3,2].map((_, j) => (
                    <span key={j} className="voice-bar" style={{ backgroundColor: modeColors.hex, height: '12px', width: '2px' }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5', modeColors.avatarBg)}>Z</div>
            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {QUICK_REPLIES[activeMode].map((reply) => (
            <button key={reply} onClick={() => sendMessage(reply)}
              className={cn('px-4 py-2 text-xs font-medium rounded-full border transition-all duration-150', modeColors.qText, modeColors.qBorder, modeColors.qBg, modeColors.qHoverBg)}>
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Dinamik öneriler */}
      {!showQuickReplies && !loading && dynamicReplies.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {dynamicReplies.map((reply) => (
            <button key={reply} onClick={() => { sendMessage(reply); setDynamicReplies([]) }}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150', modeColors.qText, modeColors.qBorder, modeColors.qBg, modeColors.qHoverBg)}>
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input alanı */}
      <div className="px-4 pb-20 pt-2 shrink-0">
        {showRecordingUI ? (
          /* ── Kayıt modu ── */
          <div className="flex items-center gap-3 bg-slate-800/80 border rounded-2xl px-4 py-3 recording-pulse" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-slate-300 shrink-0">Zeno dinliyor…</span>
            <div className="flex-1 flex items-center justify-center gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className="voice-bar" style={{ backgroundColor: modeColors.hex }} />
              ))}
            </div>
            <button onClick={handleMicClick} title="Kaydı durdur"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500 hover:bg-red-400 text-white transition-colors shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            </button>
          </div>
        ) : showProcessingUI ? (
          /* ── İşleniyor modu ── */
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3">
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: modeColors.hex, borderTopColor: 'transparent' }} />
            <span className="text-sm text-slate-400">İşleniyor…</span>
          </div>
        ) : (
          /* ── Normal input ── */
          <div className="flex gap-2 items-end bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 focus-within:border-purple-500/50 transition-colors">
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Bir şeyler yaz…" rows={1}
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none outline-none max-h-32 leading-relaxed"
              style={{ scrollbarWidth: 'none' }}
            />
            {/* Mikrofon */}
            <button onClick={handleMicClick} title={voicePhase === 'speaking' ? 'Sesi durdur' : 'Sesli konuş'}
              className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0',
                voicePhase === 'speaking' ? 'text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
              )}
              style={voicePhase === 'speaking' ? { backgroundColor: modeColors.hex } : undefined}
            >
              {voicePhase === 'speaking' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </button>
            {/* Gönder */}
            <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
              className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-30 transition-colors shrink-0', modeColors.avatarBg, 'hover:opacity-90')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/>
              </svg>
            </button>
          </div>
        )}
        {showNormalInput && (
          <p className="text-xs text-slate-600 text-center mt-2">Enter ile gönder · Shift+Enter yeni satır</p>
        )}
      </div>

      {/* Hafıza toast */}
      {memoryToast && (
        <div className="fixed bottom-24 right-4 z-50 max-w-[260px] bg-slate-800/95 border border-purple-500/30 rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm animate-slide-right">
          <p className="text-xs text-purple-400 font-medium mb-0.5">🧠 Zeno bunu aklına aldı:</p>
          <p className="text-xs text-slate-300 leading-relaxed">{memoryToast}</p>
        </div>
      )}

      {/* Ses hata toast */}
      {voiceError && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-red-950/95 border border-red-500/30 rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm animate-slide-right">
          <p className="text-xs text-red-400 font-medium">🎙️ {voiceError}</p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
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

const MODE_OPTIONS: { id: PersonalityMode; emoji: string; label: string }[] = [
  { id: 'zeno',       emoji: '⚖️', label: 'Zeno' },
  { id: 'dost',       emoji: '☕', label: 'Dost' },
  { id: 'koc',        emoji: '🎯', label: 'Koç' },
  { id: 'bilge',      emoji: '🌙', label: 'Bilge' },
  { id: 'dinleyici',  emoji: '🌊', label: 'Dinleyici' },
]

const MODE_OPENINGS: Record<PersonalityMode, string> = {
  zeno:       'Bugün zihnini en çok ne yoruyor?',
  dost:       'Naber, bugün nasılsın gerçekten?',
  koc:        'Bugün hangi konuda netlik arıyorsun?',
  bilge:      'Seni buraya getiren ne?',
  dinleyici:  'Buradayım. Ne taşıyorsun bugün?',
}

// Her modun renk teması
const MODE_COLORS: Record<PersonalityMode, {
  hex: string
  avatarBg: string
  userBubble: string
  qText: string
  qBorder: string
  qBg: string
  qHoverBg: string
}> = {
  zeno:      { hex: '#6D28D9', avatarBg: 'bg-purple-700',  userBubble: 'bg-purple-600',  qText: 'text-purple-300',  qBorder: 'border-purple-500/30',  qBg: 'bg-purple-500/10',  qHoverBg: 'hover:bg-purple-500/25'  },
  dost:      { hex: '#D97706', avatarBg: 'bg-amber-600',   userBubble: 'bg-amber-500',   qText: 'text-amber-300',   qBorder: 'border-amber-500/30',   qBg: 'bg-amber-500/10',   qHoverBg: 'hover:bg-amber-500/25'   },
  koc:       { hex: '#1D4ED8', avatarBg: 'bg-blue-700',    userBubble: 'bg-blue-700',    qText: 'text-blue-300',    qBorder: 'border-blue-500/30',    qBg: 'bg-blue-500/10',    qHoverBg: 'hover:bg-blue-500/25'    },
  bilge:     { hex: '#065F46', avatarBg: 'bg-emerald-800', userBubble: 'bg-emerald-800', qText: 'text-emerald-300', qBorder: 'border-emerald-500/30', qBg: 'bg-emerald-500/10', qHoverBg: 'hover:bg-emerald-500/25' },
  dinleyici: { hex: '#9D174D', avatarBg: 'bg-rose-800',    userBubble: 'bg-rose-800',    qText: 'text-rose-300',    qBorder: 'border-rose-500/30',    qBg: 'bg-rose-500/10',    qHoverBg: 'hover:bg-rose-500/25'    },
}

const MOOD_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function MoodWidget({ onSelect, avatarBg }: { onSelect: (score: number) => void; avatarBg: string }) {
  return (
    <div className="flex justify-start">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1', avatarBg)}>
        Z
      </div>
      <div className="max-w-[80%] bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 space-y-3">
        <p className="text-slate-100 text-sm leading-relaxed">Bugün kendini 1–10 arası nasıl hissediyorsun?</p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_SCORES.map((n) => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              className={cn(
                'w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150',
                n <= 3 ? 'bg-red-500/20 text-red-300 hover:bg-red-500/40 border border-red-500/30'
                : n <= 6 ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 border border-emerald-500/30'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-slate-500 text-xs">1 = çok kötü · 10 = harika</p>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: MODE_OPENINGS['zeno'] }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const [showMoodWidget, setShowMoodWidget] = useState(false)
  const [moodSaved, setMoodSaved] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<PersonalityMode>('zeno')
  const [userName, setUserName] = useState<string | null>(null)
  // Dalga animasyonu
  const [waveActive, setWaveActive] = useState(false)
  const [waveColor, setWaveColor] = useState('#6D28D9')
  const bottomRef = useRef<HTMLDivElement>(null)
  const assistantMessageCount = useRef(0)

  const modeColors = MODE_COLORS[activeMode]
  const activeModeOption = MODE_OPTIONS.find((m) => m.id === activeMode)!

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session?.user)
      setUserId(session?.user?.id ?? null)
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('personality_mode, full_name')
          .eq('id', session.user.id)
          .single()
        if (data?.personality_mode) {
          const mode = data.personality_mode as PersonalityMode
          setActiveMode(mode)
          setMessages([{ role: 'assistant', content: MODE_OPENINGS[mode] }])
        }
        if (data?.full_name) setUserName(data.full_name.split(' ')[0])
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showMoodWidget])

  function triggerWave(mode: PersonalityMode) {
    setWaveColor(MODE_COLORS[mode].hex)
    setWaveActive(false)
    // Force reflow then re-enable to restart animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWaveActive(true)
        setTimeout(() => setWaveActive(false), 800)
      })
    })
  }

  function startNewConversation(mode: PersonalityMode) {
    triggerWave(mode)
    setActiveMode(mode)
    setMessages([{ role: 'assistant', content: MODE_OPENINGS[mode] }])
    setShowQuickReplies(true)
    setShowMoodWidget(false)
    setConversationId(null)
    assistantMessageCount.current = 0
    setMoodSaved(false)
  }

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  async function handleMoodSelect(score: number) {
    setShowMoodWidget(false)
    setMoodSaved(true)
    setMessages((prev) => [...prev, { role: 'user', content: `Ruh halim: ${score}/10` }])

    if (userId) {
      const supabase = createClient()
      await supabase.from('mood_logs').insert({ user_id: userId, score })
    }

    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Ruh halim bugün ${score}/10.`,
          conversationId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          mode: activeMode,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
        if (data.conversationId) setConversationId(data.conversationId)
      }
    } catch { /* sessizce geç */ } finally {
      setLoading(false)
    }
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

      assistantMessageCount.current += 1
      if (assistantMessageCount.current === 2 && !moodSaved) {
        setTimeout(() => setShowMoodWidget(true), 600)
      }

      // Arka planda hafıza çıkarımı
      const lastExchange = `Kullanıcı: ${text}\nZeno: ${reply}`
      fetch('/api/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastExchange }),
      }).catch(() => {})

    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Bağlantıda bir sorun oluştu. Lütfen tekrar dene.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Dalga animasyonu overlay */}
      {waveActive && (
        <div
          className="wave-sweep"
          style={{ background: `linear-gradient(to bottom, ${waveColor}50 0%, ${waveColor}20 50%, transparent 100%)` }}
        />
      )}

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0 backdrop-blur-sm transition-colors duration-500"
        style={{ backgroundColor: `color-mix(in srgb, ${modeColors.hex} 8%, #020617 92%)` }}
      >
        {/* Mod avatarı */}
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0 transition-colors duration-300', modeColors.avatarBg)}>
          Z
        </div>

        {/* Mod badge — tıklanınca /settings'e gider */}
        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          title="Modu değiştir"
        >
          <span className="text-sm">{activeModeOption.emoji}</span>
          <span className="text-xs text-slate-200 font-medium">{activeModeOption.label}</span>
        </Link>

        <div className="flex-1" />

        {/* Sohbetlerim */}
        <Link
          href="/chats"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="hidden sm:block">Sohbetlerim</span>
        </Link>

        {/* Yeni sohbet */}
        <button
          onClick={() => startNewConversation(activeMode)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
          title="Yeni sohbet başlat"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span className="hidden sm:block">Yeni</span>
        </button>

        {isLoggedIn ? (
          <div className="flex items-center gap-1">
            {userName && <span className="text-xs text-slate-500 hidden sm:block">{userName}</span>}
            <button
              onClick={handleSignOut}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-800"
            >
              Çıkış
            </button>
          </div>
        ) : (
          <a href="/auth/login" className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800">
            Giriş Yap
          </a>
        )}
      </header>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5 transition-colors duration-300', modeColors.avatarBg)}>
                Z
              </div>
            )}
            <div
              className={cn(
                'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? cn(modeColors.userBubble, 'text-white rounded-br-md shadow-md')
                  : 'bg-slate-800 text-slate-100 rounded-bl-md border border-slate-700/60 shadow-sm'
              )}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                    em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                    li: ({ children }) => <li className="text-slate-100">{children}</li>,
                    code: ({ children }) => <code className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono text-purple-300">{children}</code>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {showMoodWidget && <MoodWidget onSelect={handleMoodSelect} avatarBg={modeColors.avatarBg} />}

        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5', modeColors.avatarBg)}>
              Z
            </div>
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
            <button
              key={reply}
              onClick={() => sendMessage(reply)}
              className={cn(
                'px-4 py-2 text-xs font-medium rounded-full border transition-all duration-150',
                modeColors.qText, modeColors.qBorder, modeColors.qBg, modeColors.qHoverBg
              )}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-20 pt-2 shrink-0">
        <div className="flex gap-2 items-end bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 focus-within:border-purple-500/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bir şeyler yaz…"
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none outline-none max-h-32 leading-relaxed"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-30 transition-colors shrink-0', modeColors.avatarBg, 'hover:opacity-90')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-600 text-center mt-2">Enter ile gönder · Shift+Enter yeni satır</p>
      </div>

      <BottomNav />
    </div>
  )
}

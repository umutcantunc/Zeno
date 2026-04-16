'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { PersonalityMode } from '@/lib/systemPrompt'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = ['İş Yükü', 'Odaklanma Sorunu', 'Zaman Baskısı', 'Sadece Yorgunum']

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

const OPENING_MESSAGE: Message = {
  role: 'assistant',
  content: 'Bugün zihnini en çok ne yoruyor?',
}

const MOOD_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function MoodWidget({ onSelect }: { onSelect: (score: number) => void }) {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1">
        Z
      </div>
      <div className="max-w-[80%] bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 space-y-3">
        <p className="text-slate-100 text-sm leading-relaxed">
          Bugün kendini 1–10 arası nasıl hissediyorsun?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_SCORES.map((n) => (
            <button
              key={n}
              onClick={() => onSelect(n)}
              className={cn(
                'w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150',
                n <= 3
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/40 border border-red-500/30'
                  : n <= 6
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 border border-amber-500/30'
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
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(true)
  const [showMoodWidget, setShowMoodWidget] = useState(false)
  const [moodSaved, setMoodSaved] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeMode, setActiveMode] = useState<PersonalityMode>('zeno')
  const [showModeMenu, setShowModeMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const assistantMessageCount = useRef(0)

  useEffect(() => {
    const supabase = createClient()

    // İlk yüklemede mevcut session'ı oku
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session?.user)
      setUserEmail(session?.user?.email ?? null)
      setUserId(session?.user?.id ?? null)
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('personality_mode')
          .eq('id', session.user.id)
          .single()
        if (data?.personality_mode) setActiveMode(data.personality_mode as PersonalityMode)
      }
    })

    // Session değişikliklerini dinle (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
      setUserEmail(session?.user?.email ?? null)
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showMoodWidget])

  useEffect(() => {
    if (!showModeMenu) return
    const close = () => setShowModeMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showModeMenu])

  function handleModeChange(mode: PersonalityMode) {
    setActiveMode(mode)
    setShowModeMenu(false)
    // Sohbeti sıfırla, yeni modun açılış mesajını göster
    setMessages([{ role: 'assistant', content: MODE_OPENINGS[mode] }])
    setShowQuickReplies(true)
    setShowMoodWidget(false)
    setConversationId(null)
    assistantMessageCount.current = 0
  }

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  async function handleMoodSelect(score: number) {
    setShowMoodWidget(false)
    setMoodSaved(true)

    // Mood'u chat akışına yansıt
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Ruh halim: ${score}/10` },
    ])

    // Supabase'e kaydet (giriş yapılmışsa)
    if (userId) {
      const supabase = createClient()
      await supabase.from('mood_logs').insert({ user_id: userId, score })
    }

    // Zeno'nun mood'a yanıtı
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Ruh halim bugün ${score}/10.`,
          conversationId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
        if (data.conversationId) setConversationId(data.conversationId)
      }
    } catch {
      // sessizce geç
    } finally {
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

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      if (data.conversationId) setConversationId(data.conversationId)

      // İkinci asistan cevabından sonra mood widget göster (henüz gösterilmemişse)
      assistantMessageCount.current += 1
      if (assistantMessageCount.current === 2 && !moodSaved) {
        setTimeout(() => setShowMoodWidget(true), 600)
      }
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
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0 bg-slate-950/80 backdrop-blur-sm">
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-900/40 shrink-0">
          Z
        </div>

        {/* Mod seçici */}
        <div className="relative">
          <button
            onClick={() => setShowModeMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <span className="text-sm">{MODE_OPTIONS.find((m) => m.id === activeMode)?.emoji}</span>
            <span className="text-xs text-slate-200 font-medium">{MODE_OPTIONS.find((m) => m.id === activeMode)?.label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showModeMenu && (
            <div className="absolute top-full left-0 mt-1.5 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                    activeMode === m.id
                      ? 'bg-purple-600/30 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span className="font-medium">{m.label}</span>
                  {activeMode === m.id && <span className="ml-auto text-purple-400 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {isLoggedIn ? (
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              title="Ayarlar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
            <span className="text-xs text-slate-500 hidden sm:block truncate max-w-[120px]">{userEmail}</span>
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
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex items-end gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5">
                Z
              </div>
            )}
            <div
              className={cn(
                'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md shadow-md shadow-purple-900/30'
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

        {/* Mood widget */}
        {showMoodWidget && <MoodWidget onSelect={handleMoodSelect} />}

        {/* Loading */}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5">
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

      {/* Quick reply butonları — input üstünde, açılışta */}
      {showQuickReplies && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              onClick={() => sendMessage(reply)}
              className="px-4 py-2 text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-full hover:bg-purple-500/25 hover:border-purple-500/60 transition-all duration-150"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input alanı */}
      <div className="px-4 pb-5 pt-2 shrink-0">
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
            className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white disabled:opacity-30 hover:bg-purple-500 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-600 text-center mt-2">
          Enter ile gönder · Shift+Enter yeni satır
        </p>
      </div>
    </div>
  )
}

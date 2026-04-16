'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = ['İş Yükü', 'Odaklanma Sorunu', 'Zaman Baskısı', 'Sadece Yorgunum']

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const assistantMessageCount = useRef(0)

  useEffect(() => {
    const supabase = createClient()

    // İlk yüklemede mevcut session'ı oku
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user)
      setUserEmail(session?.user?.email ?? null)
      setUserId(session?.user?.id ?? null)
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
        body: JSON.stringify({ message: text, conversationId, history }),
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
      <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 shrink-0 bg-slate-950/80 backdrop-blur-sm">
        <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-900/40">
          Z
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm leading-none">Zeno</p>
          <p className="text-slate-500 text-xs mt-0.5">Zihin Koçu · AI</p>
        </div>
        {isLoggedIn ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[140px]">{userEmail}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              Çıkış
            </button>
          </div>
        ) : (
          <a
            href="/auth/login"
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
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

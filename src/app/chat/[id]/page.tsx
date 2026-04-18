'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import VoiceChat from '@/components/VoiceChat'
import type { PersonalityMode } from '@/lib/systemPrompt'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const MODE_OPENINGS: Record<PersonalityMode, string> = {
  zeno:       'Bugün zihnini en çok ne yoruyor?',
  dost:       'Naber, bugün nasılsın gerçekten?',
  koc:        'Bugün hangi konuda netlik arıyorsun?',
  bilge:      'Seni buraya getiren ne?',
  dinleyici:  'Buradayım. Ne taşıyorsun bugün?',
}

const MODE_EMOJIS: Record<string, string> = {
  zeno: '⚖️', dost: '☕', koc: '🎯', bilge: '🌙', dinleyici: '🌊',
}

const MODE_LABELS: Record<string, string> = {
  zeno: 'Zeno', dost: 'Dost', koc: 'Koç', bilge: 'Bilge', dinleyici: 'Dinleyici',
}

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

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [convTitle, setConvTitle] = useState<string>('Sohbet')
  const [activeMode, setActiveMode] = useState<PersonalityMode>('zeno')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [dynamicReplies, setDynamicReplies] = useState<string[]>([])
  const [memoryToast, setMemoryToast] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const modeColors = MODE_COLORS[activeMode]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return }

      // Load user subscription
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier, is_admin')
        .eq('id', session.user.id)
        .single()
      const premium = userData?.is_admin || userData?.subscription_tier === 'premium' || userData?.subscription_tier === 'pro'
      setIsPremium(!!premium)

      // Load conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, title, mode')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single()

      if (!conv) { router.push('/chats'); return }

      setConvTitle(conv.title || 'Sohbet')
      const mode = (conv.mode as PersonalityMode) || 'zeno'
      setActiveMode(mode)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

      const allMsgs: Message[] = [
        { role: 'assistant', content: MODE_OPENINGS[mode] },
        ...(msgs ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ]
      setMessages(allMsgs)
      setLoading(false)
    })
  }, [id, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return

    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setDynamicReplies([])
    setSending(true)

    try {
      const history = updatedMessages.slice(1, -1)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: id, history, mode: activeMode }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const reply = data.reply
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])

      // Dinamik hızlı cevaplar (sadece premium)
      if (isPremium && reply.includes('?')) {
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zenoMessage: reply }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.suggestions?.length) setDynamicReplies(d.suggestions) })
          .catch(() => {})
      }

      // Hafıza çıkarımı
      const lastExchange = `Kullanıcı: ${text}\nZeno: ${reply}`
      fetch('/api/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastExchange }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.saved && d.content) {
            setMemoryToast(d.content)
            setTimeout(() => setMemoryToast(null), 3000)
          }
        })
        .catch(() => {})

    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Bağlantıda bir sorun oluştu. Lütfen tekrar dene.' },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleVoiceMessage(userText: string, assistantText: string) {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userText },
      { role: 'assistant', content: assistantText },
    ])
    setDynamicReplies([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Sesli sohbet modal */}
      {showVoice && (
        <VoiceChat
          activeMode={activeMode}
          conversationId={id}
          modeColor={modeColors.hex}
          modeEmoji={MODE_EMOJIS[activeMode]}
          modeLabel={MODE_LABELS[activeMode]}
          onClose={() => setShowVoice(false)}
          onMessageSent={handleVoiceMessage}
        />
      )}

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0 backdrop-blur-sm transition-colors duration-500"
        style={{ backgroundColor: `color-mix(in srgb, ${modeColors.hex} 8%, #020617 92%)` }}
      >
        <Link href="/chats" className="text-slate-400 hover:text-white transition-colors shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>

        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 transition-colors duration-300', modeColors.avatarBg)}>
          {MODE_EMOJIS[activeMode]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{convTitle}</p>
          <p className="text-xs text-slate-500">{MODE_LABELS[activeMode]}</p>
        </div>

        <Link
          href="/chat"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span className="hidden sm:block">Yeni Sohbet</span>
        </Link>
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

        {sending && (
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

      {/* Dinamik öneriler */}
      {!sending && dynamicReplies.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {dynamicReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => { sendMessage(reply); setDynamicReplies([]) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150',
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
            placeholder="Kaldığın yerden devam et…"
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm resize-none outline-none max-h-32 leading-relaxed"
            style={{ scrollbarWidth: 'none' }}
          />
          {/* Mikrofon butonu */}
          <button
            onClick={() => setShowVoice(true)}
            title="Sesli sohbet"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          {/* Gönder butonu */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
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

      {/* Hafıza toast */}
      {memoryToast && (
        <div className="fixed bottom-24 right-4 z-50 max-w-[260px] bg-slate-800/95 border border-purple-500/30 rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm animate-slide-right">
          <p className="text-xs text-purple-400 font-medium mb-0.5">🧠 Zeno bunu aklına aldı:</p>
          <p className="text-xs text-slate-300 leading-relaxed">{memoryToast}</p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

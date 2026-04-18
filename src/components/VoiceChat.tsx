'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { PersonalityMode } from '@/lib/systemPrompt'

type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error'

interface VoiceChatProps {
  activeMode: PersonalityMode
  conversationId: string | null
  modeColor: string       // hex e.g. '#6D28D9'
  modeEmoji: string
  modeLabel: string
  onClose: () => void
  onMessageSent: (userText: string, assistantText: string, newConvId?: string) => void
}

const PHASE_LABELS: Record<Phase, string> = {
  idle:         'Konuşmak için mikrofona bas',
  recording:    'Dinliyorum…',
  transcribing: 'Anlıyorum…',
  thinking:     'Düşünüyorum…',
  speaking:     'Konuşuyorum…',
  error:        'Bir sorun oluştu',
}

export default function VoiceChat({
  activeMode,
  conversationId,
  modeColor,
  modeEmoji,
  modeLabel,
  onClose,
  onMessageSent,
}: VoiceChatProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Ses hızı tercihi
  const [playbackRate] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    return parseFloat(localStorage.getItem('zeno_voice_speed') ?? '1')
  })

  const voiceEnabled = typeof window !== 'undefined'
    ? localStorage.getItem('zeno_voice_enabled') !== 'false'
    : true

  // ESC ile kapat
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Unmount'ta mic'i bırak
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioRef.current?.pause()
    }
  }, [])

  async function startRecording() {
    setErrorMsg(null)
    setTranscript(null)
    setReply(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = handleRecordingStop
      recorder.start(100)

      setPhase('recording')
    } catch {
      setPhase('error')
      setErrorMsg('Mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol et.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setPhase('transcribing')
  }

  const handleRecordingStop = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type ?? 'audio/webm' })

    // --- 1) Transcribe ---
    setPhase('transcribing')
    let text = ''
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ses tanıma başarısız')
      text = data.text?.trim() ?? ''
      if (!text) {
        setPhase('error')
        setErrorMsg('Ses anlaşılamadı. Tekrar dene.')
        return
      }
      setTranscript(text)
    } catch (err: unknown) {
      setPhase('error')
      setErrorMsg((err as Error).message ?? 'Ses tanıma başarısız')
      return
    }

    // --- 2) Chat API ---
    setPhase('thinking')
    let assistantReply = ''
    let newConvId: string | undefined
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId, history: [], mode: activeMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Yanıt alınamadı')
      assistantReply = data.reply ?? ''
      newConvId = data.conversationId ?? undefined
      setReply(assistantReply)
    } catch (err: unknown) {
      setPhase('error')
      setErrorMsg((err as Error).message ?? 'Yanıt alınamadı')
      return
    }

    // --- 3) Callback (chat state güncelle) ---
    onMessageSent(text, assistantReply, newConvId)

    // --- 4) Synthesize & play ---
    if (!voiceEnabled) {
      setPhase('idle')
      return
    }

    setPhase('speaking')
    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: assistantReply, mode: activeMode }),
      })
      if (!res.ok) throw new Error('Ses sentezi başarısız')

      const audioBlob = await res.blob()
      const url = URL.createObjectURL(audioBlob)
      const audio = new Audio(url)
      audio.playbackRate = playbackRate
      audioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(url)
        setPhase('idle')
        setTranscript(null)
        setReply(null)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        setPhase('idle')
      }
      await audio.play()
    } catch {
      // Ses çalma başarısız olursa sessizce idle'a dön
      setPhase('idle')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, conversationId, onMessageSent, playbackRate, voiceEnabled])

  function handleMicClick() {
    if (phase === 'idle' || phase === 'error') {
      startRecording()
    } else if (phase === 'recording') {
      stopRecording()
    } else if (phase === 'speaking') {
      audioRef.current?.pause()
      setPhase('idle')
    }
  }

  const isAnimating = phase === 'recording' || phase === 'speaking'
  const isLoading = phase === 'transcribing' || phase === 'thinking'
  const canInteract = phase !== 'transcribing' && phase !== 'thinking'

  return (
    /* Backdrop — tıklayınca kapat */
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Kart */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center">

        {/* Başlık satırı */}
        <div className="flex items-center justify-between w-full mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">{modeEmoji}</span>
            <span className="text-white/70 text-sm font-medium">{modeLabel} · Sesli Mod</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Ses dalgası / loading animasyonu */}
        <div className="h-10 flex items-center justify-center gap-1.5 mb-4">
          {isAnimating ? (
            Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="voice-bar" style={{ backgroundColor: modeColor }} />
            ))
          ) : isLoading ? (
            <div className="flex gap-1.5 items-center">
              <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0ms]" style={{ backgroundColor: modeColor }} />
              <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]" style={{ backgroundColor: modeColor }} />
              <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]" style={{ backgroundColor: modeColor }} />
            </div>
          ) : (
            <div className="w-px h-6 opacity-0" />
          )}
        </div>

        {/* Faz etiketi */}
        <p className={`text-sm font-medium mb-1 text-center transition-colors ${phase === 'error' ? 'text-red-400' : 'text-white/70'}`}>
          {PHASE_LABELS[phase]}
        </p>
        {errorMsg && (
          <p className="text-xs text-red-400/80 text-center mb-2 leading-relaxed">{errorMsg}</p>
        )}

        {/* Transkript ve yanıt önizleme */}
        {transcript && (
          <div className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-2 mt-1">
            <p className="text-xs text-white/40 mb-0.5">Sen:</p>
            <p className="text-xs text-white/80 leading-relaxed">{transcript}</p>
          </div>
        )}
        {reply && (
          <div className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-2">
            <p className="text-xs mb-0.5" style={{ color: modeColor + 'cc' }}>Zeno:</p>
            <p className="text-xs text-white/80 leading-relaxed line-clamp-2">{reply}</p>
          </div>
        )}

        {/* Mikrofon butonu */}
        <button
          onClick={handleMicClick}
          disabled={!canInteract}
          className={`
            mt-4 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            ${phase === 'recording' ? 'scale-110' : 'hover:scale-105 active:scale-95'}
          `}
          style={{
            backgroundColor: phase === 'recording' ? '#EF4444' : modeColor,
            boxShadow: isAnimating ? `0 0 24px ${modeColor}60` : undefined,
          }}
        >
          {phase === 'recording' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          ) : phase === 'speaking' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>

        <p className="text-xs text-white/25 mt-4 text-center">
          {phase === 'idle' && 'Mikrofona bas ve konuş · ESC ile kapat'}
          {phase === 'recording' && 'Durdurmak için tekrar bas'}
          {phase === 'speaking' && 'Sesi durdurmak için tıkla'}
        </p>
      </div>
    </div>
  )
}

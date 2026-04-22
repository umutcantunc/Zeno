'use client'

import { useState, useRef, useCallback } from 'react'

export type VoicePhase = 'idle' | 'recording' | 'processing' | 'speaking'

interface Options {
  onMessageSent: (userText: string, assistantText: string, newConvId?: string) => void
  onError: (msg: string) => void
}

export function useVoiceChat(
  activeMode: string,
  conversationId: string | null,
  { onMessageSent, onError }: Options
) {
  const [phase, setPhase] = useState<VoicePhase>('idle')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const audioRef         = useRef<HTMLAudioElement | null>(null)

  // Ref'ler: stale closure olmadan en güncel değerleri yakala
  const refs = useRef({ activeMode, conversationId, onMessageSent, onError })
  refs.current = { activeMode, conversationId, onMessageSent, onError }

  /* ── Kayıt başlat ─────────────────────────────────────── */
  const startRecording = useCallback(async () => {
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
      recorder.start(100)
      setPhase('recording')
    } catch {
      refs.current.onError('Mikrofon erişimi reddedildi. Tarayıcı izinlerini kontrol et.')
    }
  }, [])

  /* ── Kayıt bitir → transcribe → chat → synthesize ────── */
  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    setPhase('processing')

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())

      const mimeType = chunksRef.current[0]?.type ?? 'audio/webm'
      const blob     = new Blob(chunksRef.current, { type: mimeType })
      const ext      = mimeType.includes('ogg') ? 'ogg'
        : mimeType.includes('mp4') ? 'mp4' : 'webm'
      const { activeMode: mode, conversationId: convId } = refs.current

      // 1. Transcribe
      let text = ''
      try {
        const fd = new FormData()
        fd.append('audio', new File([blob], `rec.${ext}`, { type: mimeType }))
        const res  = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Ses tanıma başarısız')
        text = (json.text ?? '').trim()
        if (!text) {
          refs.current.onError('Ses anlaşılamadı. Tekrar dene.')
          setPhase('idle')
          return
        }
      } catch (e: unknown) {
        refs.current.onError((e as Error).message ?? 'Ses tanıma başarısız')
        setPhase('idle')
        return
      }

      // 2. Chat API
      let reply = ''
      let newConvId: string | undefined
      try {
        const res  = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, conversationId: convId, history: [], mode }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Yanıt alınamadı')
        reply      = json.reply ?? ''
        newConvId  = json.conversationId
      } catch (e: unknown) {
        refs.current.onError((e as Error).message ?? 'Yanıt alınamadı')
        setPhase('idle')
        return
      }

      // 3. Chat state'i güncelle
      refs.current.onMessageSent(text, reply, newConvId)

      // 4. Synthesize & play
      const voiceEnabled = localStorage.getItem('zeno_voice_enabled') !== 'false'
      if (!voiceEnabled) { setPhase('idle'); return }

      setPhase('speaking')
      try {
        const res = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: reply, mode }),
        })
        if (!res.ok) throw new Error('Ses sentezi başarısız')
        const audioBlob = await res.blob()
        const url       = URL.createObjectURL(audioBlob)
        const speed     = parseFloat(localStorage.getItem('zeno_voice_speed') ?? '1')
        const audio     = new Audio(url)
        audio.playbackRate = speed
        audioRef.current   = audio
        audio.onended  = () => { URL.revokeObjectURL(url); setPhase('idle') }
        audio.onerror  = () => { URL.revokeObjectURL(url); setPhase('idle') }
        await audio.play()
      } catch {
        setPhase('idle')
      }
    }

    recorder.stop()
  }, [])

  /* ── Ses çalmayı durdur ───────────────────────────────── */
  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause()
    setPhase('idle')
  }, [])

  /* ── Tek buton: başlat / bitir / durdur ─────────────── */
  const handleMicClick = useCallback(() => {
    if      (phase === 'idle')      startRecording()
    else if (phase === 'recording') finishRecording()
    else if (phase === 'speaking')  stopSpeaking()
  }, [phase, startRecording, finishRecording, stopSpeaking])

  return { voicePhase: phase, handleMicClick }
}

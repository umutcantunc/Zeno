import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  // API key kontrolü
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[Transcribe] OPENAI_API_KEY tanımlı değil')
    return NextResponse.json({ error: 'OpenAI API anahtarı eksik' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      console.error('[Transcribe] FormData\'da audio alanı bulunamadı')
      return NextResponse.json({ error: 'Ses dosyası bulunamadı' }, { status: 400 })
    }

    console.log('[Transcribe] Dosya bilgisi:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    })

    // Whisper desteklenen format: webm, mp4, ogg, wav, flac vb.
    // Dosya adı uzantısı Whisper'ın formatı anlaması için kritik
    const ext = audioFile.type.includes('ogg') ? 'ogg'
      : audioFile.type.includes('mp4') ? 'mp4'
      : 'webm'

    const namedFile = new File([audioFile], `recording.${ext}`, { type: audioFile.type })

    const transcription = await openai.audio.transcriptions.create({
      file: namedFile,
      model: 'whisper-1',
      language: 'tr',
    })

    console.log('[Transcribe] Başarılı:', transcription.text)
    return NextResponse.json({ text: transcription.text })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Transcribe] Hata:', message)
    // Tam hata mesajını client'a döndür (debug için)
    return NextResponse.json({ error: `Ses tanıma başarısız: ${message}` }, { status: 500 })
  }
}

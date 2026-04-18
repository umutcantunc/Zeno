import { NextRequest, NextResponse } from 'next/server'

const VOICE_IDS: Record<string, string> = {
  zeno:      'pNInz6obpgDQGcFmaJgB',
  dost:      'EXAVITQu4vr4xnSDxMaL',
  koc:       'VR6AewLTigWG4xSOukaG',
  bilge:     'ErXwobaYiN019PkySvjV',
  dinleyici: 'MF3mGyEYCl7XYWbV9V6O',
}

export async function POST(req: NextRequest) {
  try {
    const { text, mode } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Metin boş olamaz' }, { status: 400 })
    }

    const voiceId = VOICE_IDS[mode as string] ?? VOICE_IDS.zeno

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('ElevenLabs error:', errText)
      return NextResponse.json({ error: 'Ses sentezi başarısız' }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Synthesize error:', err)
    return NextResponse.json({ error: 'Ses sentezi başarısız' }, { status: 500 })
  }
}

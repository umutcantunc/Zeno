import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-lg shadow-purple-900/40">Z</div>
          <h1 className="text-5xl font-bold text-white tracking-tight">Zeno</h1>
          <p className="text-xl text-purple-200 font-medium">Zihninin pusulası.</p>
          <p className="text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            Dinler, anlar, yol gösterir. Her duyguya yer var.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors duration-200"
          >
            Ücretsiz Başla
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors duration-200 border border-white/20"
          >
            Giriş Yap
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {[
            {
              emoji: '🌙',
              time: 'İş çıkışı, 5 dakika',
              title: 'Zihnini boşalt',
              desc: 'Günün yükünü bırak, dinle ve hafifle.',
            },
            {
              emoji: '💬',
              time: 'Aile kavgası sonrası',
              title: 'Yargılanmadan anlat',
              desc: 'Ne hissedersen hisset, burada güvendesin.',
            },
            {
              emoji: '🕑',
              time: "Gece 2'de",
              title: 'Yanında biri olsun',
              desc: 'Uyku gelmiyorsa Zeno uyanık ve hazır.',
            },
          ].map((item) => (
            <div key={item.title} className="bg-white/5 rounded-2xl p-5 border border-white/10 text-left hover:bg-white/8 transition-colors">
              <div className="text-2xl mb-3">{item.emoji}</div>
              <p className="text-purple-300 text-xs font-medium mb-1">{item.time}</p>
              <p className="text-white font-semibold text-sm mb-1">{item.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

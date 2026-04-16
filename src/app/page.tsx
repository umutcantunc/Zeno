import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-white tracking-tight">
            Zeno
          </h1>
          <p className="text-xl text-purple-200 font-medium">
            Zihin koçunuz, her an yanınızda
          </p>
          <p className="text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            Profesyonel hayatın yoğunluğunda kendinize zaman ayırın.
            Zeno, yargılamadan dinleyen, anlayan ve rehberlik eden AI destekli zihin koçunuzdur.
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

        <div className="grid grid-cols-3 gap-6 pt-8">
          {[
            { icon: '🧠', title: 'Akıllı Koçluk', desc: 'Kişiselleştirilmiş destek' },
            { icon: '🔒', title: 'Gizlilik', desc: 'Verileriniz şifreli ve güvende' },
            { icon: '🇹🇷', title: 'Türkçe', desc: 'Tam Türkçe deneyim' },
          ].map((item) => (
            <div key={item.title} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-white font-semibold text-sm">{item.title}</div>
              <div className="text-slate-400 text-xs mt-1">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

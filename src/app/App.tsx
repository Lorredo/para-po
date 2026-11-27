import { Logo } from '../components/brand/Logo'
import { copy } from '../content/copy'

export default function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
        <Logo size={36} />
        <div>
          <h1 className="text-lg leading-tight font-bold">{copy.appName}</h1>
          <p className="text-sm text-white/80">{copy.tagline}</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo size={96} />
        <h2 className="text-2xl font-bold text-navy">
          {copy.emptyState.title}
        </h2>
        <p className="max-w-sm text-ink/80">{copy.emptyState.body}</p>
        <p className="rounded-full bg-jeep-yellow px-4 py-2 text-sm font-semibold text-navy">
          {copy.comingSoon}
        </p>
      </main>
    </div>
  )
}

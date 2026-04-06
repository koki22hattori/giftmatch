import { getSurveyResults } from '@/app/actions'
import { AdvanceButton } from './AdvanceButton'

const GENRES = ['食べ物', '雑貨', '体験', '実用品', 'なんでもOK']

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const { genreCounts, medianBudget, totalResponses } = await getSurveyResults(roomId)

  const maxCount = Math.max(...Object.values(genreCounts), 1)

  return (
    <main className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center px-6 py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-3">PHASE 03 — SURVEY RESULTS</p>
        <h1 className="text-2xl tracking-widest text-white">アンケート結果発表</h1>
        <p className="mt-2 text-gray-500 text-xs">{totalResponses} / 6 responses collected</p>
      </div>

      {/* Budget */}
      <section className="w-full max-w-lg mb-14">
        <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-4">// 基準予算（中央値）</p>
        <div className="border border-cyan-400/30 bg-cyan-400/5 rounded px-8 py-8 text-center">
          <p className="text-xs text-cyan-400 tracking-widest mb-2">BASE BUDGET</p>
          <p className="text-6xl font-bold text-cyan-400 tracking-tight">
            ¥{medianBudget.toLocaleString()}
          </p>
          <p className="mt-3 text-gray-500 text-xs">全回答の中央値</p>
        </div>
      </section>

      {/* Genre Bar Chart */}
      <section className="w-full max-w-lg mb-14">
        <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-6">// 希望ジャンル集計</p>
        <div className="space-y-4">
          {GENRES.map((genre) => {
            const count = genreCounts[genre] ?? 0
            const pct = Math.round((count / maxCount) * 100)
            return (
              <div key={genre}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm text-gray-300">{genre}</span>
                  <span className="text-xs text-cyan-400">{count}人</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Locked Rankings */}
      <section className="w-full max-w-lg mb-10">
        <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-4">// 順位情報</p>
        <div className="border border-gray-700 rounded px-6 py-5 space-y-3">
          <LockRow label="もらいたい順位" />
          <LockRow label="渡したい順位" />
        </div>
        <p className="mt-3 text-gray-600 text-xs text-center tracking-wider">Phase 10 まで非公開</p>
      </section>

      <AdvanceButton roomId={roomId} />
    </main>
  )
}

function LockRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2 text-gray-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span className="text-xs tracking-wider">LOCKED</span>
      </div>
    </div>
  )
}

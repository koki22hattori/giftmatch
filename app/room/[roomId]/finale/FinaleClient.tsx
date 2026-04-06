'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type FinalePlayer = {
  name: string; anonymousName: string
  gameScore: number; finalBudget: number; santaTarget: string
  wantRanks: string[]; giveRanks: string[]
  giftName: string; actualAmount: number
  impression: string; giverGuess: string
  postWantRanks: string[]; anonGuesses: Record<string, string>
}
type FinaleData = {
  room: { minBudget: number; budgetDiff: number }
  players: FinalePlayer[]
  giverOf: Record<string, string>
}

type ActIndex = 'intro' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'finale'

// ── Main ──────────────────────────────────────────────────────────────────────
export function FinaleClient({ roomId, data }: { roomId: string; data: FinaleData }) {
  const [actIndex, setActIndex] = useState<ActIndex>('intro')
  const { players, giverOf, room } = data

  function next() {
    setActIndex((a) => {
      if (a === 'intro') return 1
      if (a === 7) return 'finale'
      if (typeof a === 'number' && a < 7) return (a + 1) as ActIndex
      return 'finale'
    })
  }

  const actProps = { players, giverOf, room, onNext: next }

  if (actIndex === 'intro') return <ActIntro onNext={next} />
  if (actIndex === 1) return <Act1 {...actProps} />
  if (actIndex === 2) return <Act2 {...actProps} />
  if (actIndex === 3) return <Act3 {...actProps} />
  if (actIndex === 4) return <Act4 {...actProps} />
  if (actIndex === 5) return <Act5 {...actProps} />
  if (actIndex === 6) return <Act6 {...actProps} />
  if (actIndex === 7) return <Act7 {...actProps} />
  return <FinaleAll players={players} giverOf={giverOf} />
}

// ── Shared Props ──────────────────────────────────────────────────────────────
type ActProps = {
  players: FinalePlayer[]
  giverOf: Record<string, string>
  room: { minBudget: number; budgetDiff: number }
  onNext: () => void
}

// ── Intro ─────────────────────────────────────────────────────────────────────
function ActIntro({ onNext }: { onNext: () => void }) {
  return (
    <FullScreen>
      <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-4">PHASE 10</p>
      <h1 className="act-title text-4xl font-bold text-white tracking-widest mb-4">大公開</h1>
      <p className="text-gray-500 text-sm mb-12 text-center leading-relaxed">
        全7幕にわたる<br />グランドフィナーレが始まります
      </p>
      <button onClick={onNext}
        className="px-12 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.4em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300">
        START →
      </button>
    </FullScreen>
  )
}

// ── Act 1: 予想対決 ────────────────────────────────────────────────────────────
function Act1({ players, giverOf, onNext }: ActProps) {
  const [revealCount, setRevealCount] = useState(0)

  useEffect(() => {
    if (revealCount >= players.length) return
    const t = setTimeout(() => setRevealCount((c) => c + 1), 500)
    return () => clearTimeout(t)
  }, [revealCount, players.length])

  // 誰が送ったか予想の正誤
  const giverResults = players.map((p) => ({
    name: p.name, anon: p.anonymousName,
    correct: giverOf[p.name] === p.giverGuess,
    actual: giverOf[p.name] ?? '不明',
    guessed: p.giverGuess,
  }))

  // 匿名名称予想スコア
  const anonScores = players.map((p) => {
    const score = players.filter((other) =>
      p.anonGuesses[other.anonymousName] === other.name
    ).length
    return { name: p.name, score }
  }).sort((a, b) => b.score - a.score)

  return (
    <FullScreen>
      <ActHeader act={1} title="予想対決" />
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* 誰が送った予想 */}
        <Section title="// 送り主予想 正解 / 不正解">
          <div className="flex flex-col gap-2">
            {giverResults.map((r, i) => (
              <div key={r.name}
                className="curtain-in flex items-center gap-3 px-4 py-3 rounded border text-sm"
                style={{
                  animationDelay: `${i * 0.12}s`,
                  borderColor: r.correct ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                  background:  r.correct ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                  opacity: i < revealCount ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}>
                <span className="text-lg">{r.correct ? '✓' : '✗'}</span>
                <span className="flex-1 text-gray-300">{r.anon}</span>
                <span className="text-xs text-gray-600">予想: {r.guessed || '—'}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 匿名名称予想スコア */}
        <Section title="// 匿名予想 正解数ランキング">
          <div className="flex flex-col gap-2">
            {anonScores.map((s, i) => (
              <div key={s.name}
                className="curtain-in flex items-center justify-between px-4 py-2 rounded border border-gray-700 text-sm"
                style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="text-gray-300">{players.find(p => p.name === s.name)?.anonymousName}</span>
                <span className="text-cyan-400 font-bold">{s.score} / {players.length} 正解</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <NextActButton label="第2幕へ" onNext={onNext} />
    </FullScreen>
  )
}

// ── Act 2: 正体バレ ────────────────────────────────────────────────────────────
function Act2({ players, onNext }: ActProps) {
  const [revealed, setRevealed] = useState<number>(-1)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    if (revealed >= players.length - 1) {
      setTimeout(() => setDone(true), 800)
      return
    }
    const t = setTimeout(() => setRevealed((r) => r + 1), 700)
    return () => clearTimeout(t)
  }, [revealed, players.length])

  return (
    <FullScreen>
      <ActHeader act={2} title="正体バレ" />
      <div className="w-full max-w-md flex flex-col gap-3 mb-8">
        {players.map((p, i) => {
          const isRevealed = i <= revealed
          return (
            <div key={p.name}
              className="flex items-center gap-4 px-5 py-4 rounded border transition-all duration-500"
              style={{
                borderColor: isRevealed ? 'rgba(167,139,250,0.5)' : 'rgba(55,65,81,0.8)',
                background:  isRevealed ? 'rgba(167,139,250,0.08)' : 'rgba(15,23,42,0.5)',
                boxShadow:   isRevealed ? '0 0 20px rgba(167,139,250,0.2)' : 'none',
              }}>
              <span className="text-gray-400 text-sm flex-1">{p.anonymousName}</span>
              <span className="text-gray-600 text-xs">=</span>
              {isRevealed ? (
                <span className="identity-slam text-lg font-bold text-white"
                  style={{ animationDelay: '0s', textShadow: '0 0 20px rgba(167,139,250,0.8)' }}>
                  {p.name}
                </span>
              ) : (
                <span className="text-gray-700 text-sm tracking-widest">？？？</span>
              )}
            </div>
          )
        })}
      </div>
      {done && <NextActButton label="第3幕へ" onNext={onNext} />}
    </FullScreen>
  )
}

// ── Act 3: シークレットサンタ解禁 ─────────────────────────────────────────────
function Act3({ players, giverOf, onNext }: ActProps) {
  return (
    <FullScreen>
      <ActHeader act={3} title="サンタ解禁" />
      <div className="w-full max-w-md flex flex-col gap-3 mb-8">
        {players.map((p, i) => {
          const giver = players.find((g) => g.name === giverOf[p.name])
          return (
            <div key={p.name}
              className="reveal-pop flex items-center gap-3 px-4 py-3 rounded border border-gray-700"
              style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="text-sm text-cyan-300 font-bold flex-1">{giver?.name ?? '不明'}</span>
              <span className="text-gray-600 text-xs">→</span>
              <span className="text-sm text-gray-300 flex-1 text-right">{p.name}</span>
              <span className="text-xs text-gray-600 ml-2">「{giver?.giftName ?? '?'}」</span>
            </div>
          )
        })}
      </div>
      <NextActButton label="第4幕へ" onNext={onNext} />
    </FullScreen>
  )
}

// ── Act 4: プレゼント人気投票 ──────────────────────────────────────────────────
function Act4({ players, giverOf, onNext }: ActProps) {
  // 各プレゼントのポイントを集計（受取者のrealNameをキーに）
  const points: Record<string, number> = {}
  for (const voter of players) {
    voter.postWantRanks.forEach((recipientName, idx) => {
      points[recipientName] = (points[recipientName] ?? 0) + (5 - idx)
    })
  }

  const ranking = players.map((p) => {
    const giver = players.find((g) => g.name === giverOf[p.name])
    return {
      name: p.name, anon: p.anonymousName,
      giftName: giver?.giftName ?? '不明',
      pts: points[p.name] ?? 0,
    }
  }).sort((a, b) => b.pts - a.pts)

  return (
    <FullScreen>
      <ActHeader act={4} title="人気投票" />
      <div className="w-full max-w-md flex flex-col gap-3 mb-8">
        {ranking.map((r, i) => (
          <div key={r.name}
            className="reveal-pop flex items-center gap-3 px-4 py-3 rounded border"
            style={{
              animationDelay: `${i * 0.12}s`,
              borderColor: i === 0 ? 'rgba(6,182,212,0.5)' : i === 1 ? 'rgba(167,139,250,0.4)' : 'rgba(55,65,81,0.8)',
              background:   i === 0 ? 'rgba(6,182,212,0.08)' : 'rgba(15,23,42,0.5)',
            }}>
            <span className="text-lg font-bold w-8" style={{ color: i === 0 ? '#06b6d4' : i === 1 ? '#a78bfa' : '#6b7280' }}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200">「{r.giftName}」</p>
              <p className="text-xs text-gray-600">{r.anon} がもらった</p>
            </div>
            <span className="text-cyan-400 text-sm font-bold">{r.pts}pt</span>
          </div>
        ))}
      </div>
      <NextActButton label="第5幕へ" onNext={onNext} />
    </FullScreen>
  )
}

// ── Act 5: お金の話 ────────────────────────────────────────────────────────────
function Act5({ players, giverOf, onNext }: ActProps) {
  // diff = もらったプレゼントの金額 - 自分が送った金額
  const rows = players.map((p) => {
    const giver = players.find((g) => g.name === giverOf[p.name])
    const received = giver?.actualAmount ?? 0
    const sent     = p.actualAmount
    const diff     = received - sent
    return { name: p.name, sent, received, diff }
  }).sort((a, b) => b.diff - a.diff)

  return (
    <FullScreen>
      <ActHeader act={5} title="お金の話" />
      <div className="w-full max-w-md flex flex-col gap-3 mb-8">
        {rows.map((r, i) => {
          const profit = r.diff >= 0
          return (
            <div key={r.name}
              className="reveal-pop px-4 py-3 rounded border"
              style={{
                animationDelay: `${i * 0.1}s`,
                borderColor: profit ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                background:   profit ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">{r.name}</span>
                <span className="text-base font-bold" style={{ color: profit ? '#10b981' : '#ef4444' }}>
                  {profit ? `+¥${r.diff.toLocaleString()}` : `-¥${Math.abs(r.diff).toLocaleString()}`}
                  <span className="text-xs ml-1">{profit ? '得' : '損'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>送った ¥{r.sent.toLocaleString()}</span>
                <span className="text-gray-700">→</span>
                <span>もらった ¥{r.received.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>
      <NextActButton label="第6幕へ" onNext={onNext} />
    </FullScreen>
  )
}

// ── Act 6: ゲーム実名順位発表 ──────────────────────────────────────────────────
function Act6({ players, onNext }: ActProps) {
  const sorted = [...players].sort((a, b) => {
    const d = b.gameScore - a.gameScore
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })

  return (
    <FullScreen>
      <ActHeader act={6} title="ゲーム順位" />
      <div className="w-full max-w-md flex flex-col gap-3 mb-8">
        {sorted.map((p, i) => (
          <div key={p.name}
            className="reveal-pop flex items-center gap-4 px-4 py-3 rounded border"
            style={{
              animationDelay: `${i * 0.1}s`,
              borderColor: i === 0 ? 'rgba(6,182,212,0.5)' : i === 1 ? 'rgba(167,139,250,0.4)' : 'rgba(55,65,81,0.8)',
              background:   i === 0 ? 'rgba(6,182,212,0.07)' : 'rgba(15,23,42,0.5)',
            }}>
            <span className="text-lg font-bold w-8" style={{ color: i === 0 ? '#06b6d4' : i === 1 ? '#a78bfa' : i === 2 ? '#60a5fa' : '#6b7280' }}>
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-bold text-white">{p.name}</span>
            <span className="text-xs text-gray-500">{p.anonymousName}</span>
            <span className="text-cyan-400 font-bold">{p.gameScore}pts</span>
          </div>
        ))}
      </div>
      <NextActButton label="第7幕へ" onNext={onNext} />
    </FullScreen>
  )
}

// ── Act 7: 本音バレ ────────────────────────────────────────────────────────────
function Act7({ players, onNext }: ActProps) {
  const [tab, setTab] = useState<'want' | 'give'>('want')

  return (
    <FullScreen>
      <ActHeader act={7} title="本音バレ" />
      <div className="flex gap-2 mb-6">
        {(['want', 'give'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-5 py-2 text-xs font-mono tracking-widest border rounded transition-all duration-200"
            style={{
              borderColor: tab === t ? '#06b6d4' : '#374151',
              color:       tab === t ? '#06b6d4' : '#6b7280',
              background:  tab === t ? 'rgba(6,182,212,0.08)' : 'transparent',
            }}>
            {t === 'want' ? 'もらいたい' : '渡したい'}
          </button>
        ))}
      </div>
      <div className="w-full max-w-md flex flex-col gap-4 mb-8 overflow-y-auto max-h-[50vh]">
        {players.map((p, i) => {
          const ranks = tab === 'want' ? p.wantRanks : p.giveRanks
          return (
            <div key={p.name}
              className="curtain-in px-4 py-3 rounded border border-gray-700 bg-gray-900/50"
              style={{ animationDelay: `${i * 0.08}s` }}>
              <p className="text-sm font-bold text-white mb-2">{p.name}</p>
              <div className="flex flex-wrap gap-1">
                {ranks.map((name, ri) => (
                  <span key={name} className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400">
                    <span className="text-cyan-600 mr-1">{ri + 1}.</span>{name}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <NextActButton label="フィナーレへ" onNext={onNext} />
    </FullScreen>
  )
}

// ── Finale: 全部一覧 ────────────────────────────────────────────────────────────
function FinaleAll({ players, giverOf }: { players: FinalePlayer[]; giverOf: Record<string, string> }) {
  return (
    <main className="min-h-screen bg-[#030712] text-white font-mono px-4 py-12 overflow-auto">
      <GridBg />
      <div className="relative z-10 max-w-2xl mx-auto">
        <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-2">FINALE</p>
        <h1 className="text-2xl font-bold tracking-widest text-white mb-10">全部見せます</h1>

        {players.map((p) => {
          const giver = players.find((g) => g.name === giverOf[p.name])
          return (
            <div key={p.name} className="mb-8 reveal-pop border border-gray-700 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3"
                style={{ background: 'rgba(6,182,212,0.08)', borderBottom: '1px solid rgba(6,182,212,0.2)' }}>
                <div>
                  <span className="text-white font-bold">{p.name}</span>
                  <span className="text-gray-500 text-xs ml-2">({p.anonymousName})</span>
                </div>
                <span className="text-cyan-400 text-xs">¥{p.finalBudget.toLocaleString()} / {p.gameScore}pts</span>
              </div>

              <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <FinaleRow label="送り先" value={p.santaTarget} />
                <FinaleRow label="送ったもの" value={p.giftName} />
                <FinaleRow label="実際の金額" value={`¥${p.actualAmount.toLocaleString()}`} />
                <FinaleRow label="もらったもの" value={giver?.giftName ?? '不明'} />
                <FinaleRow label="感想" value={p.impression} span />
                <FinaleRow label="送り主予想" value={`${p.giverGuess}（${giverOf[p.name] === p.giverGuess ? '正解✓' : '不正解✗'}）`} span />
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────
function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
      <GridBg />
      <div className="relative z-10 w-full flex flex-col items-center">{children}</div>
    </main>
  )
}
function GridBg() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: 'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }} />
  )
}
function ActHeader({ act, title }: { act: number; title: string }) {
  return (
    <div className="text-center mb-8">
      <p className="text-gray-600 text-xs tracking-[0.4em] mb-2">ACT {act} / 7</p>
      <h2 className="act-title text-3xl font-bold text-white tracking-widest">{title}</h2>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-3">{title}</p>
      {children}
    </div>
  )
}
function NextActButton({ label, onNext }: { label: string; onNext: () => void }) {
  return (
    <button onClick={onNext}
      className="mt-6 px-10 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300">
      {label} →
    </button>
  )
}
function FinaleRow({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-gray-600 mb-0.5">{label}</p>
      <p className="text-gray-200">{value || '—'}</p>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitPostSurvey } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'

type OtherPresent = { recipientName: string; anonymousName: string; giftName: string }
type Player       = { name: string; anonymousName: string }
type Step = 'loading' | 1 | 2 | 3 | 4 | 'submitting' | 'waiting'

export function PostSurveyClient({ roomId }: { roomId: string }) {
  const router = useRouter()

  const [playerName, setPlayerName] = useState<string | null>(null)
  const [others,     setOthers]     = useState<OtherPresent[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [step,       setStep]       = useState<Step>('loading')

  // Answers
  const [impression,    setImpression]    = useState('')
  const [giverGuess,    setGiverGuess]    = useState('')
  const [wantRanks,     setWantRanks]     = useState<OtherPresent[]>([])
  const [anonGuesses,   setAnonGuesses]   = useState<Record<string, string>>({})

  // Waiting
  const [waitList, setWaitList] = useState<Array<{ anonymousName: string; done: boolean }>>([])

  // Init
  useEffect(() => {
    const name = localStorage.getItem(`giftmatch_player_${roomId}`)
    setPlayerName(name)
    if (!name) { setStep(1); return }

    const supabase = createClient()
    supabase
      .from('players')
      .select('name, anonymous_name, santa_target, post_answers')
      .eq('room_id', roomId)
      .then(({ data: players }) => {
        if (!players) { setStep(1); return }
        const giverOf: Record<string, string> = {}
        for (const p of players) { if (p.santa_target) giverOf[p.santa_target] = p.name }
        const others = players
          .filter((p) => p.name !== name)
          .map((p) => {
            const giver = players.find((g) => g.name === giverOf[p.name])
            return {
              recipientName: p.name as string,
              anonymousName: (p.anonymous_name ?? p.name) as string,
              giftName: ((giver?.post_answers as Record<string, unknown> | null)?.gift_name as string) ?? '不明',
            }
          })
        const allPlayers = players.map((p) => ({
          name: p.name as string,
          anonymousName: (p.anonymous_name ?? p.name) as string,
        }))
        setOthers(others)
        setAllPlayers(allPlayers)
        setWantRanks(others)
        const init: Record<string, string> = {}
        for (const p of allPlayers) init[p.anonymousName] = ''
        setAnonGuesses(init)
        setStep(1)
      })
  }, [roomId])

  // Realtime when waiting
  useEffect(() => {
    if (step !== 'waiting') return

    const supabase = createClient()

    async function refresh() {
      console.log('[Realtime] refresh() called, fetching players...')
      const [{ data: room }, { data: players }] = await Promise.all([
        supabase.from('rooms').select('phase').eq('id', roomId).single(),
        supabase.from('players').select('name, anonymous_name, post_answers').eq('room_id', roomId),
      ])
      console.log('[Realtime] players fetched:', players)
      setWaitList((players ?? []).map((p) => ({
        name: p.name as string,
        anonymousName: (p.anonymous_name ?? p.name) as string,
        done: !!(p.post_answers as Record<string, unknown> | null)?.impression,
      })))
      if ((room?.phase ?? 9) >= 10) router.push(`/room/${roomId}/finale`)
    }

    refresh()

    console.log('[Realtime] channel created')
    const channel = supabase
      .channel(`post-survey-waiting-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          console.log('[Realtime] event received:', payload)
          refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          console.log('[Realtime] event received:', payload)
          if ((payload.new as { phase: number }).phase >= 10) {
            router.push(`/room/${roomId}/finale`)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [step, roomId, router])

  async function handleSubmit() {
    if (!playerName) return
    setStep('submitting')
    await submitPostSurvey(roomId, playerName, {
      impression,
      giverGuess,
      postWantRanks: wantRanks.map((p) => p.recipientName),
      anonGuesses,
    })
    setStep('waiting')
  }

  // Rank reorder helpers
  function moveUp(i: number) {
    if (i === 0) return
    const a = [...wantRanks]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setWantRanks(a)
  }
  function moveDown(i: number) {
    if (i === wantRanks.length - 1) return
    const a = [...wantRanks]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; setWantRanks(a)
  }

  function setGuess(anonName: string, realName: string) {
    setAnonGuesses((prev) => ({ ...prev, [anonName]: realName }))
  }

  // Compute which real names are still available for anon guesses
  function usedNames() {
    return new Set(Object.values(anonGuesses).filter(Boolean))
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <Screen>
        <Label>PHASE 09 — POST SURVEY</Label>
        <div className="mt-8 flex items-center gap-3 text-gray-600 text-xs">
          <PulseDot />
          <span>読み込み中...</span>
        </div>
      </Screen>
    )
  }

  // ── Waiting ──────────────────────────────────────────────────────────────
  if (step === 'waiting' || step === 'submitting') {
    const total    = waitList.length || 6
    const doneCount = waitList.filter((p) => p.done).length
    return (
      <Screen>
        <Label>PHASE 09 — WAITING</Label>
        <h1 className="text-xl tracking-widest text-white mt-2 mb-8">回答待ち</h1>
        <div className="w-full max-w-xs flex flex-col gap-2 mb-6">
          {waitList.map((p) => (
            <Row key={p.anonymousName} label={p.anonymousName} done={p.done}
              doneText="回答済み ✓" pendingText="回答中..." />
          ))}
        </div>
        <p className="text-gray-600 text-xs font-mono mb-4">{doneCount} / {total} 完了</p>
        <PulseDot />
      </Screen>
    )
  }

  const progressLabel = `${step} / 4`

  // ── Step 1: Impression ────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Screen>
        <Progress label={progressLabel} />
        <Label>STEP 1 — IMPRESSION</Label>
        <h2 className="text-lg tracking-widest text-white mt-2 mb-6">もらったプレゼントの感想</h2>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <textarea
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            placeholder="感想を自由に書いてください..."
            rows={5}
            className="w-full bg-gray-900 border border-gray-700 focus:border-cyan-400 text-white px-4 py-3 rounded outline-none transition-colors placeholder:text-gray-600 text-sm resize-none"
          />
          <NextButton disabled={!impression.trim()} onClick={() => setStep(2)} />
        </div>
      </Screen>
    )
  }

  // ── Step 2: Giver guess ───────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Screen>
        <Progress label={progressLabel} />
        <Label>STEP 2 — GUESS</Label>
        <h2 className="text-lg tracking-widest text-white mt-2 mb-6">誰が送ってくれた？</h2>
        <div className="w-full max-w-sm flex flex-col gap-2 mb-6">
          {allPlayers
            .filter((p) => p.name !== playerName)
            .map((p) => (
              <button
                key={p.name}
                onClick={() => setGiverGuess(p.name)}
                className="w-full px-4 py-3 rounded border text-sm text-left transition-all duration-200"
                style={{
                  borderColor: giverGuess === p.name ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                  background:  giverGuess === p.name ? 'rgba(6,182,212,0.12)' : 'rgba(15,23,42,0.6)',
                  color:       giverGuess === p.name ? '#06b6d4' : '#d1d5db',
                }}
              >
                {p.name}
              </button>
            ))}
        </div>
        <div className="flex gap-3">
          <BackButton onClick={() => setStep(1)} />
          <NextButton disabled={!giverGuess} onClick={() => setStep(3)} />
        </div>
      </Screen>
    )
  }

  // ── Step 3: Want ranks ────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <Screen>
        <Progress label={progressLabel} />
        <Label>STEP 3 — WANT RANKS</Label>
        <h2 className="text-lg tracking-widest text-white mt-2 mb-2">欲しかったプレゼント順位</h2>
        <p className="text-gray-600 text-xs mb-6">他の人がもらったプレゼントを並び替えてください</p>
        <div className="w-full max-w-sm flex flex-col gap-2 mb-6">
          {wantRanks.map((item, i) => (
            <div
              key={item.recipientName}
              className="flex items-center gap-3 px-3 py-3 rounded border border-gray-700 bg-gray-900/60"
            >
              <span className="text-cyan-400 text-xs font-bold w-6 shrink-0">{i + 1}位</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">「{item.giftName}」</p>
                <p className="text-xs text-gray-600">{item.anonymousName} がもらった</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="w-7 h-6 rounded text-gray-500 hover:text-white disabled:opacity-25 text-xs border border-gray-700 hover:border-gray-500 transition-colors">
                  ↑
                </button>
                <button onClick={() => moveDown(i)} disabled={i === wantRanks.length - 1}
                  className="w-7 h-6 rounded text-gray-500 hover:text-white disabled:opacity-25 text-xs border border-gray-700 hover:border-gray-500 transition-colors">
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <BackButton onClick={() => setStep(2)} />
          <NextButton onClick={() => setStep(4)} />
        </div>
      </Screen>
    )
  }

  // ── Step 4: Anon guesses ──────────────────────────────────────────────────
  if (step === 4) {
    const used = usedNames()
    const selfPlayer = allPlayers.find((p) => p.name === playerName)
    const allConfirmed = allPlayers.every(
      (p) => anonGuesses[p.anonymousName]
    )

    return (
      <Screen>
        <Progress label={progressLabel} />
        <Label>STEP 4 — WHO IS WHO?</Label>
        <h2 className="text-lg tracking-widest text-white mt-2 mb-2">匿名名称の正体予想</h2>
        <p className="text-gray-600 text-xs mb-6">匿名名称が誰か全員予想してください</p>
        <div className="w-full max-w-sm flex flex-col gap-3 mb-6">
          {allPlayers.map((p) => {
            const current = anonGuesses[p.anonymousName] ?? ''
            return (
              <div key={p.anonymousName} className="flex items-center gap-3 px-4 py-3 rounded border border-gray-700 bg-gray-900/60">
                <span className="text-sm text-gray-300 flex-1 truncate">{p.anonymousName}</span>
                <span className="text-gray-600 text-xs">=</span>
                <select
                  value={current}
                  onChange={(e) => setGuess(p.anonymousName, e.target.value)}
                  className="bg-gray-800 border border-gray-600 focus:border-cyan-400 text-white text-sm px-2 py-1 rounded outline-none"
                >
                  <option value="">選択...</option>
                  {allPlayers.map((op) => (
                    <option
                      key={op.name}
                      value={op.name}
                      disabled={used.has(op.name) && current !== op.name}
                    >
                      {op.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <BackButton onClick={() => setStep(3)} />
          <button
            onClick={handleSubmit}
            disabled={!allConfirmed}
            className="px-8 py-3 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送信 →
          </button>
        </div>
      </Screen>
    )
  }

  return null
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
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
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase">{children}</p>
}
function Progress({ label }: { label: string }) {
  return <p className="text-gray-600 text-xs mb-3 font-mono">STEP {label}</p>
}
function NextButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-8 py-3 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed">
      NEXT →
    </button>
  )
}
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-6 py-3 border border-gray-700 text-gray-500 text-sm font-mono hover:border-gray-500 hover:text-gray-300 transition-all duration-300">
      ← BACK
    </button>
  )
}
function Row({ label, done, doneText, pendingText }: { label: string; done: boolean; doneText: string; pendingText: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 rounded border text-xs"
      style={{ borderColor: done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)', background: done ? 'rgba(16,185,129,0.07)' : 'transparent' }}>
      <span className="text-gray-400">{label}</span>
      <span style={{ color: done ? '#10b981' : '#374151' }}>{done ? doneText : pendingText}</span>
    </div>
  )
}
function PulseDot() {
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400"
      style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
  )
}

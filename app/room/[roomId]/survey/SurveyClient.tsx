'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitSurvey } from '@/app/actions'
import type { SurveyAnswers } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'

const PLAYERS = ['服部光貴', '五十子裕', '岡野透', '渋谷瞬', '服部直道', '木下清文']
const GENRES = ['食べ物', '雑貨', '体験', '実用品', 'なんでもOK'] as const

// ---- Background grid ----
function Grid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }}
    />
  )
}

// ---- Section card ----
function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div
      className="w-full rounded-2xl p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(15,23,42,0.85))',
        border: '1px solid rgba(6,182,212,0.18)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0"
          style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)', color: '#06b6d4' }}
        >
          {num}
        </span>
        <span className="text-white font-bold text-base">{title}</span>
      </div>
      {children}
    </div>
  )
}

// ---- Ranking list with drag-and-drop + ↑↓ buttons ----
function RankingList({
  order,
  onChange,
}: {
  order: string[]
  onChange: (next: string[]) => void
}) {
  const dragIdx = useRef<number | null>(null)

  function move(from: number, to: number) {
    const next = [...order]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {order.map((name, i) => (
        <div
          key={name}
          draggable
          onDragStart={() => { dragIdx.current = i }}
          onDragOver={(e) => {
            e.preventDefault()
            const from = dragIdx.current
            if (from !== null && from !== i) {
              move(from, i)
              dragIdx.current = i
            }
          }}
          onDragEnd={() => { dragIdx.current = null }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-grab active:cursor-grabbing select-none"
          style={{
            background: 'rgba(6,182,212,0.06)',
            border: '1px solid rgba(6,182,212,0.15)',
          }}
        >
          {/* rank badge */}
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0"
            style={{
              background: i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(6,182,212,0.1)',
              border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.5)' : 'rgba(6,182,212,0.3)'}`,
              color: i === 0 ? '#fbbf24' : '#06b6d4',
            }}
          >
            {i + 1}
          </span>

          {/* name */}
          <span className="flex-1 text-white text-sm font-medium">{name}</span>

          {/* drag hint */}
          <span className="text-gray-600 text-xs font-mono hidden sm:block">⠿⠿</span>

          {/* up/down buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => i > 0 && move(i, i - 1)}
              disabled={i === 0}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}
            >
              ↑
            </button>
            <button
              onClick={() => i < order.length - 1 && move(i, i + 1)}
              disabled={i === order.length - 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Waiting room after submission ----
function WaitingRoom({
  roomId,
  initialPlayers,
}: {
  roomId: string
  initialPlayers: { name: string; answers: SurveyAnswers | null }[]
}) {
  const router = useRouter()
  const [players, setPlayers] = useState(initialPlayers)

  useEffect(() => {
    const supabase = createClient()

    async function refresh() {
      const [{ data: room }, { data: players }] = await Promise.all([
        supabase.from('rooms').select('phase').eq('id', roomId).single(),
        supabase.from('players').select('name, answers').eq('room_id', roomId),
      ])
      const phase = (room?.phase ?? 1) as number
      const updated = (players ?? []) as { name: string; answers: SurveyAnswers | null }[]
      setPlayers(updated)
      if (phase >= 3) {
        router.push(`/room/${roomId}/results`)
      }
    }

    const channel = supabase
      .channel(`survey-waiting-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if ((payload.new as { phase: number }).phase >= 3) {
            router.push(`/room/${roomId}/results`)
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [roomId, router])

  const submitted = players.filter((p) => p.answers !== null).length
  const total = players.length

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <Grid />
      <div className="w-full max-w-md z-10 flex flex-col items-center gap-8">
        <div className="text-center">
          <div className="text-cyan-400 text-xs font-mono tracking-[0.4em] mb-3">SURVEY SUBMITTED</div>
          <h2 className="text-2xl font-bold text-white">回答完了！</h2>
          <p className="text-gray-500 text-sm mt-2">全員の回答が揃うと次のフェーズへ進みます</p>
        </div>

        {/* progress */}
        <div className="w-full">
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-gray-500">回答状況</span>
            <span style={{ color: '#06b6d4' }}>{submitted} / {total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(submitted / total) * 100}%`,
                background: 'linear-gradient(90deg, #06b6d4, #a78bfa)',
                boxShadow: '0 0 10px rgba(6,182,212,0.5)',
              }}
            />
          </div>
        </div>

        {/* player list */}
        <div
          className="w-full rounded-2xl p-5 flex flex-col gap-2"
          style={{
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(6,182,212,0.15)',
          }}
        >
          {players.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{
                background: p.answers ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="text-sm font-medium" style={{ color: p.answers ? '#10b981' : '#6b7280' }}>
                {p.name}
              </span>
              <span className="text-xs font-mono" style={{ color: p.answers ? '#10b981' : '#374151' }}>
                {p.answers ? '回答済み ✓' : '待機中...'}
              </span>
            </div>
          ))}
        </div>

        <div className="text-gray-700 text-xs font-mono animate-pulse">
          リアルタイム同期中...
        </div>
      </div>
    </div>
  )
}

// ---- Survey form ----
function SurveyForm({
  roomId,
  playerName,
  onSubmitted,
}: {
  roomId: string
  playerName: string
  onSubmitted: (players: { name: string; answers: SurveyAnswers | null }[]) => void
}) {
  const [address, setAddress] = useState('')
  const [budget, setBudget] = useState('')
  const [genre, setGenre] = useState('')
  const [wantRanks, setWantRanks] = useState<string[]>([...PLAYERS])
  const [giveRanks, setGiveRanks] = useState<string[]>([...PLAYERS])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isValid = address.trim() && budget && Number(budget) > 0 && genre

  async function handleSubmit() {
    if (!isValid || isSubmitting) return
    setIsSubmitting(true)
    setError('')
    try {
      await submitSurvey(roomId, playerName, {
        address: address.trim(),
        budget: Number(budget),
        genre,
        wantRanks,
        giveRanks,
      })
      const supabase = createClient()
      const { data } = await supabase.from('players').select('name, answers').eq('room_id', roomId)
      onSubmitted((data ?? []) as { name: string; answers: SurveyAnswers | null }[])
    } catch (e) {
      setError('送信に失敗しました。もう一度お試しください。')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] pb-32 relative overflow-hidden">
      <Grid />

      {/* header */}
      <div
        className="sticky top-0 z-20 flex justify-between items-center px-6 py-4"
        style={{
          background: 'rgba(3,7,18,0.95)',
          borderBottom: '1px solid rgba(6,182,212,0.12)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <span className="text-cyan-400 text-sm font-mono font-bold tracking-widest">GIFTMATCH</span>
        <span className="text-gray-600 text-xs font-mono">PHASE 2 — SURVEY</span>
        <span
          className="text-xs font-mono px-2 py-1 rounded"
          style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
        >
          {playerName}
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 z-10 relative flex flex-col gap-5">

        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-white">アンケート</h1>
          <p className="text-gray-500 text-sm mt-1">正直に答えてください</p>
        </div>

        {/* 1. 住所 */}
        <Section num={1} title="現住所">
          <p className="text-gray-500 text-xs mb-3">プレゼントの送り先として使用します</p>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例：三重県鳥羽市○○町1-2-3"
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0',
            }}
            onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(6,182,212,0.5)' }}
            onBlur={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)' }}
          />
        </Section>

        {/* 2. 予算 */}
        <Section num={2} title="希望最低予算">
          <p className="text-gray-500 text-xs mb-3">受け取りたいプレゼントの最低希望金額</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="3000"
              min={0}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0',
              }}
              onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(6,182,212,0.5)' }}
              onBlur={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)' }}
            />
            <span className="text-gray-400 font-mono text-sm">円</span>
          </div>
        </Section>

        {/* 3. ジャンル */}
        <Section num={3} title="希望するプレゼントのジャンル">
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={
                  genre === g
                    ? {
                        background: 'rgba(6,182,212,0.2)',
                        border: '1px solid rgba(6,182,212,0.6)',
                        color: '#06b6d4',
                        boxShadow: '0 0 15px rgba(6,182,212,0.3)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#6b7280',
                      }
                }
              >
                {g}
              </button>
            ))}
          </div>
        </Section>

        {/* 4. もらいたい順位 */}
        <Section num={4} title="プレゼントをもらいたい順位">
          <p className="text-gray-500 text-xs mb-3">1位が最もプレゼントをもらいたい人</p>
          <RankingList order={wantRanks} onChange={setWantRanks} />
        </Section>

        {/* 5. 渡したい順位 */}
        <Section num={5} title="プレゼントを渡したい順位">
          <p className="text-gray-500 text-xs mb-3">1位が最もプレゼントを渡したい人</p>
          <RankingList order={giveRanks} onChange={setGiveRanks} />
        </Section>

        {error && (
          <p className="text-red-400 text-sm text-center font-mono">{error}</p>
        )}

      </div>

      {/* sticky submit button */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4 z-20"
        style={{ background: 'linear-gradient(to top, rgba(3,7,18,1) 60%, transparent)' }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="w-full py-4 rounded-xl font-bold font-mono tracking-widest text-base transition-all active:scale-95 disabled:opacity-30"
            style={{
              background: isValid
                ? 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(6,182,212,0.1))'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isValid ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.1)'}`,
              color: isValid ? '#06b6d4' : '#4b5563',
              boxShadow: isValid ? '0 0 30px rgba(6,182,212,0.2)' : 'none',
            }}
          >
            {isSubmitting ? '送信中...' : '回答を送信する →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Anonymous name reveal screen ----
const RULES = [
  'この匿名名は他の人に絶対に教えないでください',
  'アンケートやゲームの結果はこの名前で表示されます',
  '最後の大公開まで誰が誰かは秘密です',
  'LINEでもバラさないでください！',
]

function AnonymousReveal({
  anonymousName,
  onConfirm,
}: {
  anonymousName: string
  onConfirm: () => void
}) {
  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <Grid />

      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 py-4"
        style={{ borderBottom: '1px solid rgba(6,182,212,0.12)' }}
      >
        <span className="text-cyan-400 text-sm font-mono font-bold tracking-widest">GIFTMATCH</span>
        <span className="text-gray-600 text-xs font-mono tracking-widest">ANONYMOUS NAME</span>
      </div>

      <div className="w-full max-w-lg z-10 flex flex-col items-center gap-8 mt-8">

        {/* Badge */}
        <div className="text-center fade-up">
          <div
            className="inline-block px-4 py-1 rounded-full text-xs font-mono tracking-[0.35em]"
            style={{
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.35)',
              color: '#a78bfa',
            }}
          >
            ANONYMOUS NAME ASSIGNED
          </div>
        </div>

        {/* あなたの匿名名は */}
        <div className="text-center fade-up" style={{ animationDelay: '0.08s' }}>
          <p className="text-gray-400 text-sm font-mono mb-3">あなたの匿名名は</p>
          <div
            className="font-black leading-tight px-2"
            style={{
              fontSize: 'clamp(2rem, 8vw, 3.5rem)',
              color: '#a78bfa',
              textShadow:
                '0 0 30px rgba(167,139,250,0.8), 0 0 60px rgba(167,139,250,0.4)',
              wordBreak: 'keep-all',
              overflowWrap: 'anywhere',
            }}
          >
            【{anonymousName}】
          </div>
          <p className="text-gray-400 text-sm font-mono mt-3">です</p>
        </div>

        {/* Rules */}
        <div
          className="w-full rounded-2xl p-6 fade-up"
          style={{
            animationDelay: '0.16s',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(15,23,42,0.85))',
            border: '1px solid rgba(167,139,250,0.2)',
          }}
        >
          <div className="text-purple-400 text-xs font-mono tracking-widest mb-4">RULES</div>
          <ul className="flex flex-col gap-3">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(167,139,250,0.15)',
                    border: '1px solid rgba(167,139,250,0.4)',
                    color: '#a78bfa',
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-gray-300 text-sm leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Confirm button */}
        <button
          onClick={onConfirm}
          className="w-full py-4 rounded-xl font-bold font-mono tracking-widest text-base transition-all active:scale-95 fade-up"
          style={{
            animationDelay: '0.24s',
            background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.08))',
            border: '1px solid rgba(167,139,250,0.5)',
            color: '#a78bfa',
            boxShadow: '0 0 30px rgba(167,139,250,0.2)',
          }}
        >
          わかった！アンケートへ進む →
        </button>

      </div>
    </div>
  )
}

// ---- Main client component ----
type ClientPhase = 'loading' | 'reveal' | 'form' | 'waiting' | 'no-auth'

export function SurveyClient({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<ClientPhase>('loading')
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [anonymousName, setAnonymousName] = useState<string | null>(null)
  const [waitingPlayers, setWaitingPlayers] = useState<
    { name: string; answers: SurveyAnswers | null }[]
  >([])

  useEffect(() => {
    const stored = localStorage.getItem(`giftmatch_player_${roomId}`)
    if (!stored) { setPhase('no-auth'); return }
    setPlayerName(stored)

    async function init() {
      const supabase = createClient()

      async function fetchPlayerData() {
        const { data } = await supabase
          .from('players')
          .select('anonymous_name, answers')
          .eq('room_id', roomId)
          .eq('name', stored!)
          .single()
        return data as { anonymous_name: string | null; answers: SurveyAnswers | null } | null
      }

      // anonymous_name が DB に書き込まれるまで最大3回リトライ
      let data = await fetchPlayerData()
      for (let i = 0; i < 3 && !data?.anonymous_name; i++) {
        await new Promise((r) => setTimeout(r, 1200))
        data = await fetchPlayerData()
      }

      setAnonymousName(data?.anonymous_name ?? null)

      if (data?.answers) {
        // 既にアンケート回答済み → 待機室
        const supabase = createClient()
        const { data: playerRows } = await supabase.from('players').select('name, answers').eq('room_id', roomId)
        setWaitingPlayers((playerRows ?? []) as { name: string; answers: SurveyAnswers | null }[])
        setPhase('waiting')
        return
      }

      const seenReveal = localStorage.getItem(`giftmatch_seen_reveal_${roomId}`)
      setPhase(seenReveal ? 'form' : 'reveal')
    }

    init()
  }, [roomId])

  function handleRevealConfirm() {
    localStorage.setItem(`giftmatch_seen_reveal_${roomId}`, '1')
    setPhase('form')
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse">LOADING...</div>
      </div>
    )
  }

  if (phase === 'no-auth') {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <Grid />
        <div className="z-10 text-center flex flex-col items-center gap-4">
          <div
            className="inline-block px-4 py-1 rounded-full text-xs font-mono tracking-widest"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
          >
            UNAUTHORIZED
          </div>
          <p className="text-white text-lg font-bold">先にアキネーター認証を行ってください</p>
          <a
            href={`/room/${roomId}/auth`}
            className="mt-2 px-6 py-3 rounded-xl font-mono text-sm tracking-widest"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.4)', color: '#06b6d4' }}
          >
            認証ページへ →
          </a>
        </div>
      </div>
    )
  }

  if (phase === 'reveal' && anonymousName) {
    return <AnonymousReveal anonymousName={anonymousName} onConfirm={handleRevealConfirm} />
  }

  if (phase === 'waiting') {
    return <WaitingRoom roomId={roomId} initialPlayers={waitingPlayers} />
  }

  if (!playerName) return null

  return (
    <SurveyForm
      roomId={roomId}
      playerName={playerName}
      onSubmitted={(players) => {
        setWaitingPlayers(players)
        setPhase('waiting')
      }}
    />
  )
}

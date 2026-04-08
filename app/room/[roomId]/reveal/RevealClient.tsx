'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RankedPlayer = {
  rank: number
  name: string
  anonymousName: string
  score: number
  finalBudget: number
}

// ランク別スタイル
const RANK_STYLES: Record<number, { border: string; glow: string; label: string; labelColor: string }> = {
  1: { border: '#06b6d4', glow: 'rgba(6,182,212,0.35)',  label: '1ST', labelColor: '#06b6d4' },
  2: { border: '#a78bfa', glow: 'rgba(167,139,250,0.25)', label: '2ND', labelColor: '#a78bfa' },
  3: { border: '#60a5fa', glow: 'rgba(96,165,250,0.2)',  label: '3RD', labelColor: '#60a5fa' },
  4: { border: '#374151', glow: 'transparent',           label: '4TH', labelColor: '#6b7280' },
  5: { border: '#374151', glow: 'transparent',           label: '5TH', labelColor: '#6b7280' },
  6: { border: '#374151', glow: 'transparent',           label: '6TH', labelColor: '#6b7280' },
}

export function RevealClient({
  roomId,
  players,
}: {
  roomId: string
  players: RankedPlayer[]
}) {
  const router = useRouter()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [revealCount, setRevealCount] = useState(0) // 0 = nothing shown yet
  const [showBudget, setShowBudget]   = useState(false)
  const [showButton, setShowButton]   = useState(false)
  const [advancing, setAdvancing]     = useState(false)

  // 出現順: 6位 → 1位（ドラマチック）。表示レイアウトは 1位が上・6位が下を保つ
  const revealOrder = [...players].sort((a, b) => b.rank - a.rank)
  // 出現済みランクのセット
  const revealedRanks = new Set(revealOrder.slice(0, revealCount).map((p) => p.rank))

  useEffect(() => {
    setPlayerName(localStorage.getItem(`giftmatch_player_${roomId}`))
  }, [roomId])

  // 他のプレイヤーがフェーズを進めたとき自動遷移
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`reveal-phase-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if ((payload.new as { phase: number }).phase >= 7) {
            router.push(`/room/${roomId}/santa`)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, router])

  // 段階的リビール
  useEffect(() => {
    if (revealCount >= revealOrder.length) return

    const delay = revealCount === 0 ? 800 : revealCount < revealOrder.length - 1 ? 600 : 900
    const t = setTimeout(() => setRevealCount((c) => c + 1), delay)
    return () => clearTimeout(t)
  }, [revealCount, revealOrder.length])

  // 全員表示後に予算・ボタン表示
  useEffect(() => {
    if (revealCount < revealOrder.length) return
    const t1 = setTimeout(() => setShowBudget(true),  700)
    const t2 = setTimeout(() => setShowButton(true),  1400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [revealCount, revealOrder.length])

  const myPlayer = players.find((p) => p.name === playerName)

  async function handleAdvance() {
    setAdvancing(true)
    const supabase = createClient()
    await supabase.from('rooms').update({ phase: 7 }).eq('id', roomId).eq('phase', 6)
    router.push(`/room/${roomId}/santa`)
  }

  return (
    <main className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center px-5 py-12 relative overflow-hidden">
      <GridBg />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Header */}
        <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-2">PHASE 06 — GAME RESULT</p>
        <h1 className="text-xl tracking-widest text-white mb-8">ゲーム結果発表</h1>

        {/* Ranking list (1位が上・6位が下、出現は6位から順に) */}
        <div className="w-full flex flex-col gap-3 mb-6">
          {players.map((p) => {
            const visible = revealedRanks.has(p.rank)
            const style   = RANK_STYLES[p.rank] ?? RANK_STYLES[6]
            const isMe    = p.name === playerName

            return (
              <div
                key={p.rank}
                className="transition-all duration-500"
                style={{
                  opacity:   visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : 'translateX(32px)',
                }}
              >
                <div
                  className="flex items-center gap-4 px-4 py-3 rounded"
                  style={{
                    border:     `1px solid ${isMe ? style.border : style.border + '80'}`,
                    background: isMe
                      ? `linear-gradient(135deg, ${style.glow}, rgba(3,7,18,0.95))`
                      : 'rgba(15,23,42,0.6)',
                    boxShadow:  isMe ? `0 0 20px ${style.glow}` : 'none',
                  }}
                >
                  {/* Rank badge */}
                  <div
                    className="text-xs font-bold tracking-widest w-10 text-right shrink-0"
                    style={{ color: style.labelColor }}
                  >
                    {style.label}
                  </div>

                  {/* Name */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span
                      className="text-sm truncate"
                      style={{ color: isMe ? '#ffffff' : '#d1d5db' }}
                    >
                      {p.anonymousName}
                    </span>
                    {isMe && (
                      <span className="text-xs text-cyan-400 border border-cyan-400/40 px-1.5 py-0.5 rounded shrink-0">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Score + Budget */}
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span
                      className="text-base font-bold"
                      style={{ color: style.labelColor }}
                    >
                      ¥{p.finalBudget.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-600">{p.score} pts</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 自分の予算ハイライト */}
        {myPlayer && (
          <div
            className="w-full transition-all duration-700"
            style={{
              opacity:   showBudget ? 1 : 0,
              transform: showBudget ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(12px)',
            }}
          >
            <div
              className="rounded px-6 py-6 text-center"
              style={{
                border:     '1px solid rgba(6,182,212,0.5)',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(3,7,18,0.95))',
                boxShadow:  '0 0 40px rgba(6,182,212,0.2)',
              }}
            >
              <p className="text-xs text-gray-500 tracking-widest mb-2">YOUR BUDGET</p>
              <p className="text-4xl font-bold text-cyan-400 mb-1">
                ¥{myPlayer.finalBudget.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400">
                あなたの予算は <span className="text-white font-bold">¥{myPlayer.finalBudget.toLocaleString()}</span> です
              </p>
            </div>
          </div>
        )}

        {/* Advance button */}
        {showButton && (
          <div
            className="mt-8 transition-all duration-500"
            style={{ opacity: showButton ? 1 : 0, transform: showButton ? 'translateY(0)' : 'translateY(16px)' }}
          >
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="px-10 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {advancing ? 'PROCESSING...' : 'NEXT PHASE →'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function GridBg() {
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

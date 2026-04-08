'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { setBudget } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'

type Props = {
  roomId: string
  initialMinBudget: number | null
  initialBudgetDiff: number | null
  initialPhase: number
}

export function BudgetClient({ roomId, initialMinBudget, initialBudgetDiff, initialPhase }: Props) {
  const router = useRouter()
  const [minBudget, setMinBudget] = useState('')
  const [budgetDiff, setBudgetDiff] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Already-set state from initial server render or after submit
  const [settled, setSettled] = useState<{ min: number; diff: number } | null>(
    initialMinBudget !== null && initialBudgetDiff !== null
      ? { min: initialMinBudget, diff: initialBudgetDiff }
      : null
  )

  const phaseRef = useRef(initialPhase)

  // Realtime: rooms テーブルの phase・予算変更を監視
  useEffect(() => {
    if (initialPhase >= 5) {
      router.push(`/room/${roomId}/game`)
      return
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`budget-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { phase: number; min_budget: number | null; budget_diff: number | null }
          if (row.phase >= 5) {
            router.push(`/room/${roomId}/game`)
            return
          }
          // 他の人が予算を入力した → 待機表示に切り替え
          if (row.min_budget !== null && row.budget_diff !== null && !settled) {
            setSettled({ min: row.min_budget, diff: row.budget_diff })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, router, initialPhase, settled])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const min = parseInt(minBudget.replace(/,/g, ''), 10)
    const diff = parseInt(budgetDiff.replace(/,/g, ''), 10)

    if (isNaN(min) || min <= 0) { setError('最低予算を正しく入力してください'); return }
    if (isNaN(diff) || diff < 0) { setError('差額を正しく入力してください'); return }

    setSubmitting(true)
    setError('')
    try {
      await setBudget(roomId, min, diff)
      setSettled({ min, diff })
      router.push(`/room/${roomId}/game`)
    } catch {
      setError('保存に失敗しました。もう一度お試しください。')
      setSubmitting(false)
    }
  }

  // ── Settled / waiting screen ──────────────────────────────────────────────
  if (settled) {
    const maxBudget = settled.min + settled.diff * 5
    return (
      <main className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6">
        <GridBg />
        <div className="z-10 w-full max-w-md flex flex-col items-center gap-8">
          <Label>PHASE 04 — BUDGET SET</Label>

          <div className="w-full border border-cyan-400/40 bg-cyan-400/5 rounded px-8 py-10 text-center">
            <p className="text-xs text-cyan-400 tracking-widest mb-3">BUDGET RANGE</p>
            <p className="text-4xl font-bold text-white leading-snug">
              ¥{settled.min.toLocaleString()}
              <span className="text-gray-500 text-2xl mx-2">〜</span>
              ¥{maxBudget.toLocaleString()}
            </p>
            <p className="mt-3 text-gray-500 text-xs">の予算でゲーム開始！</p>
          </div>

          <div className="flex items-center gap-3 text-gray-600 text-xs">
            <PulseDot />
            <span>ゲーム画面を準備中...</span>
          </div>
        </div>
      </main>
    )
  }

  // ── Input form ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6">
      <GridBg />
      <div className="z-10 w-full max-w-md flex flex-col gap-8">
        <div className="text-center">
          <Label>PHASE 04 — BUDGET CONFIG</Label>
          <h1 className="text-xl tracking-widest text-white mt-3">予算設定</h1>
        </div>

        {/* LINE consultation notice */}
        <div className="border border-yellow-400/30 bg-yellow-400/5 rounded px-5 py-4 text-center">
          <p className="text-yellow-300 text-xs tracking-wider leading-relaxed">
            まずLINEで全員と相談して<br />
            <span className="text-yellow-200 font-bold">最低予算</span>と
            <span className="text-yellow-200 font-bold">1位〜最下位の差額</span>を決めてください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-2">// 最低予算（円）</p>
            <input
              type="number"
              min={0}
              step={100}
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
              placeholder="例: 3000"
              className="w-full bg-gray-900 border border-gray-700 focus:border-cyan-400 text-white px-4 py-3 rounded text-lg outline-none transition-colors placeholder:text-gray-600"
            />
          </div>

          <div>
            <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-2">// 1位と最下位の差額（円）</p>
            <input
              type="number"
              min={0}
              step={100}
              value={budgetDiff}
              onChange={(e) => setBudgetDiff(e.target.value)}
              placeholder="例: 2000"
              className="w-full bg-gray-900 border border-gray-700 focus:border-cyan-400 text-white px-4 py-3 rounded text-lg outline-none transition-colors placeholder:text-gray-600"
            />
            {minBudget && budgetDiff && !isNaN(parseInt(minBudget)) && !isNaN(parseInt(budgetDiff)) && (
              <p className="mt-2 text-gray-500 text-xs">
                予算範囲：¥{parseInt(minBudget).toLocaleString()} 〜 ¥{(parseInt(minBudget) + parseInt(budgetDiff) * 5).toLocaleString()}
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !minBudget || !budgetDiff}
            className="mt-2 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed rounded"
          >
            {submitting ? 'SAVING...' : '決定 →'}
          </button>
        </form>

        <p className="text-center text-gray-700 text-xs">
          一人が入力すれば全員のゲームが解放されます
        </p>
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase">{children}</p>
  )
}

function PulseDot() {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-cyan-400"
      style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }}
    />
  )
}

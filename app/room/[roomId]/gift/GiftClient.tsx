'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitGiftRecord } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'

export function GiftClient({ roomId }: { roomId: string }) {
  const router = useRouter()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [giftName, setGiftName]     = useState('')
  const [amount, setAmount]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)
  const [waitList, setWaitList]     = useState<Array<{ anonymousName: string; done: boolean }>>([])

  useEffect(() => {
    setPlayerName(localStorage.getItem(`giftmatch_player_${roomId}`))
  }, [roomId])

  // Realtime when waiting
  useEffect(() => {
    if (!done) return

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
        done: !!(p.post_answers as Record<string, unknown> | null)?.gift_name,
      })))
      if ((room?.phase ?? 8) >= 9) router.push(`/room/${roomId}/post-survey`)
    }

    refresh()

    console.log('[Realtime] channel created')
    const channel = supabase
      .channel(`gift-waiting-${roomId}`)
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
          if ((payload.new as { phase: number }).phase >= 9) {
            router.push(`/room/${roomId}/post-survey`)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [done, roomId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseInt(amount.replace(/,/g, ''), 10)
    if (!giftName.trim())       { setError('プレゼント名を入力してください'); return }
    if (isNaN(amt) || amt <= 0) { setError('金額を正しく入力してください'); return }
    setSubmitting(true)
    setError('')
    try {
      await submitGiftRecord(roomId, playerName!, giftName.trim(), amt)
      setDone(true)
    } catch {
      setError('保存に失敗しました')
      setSubmitting(false)
    }
  }

  // ── Waiting ──────────────────────────────────────────────────────────────
  if (done) {
    const total    = waitList.length || 6
    const doneCount = waitList.filter((p) => p.done).length
    return (
      <Screen>
        <Label>PHASE 08 — WAITING</Label>
        <h1 className="text-xl tracking-widest text-white mt-2 mb-8">送付完了待ち</h1>
        <div className="w-full max-w-xs flex flex-col gap-2 mb-8">
          {waitList.map((p) => (
            <Row key={p.anonymousName} label={p.anonymousName} done={p.done}
              doneText="送付済み ✓" pendingText="未完了" />
          ))}
        </div>
        <p className="text-gray-600 text-xs font-mono mb-4">{doneCount} / {total} 完了</p>
        <PulseDot />
      </Screen>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <Screen>
      <Label>PHASE 08 — GIFT SENT</Label>
      <h1 className="text-xl tracking-widest text-white mt-2 mb-2">送付完了報告</h1>
      <p className="text-gray-600 text-xs mb-8">プレゼントを送ったら記録してください</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-5">
        <div>
          <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-2">// 送ったプレゼント名</p>
          <input
            type="text"
            value={giftName}
            onChange={(e) => setGiftName(e.target.value)}
            placeholder="例: ワイヤレスイヤホン"
            className="w-full bg-gray-900 border border-gray-700 focus:border-cyan-400 text-white px-4 py-3 rounded outline-none transition-colors placeholder:text-gray-600 text-sm"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 tracking-[0.3em] uppercase mb-2">// 実際に使った金額（円）</p>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例: 3500"
            className="w-full bg-gray-900 border border-gray-700 focus:border-cyan-400 text-white px-4 py-3 rounded outline-none transition-colors placeholder:text-gray-600 text-lg"
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !playerName}
          className="py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed rounded"
        >
          {submitting ? 'SAVING...' : '送りました！'}
        </button>
      </form>
    </Screen>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6 overflow-hidden">
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

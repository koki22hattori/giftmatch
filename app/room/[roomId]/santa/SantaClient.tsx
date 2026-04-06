'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { confirmSanta, getMyTargetDetails, getSantaData } from '@/app/actions'

type Assignment = {
  name: string
  anonymousName: string
  targetName: string
  targetAnonymousName: string
  confirmed: boolean
}

type Phase = 'overview' | 'personal' | 'waiting'

const OVERVIEW_SECONDS = 5

export function SantaClient({
  roomId,
  assignments,
}: {
  roomId: string
  assignments: Assignment[]
}) {
  const router = useRouter()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('overview')

  // Overview: stagger + countdown
  const [visibleCount, setVisibleCount]   = useState(0)
  const [countdown, setCountdown]         = useState(OVERVIEW_SECONDS)
  const [countdownActive, setCountdownActive] = useState(false)

  // Personal view
  const [targetDetails, setTargetDetails] = useState<{ targetName: string; address: string } | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [confirming, setConfirming]       = useState(false)

  // Waiting
  const [waitList, setWaitList] = useState(assignments)

  useEffect(() => {
    setPlayerName(localStorage.getItem(`giftmatch_player_${roomId}`))
  }, [roomId])

  // ── Stagger reveal (overview) ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'overview') return
    if (visibleCount >= assignments.length) {
      // 全行表示後にカウントダウン開始
      const t = setTimeout(() => setCountdownActive(true), 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 280)
    return () => clearTimeout(t)
  }, [phase, visibleCount, assignments.length])

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!countdownActive) return
    if (countdown <= 0) {
      goToPersonal()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdownActive, countdown]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Personal view ─────────────────────────────────────────────────────────
  async function goToPersonal() {
    setPhase('personal')
    if (!playerName) return
    setLoadingDetails(true)
    const details = await getMyTargetDetails(roomId, playerName)
    setTargetDetails(details)
    setLoadingDetails(false)
  }

  async function handleConfirm() {
    if (!playerName || confirming) return
    setConfirming(true)
    await confirmSanta(roomId, playerName)
    setPhase('waiting')
  }

  // ── Waiting: poll for all confirmed ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'waiting') return

    async function poll() {
      const data = await getSantaData(roomId)
      const updated = data.players.map((p) => ({
        name: p.name,
        anonymousName: p.anonymous_name ?? p.name,
        targetName: p.santa_target ?? '',
        targetAnonymousName: '',
        confirmed: (p.post_answers as Record<string, unknown> | null)?.santa_confirmed === true,
      }))
      setWaitList(updated)
      if (data.phase >= 8) {
        router.push(`/room/${roomId}/gift`)
      }
    }

    poll()
    const iv = setInterval(poll, 3000)
    return () => clearInterval(iv)
  }, [phase, roomId, router])

  // ─────────────────────────────────────────────────────────────────────────
  // Overview
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'overview') {
    return (
      <Screen>
        <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-2">PHASE 07 — SECRET SANTA</p>
        <h1 className="text-xl tracking-widest text-white mb-8">シークレットサンタ発表</h1>

        <div className="w-full max-w-sm flex flex-col gap-3 mb-8">
          {assignments.map((a, i) => (
            <div
              key={a.name}
              className="transition-all duration-500"
              style={{
                opacity:   i < visibleCount ? 1 : 0,
                transform: i < visibleCount ? 'translateX(0)' : 'translateX(24px)',
              }}
            >
              <div className="flex items-center gap-3 px-4 py-3 rounded border border-gray-700 bg-gray-900/60">
                <span className="text-sm text-gray-300 flex-1 truncate">{a.anonymousName}</span>
                <span className="text-cyan-600 text-xs">→</span>
                <span className="text-sm text-gray-300 flex-1 text-right truncate">{a.targetAnonymousName}</span>
              </div>
            </div>
          ))}
        </div>

        {countdownActive && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full"
                style={{
                  width: `${(countdown / OVERVIEW_SECONDS) * 100}%`,
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <p className="text-gray-600 text-xs font-mono">{countdown}秒後に個人確認へ</p>
          </div>
        )}

        <button
          onClick={goToPersonal}
          className="mt-6 text-gray-600 text-xs underline underline-offset-4 hover:text-gray-400 transition-colors"
        >
          スキップ →
        </button>
      </Screen>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Personal
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'personal') {
    return (
      <Screen>
        <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-2">YOUR ASSIGNMENT</p>
        <h1 className="text-xl tracking-widest text-white mb-10">あなたの送り先</h1>

        {loadingDetails ? (
          <div className="flex items-center gap-3 text-gray-600 text-xs">
            <PulseDot />
            <span>読み込み中...</span>
          </div>
        ) : targetDetails ? (
          <div className="w-full max-w-sm flex flex-col gap-4">
            {/* Target name */}
            <div
              className="px-6 py-6 rounded text-center"
              style={{
                border:     '1px solid rgba(6,182,212,0.4)',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(3,7,18,0.95))',
                boxShadow:  '0 0 40px rgba(6,182,212,0.15)',
              }}
            >
              <p className="text-xs text-gray-500 tracking-widest mb-3">SEND A GIFT TO</p>
              <p className="text-3xl font-bold text-white tracking-widest mb-1">
                {targetDetails.targetName}
              </p>
              <p className="text-gray-500 text-sm">さん</p>
            </div>

            {/* Address */}
            <div className="px-5 py-4 rounded border border-gray-700 bg-gray-900/60">
              <p className="text-xs text-gray-500 tracking-widest mb-2">// 住所</p>
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {targetDetails.address}
              </p>
            </div>

            <p className="text-xs text-gray-600 text-center leading-relaxed">
              この画面はいつでも「送り先を確認する」から再確認できます
            </p>

            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="mt-2 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed rounded"
            >
              {confirming ? 'SAVING...' : '確認しました ✓'}
            </button>
          </div>
        ) : (
          <p className="text-red-400 text-sm">データの取得に失敗しました。再読み込みしてください。</p>
        )}
      </Screen>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Waiting
  // ─────────────────────────────────────────────────────────────────────────
  const confirmedCount = waitList.filter((p) => p.confirmed).length
  const total          = waitList.length || 6

  return (
    <Screen>
      <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase mb-2">PHASE 07 — WAITING</p>
      <h1 className="text-xl tracking-widest text-white mb-8">確認待ち</h1>

      <div className="w-full max-w-xs flex flex-col gap-2 mb-8">
        {waitList.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between px-4 py-2 rounded border text-xs"
            style={{
              borderColor: p.confirmed ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)',
              background:  p.confirmed ? 'rgba(16,185,129,0.07)' : 'transparent',
            }}
          >
            <span className="text-gray-400">{p.anonymousName}</span>
            <span style={{ color: p.confirmed ? '#10b981' : '#374151' }}>
              {p.confirmed ? '確認済み ✓' : '未確認'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-xs font-mono mb-4">{confirmedCount} / {total} 確認完了</p>

      <div className="flex items-center gap-3 text-gray-600 text-xs">
        <PulseDot />
        <span>全員確認次第自動で進みます</span>
      </div>
    </Screen>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 w-full flex flex-col items-center">{children}</div>
    </main>
  )
}

function PulseDot() {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-cyan-400 shrink-0"
      style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }}
    />
  )
}

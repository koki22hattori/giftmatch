'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TREE } from '@/lib/authTree'
import type { ResultNode } from '@/lib/authTree'
import { createClient } from '@/lib/supabase/client'

const ANONYMOUS_NAMES = [
  'ケンケン',
  '親指',
  'まみさ',
  '鳥羽高のクロコダイル',
  'とぅーしゃんしん',
  '金盗まれてたタバコ屋のおばちゃん',
]

// ---- Animated number hook ----
function useAnimatedNumber(target: number): number {
  const [display, setDisplay] = useState(target)
  const rafRef = useRef(0)
  const currentRef = useRef(target)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const from = currentRef.current
    const startTime = performance.now()
    const duration = 900

    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = Math.round(from + (target - from) * eased)
      currentRef.current = val
      setDisplay(val)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return display
}

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

// ---- YES / NO button ----
function AnswerButton({
  label,
  isYes,
  onClick,
}: {
  label: string
  isYes: boolean
  onClick: () => void
}) {
  const c = isYes
    ? { text: '#10b981', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.07)', glow: 'rgba(16,185,129,' }
    : { text: '#ef4444', border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.07)', glow: 'rgba(239,68,68,' }

  return (
    <button
      onClick={onClick}
      className="flex-1 py-5 rounded-xl text-2xl font-bold font-mono tracking-widest transition-transform duration-100 active:scale-95"
      style={{
        color: c.text,
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: `0 0 20px ${c.glow}0.18)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${c.glow}0.16)`
        e.currentTarget.style.boxShadow = `0 0 35px ${c.glow}0.45)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = c.bg
        e.currentTarget.style.boxShadow = `0 0 20px ${c.glow}0.18)`
      }}
    >
      {label}
    </button>
  )
}

// ---- Identified screen ----
type RevealPhase = 'scanning' | 'name' | 'neta' | 'auth'

function IdentifiedScreen({
  result,
  questionCount,
  onAuthenticate,
}: {
  result: ResultNode
  questionCount: number
  onAuthenticate: () => void
}) {
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('scanning')
  const [netaIndex, setNetaIndex] = useState(0)
  const questions = result.netaQuestions

  useEffect(() => {
    const t1 = setTimeout(() => setRevealPhase('name'), 1400)
    const t2 = setTimeout(() => {
      setRevealPhase(questions.length > 0 ? 'neta' : 'auth')
    }, 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [questions.length])

  function handleNetaAnswer() {
    const next = netaIndex + 1
    if (next < questions.length) {
      setNetaIndex(next)
    } else {
      setRevealPhase('auth')
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <Grid />

      {/* Scanning */}
      {revealPhase === 'scanning' && (
        <div className="flex flex-col items-center gap-5 z-10">
          <div className="text-cyan-400 font-mono text-sm tracking-[0.4em] animate-pulse">
            ANALYZING DATA...
          </div>
          <div className="w-64 h-px bg-gray-800 relative overflow-hidden rounded-full">
            <div className="absolute inset-y-0 left-0 bg-cyan-400 scan-bar rounded-full" />
          </div>
          <div className="text-gray-600 font-mono text-xs mt-2">
            {questionCount}問の回答を解析中
          </div>
        </div>
      )}

      {revealPhase !== 'scanning' && (
        <div className="flex flex-col items-center gap-8 w-full max-w-lg z-10">

          {/* IDENTITY CONFIRMED badge */}
          <div className="text-center fade-up">
            <div
              className="inline-block px-4 py-1 rounded-full text-xs font-mono tracking-[0.35em] mb-3"
              style={{
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.3)',
                color: '#06b6d4',
              }}
            >
              IDENTITY CONFIRMED
            </div>
            <div className="text-gray-500 font-mono text-xs">{questionCount}問で特定</div>
          </div>

          {/* Player name */}
          <div className="text-center fade-up" style={{ animationDelay: '0.08s' }}>
            <div
              className="font-bold leading-tight mb-2"
              style={{
                fontSize: 'clamp(3.5rem, 16vw, 6rem)',
                color: '#06b6d4',
                textShadow:
                  '0 0 40px rgba(6,182,212,0.9), 0 0 80px rgba(6,182,212,0.5), 0 0 120px rgba(6,182,212,0.2)',
              }}
            >
              {result.player}
            </div>
            <div className="text-gray-500 text-sm font-mono">さん、こんにちは</div>
          </div>

          {/* Neta question */}
          {revealPhase === 'neta' && (
            <div
              key={netaIndex}
              className="w-full rounded-2xl p-7 fade-up"
              style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(15,23,42,0.85))',
                border: '1px solid rgba(6,182,212,0.22)',
                boxShadow: '0 0 60px rgba(6,182,212,0.06)',
              }}
            >
              <div className="text-cyan-700 text-xs font-mono tracking-widest mb-4">
                QUESTION {netaIndex + 1} / {questions.length}
              </div>
              <p className="text-white text-xl leading-relaxed mb-7">
                {questions[netaIndex]}
              </p>
              <div className="flex gap-4">
                <AnswerButton label="YES" isYes onClick={handleNetaAnswer} />
                <AnswerButton label="NO" isYes={false} onClick={handleNetaAnswer} />
              </div>
            </div>
          )}

          {/* 認証する button */}
          {revealPhase === 'auth' && (
            <button
              onClick={onAuthenticate}
              className="w-full py-4 rounded-xl font-bold font-mono tracking-widest text-base transition-all duration-200 active:scale-95 fade-up"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(6,182,212,0.08))',
                border: '1px solid rgba(6,182,212,0.5)',
                color: '#06b6d4',
                boxShadow: '0 0 30px rgba(6,182,212,0.25)',
              }}
            >
              認証する →
            </button>
          )}

        </div>
      )}
    </div>
  )
}

// ---- Challenger screen ----
function ChallengerScreen({ playerName, roomId }: { playerName: string; roomId: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600)
    const t2 = setTimeout(() => setPhase(2), 1550)
    const t3 = setTimeout(() => setPhase(3), 2600)
    const t4 = setTimeout(() => setFadingOut(true), 5500)  // 黒フェードアウト開始
    const t5 = setTimeout(() => router.push(`/room/${roomId}/survey`), 6300)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [roomId, router])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* 黒フェードアウトオーバーレイ（遷移前） */}
      {fadingOut && (
        <div className="absolute inset-0 bg-black pointer-events-none z-30 fade-to-black" />
      )}

      <div className="z-10 flex flex-col items-center gap-5">

        {/* ！！！ */}
        {phase >= 1 && (
          <div
            className="challenger-slam font-black"
            style={{
              fontSize: 'clamp(4.5rem, 22vw, 9rem)',
              color: '#fbbf24',
              textShadow: '0 0 30px rgba(251,191,36,0.9), 0 0 70px rgba(251,191,36,0.5)',
              lineHeight: 1,
            }}
          >
            ！！！
          </div>
        )}

        {/* 挑戦者が現れた... */}
        {phase >= 2 && (
          <div
            className="challenger-text font-bold font-mono"
            style={{
              fontSize: 'clamp(1.1rem, 4.5vw, 1.8rem)',
              color: '#e2e8f0',
              letterSpacing: '0.18em',
            }}
          >
            挑戦者が現れた...
          </div>
        )}

        {/* セパレーター */}
        {phase >= 2 && (
          <div
            className="challenger-text"
            style={{
              width: 'clamp(180px, 55vw, 380px)',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
              animationDelay: '0.15s',
            }}
          />
        )}

        {/* プレイヤー名（常に固定） */}
        {phase >= 3 && (
          <div
            className="electric-name font-black text-center"
            style={{
              fontSize: 'clamp(3rem, 15vw, 6.5rem)',
              color: '#ffffff',
              lineHeight: 1.1,
            }}
          >
            木下清文
          </div>
        )}

      </div>
    </div>
  )
}

// ---- Unknown screen ----
function UnknownScreen() {
  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <Grid />
      <div className="flex flex-col items-center gap-5 z-10 text-center">
        <div
          className="inline-block px-4 py-1 rounded-full text-xs font-mono tracking-[0.35em]"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}
        >
          IDENTITY NOT FOUND
        </div>
        <div className="text-2xl font-bold text-white">対象者が見つかりませんでした</div>
        <div className="text-gray-500 text-sm">正直に答えてもう一度試してください</div>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-8 py-3 rounded-xl font-mono text-sm tracking-widest active:scale-95"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.4)',
            color: '#ef4444',
          }}
        >
          最初から →
        </button>
      </div>
    </div>
  )
}

// ---- Main game ----
export function AuthGame({ roomId }: { roomId: string }) {
  const [nodeId, setNodeId] = useState('q1')
  const [answeredCount, setAnsweredCount] = useState(0)
  const [remainingTarget, setRemainingTarget] = useState(120_000_000)
  const [phase, setPhase] = useState<'playing' | 'revealed' | 'challenger' | 'unknown'>('playing')
  const [result, setResult] = useState<ResultNode | null>(null)

  const displayNum = useAnimatedNumber(remainingTarget)

  const node = TREE[nodeId]
  const isConfirm = node?.type === 'confirm'

  function handleAnswer(yes: boolean) {
    if (!node || node.type === 'result' || node.type === 'unknown') return

    const nextId = yes ? node.yes : node.no
    const next = TREE[nextId]
    setAnsweredCount((c) => c + 1)

    if (!next || next.type === 'unknown') {
      setPhase('unknown')
      return
    }

    if (next.type === 'result') {
      setResult(next)
      setPhase('revealed')
      return
    }

    setNodeId(nextId)
    setRemainingTarget(next.remaining)
  }

  // 即座にchallenger画面へ遷移し、DB更新はバックグラウンドで実行
  // 認証済みプレイヤー名をlocalStorageに保存してサーベイで使用
  function handleAuthenticate() {
    if (!result) return
    localStorage.setItem(`giftmatch_player_${roomId}`, result.player)
    setPhase('challenger')
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: existing } = await supabase
          .from('players')
          .select('anonymous_name')
          .eq('room_id', roomId)
          .not('anonymous_name', 'is', null)
        const taken = new Set(existing?.map((p) => p.anonymous_name) ?? [])
        const available = ANONYMOUS_NAMES.filter((n) => !taken.has(n))
        const anonymousName = available[Math.floor(Math.random() * available.length)]
        console.log('[Auth] updating playerName:', result.player, 'roomId:', roomId, 'anonymousName:', anonymousName)
        const { data, error } = await supabase
          .from('players')
          .update({ authenticated: true, anonymous_name: anonymousName })
          .eq('room_id', roomId)
          .eq('name', result.player)
        console.log('[Auth] update result:', data, error)
        if (error) {
          console.error('[Auth] update failed:', error)
          alert(`[デバッグ] 認証DB更新失敗:\ncode: ${error.code}\nmessage: ${error.message}`)
        }
      } catch (e) {
        console.error('[Auth] authenticatePlayer failed:', e)
        alert(`[デバッグ] 認証DB更新失敗:\n${e instanceof Error ? e.message : String(e)}`)
      }
    })()
  }

  if (phase === 'revealed' && result) {
    return (
      <IdentifiedScreen
        result={result}
        questionCount={answeredCount}
        onAuthenticate={handleAuthenticate}
      />
    )
  }
  if (phase === 'challenger' && result) {
    return <ChallengerScreen playerName={result.player} roomId={roomId} />
  }
  if (phase === 'unknown') {
    return <UnknownScreen />
  }
  if (!node || node.type === 'result' || node.type === 'unknown') return null

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <Grid />

      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 py-4"
        style={{ borderBottom: '1px solid rgba(6,182,212,0.12)' }}
      >
        <span className="text-cyan-400 text-sm font-mono font-bold tracking-widest">
          GIFTMATCH
        </span>
        <span className="text-gray-600 text-xs font-mono tracking-widest">
          IDENTITY VERIFICATION
        </span>
        <span className="text-cyan-700 text-xs font-mono">Q{answeredCount + 1}</span>
      </div>

      {/* Main content */}
      <div className="w-full max-w-lg flex flex-col items-center gap-8 mt-16 z-10">

        {/* Remaining counter */}
        <div className="text-center">
          <div className="text-gray-600 text-xs font-mono tracking-[0.35em] mb-3 uppercase">
            Remaining Population
          </div>
          <div
            className="font-mono font-bold tabular-nums leading-none"
            style={{
              fontSize: 'clamp(3rem, 14vw, 5.5rem)',
              color: '#06b6d4',
              textShadow: '0 0 30px rgba(6,182,212,0.7), 0 0 60px rgba(6,182,212,0.4)',
            }}
          >
            {displayNum.toLocaleString('ja-JP')}
          </div>
          <div className="text-cyan-700 text-xl font-mono mt-2">人</div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 items-center">
          {Array.from({ length: 10 }, (_, i) => {
            const done = i < answeredCount
            const active = i === answeredCount
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-500"
                style={{
                  width: active ? '10px' : '7px',
                  height: active ? '10px' : '7px',
                  background: done ? '#06b6d4' : active ? '#06b6d4' : '#1e3a5f',
                  boxShadow: active ? '0 0 10px rgba(6,182,212,0.9)' : done ? '0 0 4px rgba(6,182,212,0.4)' : 'none',
                  animation: active ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
                }}
              />
            )
          })}
        </div>

        {/* Question card */}
        <div
          className="w-full rounded-2xl p-8 relative overflow-hidden"
          style={{
            background: isConfirm
              ? 'linear-gradient(135deg, rgba(10,8,24,0.98), rgba(10,8,24,0.92))'
              : 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(15,23,42,0.85))',
            border: isConfirm
              ? '1px solid rgba(139,92,246,0.3)'
              : '1px solid rgba(6,182,212,0.22)',
            boxShadow: isConfirm
              ? '0 0 60px rgba(139,92,246,0.08), inset 0 0 40px rgba(139,92,246,0.03)'
              : '0 0 60px rgba(6,182,212,0.06)',
          }}
        >
          {isConfirm && (
            <div className="flex items-center gap-2 mb-5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full inline-block"
                  style={{
                    background: '#a78bfa',
                    boxShadow: '0 0 6px rgba(167,139,250,0.8)',
                    animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
          <p
            className="font-bold leading-relaxed"
            style={{
              fontSize: isConfirm ? 'clamp(1.6rem, 6vw, 2.2rem)' : 'clamp(1.4rem, 5vw, 1.875rem)',
              color: isConfirm ? '#e9d5ff' : '#ffffff',
              letterSpacing: isConfirm ? '0.02em' : 'normal',
            }}
          >
            {node.text}
          </p>
          {!isConfirm && (
            <div
              className="mt-5 pt-4 text-gray-600 text-xs font-mono"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              正直に答えてください
            </div>
          )}
        </div>

        {/* YES / NO */}
        <div className="flex gap-4 w-full">
          <AnswerButton label="YES" isYes onClick={() => handleAnswer(true)} />
          <AnswerButton label="NO" isYes={false} onClick={() => handleAnswer(false)} />
        </div>

      </div>
    </div>
  )
}

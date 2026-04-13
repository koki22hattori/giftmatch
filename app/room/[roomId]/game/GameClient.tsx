'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Constants ──────────────────────────────────────────────────────────────
const INITIAL_TIME = 2200   // ms per box
const MIN_TIME      = 320
const SPEED_FACTOR  = 0.925 // each correct answer multiplies timeLimit by this
const SWIPE_THRESHOLD = 70  // px to commit swipe
const MAX_MISSES    = 3
const MAX_ROUNDS    = 3

type Color     = 'red' | 'blue'
type BoxAnim   = 'entering' | 'idle' | 'fly-left' | 'fly-right' | 'shake'
type GamePhase = 'intro' | 'countdown' | 'playing' | 'round-result' | 'all-done' | 'waiting'

// ── Component ─────────────────────────────────────────────────────────────
export function GameClient({ roomId }: { roomId: string }) {
  const router = useRouter()

  // Player
  const [playerName, setPlayerName] = useState<string | null>(null)

  // Game phase
  const [gamePhase, setGamePhase] = useState<GamePhase>('intro')
  const [countdown, setCountdown] = useState(3)

  // Round tracking
  const [currentRound, setCurrentRound] = useState(1)
  const [roundScores, setRoundScores] = useState<number[]>([])

  // Current round
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)

  // Box
  const [boxColor, setBoxColor]     = useState<Color>('red')
  const [boxAnim, setBoxAnim]       = useState<BoxAnim>('entering')
  const [timerProgress, setTimerProgress] = useState(1)
  const [dragOffset, setDragOffset] = useState(0)

  // Flash feedback
  const [flashType, setFlashType] = useState<'correct' | 'wrong' | null>(null)

  // Score pop key (force re-mount to retrigger animation)
  const [scoreKey, setScoreKey] = useState(0)

  // Waiting screen
  const [waitPlayers, setWaitPlayers] = useState<Array<{ name: string; game_score: number | null; anonymous_name: string | null }>>([])

  // ── Refs (avoid stale closures in callbacks) ──
  const scoreRef       = useRef(0)
  const missesRef      = useRef(0)
  const timeLimitRef   = useRef(INITIAL_TIME)
  const boxColorRef    = useRef<Color>('red')
  const boxAnimRef     = useRef<BoxAnim>('entering')
  const roundRef       = useRef(1)
  const roundScoresRef = useRef<number[]>([])
  const boxStartRef    = useRef(0)
  const timerIdRef     = useRef<number | null>(null)

  // Drag refs
  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const isDraggingRef = useRef(false)
  const axisLockedRef = useRef<'h' | 'v' | null>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setPlayerName(localStorage.getItem(`giftmatch_player_${roomId}`))
  }, [roomId])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  handleSwipe('left')
      if (e.key === 'ArrowRight') handleSwipe('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gamePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ─────────────────────────────────────────────────────────────────
  function startTimer() {
    stopTimer()
    boxStartRef.current = performance.now()

    function tick() {
      const elapsed  = performance.now() - boxStartRef.current
      const progress = Math.max(0, 1 - elapsed / timeLimitRef.current)
      setTimerProgress(progress)

      if (elapsed >= timeLimitRef.current) {
        stopTimer()
        if (boxAnimRef.current === 'idle') triggerMiss()
      } else {
        timerIdRef.current = requestAnimationFrame(tick)
      }
    }
    timerIdRef.current = requestAnimationFrame(tick)
  }

  function stopTimer() {
    if (timerIdRef.current !== null) {
      cancelAnimationFrame(timerIdRef.current)
      timerIdRef.current = null
    }
  }

  // ── Box lifecycle ─────────────────────────────────────────────────────────
  const spawnBox = useCallback(() => {
    const color: Color = Math.random() < 0.5 ? 'red' : 'blue'
    boxColorRef.current  = color
    boxAnimRef.current   = 'entering'
    setBoxColor(color)
    setBoxAnim('entering')
    setDragOffset(0)
    setTimerProgress(1)

    setTimeout(() => {
      boxAnimRef.current = 'idle'
      setBoxAnim('idle')
      startTimer()
    }, 380)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swipe logic ───────────────────────────────────────────────────────────
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (boxAnimRef.current !== 'idle') return
    stopTimer()
    setDragOffset(0)

    const correct = (boxColorRef.current === 'red' && direction === 'left')
                 || (boxColorRef.current === 'blue' && direction === 'right')

    if (correct) {
      scoreRef.current++
      setScore(scoreRef.current)
      setScoreKey((k) => k + 1)
      timeLimitRef.current = Math.max(MIN_TIME, timeLimitRef.current * SPEED_FACTOR)

      const flyAnim: BoxAnim = direction === 'left' ? 'fly-left' : 'fly-right'
      boxAnimRef.current = flyAnim
      setBoxAnim(flyAnim)
      setFlashType('correct')
      setTimeout(() => setFlashType(null), 300)
      setTimeout(spawnBox, 400)
    } else {
      triggerMiss()
    }
  }, [spawnBox]) // eslint-disable-line react-hooks/exhaustive-deps

  function triggerMiss() {
    if (boxAnimRef.current === 'fly-left' || boxAnimRef.current === 'fly-right') return

    missesRef.current++
    setMisses(missesRef.current)
    boxAnimRef.current = 'shake'
    setBoxAnim('shake')
    setDragOffset(0)
    setFlashType('wrong')
    setTimeout(() => setFlashType(null), 400)

    if (missesRef.current >= MAX_MISSES) {
      setTimeout(endRound, 700)
    } else {
      setTimeout(spawnBox, 750)
    }
  }

  function endRound() {
    stopTimer()
    const s = scoreRef.current
    const updated = [...roundScoresRef.current, s]
    roundScoresRef.current = updated
    setRoundScores(updated)

    if (roundRef.current >= MAX_ROUNDS) {
      const best = Math.max(...updated)
      console.log('[Game] endRound: playerName=', playerName, 'roomId=', roomId, 'best=', best)
      if (!playerName) {
        console.error('[Game] playerName is null — score not saved!')
        alert('[デバッグ] playerName が null のためスコアを保存できません。認証をやり直してください。')
      } else {
        ;(async () => {
          try {
            const supabase = createClient()

            // 既存スコアを取得
            const { data: player, error: fetchError } = await supabase
              .from('players')
              .select('game_score')
              .eq('room_id', roomId)
              .eq('name', playerName)
              .single()
            console.log('[Game] fetched player:', player, 'fetchError:', fetchError)

            if (!player) {
              console.error('[Game] player row not found in DB — roomId:', roomId, 'name:', playerName)
              alert(`[デバッグ] DBにプレイヤーが見つかりません\nroomId: ${roomId}\nname: ${playerName}`)
              return
            }

            // 既存スコアより高い場合のみ UPDATE
            if (player.game_score === null || best > player.game_score) {
              console.log('[Game] updating game_score:', best, '(prev:', player.game_score, ')')
              const { error: updateError } = await supabase
                .from('players')
                .update({ game_score: best })
                .eq('room_id', roomId)
                .eq('name', playerName)
              if (updateError) {
                console.error('[Game] game_score UPDATE failed:', updateError)
                alert(`[デバッグ] スコア保存失敗:\ncode: ${updateError.code}\nmessage: ${updateError.message}\ndetails: ${updateError.details}`)
                return
              }
              console.log('[Game] game_score saved successfully:', best)
            } else {
              console.log('[Game] existing score', player.game_score, '>= best', best, '— skip update')
            }

            // 全員スコア揃ったら phase 6 へ
            const { data: allPlayers, error: allError } = await supabase
              .from('players')
              .select('game_score')
              .eq('room_id', roomId)
            console.log('[Game] allPlayers:', allPlayers, 'allError:', allError)

            if (allPlayers?.every((p) => p.game_score !== null)) {
              console.log('[Game] all scores in — advancing to phase 6')
              const { error: phaseError } = await supabase
                .from('rooms')
                .update({ phase: 6 })
                .eq('id', roomId)
                .eq('phase', 5)
              if (phaseError) {
                console.error('[Game] phase advance failed:', phaseError)
              } else {
                console.log('[Game] phase advanced to 6')
              }
            }
          } catch (e) {
            console.error('[Game] saveGameScore threw:', e)
            alert(`[デバッグ] スコア保存で予期しないエラー:\n${e instanceof Error ? e.message : String(e)}`)
          }
        })()
      }
      setGamePhase('all-done')
    } else {
      setGamePhase('round-result')
    }
  }

  // ── Start round ───────────────────────────────────────────────────────────
  function beginCountdown() {
    setGamePhase('countdown')
    setCountdown(3)

    let n = 3
    const iv = setInterval(() => {
      n--
      if (n === 0) {
        clearInterval(iv)
        startRound()
      } else {
        setCountdown(n)
      }
    }, 900)
  }

  function startRound() {
    scoreRef.current     = 0
    missesRef.current    = 0
    timeLimitRef.current = INITIAL_TIME
    setScore(0)
    setMisses(0)
    setGamePhase('playing')
    spawnBox()
  }

  function nextRound() {
    roundRef.current++
    setCurrentRound(roundRef.current)
    beginCountdown()
  }

  // ── Drag (touch + mouse) ──────────────────────────────────────────────────
  function onPointerDown(clientX: number, clientY: number) {
    if (boxAnimRef.current !== 'idle') return
    isDraggingRef.current = true
    axisLockedRef.current = null
    dragStartXRef.current = clientX
    dragStartYRef.current = clientY
  }

  function onPointerMove(clientX: number) {
    if (!isDraggingRef.current || boxAnimRef.current !== 'idle') return
    const dx = clientX - dragStartXRef.current
    setDragOffset(dx)
  }

  function onPointerUp(clientX: number, clientY: number) {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    const dx = clientX - dragStartXRef.current
    const dy = clientY - dragStartYRef.current

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      handleSwipe(dx < 0 ? 'left' : 'right')
    } else {
      setDragOffset(0)
    }
  }

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    onPointerDown(t.clientX, t.clientY)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - dragStartXRef.current
    const dy = e.touches[0].clientY - dragStartYRef.current
    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault()
    onPointerMove(e.touches[0].clientX)
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0]
    onPointerUp(t.clientX, t.clientY)
  }

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => onPointerDown(e.clientX, e.clientY)
  const onMouseMove = (e: React.MouseEvent) => onPointerMove(e.clientX)
  const onMouseUp   = (e: React.MouseEvent) => onPointerUp(e.clientX, e.clientY)
  const onMouseLeave = () => { isDraggingRef.current = false; setDragOffset(0) }

  // ── Waiting screen: Realtime ─────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'waiting') return

    const supabase = createClient()

    async function refresh() {
      console.log('[Realtime] refresh() called, fetching players...')
      const [{ data: room }, { data: players }] = await Promise.all([
        supabase.from('rooms').select('phase').eq('id', roomId).single(),
        supabase.from('players').select('name, game_score, anonymous_name').eq('room_id', roomId),
      ])
      console.log('[Realtime] players fetched:', players)
      setWaitPlayers((players ?? []) as Array<{ name: string; game_score: number | null; anonymous_name: string | null }>)
      if ((room?.phase ?? 5) >= 6) {
        router.push(`/room/${roomId}/reveal`)
      }
    }

    refresh()

    const interval = setInterval(refresh, 3000)

    console.log('[Realtime] channel created')
    const channel = supabase
      .channel(`game-waiting-${roomId}`)
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
          if ((payload.new as { phase: number }).phase >= 6) {
            router.push(`/room/${roomId}/reveal`)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] status:', status)
      })

    return () => { clearInterval(interval); supabase.removeChannel(channel) }
  }, [gamePhase, roomId, router])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const bestSoFar = roundScores.length > 0 ? Math.max(...roundScores) : 0

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (gamePhase === 'intro') {
    return (
      <Screen>
        <Label>PHASE 05 — GIFT SORT</Label>
        <h1 className="text-2xl tracking-widest text-white mt-3 mb-8">プレゼント仕分けゲーム</h1>

        <div className="w-full max-w-xs flex flex-col gap-4 mb-10">
          <RuleRow color="red"  dir="←" label="赤リボン → 左にスワイプ" />
          <RuleRow color="blue" dir="→" label="青リボン → 右にスワイプ" />
        </div>

        <div className="border border-gray-700 rounded px-5 py-4 text-xs text-gray-500 text-center max-w-xs mb-10 leading-relaxed">
          3ミスでラウンド終了<br />
          3ラウンドのベストスコアを登録<br />
          スピードは正解するほど上がる
        </div>

        <button
          onClick={beginCountdown}
          className="px-12 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.35em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300"
        >
          START
        </button>
      </Screen>
    )
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  if (gamePhase === 'countdown') {
    return (
      <Screen>
        <p className="text-gray-600 text-xs tracking-widest mb-6 font-mono">ROUND {currentRound} / {MAX_ROUNDS}</p>
        <div
          key={countdown}
          className="text-8xl font-bold text-cyan-400"
          style={{ animation: 'countdown-tick 0.4s ease both' }}
        >
          {countdown}
        </div>
      </Screen>
    )
  }

  // ── Round result ──────────────────────────────────────────────────────────
  if (gamePhase === 'round-result') {
    return (
      <Screen>
        <Label>ROUND {currentRound - 1} COMPLETE</Label>
        <p className="text-6xl font-bold text-white mt-4 mb-2">{roundScores[roundScores.length - 1]}</p>
        <p className="text-gray-500 text-xs mb-10">points</p>
        <button
          onClick={nextRound}
          className="px-10 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300"
        >
          ROUND {currentRound} →
        </button>
      </Screen>
    )
  }

  // ── All done ──────────────────────────────────────────────────────────────
  if (gamePhase === 'all-done') {
    return (
      <Screen>
        <Label>GAME COMPLETE</Label>
        <p className="text-xs text-gray-600 mt-2 mb-6 font-mono">
          {roundScores.map((s, i) => `R${i + 1}: ${s}`).join('  /  ')}
        </p>
        <div className="border border-cyan-400/40 bg-cyan-400/5 rounded px-10 py-8 text-center mb-8">
          <p className="text-xs text-cyan-400 tracking-widest mb-2">BEST SCORE</p>
          <p className="text-6xl font-bold text-white">{bestSoFar}</p>
        </div>
        <button
          onClick={() => setGamePhase('waiting')}
          className="px-10 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300"
        >
          スコアを登録して待機
        </button>
      </Screen>
    )
  }

  // ── Waiting ───────────────────────────────────────────────────────────────
  if (gamePhase === 'waiting') {
    const total    = waitPlayers.length || 6
    const done     = waitPlayers.filter((p) => p.game_score !== null).length
    return (
      <Screen>
        <Label>WAITING FOR OTHERS</Label>
        <p className="text-gray-600 text-xs mt-2 mb-8 font-mono">{done} / {total} SUBMITTED</p>

        <div className="w-full max-w-xs flex flex-col gap-2 mb-10">
          {waitPlayers.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between px-4 py-2 rounded border text-xs"
              style={{
                borderColor: p.game_score !== null ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)',
                background:  p.game_score !== null ? 'rgba(16,185,129,0.07)' : 'transparent',
              }}
            >
              <span className="text-gray-400">{p.anonymous_name ?? p.name}</span>
              <span style={{ color: p.game_score !== null ? '#10b981' : '#374151' }}>
                {p.game_score !== null ? `${p.game_score} pts ✓` : 'PLAYING...'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 text-gray-600 text-xs">
          <PulseDot />
          <span className="font-mono">全員揃い次第自動で進みます</span>
        </div>
      </Screen>
    )
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const boxClass = {
    entering: 'box-enter',
    idle:     '',
    'fly-left':  'box-fly-left',
    'fly-right': 'box-fly-right',
    shake:    'box-shake',
  }[boxAnim]

  const dragRatio  = dragOffset / 150  // -1…1 range for visual feedback
  const leftActive  = dragOffset < -20
  const rightActive = dragOffset > 20

  return (
    <div
      className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col select-none overflow-hidden"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <GridBg />

      {/* Flash overlay */}
      {flashType && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: flashType === 'correct'
              ? 'rgba(6,182,212,0.12)'
              : 'rgba(239,68,68,0.18)',
            animation: 'miss-flash 0.35s ease both',
          }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between px-5 pt-8">
        {/* Misses */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-600 tracking-widest">MISS</p>
          <div className="flex gap-2">
            {Array.from({ length: MAX_MISSES }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border"
                style={{
                  borderColor:  i < misses ? '#ef4444' : '#374151',
                  background:   i < misses ? '#ef4444' : 'transparent',
                  boxShadow:    i < misses ? '0 0 8px #ef4444' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Round */}
        <div className="text-center">
          <p className="text-xs text-gray-600 tracking-widest">ROUND</p>
          <p className="text-lg font-bold text-white">{currentRound}<span className="text-gray-600 text-sm"> / {MAX_ROUNDS}</span></p>
        </div>

        {/* Score */}
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs text-gray-600 tracking-widest">SCORE</p>
          <p
            key={scoreKey}
            className="text-2xl font-bold text-cyan-400 score-pop"
          >
            {score}
          </p>
        </div>
      </div>

      {/* Timer bar */}
      <div className="relative z-10 mx-5 mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${timerProgress * 100}%`,
            background: timerProgress > 0.4
              ? '#06b6d4'
              : timerProgress > 0.2
                ? '#f59e0b'
                : '#ef4444',
            boxShadow: `0 0 8px ${timerProgress > 0.4 ? '#06b6d4' : '#ef4444'}`,
          }}
        />
      </div>

      {/* Game area */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Direction hints */}
        <div className="flex w-full max-w-xs justify-between items-center px-4">
          <div
            className="flex items-center gap-2 transition-all duration-100"
            style={{ opacity: leftActive ? 1 : 0.25 }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-red-500 bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-xs">●</span>
            </div>
            <span className="text-red-400 text-lg font-bold">←</span>
          </div>
          <div
            className="flex items-center gap-2 transition-all duration-100"
            style={{ opacity: rightActive ? 1 : 0.25 }}
          >
            <span className="text-blue-400 text-lg font-bold">→</span>
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-xs">●</span>
            </div>
          </div>
        </div>

        {/* Present box */}
        <div
          className={`cursor-grab active:cursor-grabbing ${boxClass}`}
          style={{
            transform: boxAnim === 'idle'
              ? `translateX(${dragOffset}px) rotate(${dragRatio * 12}deg)`
              : undefined,
          }}
          onMouseDown={onMouseDown}
        >
          <PresentBox color={boxColor} />
        </div>

        {/* Color label */}
        <p
          className="text-sm tracking-widest font-bold transition-colors duration-150"
          style={{ color: boxColor === 'red' ? '#ef4444' : '#3b82f6' }}
        >
          {boxColor === 'red' ? '← 赤リボン' : '青リボン →'}
        </p>
      </div>

      {/* Swipe hint */}
      <div className="relative z-10 pb-10 text-center">
        <p className="text-gray-700 text-xs tracking-widest">スワイプ または ←→ キー</p>
      </div>
    </div>
  )
}

// ── Present Box ──────────────────────────────────────────────────────────────
function PresentBox({ color }: { color: Color }) {
  const ribbonColor = color === 'red' ? '#ef4444' : '#3b82f6'
  const glowColor   = color === 'red' ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.5)'
  const lidColor    = color === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'

  return (
    <div className="relative" style={{ width: 160, height: 160 }}>
      {/* Lid */}
      <div
        className="absolute top-0 left-0 right-0 rounded-t-lg"
        style={{
          height: 36,
          background: `linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))`,
          border: `2px solid ${ribbonColor}`,
          borderBottom: 'none',
          boxShadow: `0 0 20px ${glowColor}`,
        }}
      />

      {/* Bow */}
      <div className="absolute" style={{ top: -18, left: '50%', transform: 'translateX(-50%)' }}>
        <BowSVG color={ribbonColor} />
      </div>

      {/* Box body */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-b-lg"
        style={{
          top: 34,
          background: `linear-gradient(160deg, rgba(30,41,59,0.98), rgba(15,23,42,0.98))`,
          border: `2px solid ${ribbonColor}`,
          borderTop: 'none',
          boxShadow: `0 0 30px ${glowColor}, inset 0 0 20px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Vertical ribbon */}
        <div
          className="absolute inset-y-0"
          style={{
            left: '50%',
            width: 14,
            transform: 'translateX(-50%)',
            background: ribbonColor,
            opacity: 0.85,
            boxShadow: `0 0 10px ${ribbonColor}`,
          }}
        />
        {/* Horizontal ribbon */}
        <div
          className="absolute inset-x-0"
          style={{
            top: '50%',
            height: 14,
            transform: 'translateY(-50%)',
            background: ribbonColor,
            opacity: 0.85,
            boxShadow: `0 0 10px ${ribbonColor}`,
          }}
        />
      </div>

      {/* Lid vertical ribbon continuation */}
      <div
        className="absolute"
        style={{
          top: 0,
          bottom: 124,
          left: '50%',
          width: 14,
          transform: 'translateX(-50%)',
          background: ribbonColor,
          opacity: 0.85,
        }}
      />
    </div>
  )
}

function BowSVG({ color }: { color: string }) {
  return (
    <svg width="44" height="22" viewBox="0 0 44 22" fill="none">
      {/* Left loop */}
      <ellipse cx="11" cy="11" rx="11" ry="7" fill={color} opacity="0.9" transform="rotate(-15 11 11)" />
      <ellipse cx="11" cy="11" rx="7" ry="4" fill="#030712" opacity="0.6" transform="rotate(-15 11 11)" />
      {/* Right loop */}
      <ellipse cx="33" cy="11" rx="11" ry="7" fill={color} opacity="0.9" transform="rotate(15 33 11)" />
      <ellipse cx="33" cy="11" rx="7" ry="4" fill="#030712" opacity="0.6" transform="rotate(15 33 11)" />
      {/* Center knot */}
      <circle cx="22" cy="11" r="5" fill={color} />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6">
      <GridBg />
      <div className="relative z-10 flex flex-col items-center">{children}</div>
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
  return <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase">{children}</p>
}

function RuleRow({ color, dir, label }: { color: 'red' | 'blue'; dir: string; label: string }) {
  const c = color === 'red' ? { border: '#ef4444', text: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
                            : { border: '#3b82f6', text: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
  return (
    <div
      className="flex items-center gap-4 px-5 py-3 rounded"
      style={{ border: `1px solid ${c.border}30`, background: c.bg }}
    >
      <span className="text-2xl font-bold" style={{ color: c.text }}>{dir}</span>
      <span className="text-sm text-gray-300">{label}</span>
    </div>
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

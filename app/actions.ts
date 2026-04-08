'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const PLAYERS = ['服部光貴', '五十子裕', '岡野透', '渋谷瞬', '服部直道', '木下清文']

const ANONYMOUS_NAMES = [
  'ケンケン',
  '親指',
  'まみさ',
  '鳥羽高のクロコダイル',
  'とぅーしゃんしん',
  '金盗まれてたタバコ屋のおばちゃん',
]

export async function createRoom() {
  const supabase = createClient()

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({ phase: 1 })
    .select()
    .single()

  if (error || !room) throw new Error('ルームの作成に失敗しました')

  await supabase
    .from('players')
    .insert(PLAYERS.map((name) => ({ room_id: room.id, name })))

  redirect(`/room/${room.id}/auth`)
}

export async function authenticatePlayer(roomId: string, playerName: string) {
  const supabase = createClient()

  // このルームで既に割り当て済みの匿名名称を取得
  const { data: existing } = await supabase
    .from('players')
    .select('anonymous_name')
    .eq('room_id', roomId)
    .not('anonymous_name', 'is', null)

  const taken = new Set(existing?.map((p) => p.anonymous_name) ?? [])
  const available = ANONYMOUS_NAMES.filter((n) => !taken.has(n))
  const anonymousName = available[Math.floor(Math.random() * available.length)]

  const { error } = await supabase
    .from('players')
    .update({ authenticated: true, anonymous_name: anonymousName })
    .eq('room_id', roomId)
    .eq('name', playerName)

  if (error) throw new Error('認証に失敗しました')
}

export type SurveyAnswers = {
  address: string
  budget: number
  genre: string
  wantRanks: string[]
  giveRanks: string[]
}

export async function submitSurvey(
  roomId: string,
  playerName: string,
  answers: SurveyAnswers
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('players')
    .update({ answers })
    .eq('room_id', roomId)
    .eq('name', playerName)

  console.log('[Survey] update result:', data, error)
  if (error) {
    console.error('[Survey] update failed:', error)
    throw new Error('回答の保存に失敗しました')
  }

  // 全員回答済みなら phase 3 へ自動進行
  const { data: players } = await supabase
    .from('players')
    .select('answers')
    .eq('room_id', roomId)

  if (players?.every((p) => p.answers !== null)) {
    const { data: phaseData, error: phaseError } = await supabase
      .from('rooms')
      .update({ phase: 3 })
      .eq('id', roomId)
    console.log('[Survey] phase update result:', phaseData, phaseError)
    if (phaseError) console.error('[Survey] phase update failed:', phaseError)
  }
}

export async function getMyPlayerData(roomId: string, playerName: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('players')
    .select('anonymous_name, answers')
    .eq('room_id', roomId)
    .eq('name', playerName)
    .single()
  return data as { anonymous_name: string | null; answers: SurveyAnswers | null } | null
}

export async function getSurveyResults(roomId: string) {
  const supabase = createClient()

  const { data: players } = await supabase
    .from('players')
    .select('answers')
    .eq('room_id', roomId)
    .not('answers', 'is', null)

  const answers = (players ?? []).map((p) => p.answers as SurveyAnswers)

  // ジャンル集計
  const GENRES = ['食べ物', '雑貨', '体験', '実用品', 'なんでもOK']
  const genreCounts: Record<string, number> = Object.fromEntries(GENRES.map((g) => [g, 0]))
  for (const a of answers) {
    if (a?.genre) genreCounts[a.genre] = (genreCounts[a.genre] ?? 0) + 1
  }

  // 予算中央値
  const budgets = answers
    .map((a) => Number(a?.budget ?? 0))
    .filter((b) => b > 0)
    .sort((a, b) => a - b)
  const mid = Math.floor(budgets.length / 2)
  const medianBudget =
    budgets.length === 0
      ? 0
      : budgets.length % 2 === 0
        ? Math.round((budgets[mid - 1] + budgets[mid]) / 2)
        : budgets[mid]

  return { genreCounts, medianBudget, totalResponses: answers.length }
}

export async function advancePhase(roomId: string, fromPhase: number) {
  const supabase = createClient()
  // 現在のフェーズが期待値と一致する場合のみ更新（多重押し防止）
  await supabase
    .from('rooms')
    .update({ phase: fromPhase + 1 })
    .eq('id', roomId)
    .eq('phase', fromPhase)
}

export async function setBudget(
  roomId: string,
  minBudget: number,
  budgetDiff: number
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('rooms')
    .update({ min_budget: minBudget, budget_diff: budgetDiff, phase: 5 })
    .eq('id', roomId)
    .eq('phase', 4)

  if (error) throw new Error('予算の保存に失敗しました')
}

export async function getBudgetStatus(roomId: string) {
  const supabase = createClient()
  const { data: room } = await supabase
    .from('rooms')
    .select('phase, min_budget, budget_diff')
    .eq('id', roomId)
    .single()

  return {
    phase: (room?.phase ?? 4) as number,
    minBudget: room?.min_budget as number | null,
    budgetDiff: room?.budget_diff as number | null,
  }
}

export async function saveGameScore(roomId: string, playerName: string, score: number) {
  const supabase = createClient()

  // 既存スコアより高い場合のみ更新
  const { data: player } = await supabase
    .from('players')
    .select('game_score')
    .eq('room_id', roomId)
    .eq('name', playerName)
    .single()

  if (player && (player.game_score === null || score > player.game_score)) {
    await supabase
      .from('players')
      .update({ game_score: score })
      .eq('room_id', roomId)
      .eq('name', playerName)
  }

  // 全員スコア揃ったら phase 6 へ自動進行
  const { data: allPlayers } = await supabase
    .from('players')
    .select('game_score')
    .eq('room_id', roomId)

  if (allPlayers?.every((p) => p.game_score !== null)) {
    await supabase.from('rooms').update({ phase: 6 }).eq('id', roomId).eq('phase', 5)
  }
}

export async function getGameStatus(roomId: string) {
  const supabase = createClient()

  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('phase').eq('id', roomId).single(),
    supabase.from('players').select('name, game_score, anonymous_name').eq('room_id', roomId),
  ])

  return {
    phase: (room?.phase ?? 5) as number,
    players: (players ?? []) as Array<{
      name: string
      game_score: number | null
      anonymous_name: string | null
    }>,
  }
}

export async function computeAndSaveFinalBudgets(roomId: string) {
  const supabase = createClient()

  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('min_budget, budget_diff').eq('id', roomId).single(),
    supabase
      .from('players')
      .select('name, game_score, final_budget')
      .eq('room_id', roomId),
  ])

  if (!room || !players) return

  // 既に計算済みならスキップ
  if (players.every((p) => p.final_budget !== null)) return

  const minBudget  = room.min_budget  ?? 3000
  const budgetDiff = room.budget_diff ?? 1000
  const n          = players.length

  // スコア降順でソート（同点は名前昇順で安定）
  const sorted = [...players].sort((a, b) => {
    const d = (b.game_score ?? 0) - (a.game_score ?? 0)
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })

  // final_budget = min + diff * (n - 1 - index)
  await Promise.all(
    sorted.map((p, i) =>
      supabase
        .from('players')
        .update({ final_budget: minBudget + budgetDiff * i })
        .eq('room_id', roomId)
        .eq('name', p.name)
    )
  )
}

export async function getRevealData(roomId: string) {
  const supabase = createClient()

  const { data: players } = await supabase
    .from('players')
    .select('name, anonymous_name, game_score, final_budget')
    .eq('room_id', roomId)

  return (players ?? []) as Array<{
    name: string
    anonymous_name: string | null
    game_score: number | null
    final_budget: number | null
  }>
}

// ── Secret Santa ────────────────────────────────────────────────────────────

/** 完全順列（自分→自分なし）を生成するヘルパー */
function makeDerangement(arr: string[]): string[] {
  let result: string[]
  let attempts = 0
  do {
    result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    attempts++
    if (attempts > 1000) throw new Error('derangement failed')
  } while (result.some((v, i) => v === arr[i]))
  return result
}

export async function generateSantaAssignments(roomId: string) {
  const supabase = createClient()

  const { data: players } = await supabase
    .from('players')
    .select('name, santa_target')
    .eq('room_id', roomId)

  if (!players) return

  // 既に割り当て済みならスキップ（冪等）
  if (players.every((p) => p.santa_target !== null)) return

  const names   = players.map((p) => p.name)
  const targets = makeDerangement(names)

  await Promise.all(
    names.map((name, i) =>
      supabase
        .from('players')
        .update({ santa_target: targets[i] })
        .eq('room_id', roomId)
        .eq('name', name)
    )
  )
}

export async function getSantaData(roomId: string) {
  const supabase = createClient()

  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('phase').eq('id', roomId).single(),
    supabase
      .from('players')
      .select('name, anonymous_name, santa_target, post_answers')
      .eq('room_id', roomId),
  ])

  return {
    phase: (room?.phase ?? 7) as number,
    players: (players ?? []) as Array<{
      name: string
      anonymous_name: string | null
      santa_target: string | null
      post_answers: Record<string, unknown> | null
    }>,
  }
}

export async function getMyTargetDetails(roomId: string, playerName: string) {
  const supabase = createClient()

  const { data: me } = await supabase
    .from('players')
    .select('santa_target')
    .eq('room_id', roomId)
    .eq('name', playerName)
    .single()

  if (!me?.santa_target) return null

  const { data: target } = await supabase
    .from('players')
    .select('name, answers')
    .eq('room_id', roomId)
    .eq('name', me.santa_target)
    .single()

  return {
    targetName: target?.name ?? '',
    address: (target?.answers as { address?: string } | null)?.address ?? '（住所未設定）',
  }
}

export async function confirmSanta(roomId: string, playerName: string) {
  const supabase = createClient()

  // post_answers に santa_confirmed を追記（既存フィールドを保持）
  const { data: player } = await supabase
    .from('players')
    .select('post_answers')
    .eq('room_id', roomId)
    .eq('name', playerName)
    .single()

  const existing = (player?.post_answers as Record<string, unknown>) ?? {}
  await supabase
    .from('players')
    .update({ post_answers: { ...existing, santa_confirmed: true } })
    .eq('room_id', roomId)
    .eq('name', playerName)

  // 全員確認済みなら phase 8 へ
  const { data: allPlayers } = await supabase
    .from('players')
    .select('post_answers')
    .eq('room_id', roomId)

  const allConfirmed = allPlayers?.every(
    (p) => (p.post_answers as Record<string, unknown> | null)?.santa_confirmed === true
  )
  if (allConfirmed) {
    await supabase.from('rooms').update({ phase: 8 }).eq('id', roomId).eq('phase', 7)
  }
}

// ── Phase 8: 送付記録 ───────────────────────────────────────────────────────

export async function submitGiftRecord(
  roomId: string,
  playerName: string,
  giftName: string,
  actualAmount: number,
) {
  const supabase = createClient()

  const { data: player } = await supabase
    .from('players').select('post_answers').eq('room_id', roomId).eq('name', playerName).single()

  const existing = (player?.post_answers as Record<string, unknown>) ?? {}
  await supabase.from('players')
    .update({ post_answers: { ...existing, gift_name: giftName, actual_amount: actualAmount } })
    .eq('room_id', roomId).eq('name', playerName)

  const { data: all } = await supabase.from('players').select('post_answers').eq('room_id', roomId)
  if (all?.every((p) => (p.post_answers as Record<string, unknown> | null)?.gift_name)) {
    await supabase.from('rooms').update({ phase: 9 }).eq('id', roomId).eq('phase', 8)
  }
}

export async function getGiftStatus(roomId: string) {
  const supabase = createClient()
  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('phase').eq('id', roomId).single(),
    supabase.from('players').select('name, anonymous_name, post_answers').eq('room_id', roomId),
  ])
  return {
    phase: (room?.phase ?? 8) as number,
    players: (players ?? []).map((p) => ({
      name: p.name as string,
      anonymousName: (p.anonymous_name ?? p.name) as string,
      done: !!(p.post_answers as Record<string, unknown> | null)?.gift_name,
    })),
  }
}

// ── Phase 9: 事後アンケート ─────────────────────────────────────────────────

export type PostSurveyData = {
  impression: string
  giverGuess: string        // 実名
  postWantRanks: string[]   // 受取者の実名 配列（欲しかった順）
  anonGuesses: Record<string, string>  // 匿名名称 → 実名
}

export async function getPhase9Data(roomId: string, playerName: string) {
  const supabase = createClient()
  const { data: players } = await supabase
    .from('players')
    .select('name, anonymous_name, santa_target, post_answers')
    .eq('room_id', roomId)
  if (!players) return null

  // 誰が誰に送ったか: giver.santaTarget → recipient.name
  const giverOf: Record<string, string> = {}  // recipientName → giverName
  for (const p of players) {
    if (p.santa_target) giverOf[p.santa_target] = p.name
  }

  // 自分以外の受取者リスト（プレゼント名付き）
  const others = players
    .filter((p) => p.name !== playerName)
    .map((p) => {
      const giverName = giverOf[p.name]
      const giver = players.find((g) => g.name === giverName)
      return {
        recipientName: p.name,
        anonymousName: (p.anonymous_name ?? p.name) as string,
        giftName: ((giver?.post_answers as Record<string, unknown> | null)?.gift_name as string) ?? '不明',
      }
    })

  const allPlayers = players.map((p) => ({
    name: p.name as string,
    anonymousName: (p.anonymous_name ?? p.name) as string,
  }))

  return { others, allPlayers }
}

export async function submitPostSurvey(
  roomId: string,
  playerName: string,
  data: PostSurveyData,
) {
  const supabase = createClient()

  const { data: player } = await supabase
    .from('players').select('post_answers').eq('room_id', roomId).eq('name', playerName).single()

  const existing = (player?.post_answers as Record<string, unknown>) ?? {}
  await supabase.from('players').update({
    post_answers: {
      ...existing,
      impression: data.impression,
      giver_guess: data.giverGuess,
      post_want_ranks: data.postWantRanks,
      anon_guesses: data.anonGuesses,
    },
  }).eq('room_id', roomId).eq('name', playerName)

  const { data: all } = await supabase.from('players').select('post_answers').eq('room_id', roomId)
  if (all?.every((p) => (p.post_answers as Record<string, unknown> | null)?.impression)) {
    await supabase.from('rooms').update({ phase: 10 }).eq('id', roomId).eq('phase', 9)
  }
}

export async function getPostSurveyStatus(roomId: string) {
  const supabase = createClient()
  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('phase').eq('id', roomId).single(),
    supabase.from('players').select('name, anonymous_name, post_answers').eq('room_id', roomId),
  ])
  return {
    phase: (room?.phase ?? 9) as number,
    players: (players ?? []).map((p) => ({
      name: p.name as string,
      anonymousName: (p.anonymous_name ?? p.name) as string,
      done: !!(p.post_answers as Record<string, unknown> | null)?.impression,
    })),
  }
}

// ── Phase 10: 大公開 ────────────────────────────────────────────────────────

export async function getFinaleData(roomId: string) {
  const supabase = createClient()
  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('players').select('*').eq('room_id', roomId),
  ])

  type PA = {
    santa_confirmed?: boolean
    gift_name?: string
    actual_amount?: number
    impression?: string
    giver_guess?: string
    post_want_ranks?: string[]
    anon_guesses?: Record<string, string>
  }

  const ps = (players ?? []).map((p) => {
    const pa = (p.post_answers as PA) ?? {}
    const ans = (p.answers as SurveyAnswers | null) ?? { address: '', budget: 0, genre: '', wantRanks: [], giveRanks: [] }
    return {
      name: p.name as string,
      anonymousName: (p.anonymous_name ?? p.name) as string,
      gameScore: (p.game_score ?? 0) as number,
      finalBudget: (p.final_budget ?? 0) as number,
      santaTarget: (p.santa_target ?? '') as string,
      wantRanks: (ans.wantRanks ?? []) as string[],
      giveRanks: (ans.giveRanks ?? []) as string[],
      giftName: (pa.gift_name ?? '不明') as string,
      actualAmount: (pa.actual_amount ?? 0) as number,
      impression: (pa.impression ?? '') as string,
      giverGuess: (pa.giver_guess ?? '') as string,
      postWantRanks: (pa.post_want_ranks ?? []) as string[],
      anonGuesses: (pa.anon_guesses ?? {}) as Record<string, string>,
    }
  })

  // 各プレイヤーの「送ってきた人」マップ
  const giverOf: Record<string, string> = {}
  for (const p of ps) {
    if (p.santaTarget) giverOf[p.santaTarget] = p.name
  }

  return {
    room: {
      minBudget: (room?.min_budget ?? 0) as number,
      budgetDiff: (room?.budget_diff ?? 0) as number,
    },
    players: ps,
    giverOf,
  }
}

export async function getPhaseStatus(roomId: string) {
  const supabase = createClient()

  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('phase').eq('id', roomId).single(),
    supabase.from('players').select('name, answers').eq('room_id', roomId),
  ])

  return {
    phase: (room?.phase ?? 1) as number,
    players: (players ?? []) as { name: string; answers: SurveyAnswers | null }[],
  }
}

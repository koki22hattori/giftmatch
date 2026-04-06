import { computeAndSaveFinalBudgets, getRevealData } from '@/app/actions'
import { RevealClient } from './RevealClient'

export default async function RevealPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params

  // 最終予算を計算・保存（冪等）
  await computeAndSaveFinalBudgets(roomId)

  const raw = await getRevealData(roomId)

  // スコア降順でランク付け（同点は名前昇順）
  const sorted = [...raw].sort((a, b) => {
    const d = (b.game_score ?? 0) - (a.game_score ?? 0)
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })

  const players = sorted.map((p, i) => ({
    rank: i + 1,
    name: p.name,
    anonymousName: p.anonymous_name ?? p.name,
    score: p.game_score ?? 0,
    finalBudget: p.final_budget ?? 0,
  }))

  return <RevealClient roomId={roomId} players={players} />
}

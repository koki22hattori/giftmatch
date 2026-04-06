import { generateSantaAssignments, getSantaData } from '@/app/actions'
import { SantaClient } from './SantaClient'

export default async function SantaPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params

  // 割り当て生成（冪等）
  await generateSantaAssignments(roomId)

  const { players } = await getSantaData(roomId)

  // 匿名名 → 匿名名 のマップを組み立て（アドレスは含めない）
  const nameToAnon = Object.fromEntries(
    players.map((p) => [p.name, p.anonymous_name ?? p.name])
  )

  const assignments = players.map((p) => ({
    name: p.name,
    anonymousName: p.anonymous_name ?? p.name,
    targetName: p.santa_target ?? '',
    targetAnonymousName: p.santa_target ? (nameToAnon[p.santa_target] ?? p.santa_target) : '',
    confirmed: (p.post_answers as Record<string, unknown> | null)?.santa_confirmed === true,
  }))

  return <SantaClient roomId={roomId} assignments={assignments} />
}

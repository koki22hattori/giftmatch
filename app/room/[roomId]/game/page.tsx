import { GameClient } from './GameClient'

export default async function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return <GameClient roomId={roomId} />
}

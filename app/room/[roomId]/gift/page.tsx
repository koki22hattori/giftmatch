import { GiftClient } from './GiftClient'

export default async function GiftPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return <GiftClient roomId={roomId} />
}

import { AuthGame } from './AuthGame'

export default async function AuthPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return <AuthGame roomId={roomId} />
}

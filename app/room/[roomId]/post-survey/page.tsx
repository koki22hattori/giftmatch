import { PostSurveyClient } from './PostSurveyClient'

export default async function PostSurveyPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return <PostSurveyClient roomId={roomId} />
}

import { SurveyClient } from './SurveyClient'

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  return <SurveyClient roomId={roomId} />
}

import { getFinaleData } from '@/app/actions'
import { FinaleClient } from './FinaleClient'

export default async function FinalePage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const data = await getFinaleData(roomId)
  return <FinaleClient roomId={roomId} data={data} />
}

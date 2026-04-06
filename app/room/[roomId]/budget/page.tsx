import { getBudgetStatus } from '@/app/actions'
import { BudgetClient } from './BudgetClient'

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const { phase, minBudget, budgetDiff } = await getBudgetStatus(roomId)

  return (
    <BudgetClient
      roomId={roomId}
      initialPhase={phase}
      initialMinBudget={minBudget}
      initialBudgetDiff={budgetDiff}
    />
  )
}

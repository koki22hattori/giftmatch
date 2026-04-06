'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { advancePhase } from '@/app/actions'

export function AdvanceButton({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAdvance() {
    setLoading(true)
    await advancePhase(roomId, 3)
    router.push(`/room/${roomId}/budget`)
  }

  return (
    <button
      onClick={handleAdvance}
      disabled={loading}
      className="mt-10 px-10 py-4 border border-cyan-400 text-cyan-400 text-sm tracking-[0.3em] uppercase font-mono hover:bg-cyan-400 hover:text-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? 'PROCESSING...' : 'NEXT PHASE →'}
    </button>
  )
}

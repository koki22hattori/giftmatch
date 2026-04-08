'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { advancePhase } from '@/app/actions'
import { createClient } from '@/lib/supabase/client'

export function AdvanceButton({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // 他のプレイヤーがフェーズを進めたとき自動遷移
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`results-phase-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if ((payload.new as { phase: number }).phase >= 4) {
            router.push(`/room/${roomId}/budget`)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, router])

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

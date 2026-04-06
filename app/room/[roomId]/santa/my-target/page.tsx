'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getMyTargetDetails } from '@/app/actions'

export default function MyTargetPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const router = useRouter()

  const [details, setDetails] = useState<{ targetName: string; address: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const name = localStorage.getItem(`giftmatch_player_${roomId}`)
    if (!name) { setLoading(false); return }

    getMyTargetDetails(roomId, name).then((d) => {
      setDetails(d)
      setLoading(false)
    })
  }, [roomId])

  return (
    <main className="relative min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-5">
        <p className="text-cyan-400 text-xs tracking-[0.4em] uppercase">YOUR ASSIGNMENT</p>
        <h1 className="text-xl tracking-widest text-white mb-4">送り先確認</h1>

        {loading ? (
          <div className="flex items-center gap-3 text-gray-600 text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full bg-cyan-400"
              style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }}
            />
            <span>読み込み中...</span>
          </div>
        ) : details ? (
          <>
            <div
              className="w-full px-6 py-6 rounded text-center"
              style={{
                border:     '1px solid rgba(6,182,212,0.4)',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(3,7,18,0.95))',
                boxShadow:  '0 0 40px rgba(6,182,212,0.15)',
              }}
            >
              <p className="text-xs text-gray-500 tracking-widest mb-3">SEND A GIFT TO</p>
              <p className="text-3xl font-bold text-white tracking-widest mb-1">{details.targetName}</p>
              <p className="text-gray-500 text-sm">さん</p>
            </div>

            <div className="w-full px-5 py-4 rounded border border-gray-700 bg-gray-900/60">
              <p className="text-xs text-gray-500 tracking-widest mb-2">// 住所</p>
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{details.address}</p>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm">データが見つかりませんでした</p>
        )}

        <button
          onClick={() => router.back()}
          className="mt-4 text-gray-600 text-xs underline underline-offset-4 hover:text-gray-400 transition-colors"
        >
          ← 戻る
        </button>
      </div>
    </main>
  )
}

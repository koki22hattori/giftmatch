'use client'

import { useTransition } from 'react'
import { createRoom } from '@/app/actions'

export default function Home() {
  const [isPending, startTransition] = useTransition()

  return (
    <div
      className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-6 relative overflow-hidden cursor-pointer"
      onClick={() => {
        if (!isPending) startTransition(() => createRoom())
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="z-10 text-center flex flex-col items-center gap-6">
        <div className="text-cyan-600 text-xs font-mono tracking-[0.5em]">SECURE GIFT EXCHANGE</div>
        <h1
          className="font-bold"
          style={{
            fontSize: 'clamp(3rem, 14vw, 5.5rem)',
            color: '#06b6d4',
            textShadow: '0 0 40px rgba(6,182,212,0.6), 0 0 80px rgba(6,182,212,0.2)',
          }}
        >
          GiftMatch
        </h1>
        <p className="text-gray-600 text-sm font-mono tracking-widest">プレゼント交換システム</p>

        <div
          className="mt-6 px-8 py-3 rounded-full font-mono text-sm tracking-widest transition-all duration-200"
          style={{
            border: '1px solid rgba(6,182,212,0.4)',
            color: isPending ? '#164e63' : '#06b6d4',
            background: 'rgba(6,182,212,0.06)',
          }}
        >
          {isPending ? 'LOADING...' : '画面をクリックしてスタート'}
        </div>
      </div>
    </div>
  )
}

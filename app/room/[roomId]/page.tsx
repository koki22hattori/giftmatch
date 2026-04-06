import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const supabase = createClient()

  const [{ data: room }, { data: players }] = await Promise.all([
    supabase.from('rooms').select().eq('id', roomId).single(),
    supabase.from('players').select().eq('room_id', roomId).order('name'),
  ])

  if (!room) notFound()

  const authenticatedCount = players?.filter((p) => p.authenticated).length ?? 0
  const total = players?.length ?? 0

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-md z-10 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-cyan-400 text-xs font-mono tracking-[0.4em] mb-2">GIFTMATCH</div>
          <h1 className="text-3xl font-bold text-white mb-1">フェーズ {room.phase}</h1>
          <div
            className="text-gray-600 text-xs font-mono mt-3 px-3 py-1 rounded inline-block"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            ROOM: {roomId.slice(0, 8).toUpperCase()}
          </div>
        </div>

        {/* Phase 7–8: 送り先確認ボタン */}
        {(room.phase === 7 || room.phase === 8) && (
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(15,23,42,0.85))',
              border: '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <p className="text-white font-bold mb-2">シークレットサンタ</p>
            <p className="text-gray-500 text-xs mb-5">あなたの送り先と住所を確認できます</p>
            <Link
              href={`/room/${roomId}/santa/my-target`}
              className="block w-full py-4 rounded-xl text-center font-bold font-mono tracking-widest text-sm transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(6,182,212,0.08))',
                border: '1px solid rgba(6,182,212,0.45)',
                color: '#06b6d4',
                boxShadow: '0 0 30px rgba(6,182,212,0.2)',
              }}
            >
              送り先を確認する →
            </Link>
          </div>
        )}

        {/* Phase 1: Auth status */}
        {room.phase === 1 && (
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.97), rgba(15,23,42,0.85))',
              border: '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <div className="flex justify-between items-center mb-5">
              <span className="text-white font-bold">アキネーター認証</span>
              <span
                className="text-xs font-mono px-2 py-1 rounded"
                style={{
                  background: 'rgba(6,182,212,0.1)',
                  border: '1px solid rgba(6,182,212,0.3)',
                  color: '#06b6d4',
                }}
              >
                {authenticatedCount} / {total}
              </span>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              {players?.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{
                    background: player.authenticated
                      ? 'rgba(16,185,129,0.08)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${player.authenticated ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span
                    className="font-medium text-sm"
                    style={{ color: player.authenticated ? '#10b981' : '#9ca3af' }}
                  >
                    {player.name}
                  </span>
                  <span className="text-xs font-mono" style={{ color: player.authenticated ? '#10b981' : '#374151' }}>
                    {player.authenticated ? 'VERIFIED ✓' : 'PENDING'}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href={`/room/${roomId}/auth`}
              className="block w-full py-4 rounded-xl text-center font-bold font-mono tracking-widest text-sm transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(6,182,212,0.08))',
                border: '1px solid rgba(6,182,212,0.45)',
                color: '#06b6d4',
                boxShadow: '0 0 30px rgba(6,182,212,0.2)',
              }}
            >
              認証する →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lzwhfwyqqpeitxdmbnld.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'SUPABASE_SECRET_REMOVED'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const PLAYERS = ['服部光貴', '五十子裕', '岡野透', '渋谷瞬', '服部直道', '木下清文']

const ANONYMOUS_NAMES = [
  'ケンケン',
  '親指',
  'まみさ',
  '鳥羽高のクロコダイル',
  'とぅーしゃんしん',
  '金盗まれてたタバコ屋のおばちゃん',
]

const PLAYER_DATA = [
  { name: '五十子裕',  genre: '食べ物', budget: 3000, gameScore: 42, address: '東京都渋谷区テスト1-2-3' },
  { name: '岡野透',   genre: '雑貨',   budget: 5000, gameScore: 31, address: '大阪府大阪市テスト4-5-6' },
  { name: '渋谷瞬',   genre: '体験',   budget: 3000, gameScore: 27, address: '神奈川県横浜市テスト7-8-9' },
  { name: '服部光貴', genre: '食べ物', budget: 3000, gameScore: 55, address: '愛知県名古屋市テスト10-11' },
  { name: '服部直道', genre: '実用品', budget: 5000, gameScore: 19, address: '福岡県福岡市テスト12-13' },
  { name: '木下清文', genre: '食べ物', budget: 3000, gameScore: 38, address: '北海道札幌市テスト14-15' },
]

// phase 6 用: min_budget=3000, budget_diff=500 → 予算範囲 3000〜5500
const ROOM_BUDGET = { min_budget: 3000, budget_diff: 500 }

// wantRanks / giveRanks: 自分以外の5人をダミー順位でセット
function makeRanks(playerName) {
  return PLAYERS.filter((n) => n !== playerName)
}

function makeDerangement(arr) {
  let result
  do {
    result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
  } while (result.some((v, i) => v === arr[i]))
  return result
}

// phase を引数で受け取る（デフォルト3）
// 使い方: node scripts/seed-test-data.mjs [phase]
// 例: node scripts/seed-test-data.mjs 4
const targetPhase = parseInt(process.argv[2] ?? '3', 10)

const PHASE_URLS = {
  3:  (id) => `http://localhost:3000/room/${id}/results`,
  4:  (id) => `http://localhost:3000/room/${id}/budget`,
  5:  (id) => `http://localhost:3000/room/${id}/game`,
  6:  (id) => `http://localhost:3000/room/${id}/reveal`,
  7:  (id) => `http://localhost:3000/room/${id}/santa`,
  8:  (id) => `http://localhost:3000/room/${id}/gift`,
  9:  (id) => `http://localhost:3000/room/${id}/post-survey`,
  10: (id) => `http://localhost:3000/room/${id}/finale`,
}

async function seed() {
  // 1. 新しいルームを作成
  const roomPayload = targetPhase >= 6
    ? { phase: targetPhase, ...ROOM_BUDGET }
    : { phase: targetPhase }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert(roomPayload)
    .select()
    .single()

  if (roomError || !room) {
    console.error('ルーム作成失敗:', roomError)
    process.exit(1)
  }

  console.log(`✓ ルーム作成: ${room.id}`)

  // 2. 6人のプレイヤーをまとめて挿入
  const playerRows = PLAYER_DATA.map((p, i) => ({
    room_id: room.id,
    name: p.name,
    anonymous_name: ANONYMOUS_NAMES[i],
    authenticated: true,
    answers: {
      address: p.address ?? 'テスト住所',
      budget: p.budget,
      genre: p.genre,
      wantRanks: makeRanks(p.name),
      giveRanks: makeRanks(p.name),
    },
    ...(targetPhase >= 5 ? { game_score: p.gameScore } : {}),
  }))

  const { error: insertError } = await supabase.from('players').insert(playerRows)
  if (insertError) { console.error('プレイヤー挿入失敗:', insertError); process.exit(1) }

  // Phase 7+: シークレットサンタ割り当て（完全順列）
  if (targetPhase >= 7) {
    const names = PLAYER_DATA.map(p => p.name)
    const targets = makeDerangement(names)
    await Promise.all(names.map((name, i) =>
      supabase.from('players').update({ santa_target: targets[i] })
        .eq('room_id', room.id).eq('name', name)
    ))
    console.log('✓ シークレットサンタ割り当て完了')
  }

  // Phase 8+: プレゼント送付記録
  if (targetPhase >= 8) {
    const gifts = ['ワイヤレスイヤホン', 'ハンドクリームセット', 'コーヒーギフト', 'ノートブック3冊セット', 'アロマキャンドル', 'テックガジェット']
    await Promise.all(PLAYER_DATA.map((p, i) =>
      supabase.from('players').update({
        post_answers: { santa_confirmed: true, gift_name: gifts[i], actual_amount: p.budget + Math.floor(Math.random() * 400 - 200) }
      }).eq('room_id', room.id).eq('name', p.name)
    ))
    console.log('✓ フェーズ8データ完了')
  }

  // Phase 9+: 事後アンケート
  if (targetPhase >= 9) {
    const names = PLAYER_DATA.map(p => p.name)
    await Promise.all(PLAYER_DATA.map((p, i) => {
      const others = names.filter(n => n !== p.name)
      const anonMap = {}
      PLAYER_DATA.forEach((op, oi) => { anonMap[ANONYMOUS_NAMES[oi]] = op.name })
      return supabase.from('players').update({
        post_answers: {
          santa_confirmed: true, gift_name: ['ワイヤレスイヤホン','ハンドクリームセット','コーヒーギフト','ノートブック3冊セット','アロマキャンドル','テックガジェット'][i],
          actual_amount: p.budget + Math.floor(Math.random() * 400 - 200),
          impression: `とても嬉しかったです！${['実用的', '可愛い', 'おしゃれ', 'センスがいい', '気が利いている', 'ありがたい'][i]}プレゼントでした。`,
          giver_guess: names[(i + 1) % names.length],
          post_want_ranks: [...others].sort(() => Math.random() - 0.5),
          anon_guesses: anonMap,
        }
      }).eq('room_id', room.id).eq('name', p.name)
    }))

    // Phase 9 はfinal_budget計算も必要
    const sortedByScore = [...PLAYER_DATA].sort((a, b) => b.gameScore - a.gameScore)
    const minBudget = ROOM_BUDGET.min_budget, diff = ROOM_BUDGET.budget_diff
    await Promise.all(sortedByScore.map((p, i) =>
      supabase.from('players').update({ final_budget: minBudget + diff * i })
        .eq('room_id', room.id).eq('name', p.name)
    ))
    console.log('✓ フェーズ9データ完了')
  }

  console.log('✓ 6人のプレイヤーデータを挿入しました')
  console.log('\n--- テスト用URL ---')
  const urlFn = PHASE_URLS[targetPhase] ?? ((id) => `http://localhost:3000/room/${id}`)
  console.log(urlFn(room.id))
  console.log(`\nroom_id: ${room.id}  (phase=${targetPhase})`)
}

seed()

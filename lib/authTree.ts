export type PlayerName =
  | '服部光貴'
  | '五十子裕'
  | '岡野透'
  | '渋谷瞬'
  | '服部直道'
  | '木下清文'

export type QuestionNode = {
  type: 'question'
  id: string
  text: string
  remaining: number
  yes: string
  no: string
}

export type ConfirmNode = {
  type: 'confirm'
  id: string
  text: string
  remaining: number
  yes: string
  no: string
}

export type ResultNode = {
  type: 'result'
  player: PlayerName
  netaQuestions: string[]  // 固定ネタ質問（順番通りに表示）
}

export type UnknownNode = {
  type: 'unknown'
}

export type TreeNode = QuestionNode | ConfirmNode | ResultNode | UnknownNode

export const TREE: Record<string, TreeNode> = {
  q1: {
    type: 'question', id: 'q1',
    text: '日本人ですか？',
    remaining: 120_000_000,
    yes: 'q2', no: 'confirm_kinoshita_1',
  },
  q2: {
    type: 'question', id: 'q2',
    text: '男性ですか？',
    remaining: 60_000_000,
    yes: 'q3', no: 'confirm_kinoshita_1',
  },
  q3: {
    type: 'question', id: 'q3',
    text: '三重県出身ですか？',
    remaining: 1_800_000,
    yes: 'q4', no: 'confirm_kinoshita_1',
  },
  q4: {
    type: 'question', id: 'q4',
    text: '鳥羽高校を卒業しましたか？',
    remaining: 8_000,
    yes: 'q5', no: 'confirm_kinoshita_1',
  },
  q5: {
    type: 'question', id: 'q5',
    text: '修学旅行は北海道でしたか？',
    remaining: 240,
    yes: 'q6', no: 'confirm_kinoshita_1',
  },
  q6: {
    type: 'question', id: 'q6',
    text: '社会人ですか？',
    remaining: 180,
    yes: 'q7', no: 'confirm_kinoshita_1',
  },
  q7: {
    type: 'question', id: 'q7',
    text: '元テニス部ですか？',
    remaining: 6,
    yes: 'q8_tennis', no: 'q8_notennis',
  },
  q8_tennis: {
    type: 'question', id: 'q8_tennis',
    text: '癖毛ですか？',
    remaining: 12,
    yes: 'result_isogoko', no: 'result_okano',
  },
  q8_notennis: {
    type: 'question', id: 'q8_notennis',
    text: 'バスケ経験ありますか？',
    remaining: 6,
    yes: 'q9_basket', no: 'q9_nobasket',
  },
  q9_basket: {
    type: 'question', id: 'q9_basket',
    text: '倉田山中学出身ですか？',
    remaining: 8,
    yes: 'result_shibuya', no: 'result_hattori_naomichi',
  },
  q9_nobasket: {
    type: 'question', id: 'q9_nobasket',
    text: '癖毛ですか？',
    remaining: 6,
    yes: 'result_hattori_mitsuki', no: 'confirm_kinoshita_1',
  },

  // 木下清文 2段階確認
  confirm_kinoshita_1: {
    type: 'confirm', id: 'confirm_kinoshita_1',
    text: '…もしかして、あなたは木下清文ですか？',
    remaining: 1,
    yes: 'confirm_kinoshita_2', no: 'unknown',
  },
  confirm_kinoshita_2: {
    type: 'confirm', id: 'confirm_kinoshita_2',
    text: '本当に木下清文ですか？',
    remaining: 1,
    yes: 'result_kinoshita', no: 'unknown',
  },

  result_isogoko: {
    type: 'result',
    player: '五十子裕',
    netaQuestions: [
      'フィリピンでトイレットペーパーがなく、お札でケツを拭きましたか？',
      '江？',
      'Kanyan.0905@docomo.ne.jp？',
    ],
  },
  result_okano: {
    type: 'result',
    player: '岡野透',
    netaQuestions: [
      '中学時代、カツアゲが怖くて靴の中にお金を入れてララパークに行っていましたか？',
      '文化祭の漫才中にネタを飛ばしましたか？',
      '高2の頃、化学の授業をバックれてましたか？',
    ],
  },
  result_shibuya: {
    type: 'result',
    player: '渋谷瞬',
    netaQuestions: [
      'コーヒーが好きじゃないのにカフェの店長していますか？',
      'キノコ食べれないのにお店でパスタを提供していますか？',
      'みゆこ？',
    ],
  },
  result_hattori_naomichi: {
    type: 'result',
    player: '服部直道',
    netaQuestions: [
      '高校最後の体育祭ではしゃいで肉離れを起こしましたか？',
      '全校集会から全員で逃げ出しましたが、久保先生に捕まりましたか？',
      '高2の頃、化学の授業をバックれてましたか？',
    ],
  },
  result_hattori_mitsuki: {
    type: 'result',
    player: '服部光貴',
    netaQuestions: [
      'このアプリの制作者？',
    ],
  },
  result_kinoshita: {
    type: 'result',
    player: '木下清文',
    netaQuestions: [],
  },
  unknown: { type: 'unknown' },
}

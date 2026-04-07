-- GiftMatch Schema

create table rooms (
  id uuid primary key default gen_random_uuid(),
  phase integer not null default 1 check (phase between 1 and 10),
  base_budget integer,
  min_budget integer,
  budget_diff integer,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  anonymous_name text,
  -- { address, budget, genre, want_ranks: [], give_ranks: [] }
  answers jsonb,
  game_score integer,
  final_budget integer,
  santa_target text,
  -- { impression, prediction }
  post_answers jsonb,
  authenticated boolean not null default false
);

create table guesses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  guesser_name text not null,
  guessed_target text not null
);

-- インデックス
create index on players(room_id);
create index on guesses(room_id);

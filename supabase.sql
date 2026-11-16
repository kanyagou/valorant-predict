create table rooms (
  code text primary key,
  state jsonb not null default '{}',
  updated_at timestamptz default now()
);
create table preds (
  room text,
  player_id text,
  answers jsonb not null default '{}',
  created_at timestamptz default now(),
  primary key (room, player_id)
);
alter table rooms enable row level security;
alter table preds enable row level security;
create policy "rooms open" on rooms for all to anon using (true) with check (true);
create policy "preds open" on preds for all to anon using (true) with check (true);

-- Writer Cup V8 final-round protection.
-- Apply once in Supabase before publishing the matching app.js update.

create or replace function public.writer_cup_protect_completed_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id text;
begin
  v_tournament_id := case when tg_op = 'DELETE' then old.tournament_id else new.tournament_id end;

  if tg_op = 'UPDATE'
     and old.tournament_id is distinct from new.tournament_id
     and exists (
       select 1 from public.tournaments
       where id = old.tournament_id and status = 'complete'
     ) then
    raise exception 'Round is locked. Reopen it with the scorer PIN before editing official results.';
  end if;

  if exists (
    select 1 from public.tournaments
    where id = v_tournament_id and status = 'complete'
  ) then
    raise exception 'Round is locked. Reopen it with the scorer PIN before editing official results.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.writer_cup_protect_completed_data() from public, anon, authenticated;

drop trigger if exists writer_cup_lock_scores on public.scores;
create trigger writer_cup_lock_scores
before insert or update or delete on public.scores
for each row execute function public.writer_cup_protect_completed_data();

drop trigger if exists writer_cup_lock_handicaps on public.daily_handicaps;
create trigger writer_cup_lock_handicaps
before insert or update or delete on public.daily_handicaps
for each row execute function public.writer_cup_protect_completed_data();

drop trigger if exists writer_cup_lock_side_competitions on public.side_competitions;
create trigger writer_cup_lock_side_competitions
before insert or update or delete on public.side_competitions
for each row execute function public.writer_cup_protect_completed_data();

drop trigger if exists writer_cup_lock_course_settings on public.course_settings;
create trigger writer_cup_lock_course_settings
before insert or update or delete on public.course_settings
for each row execute function public.writer_cup_protect_completed_data();

create or replace function public.writer_cup_protect_completed_tournament()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'complete'
     and to_jsonb(new) is distinct from to_jsonb(old)
     and coalesce(current_setting('writer_cup.allow_reopen', true), '') <> 'on' then
    raise exception 'Round is locked. Reopen it with the scorer PIN before editing official results.';
  end if;
  return new;
end;
$$;

revoke all on function public.writer_cup_protect_completed_tournament() from public, anon, authenticated;

drop trigger if exists writer_cup_lock_tournament on public.tournaments;
create trigger writer_cup_lock_tournament
before update on public.tournaments
for each row execute function public.writer_cup_protect_completed_tournament();

create or replace function public.writer_cup_finalise_round(
  p_tournament_id text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_hole integer;
  v_expected integer;
  v_actual integer;
begin
  if not coalesce(public.writer_cup_valid_pin(p_tournament_id, p_pin), false) then
    raise exception 'Invalid scorer PIN';
  end if;

  select status into v_status
  from public.tournaments
  where id = p_tournament_id
  for update;

  if v_status is null then raise exception 'Unknown tournament'; end if;
  if v_status = 'complete' then return; end if;

  for v_hole in 1..18 loop
    v_expected := case when v_hole <= 6 then 2 else 4 end;
    select count(*) into v_actual
    from public.scores
    where tournament_id = p_tournament_id and hole_number = v_hole;
    if v_actual <> v_expected then
      raise exception 'Hole % is incomplete and the round cannot be finalised', v_hole;
    end if;
  end loop;

  if not exists (
    select 1 from public.side_competitions
    where tournament_id = p_tournament_id
      and competition_type = 'ntp'
      and (winner_player_id is not null or result_text = 'No qualifying ball')
  ) then
    raise exception 'Nearest to the Pin result is required before finalising';
  end if;

  if not exists (
    select 1 from public.side_competitions
    where tournament_id = p_tournament_id
      and competition_type = 'longest_drive'
      and (winner_player_id is not null or result_text = 'Nobody hit the fairway')
  ) then
    raise exception 'Longest Drive result is required before finalising';
  end if;

  update public.tournaments
  set status = 'complete', current_hole = 18, updated_at = now()
  where id = p_tournament_id;
end;
$$;

revoke all on function public.writer_cup_finalise_round(text, text) from public;
grant execute on function public.writer_cup_finalise_round(text, text) to anon, authenticated;

create or replace function public.writer_cup_reopen_round(
  p_tournament_id text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not coalesce(public.writer_cup_valid_pin(p_tournament_id, p_pin), false) then
    raise exception 'Invalid scorer PIN';
  end if;

  select status into v_status
  from public.tournaments
  where id = p_tournament_id
  for update;

  if v_status is null then raise exception 'Unknown tournament'; end if;
  if v_status <> 'complete' then raise exception 'Round is not locked'; end if;

  perform set_config('writer_cup.allow_reopen', 'on', true);
  update public.tournaments
  set status = 'live', current_hole = 18, updated_at = now()
  where id = p_tournament_id;
end;
$$;

revoke all on function public.writer_cup_reopen_round(text, text) from public;
grant execute on function public.writer_cup_reopen_round(text, text) to anon, authenticated;

-- Hole 18 remains editable until the scorer explicitly finalises the round.
create or replace function public.writer_cup_save_hole(
  p_tournament_id text,
  p_pin text,
  p_hole_number integer,
  p_scores jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  f text;
  player_key text;
  gross integer;
  static_par integer;
  static_si integer;
  par_v integer;
  si_v integer;
  si2_v integer;
  hcp integer;
  strokes integer;
  pts integer;
  mode_v text := 'standard';
  manual_holes_v jsonb := '[]'::jsonb;
  standard_si2_v jsonb := '{}'::jsonb;
  manual_item jsonb;
begin
  if not coalesce(public.writer_cup_valid_pin(p_tournament_id,p_pin),false) then
    raise exception 'Invalid scorer PIN';
  end if;

  select format,par,stroke_index
  into f,static_par,static_si
  from public.holes
  where tournament_id=p_tournament_id and hole_number=p_hole_number;
  if f is null then raise exception 'Unknown hole'; end if;

  select coalesce(active_mode,'standard'),coalesce(manual_holes,'[]'::jsonb),coalesce(standard_si2_overrides,'{}'::jsonb)
  into mode_v,manual_holes_v,standard_si2_v
  from public.course_settings
  where tournament_id=p_tournament_id;

  if f<>'writer_scramble' then
    if mode_v='manual' then
      select value into manual_item
      from jsonb_array_elements(manual_holes_v)
      where (value->>'n')::integer=p_hole_number
      limit 1;
      if manual_item is null then raise exception 'Manual hole setup is missing'; end if;
      par_v=nullif(manual_item->>'par','')::integer;
      si_v=nullif(manual_item->>'si','')::integer;
      si2_v=nullif(manual_item->>'si2','')::integer;
    else
      par_v=static_par;
      si_v=static_si;
      si2_v=nullif(standard_si2_v->>p_hole_number::text,'')::integer;
    end if;
    if par_v is null or si_v is null then raise exception 'Par or stroke index missing'; end if;
  end if;

  delete from public.scores
  where tournament_id=p_tournament_id and hole_number=p_hole_number;

  if f='writer_scramble' then
    insert into public.scores(tournament_id,hole_number,competitor_type,competitor_id,gross_score)
    values
      (p_tournament_id,p_hole_number,'team','berkeley-jail',(p_scores->>'bj')::integer),
      (p_tournament_id,p_hole_number,'team','itchy-scratchy',(p_scores->>'is')::integer);
  else
    foreach player_key in array array['ben','joel','dylan','brent'] loop
      gross=(p_scores->>player_key)::integer;
      select daily_handicap into hcp
      from public.daily_handicaps
      where tournament_id=p_tournament_id and player_id=player_key;
      if hcp is null then raise exception 'Daily handicap missing'; end if;
      strokes =
        (case when hcp>=si_v then 1 else 0 end) +
        (case when hcp>=coalesce(si2_v,si_v+18) then 1 else 0 end) +
        (case when hcp>=si_v+36 then 1 else 0 end);
      pts=greatest(0,2+par_v-(gross-strokes));
      insert into public.scores(
        tournament_id,hole_number,competitor_type,competitor_id,gross_score,stableford_points
      ) values (
        p_tournament_id,p_hole_number,'player',player_key,gross,pts
      );
    end loop;
  end if;

  update public.tournaments
  set current_hole=least(18,greatest(current_hole,p_hole_number+case when p_hole_number<18 then 1 else 0 end)),
      status='live', updated_at=now()
  where id=p_tournament_id;
end;
$$;

revoke all on function public.writer_cup_save_hole(text, text, integer, jsonb) from public;
grant execute on function public.writer_cup_save_hole(text, text, integer, jsonb) to anon, authenticated;

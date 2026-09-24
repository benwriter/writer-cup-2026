-- V10: keep the completed 2026 event and its frozen archive; create future events separately.
-- Apply once in a transaction. No new tournament is created until its PIN-verified setup is submitted.
begin;

-- Team and player slugs repeat each year; references must include the tournament.
alter table public.daily_handicaps drop constraint daily_handicaps_player_id_fkey;
alter table public.player_notes drop constraint player_notes_player_id_fkey;
alter table public.side_competitions drop constraint side_competitions_winner_player_id_fkey;
alter table public.players drop constraint players_team_id_fkey;
alter table public.players drop constraint players_pkey;
alter table public.teams drop constraint teams_pkey;
alter table public.teams add primary key(tournament_id,id);
alter table public.players add primary key(tournament_id,id);
alter table public.players add constraint players_team_event_fkey foreign key(tournament_id,team_id) references public.teams(tournament_id,id) on delete cascade;
alter table public.daily_handicaps add constraint handicaps_player_event_fkey foreign key(tournament_id,player_id) references public.players(tournament_id,id) on delete cascade;
alter table public.player_notes add constraint notes_player_event_fkey foreign key(tournament_id,player_id) references public.players(tournament_id,id) on delete cascade;
alter table public.side_competitions add constraint side_winner_player_event_fkey foreign key(tournament_id,winner_player_id) references public.players(tournament_id,id);

create table public.writer_cup_active_event(
 singleton boolean primary key default true check(singleton),
 tournament_id text not null references public.tournaments(id),
 updated_at timestamptz not null default now()
);
insert into public.writer_cup_active_event(singleton,tournament_id) values(true,'writer-cup-2026');
alter table public.writer_cup_active_event enable row level security;
revoke all on public.writer_cup_active_event from public,anon,authenticated;
grant select on public.writer_cup_active_event to anon,authenticated;
create policy active_event_read on public.writer_cup_active_event for select to anon,authenticated using(true);

create table public.writer_cup_event_content(
 tournament_id text primary key references public.tournaments(id),
 tee_off_at timestamptz not null,
 latitude double precision,
 longitude double precision,
 venue_story text not null default '',
 extra_conditions text not null default '',
 sponsors jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now(),
 constraint event_content_lat check(latitude is null or latitude between -90 and 90),
 constraint event_content_lon check(longitude is null or longitude between -180 and 180),
 constraint event_content_sponsors check(jsonb_typeof(sponsors)='array')
);
insert into public.writer_cup_event_content(tournament_id,tee_off_at,latitude,longitude,sponsors)
values ('writer-cup-2026','2026-09-24 07:00 Australia/Sydney'::timestamptz,-33.98263,151.25137,
 '["TEMU","2 P’s On A Pod Podcast","AMPOL","Guzman y Gomez","Srixon","Titleist","LSKD","Wesley Mission","Tri-Lite Golf Buggies","The Coast Golf & Recreation Club","Hahn Beer"]'::jsonb);
alter table public.writer_cup_event_content enable row level security;
revoke all on public.writer_cup_event_content from public,anon,authenticated;
grant select on public.writer_cup_event_content to anon,authenticated;
create policy event_content_read on public.writer_cup_event_content for select to anon,authenticated using(true);

-- The scorer PIN is checked against the current event. A transaction creates all new rows
-- and switches the public pointer only when everything succeeds.
create function public.writer_cup_create_event_v10(p_pin text,p_date date,p_venue text,p_tee text,p_tee_time time,p_latitude double precision default null,p_longitude double precision default null)
returns text language plpgsql security definer set search_path='' as $$
declare current_id text; previous public.tournaments%rowtype; next_id text; slots jsonb;
begin
 select tournament_id into current_id from public.writer_cup_active_event where singleton=true for update;
 if not coalesce(public.writer_cup_valid_pin(current_id,p_pin),false) then raise exception 'Invalid scorer PIN'; end if;
 select * into previous from public.tournaments where id=current_id for update;
 if previous.status<>'complete' then raise exception 'Complete the current Cup before creating the next'; end if;
 if p_date is null or extract(year from p_date)<=extract(year from previous.event_date)
    or extract(year from p_date)>extract(year from previous.event_date)+5 then raise exception 'Choose a future Cup year'; end if;
 if char_length(trim(coalesce(p_venue,''))) not between 2 and 80 or char_length(trim(coalesce(p_tee,''))) not between 1 and 40 then raise exception 'Enter a course and tee'; end if;
 if p_tee_time is null then raise exception 'Enter a tee time'; end if;
 if (p_latitude is null) <> (p_longitude is null) or p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then raise exception 'Invalid coordinates'; end if;
 next_id='writer-cup-'||extract(year from p_date)::integer;
 if exists(select from public.tournaments where id=next_id) then raise exception 'A Cup already exists for that year'; end if;
 insert into public.tournaments(id,name,event_date,venue,tee,defending_team_id,scorer_pin_hash)
 values(next_id,'Writer Cup '||extract(year from p_date)::integer,p_date,trim(p_venue),trim(p_tee),
 case when previous.status='complete' and previous.defending_team_id='berkeley-jail' then 'berkeley-jail' else previous.defending_team_id end,
 previous.scorer_pin_hash);
 insert into public.teams(tournament_id,id,name)
 select next_id,id,name from public.teams where tournament_id=current_id;
 insert into public.players(tournament_id,id,team_id,display_name,initials,profile_title,bio,photo_url)
 select next_id,id,team_id,display_name,initials,profile_title,bio,photo_url from public.players where tournament_id=current_id;
 insert into public.holes(tournament_id,hole_number,par,stroke_index,metres,format)
 select next_id,n,4,null,null,
 case when n<=6 then 'writer_scramble' when n<=12 then 'fourball_stableford' else 'singles_aggregate' end
 from generate_series(1,18) as n;
 select jsonb_agg(jsonb_build_object('n',n,'par',null,'si',null,'si2',null,'m',null) order by n)
 into slots from generate_series(1,18) as n;
 insert into public.course_settings(tournament_id,active_mode,manual_course_name,manual_tee,manual_holes,ntp_hole,longest_drive_hole)
 values(next_id,'manual',trim(p_venue),trim(p_tee),slots,4,14);
 insert into public.writer_cup_event_content(tournament_id,tee_off_at,latitude,longitude,sponsors)
 select next_id,(p_date::timestamp+p_tee_time) at time zone 'Australia/Sydney',p_latitude,p_longitude,
 coalesce((select jsonb_agg(value) from jsonb_array_elements_text(c.sponsors) as x(value) where value not ilike '%'||previous.venue||'%'),'[]'::jsonb)
 from public.writer_cup_event_content c where c.tournament_id=current_id;
 update public.writer_cup_active_event set tournament_id=next_id,updated_at=now() where singleton=true;
 return next_id;
end; $$;
revoke all on function public.writer_cup_create_event_v10(text,date,text,text,time,double precision,double precision) from public;
grant execute on function public.writer_cup_create_event_v10(text,date,text,text,time,double precision,double precision) to anon,authenticated;

create function public.writer_cup_update_event_v10(p_tournament_id text,p_pin text,p_venue text,p_tee text,p_date date,p_tee_time time,p_latitude double precision,p_longitude double precision,p_venue_story text,p_extra_conditions text,p_sponsors jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare d date;
begin
 if not coalesce(public.writer_cup_valid_pin(p_tournament_id,p_pin),false) then raise exception 'Invalid scorer PIN'; end if;
 if p_tournament_id<>(select tournament_id from public.writer_cup_active_event where singleton=true) then raise exception 'Only the current event can be edited'; end if;
 if (select status from public.tournaments where id=p_tournament_id)='complete' then raise exception 'The completed Cup is locked'; end if;
 if char_length(trim(coalesce(p_venue,''))) not between 2 and 80 or char_length(trim(coalesce(p_tee,''))) not between 1 and 40 then raise exception 'Enter a course and tee'; end if;
 if p_date is null or p_tee_time is null then raise exception 'Date and tee-off time are required'; end if;
 d=p_date;
 if extract(year from d)::integer <> substring(p_tournament_id from '[0-9]{4}$')::integer then raise exception 'Event date must stay in the Cup year'; end if;
 if (p_latitude is null) <> (p_longitude is null) or p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180) then raise exception 'Invalid coordinates'; end if;
 if char_length(coalesce(p_venue_story,''))>3000 or char_length(coalesce(p_extra_conditions,''))>6000 or jsonb_typeof(p_sponsors)<>'array' or jsonb_array_length(p_sponsors)>30 then raise exception 'Event details are too long'; end if;
 if exists(select from jsonb_array_elements(p_sponsors) x where jsonb_typeof(x.value)<>'string' or length(x.value#>>'{}')>100) then raise exception 'Sponsor names must be text under 100 characters'; end if;
 update public.tournaments set event_date=d,venue=trim(p_venue),tee=trim(p_tee),updated_at=now() where id=p_tournament_id;
 update public.course_settings set manual_course_name=trim(p_venue),manual_tee=trim(p_tee),updated_at=now() where tournament_id=p_tournament_id;
 update public.writer_cup_event_content set tee_off_at=(p_date::timestamp+p_tee_time) at time zone 'Australia/Sydney',latitude=p_latitude,longitude=p_longitude,venue_story=trim(coalesce(p_venue_story,'')),extra_conditions=trim(coalesce(p_extra_conditions,'')),sponsors=p_sponsors,updated_at=now() where tournament_id=p_tournament_id;
end; $$;
revoke all on function public.writer_cup_update_event_v10(text,text,text,text,date,time,double precision,double precision,text,text,jsonb) from public;
grant execute on function public.writer_cup_update_event_v10(text,text,text,text,date,time,double precision,double precision,text,text,jsonb) to anon,authenticated;

-- The original notes function included a 2026-only restriction. Carry the same per-player behaviour into the selected current event.
create or replace function public.writer_cup_save_player_note(p_tournament_id text,p_player_id text,p_note_key text,p_hole_number integer,p_note_text text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_tournament_id<>(select tournament_id from public.writer_cup_active_event where singleton=true) then raise exception 'Unknown tournament'; end if;
 if not exists (select 1 from public.players where tournament_id=p_tournament_id and id=p_player_id) then raise exception 'Unknown player'; end if;
 if p_hole_number is not null and p_hole_number not between 1 and 18 then raise exception 'Invalid hole number'; end if;
 if p_note_key <> 'general' and p_note_key <> ('hole-' || coalesce(p_hole_number::text,'')) then raise exception 'Invalid note key'; end if;
 if char_length(coalesce(p_note_text,'')) > 1500 then raise exception 'Note is too long'; end if;
 if trim(coalesce(p_note_text,'')) = '' then
   delete from public.player_notes where tournament_id=p_tournament_id and player_id=p_player_id and note_key=p_note_key;
 else
   insert into public.player_notes(tournament_id,player_id,note_key,hole_number,note_text)
   values(p_tournament_id,p_player_id,p_note_key,p_hole_number,trim(p_note_text))
   on conflict(tournament_id,player_id,note_key) do update set hole_number=excluded.hole_number,note_text=excluded.note_text,updated_at=now();
 end if;
end; $$;

-- Preserve archived rows while removing the Captain's Desk mutations. Existing
-- archived snapshots and public photo viewing remain available; reports and
-- photo writes are retired for V10.
create or replace function public.writer_cup_postcup(p_tournament_id text,p_pin text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; a public.writer_cup_archives%rowtype;
begin
 if not coalesce(public.writer_cup_valid_pin(p_tournament_id,p_pin),false) then raise exception 'Invalid scorer PIN'; end if;
 if p_action='archive' then
  perform 1 from public.tournaments where id=p_tournament_id and status='complete' for update;
  if not found then raise exception 'Finalise the round before archiving'; end if;
  select jsonb_build_object(
   'tournament',(select to_jsonb(t)-'scorer_pin_hash' from public.tournaments t where id=p_tournament_id),
   'event_content',(select to_jsonb(c) from public.writer_cup_event_content c where tournament_id=p_tournament_id),
   'scores',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.scores t where tournament_id=p_tournament_id),
   'course_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.course_settings t where tournament_id=p_tournament_id),
   'holes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.holes t where tournament_id=p_tournament_id),
   'daily_handicaps',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.daily_handicaps t where tournament_id=p_tournament_id),
   'players',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.players t where tournament_id=p_tournament_id),
   'teams',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.teams t where tournament_id=p_tournament_id),
   'player_notes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.player_notes t where tournament_id=p_tournament_id),
   'course_guide',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.course_guide t where tournament_id=p_tournament_id),
   'side_competitions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.side_competitions t where tournament_id=p_tournament_id)) into s;
  insert into public.writer_cup_archives(id,title,event_date,snapshot)
   values(p_tournament_id,s->'tournament'->>'name',(s->'tournament'->>'event_date')::date,s) on conflict(id) do nothing;
  return jsonb_build_object('ok',true);
 end if;
 select * into a from public.writer_cup_archives where id=p_tournament_id;
 if not found then raise exception 'Archive missing'; end if;
 if p_action='context' then
  return jsonb_build_object('snapshot',a.snapshot,'report',(select body from public.writer_cup_reports where archive_id=a.id));
 end if;
 raise exception 'Captain''s Desk actions are retired';
end; $$;
revoke all on function public.writer_cup_postcup(text,text,text,jsonb) from public,anon,authenticated;

-- Future Cups archive automatically after the existing complete-round checks pass.
create function public.writer_cup_finalise_v10(p_tournament_id text,p_pin text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.writer_cup_finalise_round(p_tournament_id,p_pin);
 perform public.writer_cup_postcup(p_tournament_id,p_pin,'archive','{}'::jsonb);
end; $$;
revoke all on function public.writer_cup_finalise_v10(text,text) from public;
grant execute on function public.writer_cup_finalise_v10(text,text) to anon,authenticated;
commit;

create table exercises(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,name text not null,primary_muscle text not null,secondary text[] default '{}',type text not null default 'weight' check(type in('weight','bodyweight','time')),video_url text,archived boolean default false);
create table routines(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,name text not null);
create table routine_exercises(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,routine_id uuid references routines on delete cascade,exercise_id uuid references exercises,position int default 0);
create table sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,routine_id uuid references routines on delete set null,date date not null,notes text,created_at timestamptz default now());
create table sets(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,session_id uuid references sessions on delete cascade,exercise_id uuid references exercises,position int,reps int,weight_kg numeric,seconds int,rest_s int,warmup boolean default false,created_at timestamptz default now());

do $$ declare t text; begin
foreach t in array array['exercises','routines','routine_exercises','sessions','sets'] loop
execute format('alter table %I enable row level security',t);
execute format('create policy "own" on %I for all using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
end loop; end $$;

create function seed_exercises() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into exercises(user_id,name,primary_muscle,secondary,type) values
(new.id,'Press banca','Pecho','{Tríceps,Hombro}','weight'),
(new.id,'Press inclinado con mancuernas','Pecho','{Hombro,Tríceps}','weight'),
(new.id,'Aperturas','Pecho','{}','weight'),
(new.id,'Flexiones','Pecho','{Tríceps}','bodyweight'),
(new.id,'Fondos','Pecho','{Tríceps}','bodyweight'),
(new.id,'Press militar','Hombro','{Tríceps}','weight'),
(new.id,'Elevaciones laterales','Hombro','{}','weight'),
(new.id,'Dominadas','Espalda','{Bíceps}','bodyweight'),
(new.id,'Jalón al pecho','Espalda','{Bíceps}','weight'),
(new.id,'Remo con barra','Espalda','{Bíceps}','weight'),
(new.id,'Curl de bíceps','Bíceps','{Antebrazo}','weight'),
(new.id,'Extensión de tríceps','Tríceps','{}','weight'),
(new.id,'Sentadilla','Cuádriceps','{Glúteo}','weight'),
(new.id,'Prensa','Cuádriceps','{Glúteo}','weight'),
(new.id,'Peso muerto rumano','Femoral','{Glúteo,Espalda}','weight'),
(new.id,'Hip thrust','Glúteo','{Femoral}','weight'),
(new.id,'Curl femoral','Femoral','{}','weight'),
(new.id,'Elevación de talones','Pantorrilla','{}','weight'),
(new.id,'Crunch abdominal','Abdomen','{}','bodyweight'),
(new.id,'Plancha','Abdomen','{}','time');
return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function seed_exercises();

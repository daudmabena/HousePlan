-- Run schema.sql (which includes this schema and the import) in Supabase SQL Editor.
-- Only explicitly approved accounts can read the imported house records.
create table if not exists public.house_access (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.house_access enable row level security;
revoke all on public.house_access from anon, authenticated;
create or replace function public.has_house_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.house_access where user_id = (select auth.uid()));
$$;
revoke all on function public.has_house_access() from public, anon;
grant execute on function public.has_house_access() to authenticated;
create table if not exists public.house_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  house_name text not null default 'Mabena House' check (length(trim(house_name)) between 1 and 120),
  currency text not null default '' check (currency ~ '^([A-Z]{3})?$')
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  status text not null default 'Not started' check (status in ('Not started','In progress','Complete','On hold')),
  budget bigint check (budget between 0 and 1000000000000),
  start_date date, target_date date,
  notes text not null default '' check (length(notes)<=2000),
  sort_order integer not null default 0 check (sort_order>=0),
  created_at timestamptz not null default now(),
  unique(id,owner_id),
  check (start_date is null or target_date is null or target_date>=start_date)
);
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  unit text not null default '' check(length(unit)<=40),
  budget bigint check (budget between 0 and 1000000000000),
  notes text not null default '' check(length(notes)<=2000),
  sort_order integer not null default 0 check(sort_order>=0),
  unique(id,project_id,owner_id),
  foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null, item_id uuid,
  amount bigint not null check(amount between 1 and 1000000000000),
  payment_date date,
  reference text not null default '' check(length(reference)<=120),
  description text not null check(length(trim(description)) between 1 and 500),
  payee text not null default '' check(length(payee)<=120),
  receipt text not null default '' check(length(receipt)<=200),
  created_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete restrict,
  foreign key(item_id,project_id,owner_id) references public.items(id,project_id,owner_id) on delete restrict
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null check(length(trim(title)) between 1 and 200),
  due_date date,
  status text not null default 'To do' check(status in ('To do','In progress','Done')),
  notes text not null default '' check(length(notes)<=2000),
  created_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists items_owner_project_idx on public.items(owner_id,project_id);
create index if not exists payments_owner_project_idx on public.payments(owner_id,project_id);
create index if not exists payments_item_idx on public.payments(item_id,project_id,owner_id);
create index if not exists tasks_owner_project_idx on public.tasks(owner_id,project_id);
alter table public.house_settings enable row level security;
alter table public.projects enable row level security;
alter table public.items enable row level security;
alter table public.payments enable row level security;
alter table public.tasks enable row level security;
drop policy if exists settings_owner on public.house_settings;
create policy settings_owner on public.house_settings for all to authenticated using ((select auth.uid())=id and (select public.has_house_access())) with check ((select auth.uid())=id and (select public.has_house_access()));
drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects for all to authenticated using ((select auth.uid())=owner_id and (select public.has_house_access())) with check ((select auth.uid())=owner_id and (select public.has_house_access()));
drop policy if exists items_owner on public.items;
create policy items_owner on public.items for all to authenticated using ((select auth.uid())=owner_id and (select public.has_house_access())) with check ((select auth.uid())=owner_id and (select public.has_house_access()));
drop policy if exists payments_owner on public.payments;
create policy payments_owner on public.payments for all to authenticated using ((select auth.uid())=owner_id and (select public.has_house_access())) with check ((select auth.uid())=owner_id and (select public.has_house_access()));
drop policy if exists tasks_owner on public.tasks;
create policy tasks_owner on public.tasks for all to authenticated using ((select auth.uid())=owner_id and (select public.has_house_access())) with check ((select auth.uid())=owner_id and (select public.has_house_access()));
revoke all on public.house_settings,public.projects,public.items,public.payments,public.tasks from anon;
grant select,insert,update on public.house_settings to authenticated;
revoke delete on public.house_settings from authenticated;
grant select,insert,update,delete on public.projects,public.items,public.payments,public.tasks to authenticated;

-- Imported records: mabenahouse.xlsx, transactions and next project.
-- Amounts retain original units; currency and payment dates were not specified.
-- Extra blocks are grouped under Renta / 3 courses after renta; original descriptions remain.
create or replace function public.initialize_house() returns void
language plpgsql security invoker set search_path = '' as $$
declare who uuid := auth.uid(); inserted uuid;
begin
  if who is null then raise exception 'Sign in first'; end if;
  if not public.has_house_access() then raise exception 'This account is not approved. Add your account to house_access in Supabase SQL Editor.'; end if;
  insert into public.house_settings(id,house_name,currency) values(who,'Mabena House','')
    on conflict (id) do nothing returning id into inserted;
  if inserted is null then return; end if;
  insert into public.projects(owner_id,name,status,budget,notes,sort_order) values
    (who,'Site preparations','In progress',null,'Progress was not specified in the source. Update this status as needed.',0),
    (who,'Foundation','In progress',null,'Progress was not specified in the source. Update this status as needed.',1),
    (who,'Wall','In progress',null,'Progress was not specified in the source. Update this status as needed.',2),
    (who,'Renta','In progress',null,'Progress was not specified in the source. Update this status as needed.',3),
    (who,'3 courses after renta','In progress',null,'Progress was not specified in the source. Update this status as needed.',4),
    (who,'Septic tank','In progress',null,'Progress was not specified in the source. Update this status as needed.',5),
    (who,'Fence','In progress',14000000,'',6),
    (who,'Roofing','Not started',null,'',7),
    (who,'Grills','Not started',null,'',8),
    (who,'Plumbing and sanitary ware','Not started',null,'',9),
    (who,'Wiring, sockets and switches','Not started',null,'',10),
    (who,'Plaster','Not started',null,'',11),
    (who,'Skimming','Not started',null,'',12),
    (who,'Gypsum board','Not started',null,'',13),
    (who,'Tiles','Not started',null,'',14),
    (who,'Painting','Not started',null,'',15),
    (who,'Cabinetry (kitchen and rooms)','Not started',null,'',16),
    (who,'Tank tower with toilet','Not started',null,'',17),
    (who,'Outside store with kitchen','Not started',null,'',18),
    (who,'Landscaping','Not started',null,'',19);
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Site clearing','service',0 from public.projects where owner_id=who and sort_order=0;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Setting out and surveying','service',1 from public.projects where owner_id=who and sort_order=0;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Cement','bags',2 from public.projects where owner_id=who and sort_order=1;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Sand','loads',3 from public.projects where owner_id=who and sort_order=1;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Aggregates','loads',4 from public.projects where owner_id=who and sort_order=1;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Reinforcement steel','kg',5 from public.projects where owner_id=who and sort_order=1;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Foundation labour','service',6 from public.projects where owner_id=who and sort_order=1;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Wall blocks','pieces',7 from public.projects where owner_id=who and sort_order=2;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Mortar materials','batch',8 from public.projects where owner_id=who and sort_order=2;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Masonry labour','service',9 from public.projects where owner_id=who and sort_order=2;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Renta concrete and reinforcement','batch',10 from public.projects where owner_id=who and sort_order=3;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Formwork and labour','service',11 from public.projects where owner_id=who and sort_order=3;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Upper wall blocks','pieces',12 from public.projects where owner_id=who and sort_order=4;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Upper wall cement','bags',13 from public.projects where owner_id=who and sort_order=4;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Septic tank materials','batch',14 from public.projects where owner_id=who and sort_order=5;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Septic tank labour','service',15 from public.projects where owner_id=who and sort_order=5;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Fence blocks and cement','batch',16 from public.projects where owner_id=who and sort_order=6;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Fence gate','piece',17 from public.projects where owner_id=who and sort_order=6;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Fence labour','service',18 from public.projects where owner_id=who and sort_order=6;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Roof trusses','set',19 from public.projects where owner_id=who and sort_order=7;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Roof sheets and accessories','set',20 from public.projects where owner_id=who and sort_order=7;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Roofing labour','service',21 from public.projects where owner_id=who and sort_order=7;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Window and door grills','set',22 from public.projects where owner_id=who and sort_order=8;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Pipes and fittings','set',23 from public.projects where owner_id=who and sort_order=9;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Sanitary ware','set',24 from public.projects where owner_id=who and sort_order=9;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Plumbing labour','service',25 from public.projects where owner_id=who and sort_order=9;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Electrical cables and conduit','set',26 from public.projects where owner_id=who and sort_order=10;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Sockets and switches','set',27 from public.projects where owner_id=who and sort_order=10;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Electrical labour','service',28 from public.projects where owner_id=who and sort_order=10;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Plaster materials and labour','service',29 from public.projects where owner_id=who and sort_order=11;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Skimming materials and labour','service',30 from public.projects where owner_id=who and sort_order=12;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Gypsum boards and installation','service',31 from public.projects where owner_id=who and sort_order=13;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Floor and wall tiles','m²',32 from public.projects where owner_id=who and sort_order=14;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Tile adhesive and labour','service',33 from public.projects where owner_id=who and sort_order=14;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Paint and primer','litres',34 from public.projects where owner_id=who and sort_order=15;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Painting labour','service',35 from public.projects where owner_id=who and sort_order=15;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Kitchen cabinets','set',36 from public.projects where owner_id=who and sort_order=16;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Bedroom wardrobes','set',37 from public.projects where owner_id=who and sort_order=16;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Water tank and tower','set',38 from public.projects where owner_id=who and sort_order=17;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Toilet construction','service',39 from public.projects where owner_id=who and sort_order=17;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Store and outside kitchen','service',40 from public.projects where owner_id=who and sort_order=18;
  insert into public.items(owner_id,project_id,name,unit,sort_order) select who,id,'Landscaping materials and labour','service',41 from public.projects where owner_id=who and sort_order=19;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,1000000,'DAY 1','Site preparations' from public.projects where owner_id=who and sort_order=0;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,25000000,'DAY 2','Foundation' from public.projects where owner_id=who and sort_order=1;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,4000000,'DAY 3','Foundation' from public.projects where owner_id=who and sort_order=1;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,3000000,'DAY 4','Wall' from public.projects where owner_id=who and sort_order=2;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,4000000,'DAY 5','Wall' from public.projects where owner_id=who and sort_order=2;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,2000000,'DAY 6','Wall' from public.projects where owner_id=who and sort_order=2;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,6000000,'DAY 7','Renta' from public.projects where owner_id=who and sort_order=3;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,3000000,'DAY 8','3 coz after renta' from public.projects where owner_id=who and sort_order=4;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,1600000,'DAY 9','Extra 700 blocks 6"@1450+800k for a renta' from public.projects where owner_id=who and sort_order=3;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,1100000,'DAY 10','Septic tank' from public.projects where owner_id=who and sort_order=5;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,400000,'DAY 11','Extra 200 blocks 5"@1300+5bags of cement to 3coz after renta' from public.projects where owner_id=who and sort_order=4;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,5000000,'DAY 12','Fence' from public.projects where owner_id=who and sort_order=6;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,1000000,'DAY 13','Fence' from public.projects where owner_id=who and sort_order=6;
  insert into public.payments(owner_id,project_id,amount,reference,description) select who,id,2000000,'DAY 14','Fence' from public.projects where owner_id=who and sort_order=6;
  insert into public.tasks(owner_id,project_id,title,notes) select who,id,'Confirm the remaining fence work','Suggested planning task. Edit to match your plan.' from public.projects where owner_id=who and sort_order=6;
  insert into public.tasks(owner_id,project_id,title,notes) select who,id,'Get roofing quotations','Suggested planning task. Edit to match your plan.' from public.projects where owner_id=who and sort_order=7;
  insert into public.tasks(owner_id,project_id,title,notes) select who,id,'List plumbing and sanitary requirements','Suggested planning task. Edit to match your plan.' from public.projects where owner_id=who and sort_order=9;
  insert into public.tasks(owner_id,project_id,title,notes) select who,id,'Get an electrical installation estimate','Suggested planning task. Edit to match your plan.' from public.projects where owner_id=who and sort_order=10;
end;
$$;
revoke all on function public.initialize_house() from public, anon;
grant execute on function public.initialize_house() to authenticated;

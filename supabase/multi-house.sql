create table public.houses (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 currency text not null default '' check(currency ~ '^([A-Z]{3})?$'),
 created_by uuid references auth.users(id) on delete set null, source_key text unique, archived_at timestamptz, created_at timestamptz not null default now()
);
create table public.house_members (
 house_id uuid not null references public.houses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(house_id,user_id)
);
create index house_members_user_idx on public.house_members(user_id,house_id);
create table public.house_invitations (
 id uuid primary key default gen_random_uuid(), house_id uuid not null references public.houses(id) on delete cascade,
 email text not null check(length(email)<=254 and email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 token_hash text not null unique, invited_by uuid references auth.users(id) on delete set null,
 expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index house_invitations_house_idx on public.house_invitations(house_id);
create table public.stages (
 id uuid primary key default gen_random_uuid(), house_id uuid not null references public.houses(id),
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 name text not null check(length(trim(name)) between 1 and 120),
 status text not null default 'Not started' check(status in ('Not started','In progress','Complete','On hold')),
 budget bigint check(budget between 0 and 1000000000000), start_date date, target_date date,
 notes text not null default '' check(length(notes)<=2000), sort_order integer not null default 0 check(sort_order>=0),
 created_at timestamptz not null default now(), unique(id,house_id),
 check(start_date is null or target_date is null or target_date>=start_date)
);
create table public.items (
 id uuid primary key default gen_random_uuid(), house_id uuid not null references public.houses(id), stage_id uuid not null,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 name text not null check(length(trim(name)) between 1 and 120), unit text not null default '' check(length(unit)<=40),
 budget bigint check(budget between 0 and 1000000000000), notes text not null default '' check(length(notes)<=2000),
 sort_order integer not null default 0 check(sort_order>=0), unique(id,stage_id,house_id),
 foreign key(stage_id,house_id) references public.stages(id,house_id) on delete cascade
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), house_id uuid not null references public.houses(id), stage_id uuid not null, item_id uuid,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 amount bigint not null check(amount between 1 and 1000000000000), payment_date date,
 reference text not null default '' check(length(reference)<=120), description text not null check(length(trim(description)) between 1 and 500),
 payee text not null default '' check(length(payee)<=120), receipt text not null default '' check(length(receipt)<=200),
 created_at timestamptz not null default now(),
 foreign key(stage_id,house_id) references public.stages(id,house_id) on delete restrict,
 foreign key(item_id,stage_id,house_id) references public.items(id,stage_id,house_id) on delete restrict
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), house_id uuid not null references public.houses(id), stage_id uuid not null,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 title text not null check(length(trim(title)) between 1 and 200), due_date date,
 status text not null default 'To do' check(status in ('To do','In progress','Done')),
 notes text not null default '' check(length(notes)<=2000), created_at timestamptz not null default now(),
 foreign key(stage_id,house_id) references public.stages(id,house_id) on delete cascade
);
create index stages_house_idx on public.stages(house_id);
create index items_house_stage_idx on public.items(house_id,stage_id);
create index payments_house_stage_idx on public.payments(house_id,stage_id);
create index payments_item_idx_v2 on public.payments(item_id,stage_id,house_id);
create index tasks_house_stage_idx on public.tasks(house_id,stage_id);
create function public.is_verified() returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null);
$$;
create function public.is_house_member(hid uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select public.is_verified() and exists(select 1 from public.house_members where house_id=hid and user_id=auth.uid());
$$;
create function public.can_edit_house(hid uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select public.is_house_member(hid) and exists(select 1 from public.houses where id=hid and archived_at is null);
$$;
create function public.lock_editable_house(hid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.houses where id=hid for update;
 if not public.can_edit_house(hid) then raise exception 'House is archived or you no longer have access'; end if;
end;
$$;
create function public.guard_house_record() returns trigger language plpgsql security definer set search_path='' as $$
declare hid uuid;
begin
 hid:=case when TG_OP='DELETE' then OLD.house_id else NEW.house_id end;
 perform 1 from public.houses where id=hid for update;
 if TG_OP='UPDATE' and (NEW.house_id<>OLD.house_id or (auth.uid() is not null and NEW.created_by is distinct from OLD.created_by)) then raise exception 'House and creator cannot be changed'; end if;
 if auth.uid() is not null and not public.can_edit_house(hid) then raise exception 'House is archived or inaccessible'; end if;
 if TG_OP='DELETE' then return OLD; end if; return NEW;
end;
$$;
create trigger stages_house_guard before insert or update or delete on public.stages for each row execute function public.guard_house_record();
create trigger items_house_guard before insert or update or delete on public.items for each row execute function public.guard_house_record();
create trigger payments_house_guard before insert or update or delete on public.payments for each row execute function public.guard_house_record();
create trigger tasks_house_guard before insert or update or delete on public.tasks for each row execute function public.guard_house_record();
create function public.keep_house_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.houses where id=OLD.house_id for update;
 if exists(select 1 from public.houses where id=OLD.house_id) and not exists(select 1 from public.house_members where house_id=OLD.house_id and user_id<>OLD.user_id) then raise exception 'A house must keep at least one owner'; end if;
 return OLD;
end;
$$;
create trigger keep_last_owner before delete on public.house_members for each row execute function public.keep_house_owner();
create function public.update_house(hid uuid, house_name text, house_currency text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.lock_editable_house(hid);
 update public.houses set name=trim(house_name),currency=upper(trim(house_currency)) where id=hid;
end;
$$;
create function public.set_house_archived(hid uuid, archived boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.houses where id=hid for update;
 if not public.is_house_member(hid) then raise exception 'You do not have access to this house'; end if;
 update public.houses set archived_at=case when archived then now() else null end where id=hid;
end;
$$;
create function public.get_house_members(hid uuid) returns table(user_id uuid,email text,joined_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if not public.is_house_member(hid) then raise exception 'You do not have access to this house'; end if;
 return query select m.user_id,u.email::text,m.joined_at from public.house_members m join auth.users u on u.id=m.user_id where m.house_id=hid order by m.joined_at,m.user_id;
end;
$$;
create function public.remove_house_member(hid uuid, member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.lock_editable_house(hid);
 delete from public.house_members where house_id=hid and user_id=member_id;
 if not found then raise exception 'Owner not found'; end if;
end;
$$;
create function public.create_house_invitation(hid uuid, invited_email text) returns text language plpgsql security definer set search_path='' as $$
declare token text; normalized text:=lower(trim(invited_email));
begin
 perform public.lock_editable_house(hid);
 if exists(select 1 from public.house_members m join auth.users u on u.id=m.user_id where m.house_id=hid and lower(u.email)=normalized) then raise exception 'This person already owns this house'; end if;
 update public.house_invitations set revoked_at=now() where house_id=hid and email=normalized and revoked_at is null and accepted_at is null;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.house_invitations(house_id,email,token_hash,invited_by) values(hid,normalized,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid());
 return token;
end;
$$;
create function public.revoke_house_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare hid uuid;
begin
 select house_id into hid from public.house_invitations where id=invitation_id;
 perform public.lock_editable_house(hid);
 update public.house_invitations set revoked_at=now() where id=invitation_id and accepted_at is null;
end;
$$;
create function public.accept_house_invitation(token text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.house_invitations; user_email text;
begin
 if not public.is_verified() then raise exception 'Sign in with a verified email to accept this invitation'; end if;
 select lower(email) into user_email from auth.users where id=auth.uid();
 select * into invitation from public.house_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not found then raise exception 'Invitation is invalid'; end if;
 perform 1 from public.houses where id=invitation.house_id for update;
 select * into invitation from public.house_invitations where id=invitation.id for update;
 if invitation.email<>user_email then raise exception 'Sign in using the email address this invitation was sent to'; end if;
 if invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then raise exception 'Invitation has expired, was revoked, or was already accepted'; end if;
 if exists(select 1 from public.houses where id=invitation.house_id and archived_at is not null) then raise exception 'This house is archived'; end if;
 insert into public.house_members(house_id,user_id)values(invitation.house_id,auth.uid()) on conflict do nothing;
 update public.house_invitations set accepted_at=now() where id=invitation.id;
 return invitation.house_id;
end;
$$;
alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.house_invitations enable row level security;
alter table public.stages enable row level security;
alter table public.items enable row level security;
alter table public.payments enable row level security;
alter table public.tasks enable row level security;
create policy houses_members on public.houses for select to authenticated using(public.is_house_member(id));
create policy members_house on public.house_members for select to authenticated using(public.is_house_member(house_id));
create policy invitations_house on public.house_invitations for select to authenticated using(public.is_house_member(house_id));
create policy stages_read on public.stages for select to authenticated using(public.is_house_member(house_id));
create policy stages_write on public.stages for all to authenticated using(public.can_edit_house(house_id)) with check(public.can_edit_house(house_id));
create policy items_read on public.items for select to authenticated using(public.is_house_member(house_id));
create policy items_write on public.items for all to authenticated using(public.can_edit_house(house_id)) with check(public.can_edit_house(house_id));
create policy payments_read on public.payments for select to authenticated using(public.is_house_member(house_id));
create policy payments_write on public.payments for all to authenticated using(public.can_edit_house(house_id)) with check(public.can_edit_house(house_id));
create policy tasks_read on public.tasks for select to authenticated using(public.is_house_member(house_id));
create policy tasks_write on public.tasks for all to authenticated using(public.can_edit_house(house_id)) with check(public.can_edit_house(house_id));
revoke all on public.houses,public.house_members,public.house_invitations,public.stages,public.items,public.payments,public.tasks from public,anon,authenticated;
grant select on public.houses,public.house_members,public.stages,public.items,public.payments,public.tasks to authenticated;
grant select(id,house_id,email,expires_at,accepted_at,revoked_at,created_at) on public.house_invitations to authenticated;
grant delete on public.stages,public.items,public.payments,public.tasks to authenticated;
grant insert(house_id,name,status,budget,start_date,target_date,notes,sort_order) on public.stages to authenticated;
grant insert(house_id,stage_id,name,unit,budget,notes,sort_order) on public.items to authenticated;
grant insert(house_id,stage_id,item_id,amount,payment_date,reference,description,payee,receipt) on public.payments to authenticated;
grant insert(house_id,stage_id,title,due_date,status,notes) on public.tasks to authenticated;
grant update(name,status,budget,start_date,target_date,notes,sort_order) on public.stages to authenticated;
grant update(stage_id,name,unit,budget,notes,sort_order) on public.items to authenticated;
grant update(stage_id,item_id,amount,payment_date,reference,description,payee,receipt) on public.payments to authenticated;
grant update(stage_id,title,due_date,status,notes) on public.tasks to authenticated;
revoke all on function public.is_verified(),public.is_house_member(uuid),public.can_edit_house(uuid),public.lock_editable_house(uuid),public.guard_house_record(),public.keep_house_owner(),public.update_house(uuid,text,text),public.set_house_archived(uuid,boolean),public.get_house_members(uuid),public.remove_house_member(uuid,uuid),public.create_house_invitation(uuid,text),public.revoke_house_invitation(uuid),public.accept_house_invitation(text) from public,anon,authenticated;
grant execute on function public.is_verified(),public.is_house_member(uuid),public.can_edit_house(uuid),public.update_house(uuid,text,text),public.set_house_archived(uuid,boolean),public.get_house_members(uuid),public.remove_house_member(uuid,uuid),public.create_house_invitation(uuid,text),public.revoke_house_invitation(uuid),public.accept_house_invitation(text) to authenticated;

-- Optional administrator-run import. Replace OWNER_EMAIL below. Never run for every signup.
begin;
do $$
declare who uuid; hid uuid;
begin
 select id into who from auth.users where lower(email)=lower('OWNER_EMAIL') and email_confirmed_at is not null;
 if who is null then raise exception 'Set OWNER_EMAIL to an existing verified account email'; end if;
 if exists(select 1 from public.houses where source_key='mabenahouse:'||who::text) then raise notice 'Workbook already imported'; return; end if;
 insert into public.houses(name,currency,created_by,source_key) values('Mabena House','',who,'mabenahouse:'||who::text) returning id into hid;
 insert into public.house_members(house_id,user_id)values(hid,who);
 insert into public.stages(house_id,created_by,name,status,budget,notes,sort_order)values
 (hid,who,'Site preparations','In progress',null,'Progress was not specified in the source. Update this status as needed.',0),
 (hid,who,'Foundation','In progress',null,'Progress was not specified in the source. Update this status as needed.',1),
 (hid,who,'Wall','In progress',null,'Progress was not specified in the source. Update this status as needed.',2),
 (hid,who,'Renta','In progress',null,'Progress was not specified in the source. Update this status as needed.',3),
 (hid,who,'3 courses after renta','In progress',null,'Progress was not specified in the source. Update this status as needed.',4),
 (hid,who,'Septic tank','In progress',null,'Progress was not specified in the source. Update this status as needed.',5),
 (hid,who,'Fence','In progress',14000000,'',6),
 (hid,who,'Roofing','Not started',null,'',7),
 (hid,who,'Grills','Not started',null,'',8),
 (hid,who,'Plumbing and sanitary ware','Not started',null,'',9),
 (hid,who,'Wiring, sockets and switches','Not started',null,'',10),
 (hid,who,'Plaster','Not started',null,'',11),
 (hid,who,'Skimming','Not started',null,'',12),
 (hid,who,'Gypsum board','Not started',null,'',13),
 (hid,who,'Tiles','Not started',null,'',14),
 (hid,who,'Painting','Not started',null,'',15),
 (hid,who,'Cabinetry (kitchen and rooms)','Not started',null,'',16),
 (hid,who,'Tank tower with toilet','Not started',null,'',17),
 (hid,who,'Outside store with kitchen','Not started',null,'',18),
 (hid,who,'Landscaping','Not started',null,'',19);
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Site clearing','service',0 from public.stages where house_id=hid and sort_order=0;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Setting out and surveying','service',1 from public.stages where house_id=hid and sort_order=0;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Cement','bags',2 from public.stages where house_id=hid and sort_order=1;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Sand','loads',3 from public.stages where house_id=hid and sort_order=1;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Aggregates','loads',4 from public.stages where house_id=hid and sort_order=1;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Reinforcement steel','kg',5 from public.stages where house_id=hid and sort_order=1;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Foundation labour','service',6 from public.stages where house_id=hid and sort_order=1;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Wall blocks','pieces',7 from public.stages where house_id=hid and sort_order=2;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Mortar materials','batch',8 from public.stages where house_id=hid and sort_order=2;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Masonry labour','service',9 from public.stages where house_id=hid and sort_order=2;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Renta concrete and reinforcement','batch',10 from public.stages where house_id=hid and sort_order=3;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Formwork and labour','service',11 from public.stages where house_id=hid and sort_order=3;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Upper wall blocks','pieces',12 from public.stages where house_id=hid and sort_order=4;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Upper wall cement','bags',13 from public.stages where house_id=hid and sort_order=4;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Septic tank materials','batch',14 from public.stages where house_id=hid and sort_order=5;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Septic tank labour','service',15 from public.stages where house_id=hid and sort_order=5;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Fence blocks and cement','batch',16 from public.stages where house_id=hid and sort_order=6;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Fence gate','piece',17 from public.stages where house_id=hid and sort_order=6;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Fence labour','service',18 from public.stages where house_id=hid and sort_order=6;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Roof trusses','set',19 from public.stages where house_id=hid and sort_order=7;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Roof sheets and accessories','set',20 from public.stages where house_id=hid and sort_order=7;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Roofing labour','service',21 from public.stages where house_id=hid and sort_order=7;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Window and door grills','set',22 from public.stages where house_id=hid and sort_order=8;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Pipes and fittings','set',23 from public.stages where house_id=hid and sort_order=9;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Sanitary ware','set',24 from public.stages where house_id=hid and sort_order=9;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Plumbing labour','service',25 from public.stages where house_id=hid and sort_order=9;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Electrical cables and conduit','set',26 from public.stages where house_id=hid and sort_order=10;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Sockets and switches','set',27 from public.stages where house_id=hid and sort_order=10;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Electrical labour','service',28 from public.stages where house_id=hid and sort_order=10;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Plaster materials and labour','service',29 from public.stages where house_id=hid and sort_order=11;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Skimming materials and labour','service',30 from public.stages where house_id=hid and sort_order=12;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Gypsum boards and installation','service',31 from public.stages where house_id=hid and sort_order=13;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Floor and wall tiles','m²',32 from public.stages where house_id=hid and sort_order=14;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Tile adhesive and labour','service',33 from public.stages where house_id=hid and sort_order=14;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Paint and primer','litres',34 from public.stages where house_id=hid and sort_order=15;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Painting labour','service',35 from public.stages where house_id=hid and sort_order=15;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Kitchen cabinets','set',36 from public.stages where house_id=hid and sort_order=16;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Bedroom wardrobes','set',37 from public.stages where house_id=hid and sort_order=16;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Water tank and tower','set',38 from public.stages where house_id=hid and sort_order=17;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Toilet construction','service',39 from public.stages where house_id=hid and sort_order=17;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Store and outside kitchen','service',40 from public.stages where house_id=hid and sort_order=18;
 insert into public.items(house_id,created_by,stage_id,name,unit,sort_order) select hid,who,id,'Landscaping materials and labour','service',41 from public.stages where house_id=hid and sort_order=19;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,1000000,null,'DAY 1','Site preparations','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=0;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,25000000,null,'DAY 2','Foundation','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=1;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,4000000,null,'DAY 3','Foundation','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=1;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,3000000,null,'DAY 4','Wall','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=2;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,4000000,null,'DAY 5','Wall','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=2;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,2000000,null,'DAY 6','Wall','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=2;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,6000000,null,'DAY 7','Renta','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=3;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,3000000,null,'DAY 8','3 coz after renta','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=4;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,1600000,null,'DAY 9','Extra 700 blocks 6"@1450+800k for a renta','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=3;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,1100000,null,'DAY 10','Septic tank','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=5;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,400000,null,'DAY 11','Extra 200 blocks 5"@1300+5bags of cement to 3coz after renta','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=4;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,5000000,null,'DAY 12','Fence','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=6;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,1000000,null,'DAY 13','Fence','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=6;
 insert into public.payments(house_id,created_by,stage_id,amount,payment_date,reference,description,payee,receipt,created_at)select hid,who,id,2000000,null,'DAY 14','Fence','','','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=6;
 insert into public.tasks(house_id,created_by,stage_id,title,status,due_date,notes,created_at)select hid,who,id,'Confirm the remaining fence work','To do',null,'Suggested planning task. Edit to match your plan.','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=6;
 insert into public.tasks(house_id,created_by,stage_id,title,status,due_date,notes,created_at)select hid,who,id,'Get roofing quotations','To do',null,'Suggested planning task. Edit to match your plan.','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=7;
 insert into public.tasks(house_id,created_by,stage_id,title,status,due_date,notes,created_at)select hid,who,id,'List plumbing and sanitary requirements','To do',null,'Suggested planning task. Edit to match your plan.','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=9;
 insert into public.tasks(house_id,created_by,stage_id,title,status,due_date,notes,created_at)select hid,who,id,'Get an electrical installation estimate','To do',null,'Suggested planning task. Edit to match your plan.','2026-10-07T00:00:00Z' from public.stages where house_id=hid and sort_order=10;
end;$$;
commit;

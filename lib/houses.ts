import templates from './templates.json';
import type { House, HouseData } from './types';
export function starterData(house: House): HouseData {
  const stages = templates.stages.map(s => ({...s,id:crypto.randomUUID(),house_id:house.id,budget:null,status:'Not started' as const,start_date:null,target_date:null,notes:''}));
  const items = templates.items.map(({stage_order,...item}) => ({...item,id:crypto.randomUUID(),house_id:house.id,stage_id:stages.find(s=>s.sort_order===stage_order)!.id,budget:null,notes:''}));
  return {stages,items,payments:[],tasks:[],settings:{id:house.id,house_name:house.name,currency:house.currency}};
}
export function legacyPreview(raw: Record<string,unknown>,house:House):HouseData {
  const convert=(rows:unknown)=>Array.isArray(rows)?rows.map(r=>{const {project_id,...rest}=r;return {...rest,house_id:house.id,...(project_id?{stage_id:project_id}:{})};}):[];
  return {stages:convert(raw.stages??raw.projects),items:convert(raw.items),payments:convert(raw.payments),tasks:convert(raw.tasks),settings:{id:house.id,house_name:house.name,currency:house.currency}} as HouseData;
}

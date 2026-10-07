'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import type {User} from '@supabase/supabase-js';
import {House as HouseIcon,Plus,ArrowUpRight,LogOut,RefreshCw} from 'lucide-react';
import Tracker,{Auth,Setup} from './tracker';
import {getSupabase} from '@/lib/supabase';
import {settingsSchema} from '@/lib/model';
import {legacyPreview,starterData} from '@/lib/houses';
import type {House,HouseData} from '@/lib/types';
type PreviewStore={houses:House[];records:Record<string,HouseData>};
const storeKey='budget-my-house-preview-v3';
const selectedKey='budget-my-house-selected';
const seedId='00000000-0000-4000-8000-000000000900';
export default function Workspace({configured,previewData,inviteToken}:{configured:boolean;previewData:HouseData|null;inviteToken?:string}){
 const preview=!configured&&Boolean(previewData);
 const db=getSupabase();
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(!configured),[recovery,setRecovery]=useState(false);
 const [houses,setHouses]=useState<House[]>([]),[records,setRecords]=useState<PreviewStore['records']>({});
 const [selected,setSelected]=useState<string|null>(null),[creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const selectedRef=useRef(selected);selectedRef.current=selected;
 const version=useRef(0);
 const choose=useCallback((id:string|null)=>{setSelected(id);try{if(id)localStorage.setItem(selectedKey,id);else localStorage.removeItem(selectedKey);}catch{}},[]);
 useEffect(()=>{
  try{
   const fromUrl=new URL(window.location.href).searchParams.get('house');const saved=fromUrl??localStorage.getItem(selectedKey);if(saved)setSelected(saved);
   if(preview&&previewData){
    const savedStore=localStorage.getItem(storeKey);
    if(savedStore){const parsed=JSON.parse(savedStore) as PreviewStore;if(Array.isArray(parsed.houses)&&parsed.records){setHouses(parsed.houses);setRecords(parsed.records);if(!saved)setSelected(parsed.houses[0]?.id??null);return;}}
    const legacy=localStorage.getItem('mabena-house-preview-v2');const original=legacy?JSON.parse(legacy):previewData;
    const house:House={id:seedId,name:original.settings?.house_name??'Mabena House',currency:original.settings?.currency??'',created_by:null,archived_at:null,created_at:new Date().toISOString()};
    const next={houses:[house],records:{[house.id]:legacyPreview(original,house)}};setHouses(next.houses);setRecords(next.records);if(!saved)setSelected(house.id);localStorage.setItem(storeKey,JSON.stringify(next));
   }
  }catch{setError('Unable to read browser storage. Preview changes may not persist.');if(preview&&previewData){const h:House={id:seedId,name:previewData.settings.house_name,currency:previewData.settings.currency,created_by:null,archived_at:null,created_at:new Date().toISOString()};setHouses([h]);setRecords({[h.id]:previewData});setSelected(h.id);}}
 },[preview,previewData]);
 useEffect(()=>{
  if(!db)return;let active=true;
  void db.auth.getSession().then(({data,error})=>{if(active){setUser(data.session?.user??null);setReady(true);if(error)setError(error.message);}});
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{if(!active)return;setUser(session?.user??null);setReady(true);if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_OUT'){version.current++;setHouses([]);setRecords({});choose(null);}});
  return()=>{active=false;version.current++;subscription.unsubscribe();};
 },[db,choose]);
 const loadHouses=useCallback(async()=>{
  if(!db||!user)return;const request=++version.current;setLoading(true);
  try{const r=await db.from('houses').select('*').order('created_at');if(r.error)throw r.error;if(request!==version.current)return;setHouses(r.data as House[]);if(selectedRef.current&&!r.data.some(h=>h.id===selectedRef.current))choose(null);setError('');}
  catch(e){if(request===version.current){setError(e instanceof Error?e.message:'Unable to load house projects. Check your connection and database migration.');setHouses([]);}}
  finally{if(request===version.current)setLoading(false);}
 },[db,user,choose]);
 useEffect(()=>{void loadHouses();const focus=()=>void loadHouses();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[loadHouses]);
 function persist(nextHouses:House[],nextRecords:PreviewStore['records']){setHouses(nextHouses);setRecords(nextRecords);try{localStorage.setItem(storeKey,JSON.stringify({houses:nextHouses,records:nextRecords}));}catch{setError('Browser storage is unavailable. Preview changes will not persist after a reload.');}}
 const changeHouse=(house:House)=>{setHouses(old=>old.map(h=>h.id===house.id?house:h));if(preview){const nextHouses=houses.map(h=>h.id===house.id?house:h);const nextRecords={...records,[house.id]:{...records[house.id],settings:{id:house.id,house_name:house.name,currency:house.currency}}};persist(nextHouses,nextRecords);}};
 async function create(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');setBusy(true);const f=new FormData(e.currentTarget);const parsed=settingsSchema.safeParse({house_name:f.get('house_name'),currency:f.get('currency')});if(!parsed.success){setError(parsed.error.issues[0].message);setBusy(false);return;}
  try{
   if(preview){const h:House={id:crypto.randomUUID(),name:parsed.data.house_name,currency:parsed.data.currency,created_by:null,archived_at:null,created_at:new Date().toISOString()};persist([...houses,h],{...records,[h.id]:starterData(h)});choose(h.id);}
   else{const r=await db!.rpc('create_house',{house_name:parsed.data.house_name,house_currency:parsed.data.currency});if(r.error)throw r.error;choose(r.data as string);await loadHouses();}
   setCreating(false);
  }catch(e){setError(e&&typeof e==='object'&&'message'in e?String(e.message):'Unable to create house.');}finally{setBusy(false);}
 }
 if(!configured&&!preview)return <Setup/>;
 if(!ready)return <main className="loading-screen"><div className="spinner"/><p>Opening Budget My House…</p></main>;
 if(configured&&(!user||recovery))return <Auth recovery={recovery} onRecovered={()=>setRecovery(false)}/>;
 if(inviteToken)return <InvitationLanding token={inviteToken} user={user} onSuccess={id=>window.location.assign('/?house='+encodeURIComponent(id))}/>;
 const active=houses.find(h=>h.id===selected);
 if(active)return <Tracker key={active.id} previewData={preview?records[active.id]??starterData(active):null} house={active} houses={houses} sessionUser={user} onSelect={choose} onBack={()=>choose(null)} onDataChange={next=>persist(houses,{...records,[active.id]:next})} onHouseChange={changeHouse} onAccessLost={()=>{choose(null);void loadHouses();}}/>;
 return <main className="houses-page"><header className="houses-header"><a href="/" className="houses-brand"><HouseIcon size={26}/>Budget My House</a><div className="heading-actions">{!preview&&<><button className="button secondary" disabled={loading} onClick={()=>void loadHouses()}><RefreshCw size={15}/>Refresh</button><button className="button secondary" onClick={()=>void db!.auth.signOut()}><LogOut size={15}/>Sign out</button></>}</div></header>
  {preview&&<div className="preview-note">Local preview: house records stay on this browser. Shared ownership requires Supabase.</div>}
  <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Your house projects</h1><p>Keep each house’s plan, budget and payments together.</p></div><button className="button primary" onClick={()=>setCreating(true)}><Plus size={17}/>New house project</button></div>
  {error&&<div className="alert error" role="alert">{error}</div>}
  {creating&&<section className="panel house-create"><h2>Create a house project</h2><form onSubmit={create}><label className="field">House name<input name="house_name" maxLength={120} required autoFocus/></label><label className="field">Currency code<input name="currency" maxLength={3} placeholder="TZS, USD, ZAR, or blank"/></label><p className="field-hint">Includes 20 stages and 42 starter items. Budgets are blank and no payments are copied.</p><div className="heading-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setCreating(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Creating…':'Create house'}</button></div></form></section>}
  {loading&&!houses.length?<div className="loading-screen"><div className="spinner"/></div>:<div className="houses-grid">{houses.map(h=><button className="house-card" key={h.id} onClick={()=>choose(h.id)}><span className="house-card-icon"><HouseIcon size={25}/></span><span className="house-card-name">{h.name}</span><span className="house-card-meta">{h.currency||'Original units'} · {h.archived_at?'Archived':'Active'} · Co-owner workspace</span><span className="house-card-open">Open house <ArrowUpRight size={15}/></span></button>)}</div>}
  {!loading&&!houses.length&&<section className="panel empty"><HouseIcon size={30}/><p>You have no house projects yet. Create one or accept an invitation.</p></section>}
 </main>;
}
function InvitationLanding({token,user,onSuccess}:{token:string;user:User|null;onSuccess:(id:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const db=getSupabase();
 return <main className="auth-shell"><section className="auth-card"><span className="auth-logo"><HouseIcon size={28}/></span><div className="eyebrow">BUDGET MY HOUSE</div><h1>Become a house co-owner</h1><p>Accept this invitation to manage the house’s budgets, payments, tasks and ownership together.</p><p>Signed in as <strong>{user?.email}</strong>. This must match the invited email address.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary full-width" disabled={busy||!db||!/^[a-f0-9]{64}$/.test(token)} onClick={async()=>{setBusy(true);setError('');try{const r=await db!.rpc('accept_house_invitation',{token});if(r.error)throw r.error;onSuccess(r.data as string);}catch(e){setError(e&&typeof e==='object'&&'message'in e?String(e.message):'Unable to accept invitation.');setBusy(false);}}}>{busy?'Accepting…':'Accept invitation'}</button>{!/^[a-f0-9]{64}$/.test(token)&&<p className="form-error">This invitation link is invalid.</p>}<button className="auth-switch" onClick={()=>void db?.auth.signOut()}>Sign in with another account</button><a className="auth-switch" href="/">Back to house projects</a></section></main>;
}

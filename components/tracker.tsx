'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { House, LayoutDashboard, Layers3, Package, Wallet, ListChecks, Settings2, Plus, ArrowUpRight, ArrowDownToLine, Search, Pencil, Trash2, X, LogOut, RefreshCw, Check, ChevronRight, CalendarDays, ShieldCheck, CircleHelp, Menu } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import Ownership from './ownership';
import { csvText, dateFormat, itemSchema, MAX_AMOUNT, moneyFormat, paymentSchema, stageSchema, settingsSchema, summarize, taskSchema, today } from '@/lib/model';
import { stageStatuses, taskStatuses, type House as HouseProject, type HouseData, type Item, type Payment, type Stage, type TableName, type Task } from '@/lib/types';
type View = 'overview' | 'stages' | 'items' | 'payments' | 'tasks' | 'settings' | 'ownership';
type Row = Stage | Item | Payment | Task;
type Edit = {
    kind: TableName;
    row?: Row;
    stageId?: string;
    itemId?: string;
};
const empty: HouseData = { stages: [], items: [], payments: [], tasks: [], settings: { house_name: 'Mabena House', currency: '' } };
const navigation = [
    { view: 'overview', label: 'Overview', icon: LayoutDashboard }, { view: 'stages', label: 'Stages & budgets', icon: Layers3 },
    { view: 'items', label: 'Budget items', icon: Package }, { view: 'payments', label: 'Payments', icon: Wallet },
    { view: 'tasks', label: 'Project plan', icon: ListChecks }, { view: 'ownership', label: 'Ownership', icon: ShieldCheck }, { view: 'settings', label: 'Settings', icon: Settings2 },
] as const;
const headings: Record<View, [
    string,
    string
]> = {
    overview: ['Your house, in perspective', 'A clear view of your plans, budgets and every payment.'],
    stages: ['Stages & budgets', 'Set your estimates and follow each stage of construction.'],
    items: ['Budget items', 'Plan materials and services, then record payments against them.'],
    payments: ['Every payment, accounted for', 'Keep a record of what you paid, when and to whom.'],
    tasks: ['The plan ahead', 'Turn the remaining work into manageable next steps.'],
    settings: ['House settings', 'Make this tracker yours.'],
    ownership: ['Shared ownership', 'Manage the people who own this house project.'],
};
function message(error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503')
        return 'This record has linked payments. Remove or reassign those payments first.';
    if (error && typeof error === 'object' && 'code' in error && ['42P01', '42883'].includes(String(error.code)))
        return 'Database setup is incomplete. Run supabase/schema.sql in your Supabase SQL Editor, then refresh.';
    return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Something went wrong. Please try again.';
}
export default function Tracker({ previewData, house, houses, sessionUser, onSelect, onBack, onDataChange, onHouseChange, onAccessLost }: {
    previewData: HouseData | null;
    house: HouseProject; houses: HouseProject[]; sessionUser: User|null;
    onSelect:(id:string)=>void; onBack:()=>void;
    onDataChange:(data:HouseData)=>void; onHouseChange:(house:HouseProject)=>void; onAccessLost:()=>void;
}) {
    const [data, setData] = useState<HouseData>(previewData ?? {...empty,settings:{id:house.id,house_name:house.name,currency:house.currency}});
    const user=sessionUser;
    const [currentHouse,setCurrentHouse]=useState(house);
    const callbacks=useRef({onHouseChange,onAccessLost});callbacks.current={onHouseChange,onAccessLost};
    useEffect(()=>setCurrentHouse(house),[house]);
    const readOnly=Boolean(currentHouse.archived_at);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [view, setView] = useState<View>('overview');
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [edit, setEdit] = useState<Edit | null>(null);
    const [deletion, setDeletion] = useState<{
        kind: TableName;
        row: Row;
    } | null>(null);
    const [mobileMenu, setMobileMenu] = useState(false);
    const loadVersion = useRef(0);
    const preview = previewData !== null;
    const db = getSupabase();
    const load = useCallback(async () => {
        if (!db || !user)
            return;
        const version = ++loadVersion.current;
        setLoading(true);
        setError('');
        try {
            const results = await Promise.all([
                db.from('stages').select('*').eq('house_id',house.id).order('sort_order').order('created_at'),
                db.from('items').select('*').eq('house_id',house.id).order('sort_order'),
                db.from('payments').select('*').eq('house_id',house.id).order('created_at'),
                db.from('tasks').select('*').eq('house_id',house.id).order('created_at'),
                db.from('houses').select('*').eq('id',house.id).single(),
            ]);
            for (const result of results)
                if (result.error)
                    throw result.error;
            if (version !== loadVersion.current)
                return;
            setCurrentHouse(results[4].data as HouseProject);
            callbacks.current.onHouseChange(results[4].data as HouseProject);
            setData({ stages: results[0].data as Stage[], items: results[1].data as Item[], payments: results[2].data as Payment[], tasks: results[3].data as Task[], settings: {id:house.id,house_name:results[4].data!.name,currency:results[4].data!.currency} });
        }
        catch (e) {
            if(version!==loadVersion.current)return;
            setData({...empty,settings:{id:house.id,house_name:house.name,currency:house.currency}});
            setError(message(e));
            if(e && typeof e==='object' && 'code' in e && e.code==='PGRST116')callbacks.current.onAccessLost();
            throw e;
        }
        finally {
            setLoading(false);
        }
    }, [db, user, house.id]);
    useEffect(() => { if (user)
        void load().catch(() => { }); }, [user, load]);
    useEffect(()=>{const refresh=()=>{if(!preview)void load().catch(()=>{});};window.addEventListener('focus',refresh);return()=>{loadVersion.current++;window.removeEventListener('focus',refresh);};},[load,preview]);
    useEffect(() => { if (!notice)
        return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
    const storePreview=(next:HouseData)=>{setData(next);onDataChange(next);};
    const summary = useMemo(() => summarize(data), [data]);
    const money = (n: number) => moneyFormat(n, data.settings.currency);
    const stageName = (id: string) => data.stages.find(p => p.id === id)?.name ?? 'Unknown stage';
    const itemName = (id: string | null) => id ? data.items.find(i => i.id === id)?.name ?? 'Unknown item' : '';
    const go = (next: View) => { setView(next); setSearch(''); setStageFilter(''); setStatusFilter(''); setMobileMenu(false); };
    async function save(kind: TableName, raw: unknown, id?: string) {
        if(readOnly)throw new Error('Restore this archived house before editing.');
        const schemas = { stages: stageSchema, items: itemSchema, payments: paymentSchema, tasks: taskSchema };
        const parsed = schemas[kind].safeParse(raw);
        if (!parsed.success)
            throw new Error(parsed.error.issues[0].message);
        const payload = parsed.data;
        if (kind !== 'stages' && 'stage_id' in payload && !data.stages.some(p => p.id === payload.stage_id))
            throw new Error('Choose a valid stage.');
        if (kind === 'payments') {
            const p = parsed.data as Payment;
            if (p.item_id && !data.items.some(i => i.id === p.item_id && i.stage_id === p.stage_id))
                throw new Error('Choose an item from the selected stage.');
        }
        setBusy(true);
        setError('');
        try {
            if (preview) {
                const record = { ...parsed.data, id: id ?? crypto.randomUUID(), house_id:house.id, created_at: new Date().toISOString() };
                const list = data[kind] as Row[];
                storePreview({ ...data, [kind]: id ? list.map(r => r.id === id ? { ...r, ...parsed.data } : r) : [...list, record] });
            }
            else {
                if (!db || !user)
                    throw new Error('Sign in to save changes.');
                const query = id ? db.from(kind).update(parsed.data).eq('id', id).eq('house_id',house.id) : db.from(kind).insert({ ...parsed.data, house_id:house.id });
                const result = await query.select('id');
                if (result.error) {
                    if(result.error.code==='42501')await load().catch(()=>{});
                    throw result.error;
                }
                if (!result.data?.length) {
                    await load().catch(()=>{});
                    throw new Error('The record was not saved. Refresh and try again.');
                }
                await load();
            }
            setNotice('Changes saved.');
            setEdit(null);
        }
        finally {
            setBusy(false);
        }
    }
    async function remove() {
        if(readOnly)return;
        if (!deletion)
            return;
        const { kind, row } = deletion;
        setBusy(true);
        setError('');
        try {
            if (preview) {
                if (kind === 'stages' && data.payments.some(p => p.stage_id === row.id) || kind === 'items' && data.payments.some(p => p.item_id === row.id))
                    throw new Error('This record has linked payments. Remove or reassign those payments first.');
                const next = { ...data, [kind]: data[kind].filter(r => r.id !== row.id) };
                if (kind === 'stages') {
                    next.items = data.items.filter(i => i.stage_id !== row.id);
                    next.tasks = data.tasks.filter(t => t.stage_id !== row.id);
                }
                storePreview(next);
            }
            else {
                if (!db || !user)
                    throw new Error('Sign in to delete.');
                const r = await db.from(kind).delete().eq('id', row.id).eq('house_id',house.id).select('id');
                if (r.error)
                    throw r.error;
                if (!r.data?.length) {
                    await load().catch(()=>{});
                    throw new Error('Record not found. Refresh and try again.');
                }
                await load();
            }
            setDeletion(null);
            setNotice('Record deleted.');
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function toggleTask(task: Task) { try {
        await save('tasks', { ...task, status: task.status === 'Done' ? 'To do' : 'Done' }, task.id);
    }
    catch (e) {
        setError(message(e));
    } }
    function exportCSV() {
        let rows: (string | number | null)[][];
        if (view === 'payments')
            rows = [['SN', 'Stage', 'Item', 'Date', 'Reference', 'Description', 'Paid', 'Payee', 'Receipt'], ...filteredPayments.map((p, i) => [i + 1, stageName(p.stage_id), itemName(p.item_id), p.payment_date, p.reference, p.description, p.amount, p.payee, p.receipt])];
        else if (view === 'tasks')
            rows = [['SN', 'Stage', 'Task', 'Status', 'Due date', 'Notes'], ...filteredTasks.map((t, i) => [i + 1, stageName(t.stage_id), t.title, t.status, t.due_date, t.notes])];
        else if (view === 'items')
            rows = [['SN', 'Stage', 'Item', 'Unit', 'Budget', 'Paid', 'Remaining', 'Notes'], ...filteredItems.map((x, i) => { const paid = itemSpent(x.id); return [i + 1, stageName(x.stage_id), x.name, x.unit, x.budget, paid, x.budget === null ? null : x.budget - paid, x.notes]; })];
        else
            rows = [['SN', 'Stage', 'Status', 'Budget', 'Paid', 'Remaining', 'Start date', 'Target date', 'Notes'], ...filteredStages.map((p, i) => [i + 1, p.name, p.status, p.budget, p.spent, p.remaining, p.start_date, p.target_date, p.notes])];
        rows[0].unshift('House');rows.slice(1).forEach(r=>r.unshift(data.settings.house_name));
        const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.settings.house_name.replace(/[^a-z0-9]/gi,'-')}-${view}-${today()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
    const matches = (...parts: (string | null | undefined)[]) => parts.join(' ').toLowerCase().includes(search.trim().toLowerCase());
    const filteredStages = summary.rows.filter(p => matches(p.name, p.notes) && (!statusFilter || p.status === statusFilter));
    const filteredItems = data.items.filter(i => (!stageFilter || i.stage_id === stageFilter) && matches(i.name, stageName(i.stage_id), i.notes));
    const filteredPayments = data.payments.filter(p => (!stageFilter || p.stage_id === stageFilter) && matches(p.description, p.reference, p.payee, stageName(p.stage_id), itemName(p.item_id)));
    const filteredTasks = data.tasks.filter(t => (!stageFilter || t.stage_id === stageFilter) && (!statusFilter || t.status === statusFilter) && matches(t.title, stageName(t.stage_id), t.notes));
    const itemSpent = (id: string) => data.payments.filter(p => p.item_id === id).reduce((n, p) => n + p.amount, 0);
    const stageSelect = <select aria-label="Filter by stage" value={stageFilter} onChange={e => setStageFilter(e.target.value)}><option value="">All stages</option>{data.stages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
    const actions = (kind: TableName, row: Row) => <div className="row-actions"><button className="icon-button" aria-label={`Edit ${'name' in row ? row.name : 'title' in row ? row.title : row.description}`} onClick={() => setEdit({ kind, row })} disabled={busy||readOnly}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`Delete ${'name' in row ? row.name : 'title' in row ? row.title : row.description}`} onClick={() => setDeletion({ kind, row })} disabled={busy||readOnly}><Trash2 size={15}/></button></div>;
    return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <a href="#" className="brand" onClick={e => { e.preventDefault(); go('overview'); }}><span className="brand-mark"><House size={23}/></span><span>BUDGET<span className="brand-sub">MY HOUSE</span></span></a>
      <div className="house-switch"><label htmlFor="house-switch">HOUSE PROJECT</label><select id="house-switch" value={house.id} disabled={busy} onChange={e=>onSelect(e.target.value)}>{houses.map(h=><option key={h.id} value={h.id}>{h.name}{h.archived_at?' (archived)':''}</option>)}</select><button onClick={onBack} disabled={busy}>All house projects</button></div><div className="sidebar-rule"/><div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({ view: v, label, icon: Icon }) => <button key={v} aria-label={label} aria-current={view === v ? 'page' : undefined} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => go(v)}><Icon size={19}/>{label}{v === 'tasks' && data.tasks.filter(t => t.status !== 'Done').length > 0 && <span className="nav-count">{data.tasks.filter(t => t.status !== 'Done').length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="house-mini"><House size={20}/><div><strong>{data.settings.house_name}</strong><span>Shared house workspace.</span></div></div><div className="account"><span className="avatar">{user?.email?.charAt(0).toUpperCase() ?? 'M'}</span><div><strong>{preview ? 'Local preview' : user?.email?.split('@')[0]}</strong><span>{preview ? 'Saved on this browser' : 'Private workspace'}</span></div>{!preview && <button className="icon-button light" aria-label="Sign out" onClick={async () => { const r = await db!.auth.signOut(); if (r.error)
        setError(message(r.error));
    else {
        setData(empty);
        setView('overview');
    } }}><LogOut size={17}/></button>}</div></div>
    </aside>
    {mobileMenu && <button className="menu-backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)}/>}
    <div className="main-wrap"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-toggle" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={21}/></button><House size={16}/><span>{data.settings.house_name}</span><ChevronRight size={14}/><strong>{navigation.find(n => n.view === view)?.label}</strong></div><div className="connection"><span className="connection-dot"/>{preview ? 'Local preview' : 'Database connected'}{!preview && <button className="icon-button" aria-label="Refresh data" disabled={loading || busy} onClick={() => void load().catch(() => { })}><RefreshCw size={15} className={loading ? 'spinning' : ''}/></button>}</div></header>
    <main className="main-content">
      {preview && <div className="preview-note"><CircleHelp size={16}/><span>Preview mode: changes stay on this browser. Connect Supabase for your private online tracker.</span></div>}
      {readOnly&&<div className="alert warning">This house is archived. Restore it in Ownership to make changes.</div>}
      {error && <div className="alert error" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
      {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
      <div className="page-heading"><div><div className="eyebrow">{view === 'overview' ? 'PROJECT OVERVIEW' : 'HOUSE WORKSPACE'}</div><h1>{headings[view][0]}</h1><p>{headings[view][1]}</p></div><div className="heading-actions">{view !== 'settings' && view !== 'ownership' && <button className="button secondary" onClick={exportCSV}><ArrowDownToLine size={16}/>Export CSV</button>}{view!=='ownership'&&<button className="button primary" disabled={loading || busy||readOnly} onClick={() => setEdit({ kind: view === 'items' ? 'items' : view === 'tasks' ? 'tasks' : view === 'stages' ? 'stages' : 'payments' })}><Plus size={17}/>{view === 'items' ? 'Add item' : view === 'tasks' ? 'Add task' : view === 'stages' ? 'Add stage' : 'Add payment'}</button>}</div></div>
      {loading && data.stages.length === 0 ? <section className="panel loading-screen"><div className="spinner"/><p>Loading your stages…</p></section> : <>
      {view === 'overview' && <>
        <div className="stats-grid"><Stat label="TOTAL PAID" value={money(summary.totalSpent)} note={`${data.payments.length} recorded payments`} icon={<Wallet size={19}/>} primary/><Stat label="KNOWN STAGE BUDGETS" value={money(summary.knownBudget)} note={`${data.stages.length - summary.unknownCount} of ${data.stages.length} stages estimated`} icon={<Layers3 size={19}/>}/><Stat label="REMAINING ON KNOWN BUDGETS" value={money(summary.remaining)} note="Only stages with an estimate" icon={<ArrowUpRight size={19}/>} negative={summary.remaining < 0}/><Stat label="STAGES COMPLETE" value={`${summary.completed} / ${data.stages.length}`} note={`${data.tasks.filter(t => t.status !== 'Done').length} open planning tasks`} icon={<ListChecks size={19}/>}/></div>
        {summary.unknownCount > 0 && <div className="budget-note"><span className="note-icon"><CircleHelp size={18}/></span><p><strong>{summary.unknownCount} stages still need a budget.</strong> {money(summary.unbudgetedSpent)} has been spent on these stages. The complete house budget is not yet set.</p><button onClick={() => go('stages')}>Set budgets <ChevronRight size={15}/></button></div>}
        <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h2>Where the money goes</h2><p>Paid amounts by construction stage</p></div><span className="small-label">{data.settings.currency || 'Original units'}</span></div><div className="spending-bars">{summary.rows.filter(p => p.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 7).map(p => <div className="spending-row" key={p.id}><div className="bar-label"><span>{p.name}</span><strong>{money(p.spent)}</strong></div><div className="bar-track"><div style={{ width: `${summary.totalSpent ? p.spent / summary.totalSpent * 100 : 0}%` }}/></div></div>)}{!summary.totalSpent && <Empty text="Your spending breakdown will appear after the first payment."/>}</div><div className="panel-footer"><span>Showing up to 7 highest-spend stages</span><button onClick={() => go('stages')}>All stages <ArrowUpRight size={15}/></button></div></section>
        <section className="panel"><div className="panel-heading"><div><h2>Next on the plan</h2><p>Upcoming work for your house</p></div><span className="icon-tile"><CalendarDays size={18}/></span></div><div className="next-tasks">{data.tasks.filter(t => t.status !== 'Done').sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 4).map(t => <div className="next-task" key={t.id}><button className="task-check" aria-label={`Complete ${t.title}`} disabled={busy||readOnly} onClick={() => void toggleTask(t)}/><div><strong>{t.title}</strong><span>{stageName(t.stage_id)}</span><small className={t.due_date && t.due_date < today() ? 'overdue' : ''}>{t.due_date ? dateFormat(t.due_date) : 'Set a due date'}</small></div><button className="icon-button" aria-label={`Edit ${t.title}`} onClick={() => setEdit({ kind: 'tasks', row: t })}><ChevronRight size={17}/></button></div>)}{!data.tasks.some(t => t.status !== 'Done') && <Empty text="No open tasks. Add a task to plan your next stage."/>}</div><div className="panel-footer"><span>{data.tasks.filter(t => t.status !== 'Done').length} open tasks</span><button onClick={() => go('tasks')}>View plan <ArrowUpRight size={15}/></button></div></section></div>
        <section className="panel"><div className="panel-heading"><div><h2>Recent payments</h2><p>The latest entries in your payment record</p></div><button className="text-button" onClick={() => go('payments')}>All payments <ArrowUpRight size={16}/></button></div><div className="table-scroll"><table><thead><tr><th>SN</th><th>Description</th><th>Stage</th><th>Date / reference</th><th className="numeric">Paid</th></tr></thead><tbody>{data.payments.slice(-5).reverse().map((p, i) => <tr key={p.id}><td className="sn">{i + 1}</td><td className="description-cell"><strong>{p.description}</strong>{p.payee && <small>{p.payee}</small>}</td><td>{stageName(p.stage_id)}</td><td>{p.payment_date ? dateFormat(p.payment_date) : p.reference || 'No date'}</td><td className="numeric amount">{money(p.amount)}</td></tr>)}</tbody></table></div>{!data.payments.length && <Empty text="No payments yet. Add your first payment."/>}</section>
      </>}
      {['stages', 'items', 'payments', 'tasks'].includes(view) && <section className="panel"><div className="table-toolbar"><div className="search-box"><Search size={17}/><input aria-label="Search records" placeholder={`Search ${view === 'tasks' ? 'tasks' : view}…`} value={search} onChange={e => setSearch(e.target.value)}/></div><div className="filters">{view !== 'stages' && stageSelect}{(view === 'stages' || view === 'tasks') && <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All statuses</option>{(view === 'stages' ? stageStatuses : taskStatuses).map(s => <option key={s}>{s}</option>)}</select>}</div></div>
        {view === 'stages' && <><div className="table-scroll"><table><thead><tr><th>SN</th><th>Stage</th><th>Progress</th><th className="numeric">Budget</th><th className="numeric">Paid</th><th className="numeric">Remaining</th><th>Target date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredStages.map((p, i) => <tr key={p.id}><td className="sn">{i + 1}</td><td className="description-cell"><strong>{p.name}</strong>{p.budget === null && <small>Estimate needed</small>}</td><td><Status value={p.status}/></td><td className="numeric">{p.budget === null ? <span className="muted">Not set</span> : money(p.budget)}</td><td className="numeric amount">{money(p.spent)}</td><td className={`numeric ${p.remaining !== null && p.remaining < 0 ? 'overdue' : ''}`}>{p.remaining === null ? '—' : money(p.remaining)}</td><td>{dateFormat(p.target_date)}</td><td>{actions('stages', p)}</td></tr>)}</tbody></table></div>{!filteredStages.length && <Empty text="No stages found. Add a stage or adjust your filters."/>}<div className="panel-footer"><span>{filteredStages.length} stages</span><span>Unknown budgets stay blank.</span></div></>}
        {view === 'items' && <><div className="inline-note">Item budgets break down your stage estimates. They are shown separately and are not added to stage budgets.</div><div className="table-scroll"><table><thead><tr><th>SN</th><th>Item</th><th>Stage</th><th className="numeric">Item budget</th><th className="numeric">Paid</th><th className="numeric">Remaining</th><th>Pay</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredItems.map((x, i) => { const paid = itemSpent(x.id), remaining = x.budget === null ? null : x.budget - paid; return <tr key={x.id}><td className="sn">{i + 1}</td><td className="description-cell"><strong>{x.name}</strong><small>{x.unit || 'Material / service'}</small></td><td>{stageName(x.stage_id)}</td><td className="numeric">{x.budget === null ? <span className="muted">Not set</span> : money(x.budget)}</td><td className="numeric amount">{money(paid)}</td><td className={`numeric ${remaining !== null && remaining < 0 ? 'overdue' : ''}`}>{remaining === null ? '—' : money(remaining)}</td><td><button className="pay-button" disabled={readOnly||busy} onClick={() => setEdit({ kind: 'payments', stageId: x.stage_id, itemId: x.id })}><Plus size={13}/>Pay</button></td><td>{actions('items', x)}</td></tr>; })}</tbody></table></div>{!filteredItems.length && <Empty text="No items found. Add an item or choose a different stage."/>}<div className="panel-footer"><span>{filteredItems.length} items</span><span>Older payments are stage-level until you link an item.</span></div></>}
        {view === 'payments' && <><div className="table-scroll"><table><thead><tr><th>SN</th><th>Date / reference</th><th>Description</th><th>Stage / item</th><th>Payee</th><th className="numeric">Paid</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredPayments.map((p, i) => <tr key={p.id}><td className="sn">{i + 1}</td><td><strong className="date-label">{p.payment_date ? dateFormat(p.payment_date) : 'No date'}</strong><small className="cell-sub">{p.reference}</small></td><td className="description-cell"><strong>{p.description}</strong>{p.receipt && <small>Receipt: {p.receipt}</small>}</td><td>{stageName(p.stage_id)}{p.item_id && <small className="cell-sub">{itemName(p.item_id)}</small>}</td><td>{p.payee || '—'}</td><td className="numeric amount">{money(p.amount)}</td><td>{actions('payments', p)}</td></tr>)}</tbody></table></div>{!filteredPayments.length && <Empty text="No payments found. Add a payment or adjust your filters."/>}<div className="panel-footer"><span>{filteredPayments.length} payments</span><strong>Shown total: {money(filteredPayments.reduce((n, p) => n + p.amount, 0))}</strong></div></>}
        {view === 'tasks' && <><div className="table-scroll"><table><thead><tr><th>SN</th><th>Done</th><th>Task</th><th>Stage</th><th>Status</th><th>Due date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredTasks.map((t, i) => <tr key={t.id} className={t.status === 'Done' ? 'task-complete' : ''}><td className="sn">{i + 1}</td><td><button className={`task-check ${t.status === 'Done' ? 'checked' : ''}`} disabled={busy||readOnly} aria-label={`${t.status === 'Done' ? 'Reopen' : 'Complete'} ${t.title}`} onClick={() => void toggleTask(t)}>{t.status === 'Done' && <Check size={13}/>}</button></td><td className="description-cell"><strong>{t.title}</strong>{t.notes && <small>{t.notes}</small>}</td><td>{stageName(t.stage_id)}</td><td><Status value={t.status}/></td><td className={t.due_date && t.due_date < today() && t.status !== 'Done' ? 'overdue' : ''}>{dateFormat(t.due_date)}</td><td>{actions('tasks', t)}</td></tr>)}</tbody></table></div>{!filteredTasks.length && <Empty text="No tasks found. Add a task or adjust your filters."/>}<div className="panel-footer"><span>{filteredTasks.length} tasks</span><span>Check a task to mark it done.</span></div></>}
      </section>}
      {view==='ownership'&&<Ownership house={currentHouse} user={user} preview={preview} onHouseChange={onHouseChange} onAccessLost={onAccessLost}/>}
      {view === 'settings' && <SettingsForm data={data} busy={busy||readOnly} onSave={async (raw) => { const parsed = settingsSchema.safeParse(raw); if (!parsed.success)
            throw new Error(parsed.error.issues[0].message); setBusy(true); try {
            if (preview)
                {storePreview({ ...data, settings: parsed.data });onHouseChange({...currentHouse,name:parsed.data.house_name,currency:parsed.data.currency});}
            else {
                const r = await db!.rpc('update_house',{hid:house.id,house_name:parsed.data.house_name,house_currency:parsed.data.currency});
                if (r.error)
                    throw r.error;
                
                await load();
            }
            setNotice('Settings saved.');
        }
        finally {
            setBusy(false);
        } }}/>}
      </>}
      <footer className="workspace-footer"><span><ShieldCheck size={14}/>{preview ? 'Local preview workspace' : 'Access limited to this house’s owners'}</span><span>Budget My House</span></footer>
    </main></div>
    {edit && <Editor edit={edit} data={data} busy={busy} onClose={() => { if (!busy)
        setEdit(null); }} onSave={save}/>}
    {deletion && <Modal title="Delete this record?" onClose={() => { if (!busy)
        setDeletion(null); }}><p className="modal-copy">This removes <strong>{'name' in deletion.row ? deletion.row.name : 'title' in deletion.row ? deletion.row.title : deletion.row.description}</strong>. {deletion.kind === 'stages' ? 'Linked items and tasks will also be removed. Stages with payments cannot be deleted.' : 'This cannot be undone.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy||readOnly} onClick={() => setDeletion(null)}>Cancel</button><button className="button destructive" disabled={busy||readOnly} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete record'}</button></div></Modal>}
  </div>;
}
function Stat({ label, value, note, icon, primary, negative }: {
    label: string;
    value: string;
    note: string;
    icon: ReactNode;
    primary?: boolean;
    negative?: boolean;
}) { return <section className={`stat ${primary ? 'stat-primary' : ''}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className={negative ? 'overdue' : ''}>{value}</strong><p>{note}</p></section>; }
function Status({ value }: {
    value: string;
}) { return <span className={`status status-${value.toLowerCase().replaceAll(' ', '-')}`}><span />{value}</span>; }
function Empty({ text }: {
    text: string;
}) { return <div className="empty"><House size={26}/><p>{text}</p></div>; }
function Modal({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { ref.current?.showModal(); }, []);
    return <dialog ref={ref} aria-label={title} className="modal" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) {
        const b = ref.current.getBoundingClientRect();
        if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
            onClose();
    } }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
function Field({ label, name, value, type = 'text', required = false, maxLength, children }: {
    label: string;
    name: string;
    value?: string | number | null;
    type?: string;
    required?: boolean;
    maxLength?: number;
    children?: ReactNode;
}) { return <label className="field"><span>{label}{required && <span className="required" aria-hidden="true"> *</span>}</span>{children ?? <input name={name} type={type} defaultValue={value ?? ''} required={required} maxLength={maxLength} min={type === 'number' ? 0 : undefined} max={type === 'number' ? MAX_AMOUNT : undefined} step={type === 'number' ? 1 : undefined}/>}</label>; }
function Editor({ edit, data, busy, onClose, onSave }: {
    edit: Edit;
    data: HouseData;
    busy: boolean;
    onClose: () => void;
    onSave: (kind: TableName, raw: unknown, id?: string) => Promise<void>;
}) {
    const r = edit.row;
    const [stage, setStage] = useState(r && 'stage_id' in r ? r.stage_id : edit.stageId ?? data.stages[0]?.id ?? '');
    const [item, setItem] = useState(r && 'item_id' in r ? r.item_id ?? '' : edit.itemId ?? '');
    const [error, setError] = useState('');
    const kind = edit.kind;
    const name = kind === 'stages' ? 'stage' : kind === 'items' ? 'item' : kind === 'tasks' ? 'task' : 'payment';
    const stageRow = kind === 'stages' ? r as Stage | undefined : undefined;
    const itemRow = kind === 'items' ? r as Item | undefined : undefined;
    const payment = kind === 'payments' ? r as Payment | undefined : undefined;
    const task = kind === 'tasks' ? r as Task | undefined : undefined;
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        const fd = new FormData(e.currentTarget);
        const val = (key: string) => String(fd.get(key) ?? '').trim();
        const nullable = (key: string) => val(key) || null;
        const amount = (key: string) => val(key) === '' ? null : Number(val(key));
        let raw: unknown;
        if (kind === 'stages')
            raw = { name: val('name'), status: val('status'), budget: amount('budget'), start_date: nullable('start_date'), target_date: nullable('target_date'), notes: val('notes'), sort_order: stageRow?.sort_order ?? Math.max(-1, ...data.stages.map(p => p.sort_order)) + 1 };
        else if (kind === 'items')
            raw = { stage_id: stage, name: val('name'), budget: amount('budget'), unit: val('unit'), notes: val('notes'), sort_order: itemRow?.sort_order ?? Math.max(-1, ...data.items.map(i => i.sort_order)) + 1 };
        else if (kind === 'payments')
            raw = { stage_id: stage, item_id: item || null, amount: amount('amount'), payment_date: nullable('payment_date'), reference: val('reference'), description: val('description'), payee: val('payee'), receipt: val('receipt') };
        else
            raw = { stage_id: stage, title: val('title'), due_date: nullable('due_date'), status: val('status'), notes: val('notes') };
        try {
            await onSave(kind, raw, r?.id);
        }
        catch (e) {
            setError(message(e));
        }
    }
    return <Modal title={`${r ? 'Edit' : 'Add'} ${name}`} onClose={onClose}><form onSubmit={submit}><div className="modal-fields">
    {kind !== 'stages' && <Field label="Stage" name="stage_id" required><select name="stage_id" value={stage} required onChange={e => { setStage(e.target.value); setItem(''); }}><option value="" disabled>Choose a stage</option>{data.stages.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>}
    {(kind === 'stages' || kind === 'items') && <Field label={kind === 'stages' ? 'Stage name' : 'Item name'} name="name" value={stageRow?.name ?? itemRow?.name} maxLength={120} required/>}
    {kind === 'stages' && <Field label="Progress" name="status"><select name="status" defaultValue={stageRow?.status ?? 'Not started'}>{stageStatuses.map(s => <option key={s}>{s}</option>)}</select></Field>}
    {(kind === 'stages' || kind === 'items') && <><Field label={`Estimated ${kind === 'items' ? 'item' : 'stage'} budget${data.settings.currency ? ' (' + data.settings.currency + ')' : ''}`} name="budget" value={stageRow?.budget ?? itemRow?.budget} type="number"/><p className="field-hint">Leave blank if the estimate is unknown. Use whole amounts.</p></>}
    {kind === 'items' && <Field label="Unit (e.g. bags, pieces, service)" name="unit" value={itemRow?.unit} maxLength={40}/>}
    {kind === 'stages' && <div className="field-grid"><Field label="Start date" name="start_date" value={stageRow?.start_date} type="date"/><Field label="Target date" name="target_date" value={stageRow?.target_date} type="date"/></div>}
    {kind === 'payments' && <><Field label="Item (optional)" name="item_id"><select name="item_id" value={item} onChange={e => setItem(e.target.value)}><option value="">Stage-level payment</option>{data.items.filter(i => i.stage_id === stage).map(i => <option value={i.id} key={i.id}>{i.name}</option>)}</select></Field><Field label="Description" name="description" value={payment?.description ?? data.items.find(i => i.id === edit.itemId)?.name} required maxLength={500}/><div className="field-grid"><Field label={`Amount paid${data.settings.currency ? ' (' + data.settings.currency + ')' : ''}`} name="amount" value={payment?.amount} type="number" required/><Field label="Payment date" name="payment_date" value={payment ? payment.payment_date : today()} type="date"/></div><Field label="Payee / supplier" name="payee" value={payment?.payee} maxLength={120}/><div className="field-grid"><Field label="Reference / day" name="reference" value={payment?.reference} maxLength={120}/><Field label="Receipt reference" name="receipt" value={payment?.receipt} maxLength={200}/></div></>}
    {kind === 'tasks' && <><Field label="Task" name="title" value={task?.title} required maxLength={200}/><div className="field-grid"><Field label="Status" name="status"><select name="status" defaultValue={task?.status ?? 'To do'}>{taskStatuses.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Due date" name="due_date" value={task?.due_date} type="date"/></div></>}
    {kind !== 'payments' && <Field label="Notes" name="notes"><textarea name="notes" defaultValue={stageRow?.notes ?? itemRow?.notes ?? task?.notes ?? ''} maxLength={2000} rows={3}/></Field>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {kind !== 'stages' && !data.stages.length && <p className="form-error">Add a stage first.</p>}
    </div><div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || (kind !== 'stages' && !data.stages.length)}>{busy ? 'Saving…' : `Save ${name}`}</button></div></form></Modal>;
}
function SettingsForm({ data, busy, onSave }: {
    data: HouseData;
    busy: boolean;
    onSave: (raw: unknown) => Promise<void>;
}) {
    const [error, setError] = useState('');
    return <div className="settings-layout"><section className="panel settings-panel"><div className="panel-heading"><div><h2>House project details</h2><p>Used throughout your workspace</p></div></div><form onSubmit={async (e) => { e.preventDefault(); setError(''); const f = new FormData(e.currentTarget); try {
        await onSave({ house_name: f.get('house_name'), currency: f.get('currency') });
    }
    catch (e) {
        setError(message(e));
    } }}><Field label="House project name" name="house_name" value={data.settings.house_name} required maxLength={120}/><Field label="Currency code" name="currency" value={data.settings.currency} maxLength={3}/><p className="field-hint">For example TZS, USD or ZAR. Leave blank to use original units. Changing the label does not convert amounts.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></form></section><section className="panel source-panel"><h2>Using this house workspace</h2><p>Stage budgets describe the overall construction plan. Item estimates are breakdowns and are not added again to stage budgets.</p><p>Record each payment once. Link it to an item when you want to track that item’s paid amount and balance.</p><p>Owners share access to this house’s records. Use Ownership to invite people, manage owners, or archive this house.</p><p>Export CSV from each list to keep a copy of the selected house’s records.</p></section></div>;
}
export function Setup() { return <main className="auth-shell"><section className="auth-card"><span className="auth-logo"><House size={28}/></span><div className="eyebrow">BUDGET MY HOUSE</div><h1>Connect your house tracker</h1><p>Your app is ready. Connect the database to start managing your house projects.</p><ol className="setup-steps"><li>Create a Supabase project.</li><li>Run <code>supabase/schema.sql</code> in its SQL Editor.</li><li>Add the project URL and publishable key to the two environment variables in <code>.env.example</code>.</li><li>Redeploy on Vercel, then create your account.</li></ol><p className="field-hint">See README.md in the project for the complete setup. For an existing database, run migrate-v2.sql instead. New houses receive templates without copied payments.</p></section></main>; }
export function Auth({ recovery, onRecovered }: {
    recovery: boolean;
    onRecovered: () => void;
}) {
    const [signup, setSignup] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const db = getSupabase()!;
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError('');
        setInfo('');
        const f = new FormData(e.currentTarget);
        const email = String(f.get('email') ?? '').trim();
        const password = String(f.get('password'));
        try {
            if (recovery) {
                const r = await db.auth.updateUser({ password });
                if (r.error)
                    throw r.error;
                onRecovered();
                return;
            }
            const r = signup ? await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin+window.location.pathname } }) : await db.auth.signInWithPassword({ email, password });
            if (r.error)
                throw r.error;
            if (signup && !r.data.session)
                setInfo('Check your email to confirm your account, then sign in.');
        }
        catch (e) {
            setError(message(e));
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="auth-shell"><div className="auth-brand"><House size={30}/><span>BUDGET MY HOUSE</span></div><section className="auth-card"><span className="auth-logo"><House size={28}/></span><div className="eyebrow">YOUR PRIVATE PROJECT WORKSPACE</div><h1>{recovery ? 'Set a new password' : signup ? 'Start tracking your house' : 'Welcome to your house project'}</h1><p>Plans, budgets and payments. All in one place.</p><form onSubmit={submit}>{!recovery && <Field label="Email" name="email" type="email" required/>}<Field label={recovery ? 'New password' : 'Password'} name="password" required><input name="password" type="password" required minLength={signup || recovery ? 12 : 1} autoComplete={signup || recovery ? 'new-password' : 'current-password'}/></Field>{(signup || recovery) && <p className="field-hint">Use at least 12 characters. Confirm your email to create house projects or accept invitations.</p>}{error && <p className="form-error" role="alert">{error}</p>}{info && <p className="form-info" role="status">{info}</p>}<button className="button primary full-width" disabled={busy}>{busy ? 'Please wait…' : recovery ? 'Update password' : signup ? 'Create account' : 'Sign in'}<ArrowUpRight size={17}/></button></form>{!recovery && <><button className="auth-switch" disabled={busy} onClick={() => { setSignup(!signup); setError(''); setInfo(''); }}>{signup ? 'Already have an account? Sign in' : 'Create your account'}</button>{!signup && <button className="auth-switch muted" disabled={busy} onClick={async () => { const email = prompt('Enter your account email:'); if (!email)
        return; setBusy(true); setError(''); const r = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }); if (r.error)
        setError(message(r.error));
    else
        setInfo('If this account exists, a password reset link has been sent.'); setBusy(false); }}>Forgot password?</button>}</>}<div className="auth-foot"><ShieldCheck size={15}/>Only house co-owners can access shared records.</div></section></main>;
}

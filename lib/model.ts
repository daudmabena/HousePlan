import { z } from 'zod';
import { stageStatuses, taskStatuses, type HouseData } from './types';
export const MAX_AMOUNT = 1000000000000;
const money = z.number().int('Use whole amounts.').min(0).max(MAX_AMOUNT);
const text = (max: number) => z.string().trim().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Enter a valid date.').nullable();
export const stageSchema = z.object({ name: text(120).min(1, 'Enter a stage name.'), status: z.enum(stageStatuses), budget: money.nullable(), start_date: date, target_date: date, notes: text(2000), sort_order: z.number().int().nonnegative() }).refine(p => !p.start_date || !p.target_date || p.target_date >= p.start_date, { message: 'Target date must be on or after start date.', path: ['target_date'] });
export const itemSchema = z.object({ stage_id: z.uuid(), name: text(120).min(1, 'Enter an item name.'), budget: money.nullable(), unit: text(40), notes: text(2000), sort_order: z.number().int().nonnegative() });
export const paymentSchema = z.object({ stage_id: z.uuid(), item_id: z.uuid().nullable(), amount: money.min(1, 'Enter a positive amount.'), payment_date: date, reference: text(120), description: text(500).min(1, 'Enter a payment description.'), payee: text(120), receipt: text(200) });
export const taskSchema = z.object({ stage_id: z.uuid(), title: text(200).min(1, 'Enter a task title.'), due_date: date, status: z.enum(taskStatuses), notes: text(2000) });
export const settingsSchema = z.object({ house_name: text(120).min(1), currency: z.string().trim().toUpperCase().regex(/^([A-Z]{3})?$/, 'Use a 3-letter currency code, or leave blank.') });
export function summarize(data: HouseData) {
    const spend = new Map<string, number>();
    data.payments.forEach(p => spend.set(p.stage_id, (spend.get(p.stage_id) ?? 0) + p.amount));
    const rows = data.stages.map(p => ({ ...p, spent: spend.get(p.id) ?? 0, remaining: p.budget === null ? null : p.budget - (spend.get(p.id) ?? 0) }));
    const known = rows.filter(p => p.budget !== null);
    return { rows, totalSpent: data.payments.reduce((n, p) => n + p.amount, 0), knownBudget: known.reduce((n, p) => n + p.budget!, 0), remaining: known.reduce((n, p) => n + p.remaining!, 0), unknownCount: rows.length - known.length, unbudgetedSpent: rows.filter(p => p.budget === null).reduce((n, p) => n + p.spent, 0), completed: rows.filter(p => p.status === 'Complete').length };
}
export function moneyFormat(amount: number, currency = '') {
    return `${currency ? currency + ' ' : ''}${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(amount)}`;
}
export function dateFormat(value: string | null) {
    return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')) : 'No date';
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function csvText(rows: (string | number | null)[][]) {
    return '\ufeff' + rows.map(row => row.map(v => { let s = String(v ?? ''); if (/^[\s]*[=+@-]/.test(s) && typeof v !== 'number')
        s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n');
}

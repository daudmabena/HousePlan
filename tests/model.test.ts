import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../lib/seed.json';
import type { HouseData } from '../lib/types';
import { csvText, itemSchema, paymentSchema, stageSchema, summarize, settingsSchema } from '../lib/model';
const data = seed as HouseData;
test('import reconciles and keeps unknown budgets distinct', () => {
    const result = summarize(data);
    assert.equal(result.totalSpent, 59100000);
    assert.equal(result.knownBudget, 14000000);
    assert.equal(result.remaining, 6000000);
    assert.equal(result.unknownCount, 19);
    assert.equal(result.unbudgetedSpent, 51100000);
    assert.equal(result.rows.find(p => p.name === 'Fence')?.spent, 8000000);
    assert.equal(result.rows.find(p => p.name === 'Foundation')?.remaining, null);
    assert.equal(data.items.length, 42);
});
test('new payments update balance and overspending stays negative', () => {
    const fence = data.stages.find(p => p.name === 'Fence')!;
    const result = summarize({ ...data, payments: [...data.payments, { ...data.payments[0], id: 'extra', stage_id: fence.id, amount: 7000000 }] });
    assert.equal(result.totalSpent, 66100000);
    assert.equal(result.remaining, -1000000);
});
test('zero budget is a known estimate and item budgets are not double counted', () => {
    const result = summarize({ ...data, stages: data.stages.map((p, i) => i === 0 ? { ...p, budget: 0 } : p), items: data.items.map(i => ({ ...i, budget: 100000 })) });
    assert.equal(result.knownBudget, 14000000);
    assert.equal(result.unknownCount, 18);
    assert.equal(result.remaining, 5000000);
});
test('rejects invalid money, missing stages, invalid dates and reversed date ranges', () => {
    const p = data.payments[0];
    assert.equal(paymentSchema.safeParse({ ...p, amount: -1 }).success, false);
    assert.equal(paymentSchema.safeParse({ ...p, amount: 12.5 }).success, false);
    assert.equal(paymentSchema.safeParse({ ...p, amount: NaN }).success, false);
    assert.equal(paymentSchema.safeParse({ ...p, stage_id: '' }).success, false);
    assert.equal(paymentSchema.safeParse({ ...p, payment_date: '2026-02-30' }).success, false);
    assert.equal(stageSchema.safeParse({ ...data.stages[0], start_date: '2026-10-10', target_date: '2026-10-01' }).success, false);
    assert.equal(itemSchema.safeParse({ ...data.items[0], budget: null }).success, true);
    assert.equal(settingsSchema.safeParse({ house_name: 'House', currency: 'tzs' }).data?.currency, 'TZS');
});
test('CSV escapes quotes, newlines and spreadsheet formula injection', () => {
    assert.equal(csvText([['=1+1', 'a"b', 'line\nbreak', -42, null]]), '\ufeff"\'=1+1","a""b","line\nbreak","-42",""');
});

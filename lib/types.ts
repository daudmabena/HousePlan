export const stageStatuses = ['Not started', 'In progress', 'Complete', 'On hold'] as const;
export const taskStatuses = ['To do', 'In progress', 'Done'] as const;
export type Stage = {
    id: string;
    house_id: string;
    created_by?: string;
    name: string;
    status: typeof stageStatuses[number];
    budget: number | null;
    start_date: string | null;
    target_date: string | null;
    notes: string;
    sort_order: number;
};
export type Item = {
    id: string;
    house_id: string;
    created_by?: string;
    stage_id: string;
    name: string;
    budget: number | null;
    unit: string;
    notes: string;
    sort_order: number;
};
export type Payment = {
    id: string;
    house_id: string;
    created_by?: string;
    stage_id: string;
    item_id: string | null;
    amount: number;
    payment_date: string | null;
    reference: string;
    description: string;
    payee: string;
    receipt: string;
    created_at: string;
};
export type Task = {
    id: string;
    house_id: string;
    created_by?: string;
    stage_id: string;
    title: string;
    due_date: string | null;
    status: typeof taskStatuses[number];
    notes: string;
    created_at: string;
};
export type Settings = {
    id?: string;
    house_name: string;
    currency: string;
};
export type HouseData = {
    stages: Stage[];
    items: Item[];
    payments: Payment[];
    tasks: Task[];
    settings: Settings;
};
export type TableName = 'stages' | 'items' | 'payments' | 'tasks';
export type House = { id: string; name: string; currency: string; created_by: string | null; archived_at: string | null; created_at: string };
export type Member = { user_id: string; email: string; joined_at: string };
export type Invitation = { id: string; house_id: string; email: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };

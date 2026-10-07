import Workspace from '@/components/workspace';
import seed from '@/lib/seed.json';
import type { HouseData } from '@/lib/types';
export default function Page() {
    const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const preview = !configured && process.env.NODE_ENV === 'development';
    return <Workspace previewData={preview ? seed as HouseData : null} configured={configured}/>;
}

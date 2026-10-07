import Workspace from '@/components/workspace';
export default async function InvitePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 return <Workspace configured={configured} previewData={null} inviteToken={token}/>;
}

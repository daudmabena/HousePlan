import {test,expect,type Page} from '@playwright/test';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',H='99999999-9999-4999-8999-999999999999';
const token='a'.repeat(64);
async function session(page:Page,id:string,email:string){
 const user={id,email,email_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'testsignature'].join('.');
 await page.addInitScript(value=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),{access_token:jwt,refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user});
 return user;
}
test('connected ownership screens generate/revoke links and accept as invited user',async({page,context})=>{
 const user=await session(page,A,'a@example.com');
 let invitations:Record<string,unknown>[]=[];let accepted=false;
 const house={id:H,name:'Shared build',currency:'TZS',created_by:A,archived_at:null,created_at:new Date().toISOString()};
 const api=async(p:Page,u:typeof user)=>{await p.route('http://127.0.0.1:54321/**',async route=>{const req=route.request(),url=new URL(req.url());const body=req.postDataJSON()??{};let result:unknown=[];
  if(url.pathname==='/auth/v1/user')result=u;
  else if(url.pathname.endsWith('/rpc/create_house_invitation')){expect(body).toEqual({hid:H,invited_email:'b@example.com'});invitations=[{id:'88888888-8888-4888-8888-888888888888',house_id:H,email:'b@example.com',expires_at:new Date(Date.now()+7*86400000).toISOString(),accepted_at:null,revoked_at:null,created_at:new Date().toISOString()}];result=token;}
  else if(url.pathname.endsWith('/rpc/revoke_house_invitation')){invitations=invitations.map(i=>({...i,revoked_at:new Date().toISOString()}));result=null;}
  else if(url.pathname.endsWith('/rpc/get_house_members'))result=[{user_id:A,email:'a@example.com',joined_at:new Date().toISOString()},{user_id:B,email:'b@example.com',joined_at:new Date().toISOString()}];
  else if(url.pathname.endsWith('/rpc/accept_house_invitation')){expect(body).toEqual({token});accepted=true;result=H;}
  else if(url.pathname.endsWith('/houses'))result=url.searchParams.has('id')?house:[house];
  else if(url.pathname.endsWith('/house_invitations')){expect(url.searchParams.get('select')).not.toContain('token_hash');result=invitations;}
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
 });};
 await api(page,user);await page.goto('/?house='+H);await expect(page.getByRole('heading',{name:'Your house, in perspective'})).toBeVisible();await page.getByRole('button',{name:'Ownership',exact:true}).click();await expect(page.getByText('a@example.com (you)',{exact:true})).toBeVisible();await expect(page.getByText('b@example.com',{exact:true})).toBeVisible();
 await page.getByLabel('Email address',{exact:true}).fill('b@example.com');await page.getByRole('button',{name:'Create invitation link'}).click();await expect(page.getByLabel('Invitation link',{exact:true})).toHaveValue('http://127.0.0.1:3002/invite/'+token);await expect(page.getByRole('cell',{name:'Pending',exact:true})).toBeVisible();await page.getByRole('button',{name:'Revoke',exact:true}).click();await expect(page.getByRole('cell',{name:'Revoked',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create invitation link'}).click();await expect(page.getByRole('cell',{name:'Pending',exact:true})).toBeVisible();
 const other=await context.browser()!.newContext();const invitee=await other.newPage();const b=await session(invitee,B,'b@example.com');await api(invitee,b);await invitee.goto('http://127.0.0.1:3002/invite/'+token);await expect(invitee.getByRole('heading',{name:'Become a house co-owner'})).toBeVisible();await invitee.getByRole('button',{name:'Accept invitation',exact:true}).click();await expect(invitee).toHaveURL('http://127.0.0.1:3002/?house='+H);await expect(invitee.getByRole('heading',{name:'Your house, in perspective'})).toBeVisible();expect(accepted).toBe(true);await other.close();
});

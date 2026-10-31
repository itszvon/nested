import pg from "pg";
const c = new pg.Client({host:"db.purcbbalpuovesdndlik.supabase.co",port:5432,user:"postgres",password:process.env.PGPASSWORD,database:"postgres",ssl:{rejectUnauthorized:false}});
await c.connect();
await c.query("delete from auth.users where email = 'dbg-del@example.com'");
const u = (await c.query(`insert into auth.users (id,email,email_confirmed_at,created_at,updated_at,aud,role)
  values (gen_random_uuid(),'dbg-del@example.com',now(),now(),now(),'authenticated','authenticated') returning id`)).rows[0].id;
console.log("user", u);
console.log("profile rows:", (await c.query("select count(*)::int n from public.profiles where id=$1",[u])).rows[0].n);
await c.query("insert into public.folders (owner_id,name) values ($1,'x')",[u]);
console.log("folder rows:", (await c.query("select count(*)::int n from public.folders where owner_id=$1",[u])).rows[0].n);

await c.query("begin");
await c.query("set local role authenticated");
await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:u,role:'authenticated'})]);
const r = await c.query("select public.delete_my_account() as out");
console.log("rpc ok", r.rowCount);
await c.query("commit");

console.log("auth rows:", (await c.query("select count(*)::int n from auth.users where id=$1",[u])).rows[0].n);
console.log("profile rows:", (await c.query("select count(*)::int n from public.profiles where id=$1",[u])).rows[0].n);
console.log("folder rows:", (await c.query("select count(*)::int n from public.folders where owner_id=$1",[u])).rows[0].n);
await c.end();

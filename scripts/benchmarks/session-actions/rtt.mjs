// Separate, read-only transport-floor diagnostic. Never part of the primary timer.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import postgres from 'postgres';
const [directoryArg, outputArg] = process.argv.slice(2);
assert.ok(directoryArg && outputArg);
const directory=resolve(directoryArg);
const uri=new URL(parseEnv(readFileSync(`${directory}/.env.goal_rating_desktop`,'utf8')).DATABASE_URL);
assert.equal(uri.hostname,'ep-summer-boat-b49oecxy-pooler.c-6.us-east-2.aws.neon.tech');
assert.equal(uri.pathname,'/goal_rating_desktop');
const sql=postgres(String(uri),{max:1,prepare:true,onnotice:()=>{}});
try {
 const result=await sql.begin('read only',async tx=>{
  for(let i=0;i<3;i++)await tx`select 1`;
  const observations=[];
  for(let i=0;i<30;i++){const start=performance.now();await tx`select 1`;observations.push(performance.now()-start);}
  const [explain]=await tx`explain (analyze, format json) select 1`;
  const plan=explain['QUERY PLAN'][0];
  const sorted=[...observations].sort((a,b)=>a-b);
  return {kind:'Separate read-only pooled transport-floor probe, not primary action observations',runtime:process.version,warmups:3,count:30,prepare:true,maxConnections:1,database:'isolated goal_rating_desktop, after its completed primary run',observations,medianMs:(sorted[14]+sorted[15])/2,minMs:sorted[0],maxMs:sorted.at(-1),planningMs:plan['Planning Time'],executionMs:plan['Execution Time'],limitations:'End-to-end SELECT 1 includes driver, pooled transport and PostgreSQL; it does not attribute network vs pool separately, nor predict colocated production latency. EXPLAIN is a separate query. No primary measurements or failure tests ran concurrently.'};
 });
 writeFileSync(resolve(outputArg),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({count:result.count,medianMs:result.medianMs,minMs:result.minMs,maxMs:result.maxMs,executionMs:result.executionMs}));
}finally{await sql.end();}

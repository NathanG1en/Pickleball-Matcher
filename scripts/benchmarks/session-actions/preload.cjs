// Local profiling only. Explicitly loaded with --require; never imported by the app.
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preloads execute as CommonJS. */
const {AsyncLocalStorage}=require('node:async_hooks');
const {appendFileSync}=require('node:fs');
const {createRequire,registerHooks}=require('node:module');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const http=require('node:http');
const target=process.env.CLUB_PROFILE_TRACE;
if(!target || !/^ep-summer-boat-b49oecxy(?:-pooler)?\./.test(new URL(process.env.DATABASE_URL).hostname) || !/^\/goal_[a-z0-9_]+$/.test(new URL(process.env.DATABASE_URL).pathname))throw Error('Only isolated club profiling is allowed');
const storage=new AsyncLocalStorage();
const write=value=>appendFileSync(target,JSON.stringify(value)+'\n');
const original=http.Server.prototype.emit;let seq=0;
http.Server.prototype.emit=function(event,...args){
  if(event!=='request')return original.call(this,event,...args);
  const [request,response]=args;
  const record={type:'request',id:++seq,method:request.method,path:new URL(request.url,'http://localhost').pathname,action:!!request.headers['next-action'],prefetch:request.headers['next-router-prefetch']==='1',step:request.headers['x-club-profile-step']??null,epochMs:Date.now(),inputBytes:0,outputBytes:0,queries:[]};
  const start=performance.now();const cpu=process.cpuUsage();const oldWrite=response.write;const oldEnd=response.end;const oldEmit=request.emit;
  const bytes=value=>typeof value==='string'?Buffer.byteLength(value):Buffer.isBuffer(value)||ArrayBuffer.isView(value)?value.byteLength:0;
  request.emit=function(event,...parts){if(event==='data')record.inputBytes+=bytes(parts[0]);return oldEmit.call(this,event,...parts);};
  response.end=function(...parts){record.outputBytes+=bytes(parts[0]);record.firstWriteMs??=performance.now()-start;return oldEnd.apply(this,parts);};
  response.write=function(...parts){record.outputBytes+=bytes(parts[0]);record.firstWriteMs??=performance.now()-start;return oldWrite.apply(this,parts);};
  response.once('finish',()=>write({...record,status:response.statusCode,ms:performance.now()-start,cpuMicros:process.cpuUsage(cpu)}));
  return storage.run({record,start},()=>original.call(this,event,...args));
};
globalThis[Symbol.for('club.profile.query')]=query=>{
  const context=storage.getStore();
  if(!context){write({type:'unattributed-query'});return;}
  // Inspect static template fragments only in memory. No SQL, parameters, or rows are logged.
  const text=Array.isArray(query.strings)?query.strings.join(' '):'';
  let kind='other';
  if(/pg_advisory_xact_lock/i.test(text))kind='lock-call';
  else if(/^\s*(begin|commit|rollback|savepoint|release)/i.test(text))kind='transaction';
  else if(/^\s*(select|with)/i.test(text) && !/\b(update|insert into|delete from)\b/i.test(text))kind='read';
  else if(/\b(update|insert|delete)\b/i.test(text)){
    kind=/player_synergy/i.test(text)?'chemistry-write':/match_players/i.test(text)?'snapshot-write':/player_accounts|players/i.test(text)?'rating-write':'source-write';
  }
  const tables=[...new Set((text.match(/\b(?:from|join|update|into)\s+([a-z_]+)/gi)??[]).map(part=>part.split(/\s+/).at(-1)))].sort();
  const shape=require('node:crypto').createHash('sha256').update(text.replace(/\s+/g,' ').trim()).digest('hex').slice(0,12);
  const entry={kind,shape,tables,startMs:performance.now()-context.start};context.record.queries.push(entry);
  let finished=false;
  for(const name of ['resolve','reject']){
    const fn=query[name];query[name]=function(...args){if(!finished){finished=true;entry.endMs=performance.now()-context.start;entry.ms=entry.endMs-entry.startMs;if(name==='reject')entry.failed=true;}return fn.apply(this,args);};
  }
};
const projectRequire=createRequire(resolve(process.cwd(),'package.json'));
const postgresPath=projectRequire.resolve('postgres');
const queryFiles=new Set([pathToFileURL(resolve(postgresPath,'../query.js')).href,pathToFileURL(resolve(postgresPath,'../../../src/query.js')).href]);
registerHooks({load(url,options,nextLoad){
  const result=nextLoad(url,options);if(!queryFiles.has(url))return result;
  const source=String(result.source);const anchor='!this.executed && (this.executed = true) && await 1 && this.handler(this)';
  if(!source.includes(anchor))throw Error('Driver changed: query instrumentation must be reviewed');
  write({type:'query-hook'});
  return {...result,source:source.replace(anchor,'!this.executed && (this.executed = true) && (globalThis[Symbol.for("club.profile.query")](this), true) && await 1 && this.handler(this)')};
}});

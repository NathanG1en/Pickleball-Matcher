// Measurement-only harness. npx tsx scripts/benchmarks/current-club-profile.mjs ENV_FILE OUTPUT_DIR
// Writes fixtures only to the explicitly isolated profiling branch. No app settings change.
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Session as InspectorSession} from 'node:inspector/promises';
import {PostgresRepositories} from '../../src/lib/db/postgres-repositories.ts';
import {SessionService} from '../../src/lib/domain/session-service.ts';
import {InMemoryRepositories} from '../../src/test-support/in-memory-repositories.ts';
import {DEFAULT_MATCHMAKING_CONFIG} from '../../src/lib/matchmaking/config.ts';

const [envFile, outArg] = process.argv.slice(2);
if (!envFile || !outArg) throw Error('Supply private environment file and output directory');
const env = parseEnv(readFileSync(envFile,'utf8'));
const host = 'ep-summer-boat-b49oecxy.c-6.us-east-2.aws.neon.tech';
if(new URL(env.DATABASE_URL_UNPOOLED).hostname !== host) throw Error('Only the isolated current-club profiling branch is allowed');
const out=resolve(outArg); mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2)+'\n');
const metadata={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,iterations:DEFAULT_MATCHMAKING_CONFIG.iterations,branch:'profiling-current-club-20261031',players:12,courts:3,rounds:10};
let active;
const sql=postgres(env.DATABASE_URL,{max:10,prepare:false,onnotice:()=>{},debug:()=>{if(active)active.queries++;}});
const raw=new PostgresRepositories(sql);
function wrap(repository) {
  return new Proxy(repository,{get(target,key){
    const fn=target[key]; if(typeof fn!=='function')return fn;
    if(key==='transaction')return operation=>target.transaction(tx=>operation(wrap(tx)));
    return async(...args)=>{
      const sample=active; const start=performance.now();
      try{return await fn.apply(target,args);}finally{if(sample){const phase=sample.methods[key]??={calls:0,ms:0};phase.calls++;phase.ms+=performance.now()-start;}}
    };
  }});
}
const samples=[];
async function measure(action,iteration,operation){
  const sample={action,iteration,queries:0,methods:{}};active=sample;
  const start=performance.now();
  try{const value=await operation();sample.ms=performance.now()-start;samples.push(sample);save('backend',{metadata,samples});console.log(JSON.stringify({action,iteration,ms:Math.round(sample.ms),queries:sample.queries}));return value;}finally{active=undefined;}
}
const groupId='grp_current_club_profile_20261031';
let id=0;
const dependencies={now:()=>new Date(),nextSeed:()=>20261031+id,nextId:kind=>`${kind}_club_profile_${++id}`};
const service=new SessionService(wrap(raw),dependencies);
try {
  if(await raw.getGroup(groupId)) throw Error('Profile fixture already exists; refusing to seed twice');
  metadata.before=(await sql`select (select count(*)::int from player_accounts) as accounts,(select count(*)::int from players) as roster_rows,(select count(*)::int from matches where rated and status='completed') as completed_rated_matches`)[0];
  const hash=await bcrypt.hash('Password123',12);
  const playerIds=Array.from({length:12},(_,i)=>`ply_club_profile_${i}`);
  await raw.transaction(async repository=>{
    for(let i=0;i<12;i++)await repository.createPlayerAccount({id:`usr_club_profile_${i}`,username:`club_profile_${i}`,name:`Profile Player ${i}`,passwordHash:hash,skillLevel:'intermediate',initialRating:1000+(i%5)*25,createdAt:new Date(),isPublic:false});
    await repository.insertGroup({id:groupId,name:'Current Club Profiling',ownerAccountId:'usr_club_profile_0',organizerPinHash:hash,createdAt:new Date(),isPublic:false});
    for(let i=0;i<12;i++)await repository.createPlayer({id:playerIds[i],accountId:`usr_club_profile_${i}`,groupId,name:`Profile Player ${i}`,initialRating:1000+(i%5)*25,rating:1000+(i%5)*25,ratedGamesPlayed:0,active:true});
  });
  // Warm a single ordinary connection, not ten simultaneously.
  await sql`select 1`;
  const session=await measure('startSession',0,()=>service.startSession({groupId,courtCount:3,playerIds}));
  let firstMatch;
  for(let roundNumber=1;roundNumber<=10;roundNumber++){
    const proposal=await measure('proposeRound',roundNumber,()=>service.proposeRound(session.id,100+roundNumber));
    assert.equal(proposal.courts.length,3);
    const round=await measure('startRound',roundNumber,()=>service.startRound(session.id,proposal));
    const record=(await raw.listStartedRounds(session.id)).find(r=>r.round.id===round.id);
    firstMatch??=record.matches[0];
    const inputs=record.matches.map((m,i)=>({matchId:m.id,matchVersion:m.version,team1Score:(i+roundNumber)%2?11:7,team2Score:(i+roundNumber)%2?6:11}));
    await measure('saveAllScores',roundNumber,()=>service.recordMultipleResults(inputs,{groupId,sessionId:session.id}));
    assert.ok((await raw.listStartedRounds(session.id)).find(r=>r.round.id===round.id).matches.every(m=>m.status==='completed'));
    await measure('completeRound',roundNumber,()=>service.completeRound(round.id));
    if(roundNumber%2===0){
      await measure('attendanceAway',roundNumber,()=>service.changeAttendance({sessionId:session.id,playerId:playerIds.at(-1),present:false}));
      await measure('attendancePresent',roundNumber,()=>service.changeAttendance({sessionId:session.id,playerId:playerIds.at(-1),present:true}));
    }
  }
  for(let i=0;i<5;i++)await measure('historicalCorrection',i,()=>service.recordResult({matchId:firstMatch.id,team1Score:11,team2Score:5+i}));
  await measure('endSession',0,()=>service.endSession(session.id));
  assert.equal((await raw.getSession(session.id)).status,'completed');
  save('fixture',{groupId,backendSessionId:session.id,username:'club_profile_0',password:'Password123',players:12,courts:3});
} finally {await sql.end();}

// CPU-only proposal preparation: in-memory inputs, varied seeds, unchanged 1,200 iterations.
const inspector=new InspectorSession();inspector.connect();await inspector.post('Profiler.enable');
await inspector.post('Profiler.setSamplingInterval',{interval:1000});await inspector.post('Profiler.start');
const cpu=[];
try{
  for(const scenario of [
    {name:'12-first-round',players:12,history:0,paired:false,temperature:0},
    {name:'12-round-11',players:12,history:10,paired:false,temperature:0},
    {name:'13-paired-one-bench-round-11',players:13,history:10,paired:true,temperature:0},
    {name:'24-round-11',players:24,history:10,paired:false,temperature:0},
    {name:'24-round-11-wild',players:24,history:10,paired:false,temperature:1},
  ]){
    const players=Array.from({length:scenario.players},(_,i)=>({id:`cpu-${i}`,groupId:'cpu-group',name:`CPU ${i}`,initialRating:1000+(i%5)*25,rating:1000+(i%5)*25,ratedGamesPlayed:0,active:true}));
    const memory=new InMemoryRepositories({players});let seq=0;
    const svc=new SessionService(memory,{now:()=>new Date(1793450000000+seq*1000),nextId:k=>`${k}-cpu-${++seq}`,nextSeed:()=>42+seq});
    const session=await svc.startSession({groupId:'cpu-group',courtCount:Math.floor(scenario.players/4),playerIds:players.map(p=>p.id),stayTogetherPairs:scenario.paired?[['cpu-0','cpu-1'],['cpu-2','cpu-3']]:[]});
    for(let n=0;n<scenario.history;n++){
      const proposal=await svc.proposeRound(session.id,42+n);const round=await svc.startRound(session.id,proposal);
      const record=(await memory.listStartedRounds(session.id)).find(r=>r.round.id===round.id);
      await svc.recordMultipleResults(record.matches.map(m=>({matchId:m.id,team1Score:11,team2Score:7})));await svc.completeRound(round.id);
    }
    const snapshot={session:await memory.getSession(session.id),players:await memory.listPlayers('cpu-group'),attendance:await memory.listAttendance(session.id),rounds:await memory.listStartedRounds(session.id)};
    // Deterministic equality and participant coverage outside measured calls.
    assert.deepEqual(svc.proposeRoundFromSnapshot(snapshot,501,scenario.temperature),svc.proposeRoundFromSnapshot(snapshot,501,scenario.temperature));
    for(let i=-3;i<30;i++){
      const start=performance.now();const proposal=svc.proposeRoundFromSnapshot(snapshot,1000+i,scenario.temperature);const ms=performance.now()-start;
      const ids=[...proposal.courts.flatMap(c=>[...c.team1,...c.team2]),...proposal.sitting];
      assert.equal(new Set(ids).size,players.length);assert.equal(ids.length,players.length);
      if(scenario.paired)for(const [a,b] of snapshot.session.stayTogetherPairs){
        const team=proposal.courts.flatMap(c=>[c.team1,c.team2]).find(t=>t.includes(a));
        // The approved one-seat-bench exception may split a pair.
        if(!proposal.sitting.includes(a)&&!proposal.sitting.includes(b))assert.ok(team?.includes(b));
      }
      if(i>=0)cpu.push({scenario:scenario.name,iteration:i,ms,players:scenario.players,completedRounds:scenario.history,temperature:scenario.temperature});
    }
    console.log(`CPU scenario complete: ${scenario.name}`);
  }
}finally{const {profile}=await inspector.post('Profiler.stop');writeFileSync(`${out}/cpu.cpuprofile`,JSON.stringify(profile));inspector.disconnect();save('cpu',{metadata,samples:cpu});}

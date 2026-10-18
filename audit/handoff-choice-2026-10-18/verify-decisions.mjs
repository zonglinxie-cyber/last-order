import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=process.argv[2], dir=fileURLToPath(new URL('.',import.meta.url));
const {doVerb,resolveServe}=await import(pathToFileURL(root+'/src/world/engine.ts'));
const {PEOPLE}=await import(pathToFileURL(root+'/src/world/content/index.ts'));
const rows=[];
for(const s of JSON.parse(readFileSync(dir+'/decision-scenarios.json','utf8')).scenarios){
 const watch=doVerb(s.input,PEOPLE,'handoff',['suman',s.person],{handoffMode:'watch'});
 assert.equal(watch.money,0,'只照看不能自动成交');assert.equal(watch.energy,14);
 assert.equal(watch.qualities['bought:'+s.person],undefined,'只照看不能触发购买间隔');
 const personal=resolveServe(watch,PEOPLE,s.person,s.product,s.units,false);
 assert.equal(personal.money,s.watchThenServeExpected.money);assert.equal(personal.energy,2);
 const sell=doVerb(s.input,PEOPLE,'handoff',['suman',s.person],{handoffMode:'sell'});
 assert.equal(sell.money,s.auto.money);assert.equal(sell.energy,s.auto.energy);
 rows.push({person:s.person,units:s.units,watchThenPersonal:{money:personal.money,energy:personal.energy},sell:{money:sell.money,energy:sell.energy}});
}
writeFileSync(dir+'/decision-comparison.json',JSON.stringify({rows,scope:'完整需求控制下的规则情境，不是对玩家收入预测'},null,2));console.log(JSON.stringify(rows));

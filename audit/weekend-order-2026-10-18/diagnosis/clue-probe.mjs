import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root=resolve(process.argv[2]);
const E=await import(pathToFileURL(root+'/src/world/engine.ts'));
const C=await import(pathToFileURL(root+'/src/world/content/index.ts'));
const ids=['main-slip-shen','main-slip-song','main-slip-yin','main-slip-fang'];
const played=(start)=>{
 let w=start; const seen=new Set();const drawnClues=[];const windows={};
 while(w.day<=28) {
  for(const slot of [0,1,2,3]) {
   w=E.beginSlot({...w,slot},C.PEOPLE,C.festivalsFor(w.season));
   for(const p of C.PEOPLE) if(w.present[p.id]==='counter') w=E.doVerb(w,C.PEOPLE,'greet',[p.id]);
   for(const e of E.storyDeck(w,C.PEOPLE,C.STORYLETS.filter(s=>ids.includes(s.id)),0).eligible) windows[e.storylet.id]=(windows[e.storylet.id]??0)+1;
   const {drawn}=E.drawStorylet(w,C.PEOPLE,C.STORYLETS);
   if(!drawn)continue;
   if(ids.includes(drawn.storylet.id))seen.add(drawn.storylet.id);
   if(drawn.storylet.kind==='mainline')drawnClues.push({id:drawn.storylet.id,season:w.season,day:w.day,slot});
   const idx=drawn.storylet.choices.findIndex(c=>E.choiceVisible(w,C.PEOPLE,drawn,c));
   if(idx>=0)w=E.applyChoice(w,C.PEOPLE,drawn,idx);
  }
  w=E.endDay(w,C.PEOPLE);
 }
 return {w,seen,drawnClues,windows};
};
const rows=[];
for(let i=0;i<12;i++){
 const a=played(E.newWorld(`slip-clues-${i}`,C.PEOPLE));const b=played(E.nextSeason(a.w,C.PEOPLE));
 const seen=[...new Set([...a.seen,...b.seen])];rows.push({seed:i,seen,windows:[a.windows,b.windows],drawn:[...a.drawnClues,...b.drawnClues]});
}
console.log(JSON.stringify({root,threeOrMore:rows.filter(r=>r.seen.length>=3).length,rows},null,2));

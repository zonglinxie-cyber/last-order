import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
const root=process.argv[2], dir=fileURLToPath(new URL('.',import.meta.url));
const {doVerb}=await import(pathToFileURL(root+'/src/world/engine.ts'));
const {PEOPLE}=await import(pathToFileURL(root+'/src/world/content/index.ts'));
const scenarios=JSON.parse(readFileSync(dir+'/default-baseline.json','utf8'));
const differences=[];
for (const s of scenarios) {
 const next=doVerb(s.input,PEOPLE,'handoff',['suman','anjie']);
 if (!isDeepStrictEqual(next,s.output)) differences.push({label:s.label,fields:[...new Set([...Object.keys(next),...Object.keys(s.output)])].filter(k=>!isDeepStrictEqual(next[k],s.output[k]))});
}
const result={baseline:'c88dd4d',testedRoot:root,engineSha256:createHash('sha256').update(readFileSync(root+'/src/world/engine.ts')).digest('hex'),scenarios:scenarios.length,exactMatches:scenarios.length-differences.length,differences};
writeFileSync(dir+'/default-comparison.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(differences.length)process.exitCode=1;

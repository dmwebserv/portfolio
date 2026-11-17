// Isolated server tests. Every fetch is mocked; no OpenAI credit used.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('hub/cloud/ai-service.js','utf8')).toString('base64'));
const env={SUPABASE_URL:'https://sample.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',OPENAI_API_KEY:'test-not-a-real-secret'};
const context={action:'bundle',confirmed:true,useSearch:true,project:{name:'Example','domain':'example.com',notes:'Public supplied context'}};
const req=(body=context,headers={})=>new Request('https://studio.example/api/ai',{method:'POST',headers:{Origin:'https://studio.example',Authorization:'Bearer example-token','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
let calls=[];function mock(replies){calls=[];globalThis.fetch=async(url,opts={})=>{calls.push({url,opts});assert(replies.length,'Unexpected external call');const [status,value]=replies.shift();return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});};}
mock([]);assert.equal((await handle(req(context,{Origin:'https://evil.example'}),env)).status,403);
mock([]);assert.equal((await handle(req(context,{Authorization:''}),env)).status,401);
mock([[200,{id:'other'}],[200,[]]]);assert.equal((await handle(req(),env)).status,403);assert.equal(calls.length,2);
mock([[200,{id:'owner'}],[200,[{user_id:'owner'}]]]);assert.equal((await handle(req(),{...env,OPENAI_API_KEY:''})).status,503);
mock([[200,{id:'owner'}],[200,[{user_id:'owner'}]],[200,false]]);assert.equal((await handle(req(),env)).status,429);assert.equal(calls.length,3);
const result={research:'Evidence and unknowns',email:'Human-reviewed draft',html:'<h1>Unofficial concept</h1>',sources:['https://example.com'],warnings:['Confirm image rights']};
const response=html=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...result,html})}]}],usage:{output_tokens:100}});
mock([[200,{id:'owner'}],[200,[{user_id:'owner'}]],[200,true],[200,response(result.html)]]);
const good=await handle(req(),env);assert.equal(good.status,200);assert.equal((await good.json()).result.research,result.research);assert.equal(calls[3].url,'https://api.openai.com/v1/responses');const payload=JSON.parse(calls[3].opts.body);assert.equal(payload.store,false);assert.equal(payload.max_tool_calls,1);assert.equal(payload.max_output_tokens,6500);
mock([[200,{id:'owner'}],[200,[{user_id:'owner'}]],[200,true],[200,response('<script>alert(1)</script>')]]);assert.equal((await handle(req(),env)).status,502);
mock([[200,{id:'owner'}],[200,[{user_id:'owner'}]],[200,true],[200,response('<meta http-equiv="refresh" content="0;url=https://evil.example">')]]);assert.equal((await handle(req(),env)).status,502);
console.log('PASS: origin/auth/allowlist gates, missing key, atomic quota failure, bounded provider request, script/redirect rejection. No live API used.');

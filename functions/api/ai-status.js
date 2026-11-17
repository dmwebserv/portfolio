import {owner,json} from '../../hub/cloud/ai-service.js';
export async function onRequestGet({request,env}){try{await owner(request,env);return json({configured:!!env.OPENAI_API_KEY,model:env.OPENAI_MODEL||'gpt-4.1-mini',dailyLimit:20});}catch(e){return json({error:e.status?e.message:'Unable to check integration'},e.status||500);}}

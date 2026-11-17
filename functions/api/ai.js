import {handle} from '../../hub/cloud/ai-service.js';
export const onRequest = ({request,env}) => handle(request,env);

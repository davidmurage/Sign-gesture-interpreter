'use strict';
const SUPPORTED=[/^https:\/\/meet\.google\.com\//,/^https:\/\/([a-z0-9-]+\.)*zoom\.us\//i];
const INFERENCE_URL='http://127.0.0.1:5001/interpret',MAX_MESSAGE=8*1024*1024,TIMEOUT_MS=8000;
const isSupported=url=>typeof url==='string'&&SUPPORTED.some(pattern=>pattern.test(url));
const isValidMessage=message=>message?.type==='INTERPRET_FRAME'&&typeof message.image==='string'&&/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(message.image)&&message.image.length<=MAX_MESSAGE;
async function requestInference(message,fetchImpl=fetch,timeoutMs=TIMEOUT_MS){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetchImpl(INFERENCE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:message.image}),signal:controller.signal});let data;try{data=await response.json();}catch(_){throw new Error('protocol');}if(!response.ok)throw new Error('upstream');return{ok:true,data};}catch(error){return{ok:false,error:error?.name==='AbortError'?'Inference request timed out':error?.message==='protocol'?'Invalid inference response':'Inference service unavailable'};}finally{clearTimeout(timer);}}
async function handleAction(tab,api=chrome){if(!tab.id||!isSupported(tab.url)){if(tab.id){await api.action.setBadgeText({tabId:tab.id,text:'!'});await api.action.setTitle({tabId:tab.id,title:'Supported only on Google Meet and Zoom web meetings'});}return;}try{await api.action.setBadgeText({tabId:tab.id,text:''});await api.scripting.insertCSS({target:{tabId:tab.id},files:['overlay.css']});await api.scripting.executeScript({target:{tabId:tab.id},files:['core.js','content.js']});}catch(_){await api.action.setBadgeText({tabId:tab.id,text:'!'});await api.action.setTitle({tabId:tab.id,title:'Could not open overlay. Reload the meeting page and try again.'});}}
if(typeof chrome!=='undefined'){
  chrome.action.onClicked.addListener(handleAction);
  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{if(!isSupported(sender.tab&&sender.tab.url)||!isValidMessage(message))return false;requestInference(message).then(sendResponse);return true;});
}
if(typeof module==='object')module.exports={isSupported,isValidMessage,requestInference,handleAction,TIMEOUT_MS};

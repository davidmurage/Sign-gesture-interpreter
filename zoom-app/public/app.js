(async function(){
  'use strict';
  const $=id=>document.getElementById(id),video=document.querySelector('video'),canvas=document.querySelector('canvas');
  let stream,supported=false,csrfToken='';
  try {
    csrfToken=(await (await fetch('/api/config')).json()).csrfToken;
    if(!window.zoomSdk)throw new Error();
    await zoomSdk.config({version:'0.16.0',capabilities:['getRunningContext']});
    const result=await zoomSdk.getRunningContext(),context=result.context||result;
    supported=ZoomContext.isInMeeting(context);
    $('context').textContent=supported?'Zoom context: inMeeting':`Unsupported Zoom context: ${context}. Open this app during a meeting.`;
  } catch(_){$('context').textContent='Zoom context unavailable. Open this panel from a Zoom meeting.';}
  $('toggle').disabled=!supported;
  const camera={start:async()=>{stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});video.srcObject=stream;await video.play();},capture:async()=>{if(!video.videoWidth)return null;canvas.getContext('2d').drawImage(video,0,0,320,240);return canvas.toDataURL('image/jpeg',.75);},stop:async()=>{if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;}};
  const transport=async(image,signal)=>{const response=await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({image}),signal});let data;try{data=await response.json();}catch(_){throw new Error('protocol');}if(!response.ok)throw new Error('transport');return data;};
  const controller=MeetingOverlayCore.createController({camera,transport,clipboard:navigator.clipboard,onState(state){$('status').textContent=state.status;$('result').textContent=state.visibleText;$('error').textContent=state.error;$('copy').disabled=!state.visibleText;$('toggle').textContent=state.active?'Stop':'Start';}});
  $('toggle').onclick=()=>controller.getState().active?controller.stop():controller.start();
  $('copy').onclick=()=>controller.copy().catch(()=>{$('error').textContent='Copy failed. Select the result and copy manually.';});
  window.addEventListener('pagehide',()=>controller.stop(),{once:true});
})();

const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,...args)=>ipcRenderer.invoke(channel,...args);
contextBridge.exposeInMainWorld('phoebe',{
  voiceConfig:v=>invoke('speech-config',v),speech:t=>invoke('speech',t),settings:()=>invoke('get-settings'),history:()=>invoke('get-history'),save:data=>invoke('save-settings',data),deleteKey:()=>invoke('delete-key'),
  chat:text=>invoke('chat',text),clear:()=>invoke('clear-chat'),cancel:()=>invoke('cancel-chat'),open:tab=>invoke('open-chat',tab),
  tracking:value=>invoke('tracking',value),mute:()=>invoke('mute'),menu:()=>invoke('menu'),dragStart:()=>invoke('drag-start'),dragEnd:()=>invoke('drag-end'),external:id=>invoke('external',id),
  on:(channel,callback)=>{if(!['settings','gaze','pet-state','bubble','tab','cleared'].includes(channel))return ()=>{};const fn=(_,data)=>callback(data);ipcRenderer.on(channel,fn);return ()=>ipcRenderer.removeListener(channel,fn);}
});

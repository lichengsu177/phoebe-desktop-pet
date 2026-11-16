const {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,screen,safeStorage,shell,session}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {gaze,clampPosition,requestReply,DEFAULT_MODEL}=require('./core.cjs');
app.setName('菲比啾比');
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',path.join(process.env.PHOEBE_QA_DIR||app.getPath('temp'),'phoebe-smoke'));
const defaults={model:DEFAULT_MODEL,volume:0.7,muted:false,readAloud:false,alwaysOnTop:true};
let settings={...defaults},key='',keyStored=false,tracking=false,pet,chat,tray,drag=null,turns=[],controller=null,busy=false,quitting=false;
const file=()=>path.join(app.getPath('userData'),'settings.json');
const visibleSettings=()=>({...settings,hasKey:!!key,keyStored,tracking});
function savePlain(){fs.mkdirSync(path.dirname(file()),{recursive:true});const old=readConfig();fs.writeFileSync(file(),JSON.stringify({...old,...settings}),{mode:0o600});}
function readConfig(){try{return JSON.parse(fs.readFileSync(file(),'utf8'));}catch{return {};}}
async function loadConfig(){const c=readConfig();for(const k of Object.keys(defaults))if(typeof c[k]===typeof defaults[k])settings[k]=c[k];settings.volume=Math.max(0,Math.min(1,settings.volume));if(c.encryptedKey){try{key=(await safeStorage.decryptStringAsync(Buffer.from(c.encryptedKey,'base64'))).result;keyStored=!!key;}catch{key='';}}}
function broadcast(channel,data){for(const w of [pet,chat])if(w&&!w.isDestroyed())w.webContents.send(channel,data);}
function update(){broadcast('settings',visibleSettings());buildMenu();}
function setTracking(value){tracking=!!value;if(!tracking)pet?.webContents.send('gaze',null);update();return visibleSettings();}
function safeWindow(opts,page){const w=new BrowserWindow({...opts,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.loadFile(path.join(__dirname,page));return w;}
function showChat(tab='chat'){if(!chat||chat.isDestroyed()){chat=safeWindow({width:410,height:620,minWidth:360,minHeight:480,title:'菲比的小屋',backgroundColor:'#faf8ff',titleBarStyle:'hiddenInset',show:false},'chat.html');chat.once('ready-to-show',()=>chat.show());chat.webContents.once('did-finish-load',()=>chat.webContents.send('tab',tab));chat.on('close',e=>{if(!quitting){e.preventDefault();chat.hide();}});}else{chat.show();chat.focus();chat.webContents.send('tab',tab);}}
function buildMenu(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([{label:'菲比的小屋',click:()=>showChat()},{label:'设置',click:()=>showChat('settings')},{label:'跳一下',click:()=>pet.webContents.send('pet-state','jumping')},{type:'separator'},{label:'鼠标跟随',type:'checkbox',checked:tracking,click:i=>setTracking(i.checked)},{label:'静音',type:'checkbox',checked:settings.muted,click:i=>{settings.muted=i.checked;savePlain();update();}},{label:'显示宠物',click:()=>pet.show()},{label:'暂时隐藏',click:()=>pet.hide()},{type:'separator'},{label:'退出菲比',click:()=>app.quit()}]));}
function trusted(e){return [pet,chat].some(w=>w&&!w.isDestroyed()&&e.sender===w.webContents)&&[pathToFileURL(path.join(__dirname,'pet.html')).href,pathToFileURL(path.join(__dirname,'chat.html')).href].includes(e.senderFrame?.url);}
function handle(name,fn){ipcMain.handle(name,async(e,...a)=>{if(!trusted(e))throw new Error('Untrusted sender');return fn(e,...a);});}
let speechProfile=null;
handle('speech-config',(_,v)=>{if(!v){speechProfile=null;return true;}speechProfile=require('./voice.cjs').profile(v);return true;});
handle('speech',async(_,text)=>{try{return {audio:await require('./voice.cjs').synthesize(speechProfile,text)}}catch(e){return {error:/^HTTP [0-9]{3}$/.test(e.message)?e.message:'语音未配置或请求失败，请检查地址、模型和密钥。'}}});
handle('get-settings',()=>visibleSettings());
handle('get-history',()=>turns.map(t=>({user:t.user,text:t.text})));
handle('open-chat',(_,tab)=>showChat(tab==='settings'?'settings':'chat'));
handle('tracking',(_,v)=>setTracking(v));
handle('mute',()=>{settings.muted=!settings.muted;savePlain();update();return visibleSettings();});
handle('menu',()=>{tray?.popUpContextMenu();});
handle('save-settings',async(_,data)=>{
  if(!data||typeof data!=='object')return {ok:false,error:'设置格式无效。'};
  if(typeof data.model==='string'&&!/^[a-zA-Z0-9._:-]{1,100}$/.test(data.model))return {ok:false,error:'请填写有效的模型名。'};
  if(typeof data.apiKey==='string'&&data.apiKey.trim()&&(data.apiKey.trim().length<12||data.apiKey.trim().length>600||/\s/.test(data.apiKey.trim())))return {ok:false,error:'请输入有效的 OpenAI API Key。'};
  if(typeof data.model==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(data.model))settings.model=data.model;
  if(Number.isFinite(data.volume))settings.volume=Math.max(0,Math.min(1,data.volume));
  for(const k of ['muted','readAloud','alwaysOnTop'])if(typeof data[k]==='boolean')settings[k]=data[k];
  let note='设置已保存。';
  if(typeof data.apiKey==='string'&&data.apiKey.trim()){
    const value=data.apiKey.trim();if(value.length<12||value.length>600||/[\s\r\n]/.test(value))return {ok:false,error:'请输入有效的 OpenAI API Key。'};
    key=value;keyStored=false;
    const cfg=readConfig();delete cfg.encryptedKey;
    try{if(await safeStorage.isAsyncEncryptionAvailable()){cfg.encryptedKey=(await safeStorage.encryptStringAsync(key)).toString('base64');keyStored=true;}}catch{}
    fs.mkdirSync(path.dirname(file()),{recursive:true});fs.writeFileSync(file(),JSON.stringify(cfg),{mode:0o600});
    if(!keyStored)note='密钥仅在本次运行有效；系统钥匙串暂不可用。';
    controller?.abort();turns=[];broadcast('cleared');
  }
  savePlain();pet.setAlwaysOnTop(settings.alwaysOnTop,'floating');update();return {ok:true,note,settings:visibleSettings()};
});
handle('delete-key',()=>{controller?.abort();key='';keyStored=false;turns=[];const c=readConfig();delete c.encryptedKey;fs.mkdirSync(path.dirname(file()),{recursive:true});fs.writeFileSync(file(),JSON.stringify(c),{mode:0o600});broadcast('cleared');update();return visibleSettings();});
handle('clear-chat',()=>{controller?.abort();turns=[];broadcast('cleared');return true;});
handle('cancel-chat',()=>{controller?.abort();return true;});
handle('chat',async(_,message)=>{
  if(busy)return {ok:false,error:'我还在想上一个问题，稍等一下。'};
  if(typeof message!=='string'||!message.trim()||message.length>4000)return {ok:false,error:'请发送 1–4000 字的问题。'};
  if(!key)return {ok:false,error:'先在设置中填写 OpenAI API Key，就可以和我聊天啦。',needsKey:true};
  busy=true;controller=new AbortController();const active=controller;const timer=setTimeout(()=>active.abort('timeout'),60000);broadcast('pet-state','running');
  try{const input=turns.slice(-8).flatMap(t=>[{role:'user',content:t.user},...t.output]);input.push({role:'user',content:message.trim()});
    const result=await requestReply({key,model:settings.model,input,signal:active.signal});
    if(active.signal.aborted)throw new Error('aborted');
    turns.push({user:message.trim(),...result});turns=turns.slice(-8);broadcast('pet-state','review');pet.webContents.send('bubble',result.text.slice(0,45));return {ok:true,text:result.text};
  }catch(e){broadcast('pet-state','failed');return {ok:false,error:active.signal.aborted?(active.signal.reason==='timeout'?'等待超时，请检查网络后重试。':'已停止。'):(e.message?.includes('fetch')?'连接不到 OpenAI，请检查网络后重试。':e.message||'暂时没能回答，请重试。')};
  }finally{clearTimeout(timer);busy=false;if(controller===active)controller=null;}
});
handle('drag-start',()=>{const p=screen.getCursorScreenPoint();const b=pet.getBounds();drag={dx:p.x-b.x,dy:p.y-b.y};return true;});
handle('drag-end',()=>{drag=null;return true;});
handle('external',(_,id)=>{const links={key:'https://platform.openai.com/api-keys',billing:'https://platform.openai.com/settings/organization/billing/overview',sources:'https://github.com/Genius-Society/phoebe_chubby'};if(links[id])return shell.openExternal(links[id]);});
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(async()=>{
  await loadConfig();session.defaultSession.setPermissionRequestHandler((_,__,cb)=>cb(false));
  const area=screen.getPrimaryDisplay().workArea;
  pet=safeWindow({x:area.x+area.width-270,y:area.y+area.height-320,width:240,height:300,transparent:true,frame:false,resizable:false,hasShadow:false,alwaysOnTop:settings.alwaysOnTop,skipTaskbar:true,title:'菲比啾比',show:false},'pet.html');
  pet.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});pet.once('ready-to-show',()=>pet.show());
  const icon=nativeImage.createFromPath(path.join(__dirname,'assets/tray.png')).resize({width:20,height:20});tray=new Tray(icon);tray.setToolTip('菲比啾比');tray.on('click',()=>pet.show());buildMenu();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'菲比啾比',submenu:[{label:'菲比的小屋',click:()=>showChat()},{label:'设置…',accelerator:'Command+,',click:()=>showChat('settings')},{type:'separator'},{role:'quit'}]},{role:'editMenu'}]));
  let lastX=pet.getBounds().x;
  const ticker=setInterval(()=>{if(!pet||pet.isDestroyed())return;if(!drag&&!tracking)return;const p=screen.getCursorScreenPoint();if(drag){const a=screen.getDisplayNearestPoint(p).workArea;const pos=clampPosition(p.x-drag.dx,p.y-drag.dy,a);pet.setPosition(pos.x,pos.y);pet.webContents.send('pet-state',pos.x>=lastX?'running-right':'running-left');lastX=pos.x;return;}
    if(tracking&&pet.isVisible()){const b=pet.getBounds(),dx=p.x-(b.x+120),dy=p.y-(b.y+158);pet.webContents.send('gaze',{index:gaze(dx,dy),x:Math.max(-3,Math.min(3,dx/180)),y:Math.max(-2,Math.min(2,dy/180))});}},50);
  app.on('before-quit',()=>{quitting=true;clearInterval(ticker);controller?.abort();});
  app.on('second-instance',()=>{pet.show();showChat();});app.on('activate',()=>pet.show());
  if(!smoke&&process.argv.includes('--settings'))showChat('settings');
  if(smoke){try{await require('./smoke.cjs')({pet,showChat,getChat:()=>chat,qa:process.env.PHOEBE_QA_DIR});app.quit();}catch(e){console.error('PHOEBE_SMOKE_FAILED',e.message);app.exit(1);}}
});
app.on('window-all-closed',()=>{});

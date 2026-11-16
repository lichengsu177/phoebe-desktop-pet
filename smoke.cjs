// Local UI integration checks. Never sends an OpenAI request or uses a real key.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const loaded=w=>w.webContents.isLoading()?new Promise(r=>w.webContents.once('did-finish-load',r)):Promise.resolve();
module.exports=async({pet,showChat,getChat,qa})=>{
  const errors=[];
  pet.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
  await loaded(pet);showChat();const chat=getChat();await loaded(chat);await wait(300);
  const run=s=>chat.webContents.executeJavaScript(s);
  const initial=await run('window.phoebe.settings()');
  assert.equal(initial.tracking,false);assert.equal(initial.hasKey,false);
  assert.equal((await run("window.phoebe.chat('你好')")).needsKey,true);
  assert.equal((await run("window.phoebe.save({model:'invalid model'})")).ok,false);
  assert.equal((await run("window.phoebe.save({apiKey:'bad'})")).ok,false);
  assert.equal((await run('window.phoebe.deleteKey()')).hasKey,false);
  assert.equal((await run('window.phoebe.tracking(true)')).tracking,true);
  await wait(100);
  assert.equal(await pet.webContents.executeJavaScript("document.querySelector('#track').getAttribute('aria-pressed')"),'true');
  assert.equal((await run('window.phoebe.tracking(false)')).tracking,false);
  await run('window.phoebe.clear()');assert.deepEqual(await run('window.phoebe.history()'),[]);
  assert.equal((await run('window.phoebe.save({volume:0.65,muted:false,readAloud:false,alwaysOnTop:true})')).ok,true);
  const audio=await pet.webContents.executeJavaScript(`Promise.all([1,2,3].map(n=>new Promise((resolve,reject)=>{const a=new Audio('assets/audio/jiubi-'+n+'.mp3');a.preload='auto';a.onloadeddata=()=>resolve({clip:n,duration:a.duration});a.onerror=()=>reject(new Error('Audio decode failed'));a.load();})))`);
  assert.ok(audio.every(a=>a.duration>1&&a.duration<3));
  const sprite=await pet.webContents.executeJavaScript("({width:atlas.naturalWidth,height:atlas.naturalHeight,drawn:ctx.getImageData(0,0,192,208).data.some((v,i)=>i%4===3&&v>0)})");
  assert.deepEqual(sprite,{width:1536,height:2288,drawn:true});
  await pet.webContents.executeJavaScript("document.body.classList.add('qa-visible'); setState('idle')");await wait(200);
  if(qa){fs.mkdirSync(qa,{recursive:true});fs.writeFileSync(path.join(qa,'pet-window.png'),(await pet.webContents.capturePage()).toPNG());fs.writeFileSync(path.join(qa,'chat-window.png'),(await chat.webContents.capturePage()).toPNG());}
  await run("document.querySelector('[data-tab=settings]').click()");await wait(150);
  assert.equal(await run("document.querySelector('#settings').hidden"),false);
  if(qa)fs.writeFileSync(path.join(qa,'settings-window.png'),(await chat.webContents.capturePage()).toPNG());
  assert.deepEqual(errors,[]);
  const result={ok:true,trackingDefault:false,trackingToggle:true,missingKeyHandled:true,settingsSaved:true,audio,sprite,rendererErrors:errors,liveAPI:'not tested — no key supplied'};
  if(qa)fs.writeFileSync(path.join(qa,'result.json'),JSON.stringify(result,null,2));
  console.log('PHOEBE_SMOKE',JSON.stringify(result));
};

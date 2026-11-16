const canvas=document.querySelector('#pet'),ctx=canvas.getContext('2d'),atlas=new Image();atlas.src='assets/spritesheet.png';
const rows={idle:[0,[280,110,110,140,140,320]],'running-right':[1,[120,120,120,120,120,120,120,220]],'running-left':[2,[120,120,120,120,120,120,120,220]],waving:[3,[140,140,140,280]],jumping:[4,[140,140,140,140,280]],failed:[5,[140,140,140,140,140,140,140,240]],waiting:[6,[150,150,150,150,150,260]],running:[7,[120,120,120,120,120,220]],review:[8,[150,150,150,150,150,280]]};
let config={volume:.7,muted:false,tracking:false},state='idle',index=0,next=0,until=0,look=null,dragging=false,pointerStart=null,clip=0;
const audio=new Audio();
function setState(s,duration=1500){if(!rows[s])return;if(state!==s){index=0;next=0;}state=s;until=performance.now()+duration;}
function say(text){const b=document.querySelector('#bubble');b.textContent=text;b.hidden=false;clearTimeout(say.timer);say.timer=setTimeout(()=>b.hidden=true,3500);}
async function play(){setState('waving',1800);say('菲比啾比～');if(config.muted)return;audio.pause();audio.src=`assets/audio/jiubi-${clip++%3+1}.mp3`;audio.volume=config.volume;try{await audio.play();}catch{say('声音暂时没能播放');}}
function draw(t){if(t>until&&state!=='idle'&&!dragging){state='idle';index=0;next=0;}let row,col;
 if(config.tracking&&look?.index!=null&&state==='idle'&&!dragging){row=9+Math.floor(look.index/8);col=look.index%8;canvas.style.transform=`translate(${look.x}px,${look.y}px)`;}
 else{canvas.style.transform='';const spec=rows[state];if(t>=next){index=(index+1)%spec[1].length;next=t+spec[1][index];}row=spec[0];col=index;}
 ctx.clearRect(0,0,192,208);if(atlas.complete&&atlas.naturalWidth)ctx.drawImage(atlas,col*192,row*208,192,208,0,0,192,208);requestAnimationFrame(draw);}
requestAnimationFrame(draw);
function apply(s){config=s;document.querySelector('#track').setAttribute('aria-pressed',String(s.tracking));document.querySelector('#voice').title=s.muted?'已静音，更多菜单可开启':'播放菲比啾比';if(s.muted)audio.pause();}
window.phoebe.settings().then(apply);window.phoebe.on('settings',apply);window.phoebe.on('gaze',v=>look=v);window.phoebe.on('pet-state',s=>setState(s,s==='running'?65000:1600));window.phoebe.on('bubble',say);
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerStart={x:e.screenX,y:e.screenY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointerStart)return;if(!dragging&&Math.hypot(e.screenX-pointerStart.x,e.screenY-pointerStart.y)>5){dragging=true;window.phoebe.dragStart();}});
canvas.addEventListener('pointerup',()=>{if(!pointerStart)return;if(dragging){window.phoebe.dragEnd();dragging=false;setState('idle');}else play();pointerStart=null;});
canvas.addEventListener('pointercancel',()=>{window.phoebe.dragEnd();dragging=false;pointerStart=null;setState('idle');});
canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play();}});
document.querySelector('#talk').onclick=()=>window.phoebe.open('chat');document.querySelector('#voice').onclick=play;document.querySelector('#track').onclick=()=>window.phoebe.tracking(!config.tracking);document.querySelector('#more').onclick=()=>window.phoebe.menu();

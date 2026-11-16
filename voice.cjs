function profile({url,model,voice,key=''}) {
 const u=new URL(url.trim());if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('address');
 if(!model.trim()||!voice.trim()||model.length>160||voice.length>256||key.length>600||/\s/.test(key))throw Error('profile');
 let p=u.pathname.replace(/\/+$/,'');if(!p)p='/v1';if(!p.endsWith('/audio/speech'))p+='/audio/speech';u.pathname=p;return {url:u.href,model:model.trim(),voice:voice.trim(),key};
}
async function synthesize(p,text,transport=fetch){
 if(!p||typeof text!=='string'||!text.trim())throw Error('missing');const res=await transport(p.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(p.key?{Authorization:'Bearer '+p.key}:{})},body:JSON.stringify({model:p.model,voice:p.voice,input:text.slice(0,2000),response_format:'mp3'})});
 if(!res.ok)throw Error('HTTP '+res.status);let size=0;const chunks=[];for await(const chunk of res.body){size+=chunk.length;if(size>8*1024*1024)throw Error('size');chunks.push(chunk)}if(!size)throw Error('empty');return Buffer.concat(chunks);
}
module.exports={profile,synthesize};

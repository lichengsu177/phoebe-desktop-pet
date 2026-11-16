const test=require('node:test');
const assert=require('node:assert/strict');
const {ENDPOINT,gaze,clampPosition,requestReply,responseText}=require('../core.cjs');
test('gaze maps all 16 screen directions clockwise from up, with dead zone',()=>{
  for(let i=0;i<16;i++){const a=i*Math.PI/8;assert.equal(gaze(200*Math.sin(a),-200*Math.cos(a)),i);}
  assert.equal(gaze(0,0),null);assert.equal(gaze(20,20),null);assert.equal(gaze(NaN,12),null);
  assert.equal(gaze(-1,-200),0);
});
test('drag clamps to current monitor, including negative coordinates',()=>{
  const a={x:-1440,y:0,width:1440,height:900};
  assert.deepEqual(clampPosition(-1500,800,a),{x:-1440,y:600});
  assert.deepEqual(clampPosition(100,-100,a),{x:-240,y:0});
});
test('request uses official endpoint, no server storage, and preserves replayable output',async()=>{
  const output=[{type:'reasoning',encrypted_content:'test-encrypted'}, {type:'message',role:'assistant',content:[{type:'output_text',text:'你好呀'}]}];
  const input=[{role:'user',content:'你好'}];
  const ac=new AbortController();
  const result=await requestReply({key:'test-only-key',input,signal:ac.signal,fetchImpl:async(url,opts)=>{
    assert.equal(url,ENDPOINT);assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(opts.redirect,'error');
    assert.equal(opts.signal,ac.signal);assert.equal(opts.headers.Authorization,'Bearer test-only-key');
    const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.deepEqual(body.input,input);assert.deepEqual(body.reasoning,{effort:'none'});
    assert.deepEqual(body.include,['reasoning.encrypted_content']);
    return {ok:true,json:async()=>({status:'completed',output})};
  }});
  assert.equal(result.text,'你好呀');assert.deepEqual(result.output,output);
});
test('missing key does not call network',async()=>{
  await assert.rejects(requestReply({key:'',input:[],fetchImpl:()=>{throw new Error('Network should not be reached');}}),/设置.*API Key/);
});
test('quota errors and incomplete responses are actionable',async()=>{
  await assert.rejects(requestReply({key:'test',input:[],fetchImpl:async()=>({ok:false,status:429})}),/额度或频率/);
  await assert.rejects(requestReply({key:'test',input:[],fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete',output:[]})})}),/完整生成/);
});
test('cancellation reaches transport',async()=>{
  const ac=new AbortController();ac.abort();
  await assert.rejects(requestReply({key:'test',input:[],signal:ac.signal,fetchImpl:async(_,opts)=>{opts.signal.throwIfAborted();}}),{name:'AbortError'});
});
test('refusal text renders without pretending it is an empty answer',()=>{
  assert.equal(responseText({output:[{type:'message',content:[{type:'refusal',refusal:'无法协助这个请求'}]}]}),'无法协助这个请求');
});

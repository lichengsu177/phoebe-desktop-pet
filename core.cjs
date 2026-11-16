const ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-6-luna';
const PERSONA = '你是桌面小伙伴「菲比啾比」，一个受《鸣潮》菲比启发的同人 AI 角色。用自然简短的中文陪用户聊天、鼓励和帮忙，温柔认真、偶尔俏皮，通常回复一到三句话。可以偶尔说「菲比啾比～」，不要每次都重复。不要声称自己是游戏官方角色、真人或具有未接入的功能。用户需要具体帮助时准确回答，不知道就说明。不能看到用户屏幕或文件，也不能操作电脑；不要假装已经完成动作。';
function gaze(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx,dy)<46) return null;
  return Math.round(((Math.atan2(dx,-dy)*180/Math.PI+360)%360)/22.5)%16;
}
function clampPosition(x,y,area,w=240,h=300) {
  return {x:Math.round(Math.max(area.x,Math.min(x,area.x+area.width-w))),y:Math.round(Math.max(area.y,Math.min(y,area.y+area.height-h)))};
}
function responseText(data) {
  return (data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'||x.type==='refusal').map(x=>x.text||x.refusal||'').join('\n').trim();
}
function errorFor(status) {
  if(status===401)return '密钥无效，请到设置中重新填写 OpenAI API Key。';
  if(status===403)return '此账号暂时无法访问该服务或模型，请检查 OpenAI 账号权限。';
  if(status===404)return '当前账号无法使用这个模型，请在设置中填写可用模型名。';
  if(status===429)return 'OpenAI 的额度或频率限制已触发，请检查 API 余额后稍后重试。';
  return `OpenAI 暂时没有响应（${status}），请稍后再试。`;
}
async function requestReply({key,model=DEFAULT_MODEL,input,signal,fetchImpl=fetch}) {
  if(!key)throw new Error('先在设置中填写 OpenAI API Key，就可以和我聊天啦。');
  const body={model,instructions:PERSONA,input,store:false,max_output_tokens:2048,include:['reasoning.encrypted_content']};
  if(model.startsWith('gpt-6'))body.reasoning={effort:'none'};
  const response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if(!response.ok)throw new Error(errorFor(response.status));
  const data=await response.json();
  if(data.status==='incomplete')throw new Error('这次回答没能完整生成，请缩短问题后重试。');
  const text=responseText(data);
  if(!text)throw new Error('这次没有收到文字回答，再试一次吧。');
  // Preserve complete replayable output items, including encrypted reasoning.
  return {text,output:data.output||[]};
}
module.exports={ENDPOINT,DEFAULT_MODEL,gaze,clampPosition,responseText,requestReply};

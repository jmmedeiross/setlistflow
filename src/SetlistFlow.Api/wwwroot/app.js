'use strict';
const $ = id => document.getElementById(id);
const state = { tracks: [], shows: [], show: null, plan: null, busy: false, stageIndex: 0, readOnly: false };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = seconds => `${String(Math.floor(Math.abs(seconds)/60)).padStart(2,'0')}:${String(Math.abs(seconds)%60).padStart(2,'0')}`;
const clone = value => structuredClone(value);
function duration(value) {
  if (!/^\d{1,2}:[0-5]\d$/.test(value.trim())) throw Error('Use mm:ss, por exemplo 02:45.');
  const [m,s] = value.trim().split(':').map(Number); const result = m*60+s;
  if (result < 1 || result > 3600) throw Error('A duração deve ficar entre 00:01 e 60:00.');
  return result;
}
function timing(plan) {
  const performance = plan.items.reduce((n,i)=>n+(i.liveSeconds ?? i.studioSeconds),0);
  const intro = plan.items.reduce((n,i)=>n+i.introSeconds,0);
  const pause = plan.items.reduce((n,i)=>n+i.pauseSeconds,0);
  const usable = plan.limitSeconds-plan.marginSeconds;
  return { total: performance+intro+pause, usable, remaining: usable-performance-intro-pause, extra: intro+pause,
    estimates: plan.items.filter(i=>i.liveSeconds === null).length };
}
function dirty() { return state.show && JSON.stringify(state.plan) !== JSON.stringify(state.show.draft.plan); }
function notify(text, error=false) { $('notice').textContent=text; $('notice').classList.toggle('error',error); }
async function api(path, method='GET', body) {
  const abort = new AbortController(); const timer = setTimeout(()=>abort.abort(),15000);
  try {
    const response = await fetch(`/api${path}`,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal});
    const result = response.status===204 ? null : await response.json();
    if(!response.ok) throw Error(result?.error ?? 'Não foi possível concluir a operação.');
    return result;
  } catch(error) {
    if(error.name==='AbortError')throw Error('A operação demorou demais. Recarregue para verificar se foi salva antes de tentar novamente.');
    throw error;
  } finally { clearTimeout(timer); }
}
async function operation(fn) {
  if(state.busy)return; state.busy=true; updateMetrics();
  try { await fn(); } catch(error) { notify(error.message,true); } finally {state.busy=false;updateMetrics();}
}
function sample() {
  const order=['leans-pt2','flashbacks','amiri','safety','viciar','fim'];
  return {name:'Festival · estudo de caso',limitSeconds:1800,marginSeconds:120,items:order.map((id,index)=>{
    const t=state.tracks.find(t=>t.id===id);
    return {entryId:crypto.randomUUID(),trackId:t.id,title:t.title,album:t.album,studioSeconds:t.studioSeconds,liveSeconds:null,introSeconds:0,pauseSeconds:index===order.length-1?0:20,energy:'',cue:''};
  })};
}
function setShow(show) {state.show=show;state.plan=clone(show.draft.plan);render();}
async function refreshShows() {state.shows=await api('/shows');renderNavigation();}
function renderNavigation() {
  $('shows').innerHTML=state.shows.map(s=>`<button data-show="${esc(s.id)}" class="${state.show?.id===s.id?'active':''}">${esc(s.draft.plan.name)}<small>${s.approved?'Roteiro aprovado':'Rascunho'} · ${time(s.draft.timing.totalSeconds)}</small></button>`).join('');
}
function render() {
  $('loading').hidden=true;$('workspace').hidden=false;
  $('show-name').value=state.plan.name;$('limit').value=state.plan.limitSeconds/60;$('margin').value=state.plan.marginSeconds/60;
  renderNavigation();renderItems();renderCatalog();renderHistory();updateMetrics();
  for(const id of ['show-name','limit','margin','new-show','new-track'])$(id).disabled=state.readOnly;
}
function renderItems() {
  const open=new Set([...$('set-items').querySelectorAll('details[open]')].map(el=>el.dataset.entry));
  $('set-items').innerHTML=state.plan.items.map((i,index)=>`<li data-entry="${esc(i.entryId)}"><div class="item-head"><span class="item-index">${String(index+1).padStart(2,'0')}</span><div class="item-title"><strong>${esc(i.title)}</strong><small>${esc(i.album)} · ${i.liveSeconds===null?'Gravação / estimativa':'Versão de palco'}</small></div>${i.energy?`<span class="energy ${esc(i.energy)}">${({baixa:'Baixa',media:'Média',alta:'Alta'})[i.energy]} · manual</span>`:''}<span class="item-time">${time(i.liveSeconds ?? i.studioSeconds)}</span><div class="row-actions"><button data-action="up" aria-label="Mover ${esc(i.title)} para cima" ${index===0||state.readOnly?'disabled':''}>↑</button><button data-action="down" aria-label="Mover ${esc(i.title)} para baixo" ${index===state.plan.items.length-1||state.readOnly?'disabled':''}>↓</button><button class="delete" data-action="remove" aria-label="Remover ${esc(i.title)}" ${state.readOnly?'disabled':''}>×</button></div></div><details data-entry="${esc(i.entryId)}" ${open.has(i.entryId)?'open':''}><summary>Versão e sinais de palco${i.cue?' · com instruções':''}</summary><div class="item-fields"><label>Duração ao vivo<input data-field="liveSeconds" aria-label="Duração ao vivo de ${esc(i.title)}" placeholder="${time(i.studioSeconds)}" value="${i.liveSeconds===null?'':time(i.liveSeconds)}" ${state.readOnly?'disabled':''}></label><label>Intro (segundos)<input type="number" data-field="introSeconds" min="0" max="600" step="1" value="${i.introSeconds}" aria-label="Intro de ${esc(i.title)}" ${state.readOnly?'disabled':''}></label><label>Pausa após (segundos)<input type="number" data-field="pauseSeconds" min="0" max="600" step="1" value="${i.pauseSeconds}" aria-label="Pausa após ${esc(i.title)}" ${state.readOnly?'disabled':''}></label><label>Energia · manual<select data-field="energy" aria-label="Energia de ${esc(i.title)}" ${state.readOnly?'disabled':''}><option value="">Sem classificação</option>${['baixa','media','alta'].map(e=>`<option value="${e}" ${e===i.energy?'selected':''}>${({baixa:'Baixa',media:'Média',alta:'Alta'})[e]}</option>`).join('')}</select></label><label class="wide">Sinais para DJ, áudio e iluminação<textarea data-field="cue" maxlength="500" aria-label="Sinais de palco de ${esc(i.title)}" placeholder="Escreva a instrução para a equipe…" ${state.readOnly?'disabled':''}>${esc(i.cue)}</textarea></label><p class="helper">Ao vivo em branco usa a gravação como estimativa. Pausas são somadas, inclusive após a última faixa se informadas. Instruções deste estudo de caso são fictícias.</p></div></details></li>`).join('');
  $('empty-set').hidden=state.plan.items.length>0;
}
function renderCatalog() {
  const filter=$('search').value.trim().toLocaleLowerCase('pt-BR');
  const tracks=state.tracks.filter(t=>`${t.title} ${t.album}`.toLocaleLowerCase('pt-BR').includes(filter));
  $('catalog-items').innerHTML=tracks.map(t=>`<article class="catalog-card"><span class="album-tile ${t.album==='MR.'?'mr':''}">${esc(t.album.slice(0,5))}</span><div class="info"><strong>${esc(t.title)}</strong><small>${esc(t.album)} · ${time(t.studioSeconds)}</small>${t.sourceUrl?`<a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ↗</a>`:''}</div><button data-add="${esc(t.id)}" aria-label="Adicionar ${esc(t.title)} ao repertório" ${state.readOnly?'disabled':''}>＋</button></article>`).join('')||'<p class="helper">Nenhuma faixa encontrada.</p>';
}
function updateMetrics() {
  if(!state.plan)return;
  for(const input of $('workspace').querySelectorAll('input:not(#search),textarea,select')) input.disabled=state.busy||state.readOnly;
  for(const id of ['new-show','new-track'])$(id).disabled=state.busy||state.readOnly;
  for(const btn of $('shows').querySelectorAll('button'))btn.disabled=state.busy;
  for(const btn of $('catalog-items').querySelectorAll('button'))btn.disabled=state.busy||state.readOnly;
  for(const [index,row] of [...$('set-items').children].entries())for(const btn of row.querySelectorAll('button'))btn.disabled=state.busy||state.readOnly||(btn.dataset.action==='up'&&index===0)||(btn.dataset.action==='down'&&index===state.plan.items.length-1);
  const t=timing(state.plan);$('total').textContent=time(t.total);
  $('remaining').textContent=t.remaining<0?`${time(t.remaining)} acima do limite utilizável`:`${time(t.remaining)} disponíveis no roteiro`;
  $('remaining').classList.toggle('over',t.remaining<0);
  $('budget-meter').value=t.usable>0?Math.min(100,t.total/t.usable*100):100;
  $('budget-meter').setAttribute('aria-valuetext',`${time(t.total)} de ${time(Math.max(0,t.usable))}`);
  $('budget-caption').textContent=`${time(Math.max(0,t.usable))} utilizáveis · margem de ${time(state.plan.marginSeconds)}`;
  $('track-count').textContent=state.plan.items.length;$('extra-time').textContent=time(t.extra);
  $('live-count').textContent=state.plan.items.length-t.estimates;$('estimates').textContent=`${t.estimates} estimadas`;
  $('save-status').textContent=state.readOnly?'Demonstração em consulta':dirty()?'Alterações não salvas':'Rascunho salvo';
  $('save-caption').textContent=`Revisão ${state.show.draft.number} · ${state.show.approved?'Aprovado: revisão '+state.show.approved.number:'Ainda sem roteiro aprovado'}`;
  $('revision-label').textContent=`R${String(state.show.draft.number).padStart(2,'0')}`;
  $('save').disabled=state.busy||!dirty()||state.readOnly;
  $('approve').disabled=state.busy||t.remaining<0||state.plan.items.length===0||state.readOnly;
  $('reload').disabled=state.busy;
  $('stage').disabled=state.busy||!state.show.approved;
  $('export').disabled=state.busy||!state.show.approved;
}
function renderHistory() {
  const a=state.show.approved;$('approved-status').textContent=a?`R${String(a.number).padStart(2,'0')} aprovado`:'Aguardando aprovação';$('approved-status').classList.toggle('waiting',!a);
  $('history').innerHTML=state.show.history.map(r=>`<button data-revision="${r.id}">R${String(r.number).padStart(2,'0')} ${a?.id===r.id?'· aprovado':''}<small>${time(r.timing.totalSeconds)} · ${new Date(r.createdAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></button>`).join('');
}
function validInputs() {return [...$('workspace').querySelectorAll('input,textarea,select')].every(el=>el.reportValidity());}
async function saveDraft() {
  if(!validInputs())throw Error('Corrija os campos destacados antes de salvar.');
  if(dirty()) {
    const show=await api(`/shows/${state.show.id}`,'PUT',{expectedVersion:state.show.version,plan:state.plan});
    setShow(show);await refreshShows();
  }
}
$('show-name').addEventListener('input',()=>{state.plan.name=$('show-name').value;updateMetrics();});
for(const [id,field] of [['limit','limitSeconds'],['margin','marginSeconds']])$(id).addEventListener('input',()=>{const input=$(id);const n=Number(input.value);if(input.value===''||!Number.isInteger(n)){input.setCustomValidity('Informe minutos inteiros.');return;}input.setCustomValidity('');state.plan[field]=n*60;updateMetrics();});
$('search').addEventListener('input',renderCatalog);
$('catalog-items').addEventListener('click',e=>{const btn=e.target.closest('[data-add]');if(!btn||state.readOnly)return;const t=state.tracks.find(t=>t.id===btn.dataset.add);state.plan.items.push({entryId:crypto.randomUUID(),trackId:t.id,title:t.title,album:t.album,studioSeconds:t.studioSeconds,liveSeconds:null,introSeconds:0,pauseSeconds:0,energy:'',cue:''});renderItems();updateMetrics();notify(`${t.title} adicionada ao rascunho.`);});
$('set-items').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn||state.readOnly)return;const id=btn.closest('li').dataset.entry;const index=state.plan.items.findIndex(i=>i.entryId===id);const action=btn.dataset.action;if(action==='remove')state.plan.items.splice(index,1);else{const target=index+(action==='up'?-1:1);if(target<0||target>=state.plan.items.length)return;[state.plan.items[index],state.plan.items[target]]=[state.plan.items[target],state.plan.items[index]];}renderItems();updateMetrics();});
function updateField(e) {
  const input=e.target;const field=input.dataset.field;if(!field||state.readOnly)return;
  const item=state.plan.items.find(i=>i.entryId===input.closest('li').dataset.entry);
  try {
    input.setCustomValidity('');
    if(field==='liveSeconds')item[field]=input.value.trim()===''?null:duration(input.value);
    else if(field==='introSeconds'||field==='pauseSeconds'){if(input.value===''||!Number.isInteger(Number(input.value))||Number(input.value)<0||Number(input.value)>600)throw Error('Use um número inteiro de 0 a 600.');item[field]=Number(input.value);}
    else item[field]=input.value;
    const head=input.closest('li').querySelector('.item-head');head.querySelector('.item-time').textContent=time(item.liveSeconds ?? item.studioSeconds);head.querySelector('.item-title small').textContent=`${item.album} · ${item.liveSeconds===null?'Gravação / estimativa':'Versão de palco'}`;
    updateMetrics();
  } catch(error) {input.setCustomValidity(error.message);if(e.type==='change'){input.reportValidity();notify(error.message,true);}}
}
$('set-items').addEventListener('input',updateField);
$('set-items').addEventListener('change',updateField);
$('save').addEventListener('click',()=>operation(async()=>{await saveDraft();notify('Rascunho salvo. A versão aprovada foi preservada.');}));
$('approve').addEventListener('click',()=>operation(async()=>{await saveDraft();const show=await api(`/shows/${state.show.id}/approve`,'POST',{expectedVersion:state.show.version});setShow(show);await refreshShows();notify(`Revisão ${show.approved.number} aprovada. O roteiro está pronto para o palco.`);}));
$('reload').addEventListener('click',()=>{if(dirty()&&!confirm('Descartar as alterações locais e carregar o roteiro salvo?'))return;operation(async()=>{setShow(await api(`/shows/${state.show.id}`));notify('Versão atual recarregada.');});});
$('shows').addEventListener('click',e=>{const btn=e.target.closest('[data-show]');if(!btn||btn.dataset.show===state.show?.id)return;if(dirty()&&!confirm('Descartar as alterações locais para trocar de apresentação?'))return;operation(async()=>{setShow(await api(`/shows/${btn.dataset.show}`));notify('');});});
$('new-show').addEventListener('click',()=>{if(state.readOnly)return;if(dirty()&&!confirm('Descartar as alterações locais e criar outra apresentação?'))return;operation(async()=>{const show=await api('/shows','POST',{name:'Nova apresentação · conceito',limitSeconds:2700,marginSeconds:120,items:[]});setShow(show);await refreshShows();notify('Nova apresentação criada. Adicione as faixas do catálogo.');$('show-name').focus();});});
$('new-track').addEventListener('click',()=>{$('track-dialog').showModal();});
$('cancel-track').addEventListener('click',()=>{$('track-dialog').close();});
$('track-form').addEventListener('submit',e=>{e.preventDefault();operation(async()=>{const data=new FormData(e.target);const t=await api('/tracks','POST',{title:data.get('title'),album:data.get('album'),studioSeconds:duration(data.get('duration')),sourceUrl:data.get('source')});state.tracks.push(t);renderCatalog();e.target.reset();$('track-dialog').close();notify('Faixa cadastrada. A duração ao vivo pode ser ajustada no repertório.');});});
function showStage() {
  const r=state.show.approved;const i=r.plan.items[state.stageIndex];
  $('stage-revision').textContent=`${r.plan.name} · roteiro aprovado R${r.number}`;
  $('stage-title').textContent=i.title;$('stage-duration').textContent=`${time(i.liveSeconds ?? i.studioSeconds)}${i.liveSeconds===null?' · estimativa':''}`;
  $('stage-position').textContent=`Faixa ${state.stageIndex+1} de ${r.plan.items.length}`;
  $('stage-cue').textContent=i.cue||'Sem sinal de palco registrado nesta revisão.';
  $('stage-next').textContent=r.plan.items[state.stageIndex+1]?.title||'Fim do repertório';
  $('stage-prev').disabled=state.stageIndex===0;$('stage-next-btn').disabled=state.stageIndex===r.plan.items.length-1;
}
$('stage').addEventListener('click',()=>{state.stageIndex=0;showStage();$('stage-dialog').showModal();});
$('close-stage').addEventListener('click',()=>$('stage-dialog').close());
$('stage-prev').addEventListener('click',()=>{if(state.stageIndex>0){state.stageIndex--;showStage();}});
$('stage-next-btn').addEventListener('click',()=>{if(state.stageIndex<state.show.approved.plan.items.length-1){state.stageIndex++;showStage();}});
$('history').addEventListener('click',e=>{const btn=e.target.closest('[data-revision]');if(!btn)return;const r=state.show.history.find(r=>r.id===Number(btn.dataset.revision));$('revision-title').textContent=`Revisão ${r.number} · ${r.plan.name}`;$('revision-body').innerHTML=`<h3>${time(r.timing.totalSeconds)} planejados / ${time(r.timing.usableSeconds)} utilizáveis</h3><ol>${r.plan.items.map(i=>`<li><strong>${esc(i.title)}</strong> · ${time(i.liveSeconds ?? i.studioSeconds)}${i.liveSeconds===null?' (estimativa)':''}<br>${esc(i.cue||'Sem sinal registrado')}</li>`).join('')}</ol>`;$('revision-dialog').showModal();});
$('close-revision').addEventListener('click',()=>$('revision-dialog').close());
$('export').addEventListener('click',()=>{
  const r=state.show.approved;let at=0;
  const rows=r.plan.items.map((i,index)=>{const start=at;at+=i.introSeconds+(i.liveSeconds ?? i.studioSeconds)+i.pauseSeconds;return `<tr><td>${index+1}</td><td><strong>${esc(i.title)}</strong><div class="print-cue">${esc(i.cue)}</div></td><td>${time(start)}</td><td>${time(i.liveSeconds ?? i.studioSeconds)}${i.liveSeconds===null?'*':''}</td><td>${i.introSeconds}s / ${i.pauseSeconds}s</td></tr>`;}).join('');
  $('print-view').innerHTML=`<h1>${esc(r.plan.name)}</h1><h2>Yunk Vino · artista de referência</h2><p>Roteiro aprovado · revisão ${r.number}<br>Total: ${time(r.timing.totalSeconds)} · utilizável: ${time(r.timing.usableSeconds)} · margem: ${time(r.plan.marginSeconds)}</p><table><thead><tr><th>#</th><th>Faixa / sinais</th><th>Início da entrada</th><th>Performance</th><th>Intro / pausa</th></tr></thead><tbody>${rows}</tbody></table><small>* Duração de gravação usada como estimativa de palco.<br>Projeto independente de portfólio. Briefing simulado, sem vínculo ou aprovação do artista. Evento e instruções fictícios. Tempos relativos incluem intros e pausas, sem sobreposição.</small>`;
  window.print();
});
window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
async function init() {
  try {const config=await api('/config');state.readOnly=config.readOnly;state.tracks=await api('/tracks');state.shows=await api('/shows');
    if(state.shows.length===0&&!state.readOnly){const s=await api('/shows','POST',sample());state.shows=[s];}
    if(state.shows.length===0){$('loading').textContent='Nenhuma apresentação disponível nesta demonstração.';return;}
    setShow(state.shows[0]);
  } catch(error){$('loading').textContent='Não foi possível carregar o workspace. Atualize a página para tentar novamente.';notify(error.message,true);}
}
init();

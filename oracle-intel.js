/* ==========================================================================
   ORACLE INTELLIGENCE LAYER v0.5 — COMPLETE FILE
   SOLE state input: window.oracleStatePacket() — sent VERBATIM, never rebuilt.
   No duplicate state, no client policy engine, no secrets. Server is the
   authoritative validator; this file is a display mirror. No Apply buttons
   for NEED_INFO/REJECT verdicts.
   ========================================================================== */
(function(){
"use strict";
const NS='oracle_intel';
const $id=id=>document.getElementById(id);
const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(_){return null}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString('en-CA');

let cfg=Object.assign({backend:'',lastSync:null},read(NS+'.cfg')||{});
const saveCfg=()=>write(NS+'.cfg',cfg);

/* ── CANONICAL BOUNDARY — the only state accessor in this file ── */
function canonical(){
  if(typeof window.oracleStatePacket!=='function'){
    throw new Error('window.oracleStatePacket() not found — ORACLE must expose its canonical '
      +'projection; this layer does not construct state itself');
  }
  return JSON.parse(JSON.stringify(window.oracleStatePacket()));   // verbatim, deep-copied
}

/* ── local UI event log (display only — NOT a policy engine, NOT canonical) ── */
const readAudit=()=>{try{return JSON.parse(localStorage.getItem(NS+'.audit')||'[]')}catch(_){return[]}};
function audit(e){const a=readAudit();a.unshift({t:iso(),...e});write(NS+'.audit',a.slice(0,500));}

let lastDecision=null;

/* ── backend calls ── */
async function sync(){
  if(!cfg.backend)return{ok:false,reason:'no backend URL configured'};
  try{
    const r=await fetch(cfg.backend+'/api/state',{method:'PUT',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(canonical())});
    if(!r.ok)throw new Error('PUT /api/state -> '+r.status);
    const j=await r.json();cfg.lastSync={v:j.version,ts:iso()};saveCfg();
    return{ok:true,version:j.version};
  }catch(e){return{ok:false,reason:String(e)}}
}
async function ask(question){
  question=(question||'').trim();
  const area=$id('oi-dec');if(!area)return;
  if(!question)return;
  if(!cfg.backend){renderNotice('No backend configured — ORACLE\u2019s deterministic decision engine '
    +'runs server-side. Start server.py and set the backend URL below.');return}
  let pkt;
  try{pkt=canonical()}
  catch(e){renderNotice(e.message);return}
  area.innerHTML='<div class="mono" style="font-size:12px;color:var(--faint)">canonical packet → reasoning → ORACLE validating…</div>';
  try{
    const r=await fetch(cfg.backend+'/api/reason',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({question,packet:pkt})});
    if(r.status===501){const j=await r.json().catch(()=>({}));
      renderNotice('AI layer dormant — '+String(j.detail||'set ORACLE_AI_KEY or ORACLE_AI_MOCK=1 on the server'));return}
    if(!r.ok)throw new Error((await r.text()).slice(0,160));
    const j=await r.json();lastDecision=j;
    audit({kind:'ai_decision',id:j.id,verdict:j.validation?.verdict,mode:j.mode,question});
    renderDecision(j);
  }catch(e){renderNotice('Backend error: '+e.message)}
}
async function resolve(id,action,variant){
  if(!cfg.backend||!id)return;
  try{await fetch(cfg.backend+'/api/decision',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id,action,variant:variant||null})})}catch(_){}
  audit({kind:'decision:'+action,id,variant:variant||null});render();
}

/* ── evidence ledger — server table is authoritative; this UI only posts/reads ── */
async function addEvidence(){
  const ref=$id('oi-ev-ref').value.trim(),skill=$id('oi-ev-skill').value.trim();
  if(!cfg.backend){$id('oi-status').textContent='evidence ledger requires the backend';return}
  if(!ref||!skill)return;
  try{
    await fetch(cfg.backend+'/api/evidence',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind:$id('oi-ev-kind').value.trim()||'artifact',ref,skill,
        quality:parseFloat($id('oi-ev-q').value)||0.5})});
    audit({kind:'evidence_add',ref});render();
  }catch(e){$id('oi-status').textContent='evidence add failed: '+e.message.slice(0,40)}
}
async function loadEvidence(){
  if(!cfg.backend)return[];
  try{const r=await fetch(cfg.backend+'/api/evidence');return r.ok?await r.json():[]}catch(_){return[]}
}

/* ── RENDER — display mirror only; every verdict/field comes from the server ── */
const vpill=v=>`<span class="pill ${v==='ACCEPT'?'open':v==='MODIFY'?'soon':(v==='NEED_INFO'||v==='REQUEST_INFO')?'tbd':'closed'}">${esc(v||'—')}</span>`;
const list=(lbl,items,color)=>!items?.length?'':
  `<div style="margin-top:12px"><div class="mono" style="font-size:10px;letter-spacing:2px;color:${color};margin-bottom:4px">${lbl}</div>
   ${items.map(x=>`<div style="font-size:13px;color:var(--txt);padding:2px 0 2px 12px;border-left:2px solid ${color};margin-bottom:4px">${esc(x)}</div>`).join('')}</div>`;
const block=(lbl,txt,color)=>!txt?'':
  `<div style="border-left:3px solid ${color};padding:6px 12px;margin-top:10px;font-size:13px">
   <b class="mono" style="font-size:10px;letter-spacing:2px;color:${color}">${lbl}</b><br>${esc(txt)}</div>`;
function renderNotice(msg){
  const el=$id('oi-dec');if(!el)return;
  el.innerHTML=`<div class="mono" style="font-size:12px;color:var(--amber);border-left:3px solid var(--amber);padding:6px 12px">${esc(msg)}</div>`;
}
function renderDecision(j){
  const rec=j.recommendation||{},v=j.validation||{};
  const el=$id('oi-dec'),conf=(rec.confidence??0);
  const modified=(v.verdict==='MODIFY'&&v.modified);
  const canApply=(v.verdict==='ACCEPT'||v.verdict==='MODIFY');   // no APPLY for NEED_INFO/REJECT
  el.innerHTML=`
   <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
     ${vpill(v.verdict)}
     <span class="mono" style="font-size:11px;color:var(--faint)">decision #${j.id} · ${esc(j.mode||'?')} reasoning · confidence ${conf.toFixed(2)}</span></div>
   ${rec.primary_action?`<div class="primary"><div class="plbl">PRIMARY ACTION · ORIGINAL AI PROPOSAL (unmodified)</div>
     <div style="font-size:15px;font-weight:650">${esc(rec.primary_action)}</div>
     <div class="mono" style="font-size:11px;color:var(--dim);margin-top:6px">${rec.minutes||0} min · ${esc(rec.expected_impact||'')}</div></div>`:''}
   ${modified?`<div style="background:color-mix(in srgb,var(--amber) 8%,var(--panel));border:1px solid color-mix(in srgb,var(--amber) 45%,transparent);border-radius:10px;padding:12px 14px;margin-top:12px">
     <div class="mono" style="font-size:10px;letter-spacing:2px;color:var(--amber);margin-bottom:6px">ORACLE DETERMINISTIC MODIFICATION — original preserved above</div>
     <div style="font-size:14px;font-weight:650">${esc(v.modified.primary_action)}</div>
     <div class="mono" style="font-size:11px;color:var(--dim);margin-top:4px">minutes: ${v.modified.minutes}</div>
     ${list('EXACT REASON',v.fix_reasons,'var(--amber)')}</div>`:''}
   ${block('CURRENT GAP',rec.current_gap,'var(--txt)')}
   ${block('BIGGEST BOTTLENECK',rec.bottleneck,'var(--amber)')}
   ${list('WHY THIS IS THE HIGHEST-VALUE ACTION',rec.why,'var(--txt)')}
   ${list('DO NOT',rec.do_not,'var(--red)')}
   ${block('SUCCESS CONDITION',rec.success_condition,'var(--green)')}
   <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
     <span class="mono" style="font-size:10px;letter-spacing:2px;color:var(--faint)">CONFIDENCE</span>
     <div style="flex:1;height:4px;background:var(--line);border-radius:2px;overflow:hidden">
       <i style="display:block;height:100%;width:${Math.round(conf*100)}%;background:var(--acc)"></i></div>
     <b class="mono" style="font-size:12px">${conf.toFixed(2)}</b></div>
   ${v.mission?.note?block('MISSION CHECK — '+esc(v.mission.basis||'no basis')+(v.mission.complete?' · COMPLETE':''),
     v.mission.note+(v.mission.matched_terms?.length?(' · matched: '+v.mission.matched_terms.join(', ')):''),
     v.mission.ok===false?'var(--red)':v.mission.ok===true?'var(--green)':'var(--amber)'):''}
   ${rec.missing_information?.length?block('MISSING INFORMATION — ORACLE will not invent an answer',
     rec.missing_information.join(' · '),'var(--amber)'):''}
   ${(v.missing?.length)?block('DECISION WITHHELD — MISSING CANONICAL FIELDS',
     v.missing.join(' · '),'var(--amber)'):''}
   ${v.verdict==='NEED_INFO'?`<div class="mono" style="font-size:11px;color:var(--amber);margin-top:10px">No Apply button is offered for NEED_INFO — supply the missing canonical state in ORACLE, then ask again.</div>`:''}
   ${rec.roadmap_change?`<div style="border:1px dashed var(--violet);border-radius:10px;padding:10px 14px;margin-top:12px;font-size:13px">
     <b class="mono" style="font-size:10px;letter-spacing:2px;color:var(--violet)">PROPOSED ROADMAP CHANGE — NOT APPLIED · ORACLE records, you decide</b><br>
     ${esc(typeof rec.roadmap_change==='string'?rec.roadmap_change:JSON.stringify(rec.roadmap_change))}</div>`:''}
   ${v.violations?.length?list('VALIDATION — VIOLATIONS',v.violations,'var(--red)'):''}
   ${v.warnings?.length?list('VALIDATION — WARNINGS',v.warnings,'var(--amber)'):''}
   ${v.unresolved_fields?.length?list('CANONICAL PACKET — UNRESOLVED FIELDS (reported, never defaulted)',
     v.unresolved_fields,'var(--amber)'):''}
   <div class="mono" style="font-size:10px;color:var(--faint);margin-top:10px">evidence: ${esc((rec.evidence_used||[]).join(', ')||'—')} · market: ${esc((rec.market_signals_used||[]).join(', ')||'—')}</div>
   ${j.id&&canApply?`<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
     ${modified?`<button class="sbtn" data-res="accept" data-var="modified">Accept ORACLE modification</button>
                 <button class="sbtn" data-res="accept" data-var="original">Accept original anyway</button>`
               :`<button class="sbtn" data-res="accept">Accept &amp; log</button>`}
     <button class="sbtn" data-res="complete">Completed</button>
     <button class="sbtn red" data-res="reject">Reject</button></div>`
   :j.id?`<div style="display:flex;gap:8px;margin-top:14px">
     <button class="sbtn red" data-res="reject">Reject</button>
     <button class="sbtn" data-res="dismiss">Dismiss</button></div>`:''}`;
  el.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>resolve(j.id,b.dataset.res,b.dataset.var||null));
}
async function render(){
  const body=$id('oi-body');if(!body)return;
  let pktInfo='unavailable',mode='';
  try{const p=canonical();pktInfo=`${Object.keys(p).length} top-level keys`;if(p.schema)pktInfo+=' · '+esc(p.schema);}
  catch(e){pktInfo=e.message}
  if(cfg.backend){try{const h=await(await fetch(cfg.backend+'/api/health')).json();
    mode=h.mock?'MOCK':(h.ai_configured?'LIVE':'dormant')}catch(_){mode='unreachable'}}
  const a=readAudit(),ev=await loadEvidence();
  const syncInfo=cfg.lastSync?`v${cfg.lastSync.v} @ ${esc(cfg.lastSync.ts.slice(11,19))}`:'never';
  body.innerHTML=`
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 28px;margin-bottom:12px;font-size:12.5px;color:var(--dim)">
     <div><span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--faint)">CANONICAL STATE</span><br>${esc(pktInfo)}</div>
     <div><span class="mono" style="font-size:10px;letter-spacing:1.5px;color:var(--faint)">BACKEND</span><br>
       ${cfg.backend?esc(cfg.backend.replace(/^https?:\/\//,'')):'not configured'} · ${esc(mode||'—')} · sync ${syncInfo}</div></div>
   <div class="mono" style="font-size:10px;letter-spacing:2px;color:var(--faint);margin-bottom:6px">ASK ORACLE — one validated decision, not options</div>
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
     ${['What should I do tonight?','Am I on track?','What is my biggest bottleneck?','Should I change my roadmap?','What should I build next?']
       .map(q=>`<span class="bchip" data-q="${esc(q)}">${esc(q.split('?')[0])}</span>`).join('')}</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
     <input id="oi-q" placeholder="…or ask anything about your campaign"
       style="flex:1;min-width:200px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px 11px;font-size:13px">
     <button class="sbtn" id="oi-ask">Ask</button></div>
   <div id="oi-dec"></div>
   <details style="margin-top:16px"><summary class="mono" style="font-size:11px;letter-spacing:1px;color:var(--faint);cursor:pointer">EVIDENCE LEDGER — claim ≠ evidence (server-authoritative)</summary>
     ${(ev||[]).slice(0,6).map(e=>`<div class="mono" style="font-size:11px;color:var(--dim);padding:2px 0">${esc(e.ts?.slice(0,10)||'')} · ${esc(e.kind)} · ${esc(e.skill)} · ${esc(e.ref)} · q${e.quality}</div>`).join('')||'<div class="mono" style="font-size:11px;color:var(--faint);padding:4px 0">empty</div>'}
     <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
       <input id="oi-ev-kind" placeholder="kind" style="width:90px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:6px 8px;font-size:11px">
       <input id="oi-ev-skill" placeholder="skill" style="width:90px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:6px 8px;font-size:11px">
       <input id="oi-ev-ref" placeholder="ref (repo/bench/score)" style="flex:1;min-width:140px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:6px 8px;font-size:11px">
       <input id="oi-ev-q" placeholder="0-1" style="width:56px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:6px 8px;font-size:11px">
       <button class="sbtn" id="oi-ev-add">Add</button></div></details>
   <details style="margin-top:8px"><summary class="mono" style="font-size:11px;letter-spacing:1px;color:var(--faint);cursor:pointer">LOCAL UI LOG — last ${Math.min(5,a.length)} of ${a.length} (server audit: GET /api/audit)</summary>
     ${a.slice(0,5).map(e=>`<div class="mono" style="font-size:11px;color:var(--dim);padding:2px 0">${esc(e.t.slice(11,19))} · ${esc(e.kind)} · ${esc(e.verdict||'')}${e.id?' #'+e.id:''}${e.variant?' · '+esc(e.variant):''}</div>`).join('')||'<div class="mono" style="font-size:11px;color:var(--faint);padding:4px 0">empty</div>'}</details>
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
     <button class="sbtn" id="oi-sync">Sync canonical packet → backend</button>
     <button class="sbtn" id="oi-copy">Copy canonical packet</button>
     <span id="oi-status" class="mono" style="font-size:11px;color:var(--faint);align-self:center"></span></div>`;
  wire();
  /* keep the last decision visible across re-renders (resolve/sync) */
  if(lastDecision)renderDecision(lastDecision);
  else renderNotice('Ask a question — the server reasons over the canonical packet, ORACLE validates, verdicts display verbatim.');
}
function wire(){
  const body=$id('oi-body');
  body.querySelectorAll('[data-q]').forEach(c=>c.onclick=()=>ask(c.dataset.q));
  $id('oi-ask').onclick=()=>ask($id('oi-q').value);
  $id('oi-q').onkeydown=e=>{if(e.key==='Enter')ask($id('oi-q').value)};
  $id('oi-ev-add').onclick=addEvidence;
  $id('oi-sync').onclick=async()=>{$id('oi-status').textContent='syncing…';
    const r=await sync();$id('oi-status').textContent=r.ok?('synced v'+r.version):('fail: '+r.reason.slice(0,40));render();};
  $id('oi-copy').onclick=()=>{try{const j=JSON.stringify(canonical(),null,2);
    (navigator.clipboard?navigator.clipboard.writeText(j):Promise.reject())
      .then(()=>{$id('oi-status').textContent='canonical packet copied'},()=>{});}
    catch(e){$id('oi-status').textContent=e.message}};
}
function mount(){
  const view=document.querySelector('.view.on')||document.querySelector('.wrap')||document.body;
  const card=$id('oi-card');
  if(card&&card.parentElement===view)return;
  if(card){view.insertBefore(card,view.firstChild);return}
  view.insertAdjacentHTML('afterbegin',
    `<section class="card" id="oi-card" style="margin-bottom:16px">
      <h2 class="sec">ORACLE INTELLIGENCE · DECISION LAYER
       <em>state: window.oracleStatePacket() verbatim · AI proposes → ORACLE validates · zero secrets client-side</em></h2>
      <div id="oi-body"></div></section>`);
  render();
}
new MutationObserver(mount).observe(document.body,
  {childList:true,subtree:true,attributes:true,attributeFilter:['class']});
mount();
if(cfg.backend&&(!cfg.lastSync||Date.now()-new Date(cfg.lastSync.ts).getTime()>3e5))
  sync().then(()=>render()).catch(()=>{});

window.OI={canonical,ask,sync,readAudit,
  set:(section,obj)=>{write(NS+'.'+section,obj);render()},cfg};
})();
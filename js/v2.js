/* MNQ Replay v2 — header wiring, TradingView / FX Replay style order ticket and trade lines.
   Loaded after the main script; it replaces a few of its global functions (refreshLines, ui, …). */
(function(){
'use strict';
var G=window;
function ico(id,c){return'<svg class="ic'+(c?' '+c:'')+'"><use href="#i-'+id+'"/></svg>'}
G.ico=ico;
function cleanName(n){return String(n||'').replace(/^[\u{1F300}-\u{1FAFF}☀-➿️]+\s*/u,'')}
G.cleanName=cleanName;

/* ---------- header ---------- */
$('bBack').addEventListener('click',function(){if(S)stepBack()});
function liveIco(){$('bLive').classList.toggle('on',$('smooth').checked)}
$('bLive').addEventListener('click',function(){$('smooth').checked=!$('smooth').checked;liveIco();lsSet('mnqr-live',$('smooth').checked);if(playing){play();play()}});
$('smooth').checked=!!lsGet('mnqr-live',false);liveIco();
function setCollapse(on){document.body.classList.toggle('bcol',on);lsSet('mnqr-bcol',on);if(chart)setTimeout(function(){resizeOv()},30)}
$('bCollapse').addEventListener('click',function(){setCollapse(!document.body.classList.contains('bcol'))});
setCollapse(!!lsGet('mnqr-bcol',false));
playIco();sndIcon();

/* ---------- order ticket ---------- */
var TPL_DEF=[{n:'Scalp · SL 8 / TP 16',sl:8,tp:16,be:0,part:0,trail:0},{n:'1:2 · SL 15 / TP 30, BE at 1R',sl:15,tp:30,be:1,part:0,trail:0},{n:'Runner · SL 12, close 50 % at 1R, BE',sl:12,tp:48,be:1,part:50,trail:0}];
function tpls(){return lsGet('mnqr-tpl',TPL_DEF)}
$('ticket').innerHTML=
 '<h3 class="th"><span>Order · <b id="instName">'+instName()+'</b></span><span class="tmini" id="tSpr"></span></h3>'+
 '<div class="bs2"><button class="sell2" id="bSell"><small>SELL</small><b id="pSell">–</b></button><button class="buy2" id="bBuy"><small>BUY</small><b id="pBuy">–</b></button></div>'+
 '<div class="seg" id="otype"><button data-t="market" class="on">Market</button><button data-t="limit">Limit</button><button data-t="stop">Stop</button></div>'+
 '<div class="pxr hide" id="pxWrap"><span class="bl">Price</span><div class="num2"><button data-step="-1">−</button><input type="number" id="oPrice" step="0.25"><button data-step="1">+</button></div></div>'+
 '<div class="row"><label class="f">Contracts<input type="number" id="oQty" min="1" step="1" value="1"></label><label class="f rkf"><span class="rkl">Risk <button type="button" id="oRkU" class="rku" title="Switch between $ and % of account">$</button></span><input type="number" id="oRk" min="0" step="10" placeholder="from SL"><input type="hidden" id="oRisk"></label></div>'+
 '<div class="brk"><div class="brow sl"><span class="bl">Stop loss</span><input type="number" id="oSL" min="0" step="0.25" placeholder="points"><span class="bo" id="oSLo"></span></div>'+
 '<div class="brow tp"><span class="bl">Take profit</span><input type="number" id="oTP" min="0" step="0.25" placeholder="points"><span class="bo" id="oTPo"></span></div>'+
 '<div class="rq"><span>TP from SL</span><button data-r="1">1R</button><button data-r="1.5">1.5R</button><button data-r="2">2R</button><button data-r="3">3R</button></div></div>'+
 '<div class="tplr"><select id="oTpl"></select><button class="hb" id="bTplSave" title="Save the current settings as a template">'+ico('plus')+'</button></div>'+
 '<details class="adv" id="tAdv"'+(lsGet('mnqr-adv',false)?' open':'')+'><summary>Position management</summary><div class="advb">'+
 '<div class="row"><label class="f">Trailing (points)<input type="number" id="oTrail" min="0" step="0.25" placeholder="none"></label><label class="f">SL to BE at<select id="oBE"><option value="0">Off</option><option value="1">1R</option><option value="1.5">1.5R</option><option value="2">2R</option></select></label></div>'+
 '<label class="f">Close part at 1R<select id="oPart"><option value="0">Off</option><option value="50">50 % of the position</option><option value="33">33 % of the position</option></select></label></div></details>'+
 '<div class="calc" id="calc"></div>'+
 '<div class="srow"><label class="f">Setup<select id="oSetup"></select></label><button class="hb" id="bPlaybook" title="Playbook: edit setups">'+ico('book')+'</button></div>'+
 '<div class="grow2"><span class="glbl">Setup grade</span><div id="oChecks" class="grades"></div></div>'+
 '<div class="hint">Grab SL and TP on the chart and drag them. After you enter, drag them out of the position line (TP / SL buttons).</div>';
$('tAdv').addEventListener('toggle',function(){lsSet('mnqr-adv',this.open)});
$('tAdv').querySelector('.advb').insertAdjacentHTML('beforeend','<label class="chk"><input type="checkbox" id="oConf"'+(lsGet('mnqr-oneclick',false)?'':' checked')+'> Confirm before ordering (contracts, risk, SL/TP)</label>');
$('oConf').addEventListener('change',function(){lsSet('mnqr-oneclick',!this.checked);toast(this.checked?'BUY/SELL opens a confirmation':'BUY/SELL sends the order at once')});
function renderTpl(){$('oTpl').innerHTML='<option value="">Order template …</option>'+tpls().map(function(t,i){return'<option value="'+i+'">'+esc(t.n)+'</option>'}).join('')}
renderTpl();
$('oTpl').addEventListener('change',function(){var t=tpls()[+this.value];this.value='';if(!t)return;$('oSL').value=t.sl||'';$('oTP').value=t.tp||'';$('oBE').value=String(t.be||0);$('oPart').value=String(t.part||0);$('oTrail').value=t.trail||'';
  if(t.be||t.part||t.trail){$('tAdv').open=true}toast('Template: '+t.n);if(S){ui();DV++}});
$('bTplSave').addEventListener('click',function(){uiPrompt('Template name','e.g. NY scalp').then(function(n){if(!n)return;var L=tpls();L.push({n:n,sl:num($('oSL').value)||0,tp:num($('oTP').value)||0,be:+$('oBE').value||0,part:+$('oPart').value||0,trail:num($('oTrail').value)||0});lsSet('mnqr-tpl',L);renderTpl();toast('Template saved')})});
$('otype').addEventListener('click',function(e){var t=e.target.dataset.t;if(!t)return;setOT(t)});
function setOT(t,px){OT=t;$('otype').querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.t===t)});$('pxWrap').classList.toggle('hide',t==='market');
  if(t!=='market'&&S)$('oPrice').value=fp(px!=null?px:price());if(t==='market')$('oPrice').value='';if(S){ui();DV++}}
G.setOT=setOT;
$('pxWrap').addEventListener('click',function(e){var b=e.target.closest('[data-step]');if(!b)return;var v=num($('oPrice').value)||price();$('oPrice').value=fp(q4(v+(+b.dataset.step)*0.25));if(S){ui();DV++}});
['oQty','oRisk','oSL','oTP','oPrice','oTrail'].forEach(function(id){$(id).addEventListener('input',function(){if(S){ui();toolPanel();DV++}})});
['oBE','oPart'].forEach(function(id){$(id).addEventListener('change',function(){if(S)ui()})});
$('ticket').querySelector('.rq').addEventListener('click',function(e){var b=e.target.closest('[data-r]');if(!b)return;var sl=num($('oSL').value);if(!sl){toast('Enter an SL first');return}$('oTP').value=q4(sl*(+b.dataset.r));if(S){ui();DV++}});
function exec(side){if(OT==='market')placeMarket(side);else placePending(side)}
function submit(side){if(!S)return;stop();PV.side=side;DV++;if(lsGet('mnqr-oneclick',false)){exec(side);return}confirmOrder(side)}
/* order confirmation: choose contracts or risk, stop and target before the order goes in (the chart shows the preview meanwhile) */
var CF=null;
function confirmOrder(side){if(CF)CF.remove();var mode=lsGet('mnqr-cfmode','qty');
  var el=document.createElement('div');el.id='ocf';el.className='ocf '+(side>0?'b':'s');document.body.appendChild(el);CF=el;
  var r=$('bBuy').getBoundingClientRect();el.style.top=Math.max(60,r.top-6)+'px';
  function v(id){return $(id).value}
  function draw(){var q=qtyNow(),sl=slPts(),tp=tpPts(),e=entryFor(side),risk=sl?sl*q*S.pv+comm(q):null,bal=closedBal(),typ=OT==='market'?'Market':OT==='limit'?'Limit':'Stop';
    el.innerHTML='<div class="ocf-h"><b>'+(side>0?'BUY':'SELL')+' '+instName()+'</b><span>'+typ+' @ '+fp(e)+'</span><button class="hb" data-cx="1" title="Cancel (Esc)">'+ico('x')+'</button></div>'+
      '<div class="seg ocf-m"><button data-m="qty" class="'+(mode==='qty'?'on':'')+'">Contracts</button><button data-m="usd" class="'+(mode==='usd'?'on':'')+'">Risk $</button><button data-m="pct" class="'+(mode==='pct'?'on':'')+'">Risk %</button></div>'+
      (mode==='qty'?'<div class="ocf-q"><button data-d="-1">−</button><input id="cfQ" type="number" min="1" step="1" value="'+(parseInt(v('oQty'),10)||1)+'"><button data-d="1">+</button></div><div class="ocf-qs">'+[1,2,3,5,10].map(function(n){return'<button data-qn="'+n+'" class="'+(q===n&&!num(v('oRisk'))?'on':'')+'">'+n+'</button>'}).join('')+'</div>'
        :'<label class="f">'+(mode==='usd'?'How many $ you risk':'What % of the account you risk')+'<input id="cfR" type="number" min="0" step="'+(mode==='usd'?10:0.1)+'" value="'+(rkIn(mode)||'')+'" placeholder="'+(mode==='usd'?'e.g. 100':'e.g. 0.5')+'"></label>'+(sl?'':'<div class="ocf-w">Enter a stop loss to size contracts from risk.</div>'))+
      '<div class="row"><label class="f">Stop loss (points)<input id="cfSL" type="number" min="0" step="0.25" value="'+(v('oSL')||'')+'" placeholder="none"></label><label class="f">Take profit (points)<input id="cfTP" type="number" min="0" step="0.25" value="'+(v('oTP')||'')+'" placeholder="none"></label></div>'+
      '<div class="ocf-rr"><span>TP</span>'+[1,1.5,2,3].map(function(x){return'<button data-r="'+x+'">'+x+'R</button>'}).join('')+'</div>'+
      '<div class="ocf-s"><div><small>Contracts</small><b>'+q+'</b></div><div><small>Risk</small><b class="neg">'+(risk!=null?money(risk):'no SL')+'</b>'+(risk!=null?'<i>'+(risk/bal*100).toFixed(2)+' % of account</i>':'')+'</div><div><small>Target</small><b class="pos">'+(tp?money(tp*q*S.pv-comm(q)):'–')+'</b>'+(sl&&tp?'<i>R:R 1 : '+(tp/sl).toFixed(2)+'</i>':'')+'</div></div>'+
      '<button class="ocf-go" data-go="1">Confirm '+(side>0?'BUY':'SELL')+' '+q+' '+instName()+(q>1?'':'')+'</button>'+
      '<label class="ocf-1"><input type="checkbox" id="cf1"> No confirmation (1 click)</label>';
    var inp=el.querySelector('#cfQ')||el.querySelector('#cfR');if(inp&&document.activeElement===document.body)setTimeout(function(){inp.focus();inp.select()},10)}
  function sync(){var q=el.querySelector('#cfQ'),rk=el.querySelector('#cfR'),bal=closedBal();
    if(q){$('oQty').value=Math.max(1,parseInt(q.value,10)||1);setRisk(RK.u,0)}
    if(rk)setRisk(mode,num(rk.value))
    $('oSL').value=el.querySelector('#cfSL').value;$('oTP').value=el.querySelector('#cfTP').value;ui();DV++}
  function redraw(){var a=document.activeElement,id=a&&a.id,pos=a&&a.selectionStart;draw();if(id){var n=el.querySelector('#'+id);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}}}
  function close(){if(CF===el){el.remove();CF=null;document.removeEventListener('keydown',kd,true)}}
  function go(){sync();var q=qtyNow();if(!q){toast('Risk is too small for 1 contract');return}if(el.querySelector('#cf1').checked){lsSet('mnqr-oneclick',true);toast('Orders without confirmation. Turn it back on in the order ticket settings.')}close();exec(side)}
  function kd(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();go()}}
  document.addEventListener('keydown',kd,true);
  el.addEventListener('keydown',function(e){e.stopPropagation()});
  el.addEventListener('input',function(){sync();var a=document.activeElement,id=a&&a.id,pos=a&&a.selectionStart;draw();var n=id&&el.querySelector('#'+id);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}});
  el.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    if(b.dataset.cx){close();return}if(b.dataset.go){go();return}
    if(b.dataset.m){mode=b.dataset.m;lsSet('mnqr-cfmode',mode);if(mode==='qty')setRisk(RK.u,0);else if(RK.v)setRisk(mode,rkIn(mode));redraw();return}
    if(b.dataset.d){var q=el.querySelector('#cfQ');q.value=Math.max(1,(parseInt(q.value,10)||1)+(+b.dataset.d));sync();redraw();return}
    if(b.dataset.qn){$('oQty').value=b.dataset.qn;setRisk(RK.u,0);ui();redraw();return}
    if(b.dataset.r){var sl=num(el.querySelector('#cfSL').value);if(!sl){toast('Enter an SL first');return}el.querySelector('#cfTP').value=q4(sl*(+b.dataset.r));sync();redraw()}});
  draw()}
G.confirmOrder=confirmOrder;
$('bBuy').addEventListener('click',function(){submit(1)});
$('bSell').addEventListener('click',function(){submit(-1)});
$('bBuy').addEventListener('mouseenter',function(){PV.side=1;DV++});
$('bSell').addEventListener('mouseenter',function(){PV.side=-1;DV++});
renderSetupSel();$('oSetup').addEventListener('change',renderChecklist);
$('oChecks').addEventListener('click',function(e){var b=e.target.closest('[data-gr]');if(!b)return;OGRADE=OGRADE===b.dataset.gr?'':b.dataset.gr;renderChecklist()});
$('bPlaybook').addEventListener('click',openPlaybook);
G.orderSetup=function(){var o={};if($('oSetup').value)o.setup=$('oSetup').value;if(OGRADE)o.grade=OGRADE;var be=+$('oBE').value||0;if(be)o.beR=be;return o};

/* small text prompt in the app's style */
G.uiPrompt=function(label,ph){return new Promise(function(res){var m=document.createElement('div');m.className='modal cfm';
  m.innerHTML='<div class="box cbox"><p>'+esc(label)+'</p><input id="upIn" placeholder="'+esc(ph||'')+'"><div class="cbtns"><button class="btn" data-n="1">Cancel</button><button class="btn on" data-y="1">Save</button></div></div>';
  document.body.appendChild(m);var inp=m.querySelector('#upIn');setTimeout(function(){inp.focus()},20);
  function done(v){m.remove();res(v)}
  inp.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter')done(inp.value.trim());if(e.key==='Escape')done(null)});
  m.addEventListener('click',function(e){if(e.target===m||e.target.closest('[data-n]'))done(null);else if(e.target.closest('[data-y]'))done(inp.value.trim())})})};

/* ---------- numbers for the ticket ---------- */
function slPts(){return num($('oSL').value)}
function tpPts(){return num($('oTP').value)}
function entryFor(side){if(OT==='market')return side>0?ask():price();return q4(num($('oPrice').value)||price())}
function qtyNow(){return getQtySilent()}
var _ui=G.ui;
G.ui=function(){_ui.apply(this,arguments);if(!S)return;var p=price(),a=ask(),q=qtyNow(),sl=slPts(),tp=tpPts();
  setT('pBuy',fp(a));setT('pSell',fp(p));setT('tSpr',SPR()?'spread '+fp(SPR()):'no spread');setT('instName',instName());setT('sName',cleanName(S.name));
  var side=PV.side||1,e=entryFor(side);
  setH('oSLo',sl?'<i>'+fp(q4(e-side*sl))+'</i><b class="neg">−'+money(sl*q*S.pv+comm(q)).replace('−','')+'</b>':'');
  setH('oTPo',tp?'<i>'+fp(q4(e+side*tp))+'</i><b class="pos">+'+money(tp*q*S.pv-comm(q)).replace('+','')+'</b>':'');
  var bal=closedBal(),risk=sl?sl*q*S.pv+comm(q):0;
  setH('calc','<span>Contracts <b>'+q+'</b> · $'+(S.pv*q)+'/point</span>'+(sl?'<span>Risk <b class="neg">'+money(risk)+'</b> ('+(risk/bal*100).toFixed(2)+' %)</span>':'<span class="dim">No SL: risk is unlimited</span>')+(sl&&tp?'<span>R:R <b>1 : '+(tp/sl).toFixed(2)+'</b></span>':''));
  $('bBuy').querySelector('small').textContent=(OT==='market'?'BUY':OT==='limit'?'BUY LIMIT':'BUY STOP')+(q>1?' · '+q:'');
  $('bSell').querySelector('small').textContent=(OT==='market'?'SELL':OT==='limit'?'SELL LIMIT':'SELL STOP')+(q>1?' · '+q:'');
  setH('clock','<span class="wd">'+fmtWall(nowT(),SET.tz,true).split(' ')[0]+'</span><b>'+fmtWall(nowT(),SET.tz).replace(/ (\d\d:\d\d)$/,'</b><b>$1')+'</b><span class="tz">'+(SET.tz===NY?'NY':'CET')+'</span>');
};

/* ---------- trade lines on the chart (replace the library's price lines) ---------- */
LINES.forEach(function(l){try{cs.removePriceLine(l.pl)}catch(e){}});LINES=[];
G.refreshLines=function(){DV++};
G.updateLineTitles=function(){};
G.lineHit=function(){return null};
G.validateLine=function(){};
var PV={side:1},TL={hits:[],hover:null,drag:null,axisPlus:null};G.__TL=TL;
var COL={long:'#7E8CFF',short:'#E4B24C',sl:'#F2576B',tp:'#2FCB8C',ord:'#9AA6FF',pv:'#A1A7B4'};
function pnlAt(side,entry,px,q){return pnlOf(side,entry,px,q)}
function rOf(entry,sl,px,side){var r=Math.abs(entry-sl);return r?((px-entry)*side/r):null}
function els(){var L=[];if(!S)return L;var p=price(),a=ask();
  S.positions.forEach(function(x){var mp=markPx(x.side),u=pnlAt(x.side,x.entry,mp,x.qty);
    L.push({k:'pos',o:x,f:'entry',px:x.entry,col:x.side>0?COL.long:COL.short,solid:true,chips:[
      {t:(x.side>0?'▲ ':'▼ ')+x.qty,bg:x.side>0?COL.long:COL.short,act:'menu'},
      {t:money(u,1),fg:u>=0?'#2FCB8C':'#F2576B',act:'drag-pos'},
      x.tp==null?{t:'TP',ol:COL.tp,act:'new-tp',tip:'Drag for take profit'}:null,
      x.sl==null?{t:'SL',ol:COL.sl,act:'new-sl',tip:'Drag for stop loss'}:null,
      {t:'✕',act:'x-pos',tip:'Close position'}]});
    if(x.sl!=null){var v=pnlAt(x.side,x.entry,x.sl,x.qty)-comm(x.qty),rr=x.sl0!=null&&x.sl0!==x.entry?rOf(x.entry,x.sl0,x.sl,x.side):null;
      L.push({k:'sl',o:x,f:'sl',px:x.sl,col:COL.sl,chips:[{t:x.trail?'TRAIL':x.sl===x.entry?'BE':'SL',bg:COL.sl,act:'drag'},{t:money(v,1)+(rr!=null?' · '+rr.toFixed(1)+'R':''),fg:'#F2A0AA',act:'drag'},{t:'✕',act:'x-sl',tip:'Remove SL'}]})}
    if(x.tp!=null){var w=pnlAt(x.side,x.entry,x.tp,x.qty)-comm(x.qty),r2=x.sl0!=null&&x.sl0!==x.entry?rOf(x.entry,x.sl0,x.tp,x.side):null;
      L.push({k:'tp',o:x,f:'tp',px:x.tp,col:COL.tp,chips:[{t:'TP',bg:COL.tp,act:'drag'},{t:money(w,1)+(r2!=null?' · '+r2.toFixed(1)+'R':''),fg:'#8FE3C0',act:'drag'},{t:'✕',act:'x-tp',tip:'Remove TP'}]})}});
  S.orders.forEach(function(o){var c=o.side>0?COL.long:COL.short;
    L.push({k:'ord',o:o,f:'price',px:o.price,col:c,chips:[{t:(o.side>0?'BUY ':'SELL ')+(o.type==='limit'?'LMT':'STP')+' '+o.qty,bg:c,act:'drag'},{t:fp(o.price),fg:'#E8EAEF',act:'drag'},
      o.tp==null?{t:'TP',ol:COL.tp,act:'new-tp'}:null,o.sl==null?{t:'SL',ol:COL.sl,act:'new-sl'}:null,{t:'✕',act:'x-ord',tip:'Cancel order'}]});
    if(o.sl!=null)L.push({k:'osl',o:o,f:'sl',px:o.sl,col:COL.sl,faint:true,chips:[{t:'SL',bg:COL.sl,act:'drag'},{t:money(-(Math.abs(o.price-o.sl)*o.qty*S.pv)-comm(o.qty),1),fg:'#F2A0AA',act:'drag'},{t:'✕',act:'x-sl'}]});
    if(o.tp!=null)L.push({k:'otp',o:o,f:'tp',px:o.tp,col:COL.tp,faint:true,chips:[{t:'TP',bg:COL.tp,act:'drag'},{t:money(Math.abs(o.tp-o.price)*o.qty*S.pv-comm(o.qty),1),fg:'#8FE3C0',act:'drag'},{t:'✕',act:'x-tp'}]})});
  // preview of the order in the ticket (only when it has a stop or a target, or is a limit/stop order)
  var sl=slPts(),tp=tpPts();
  if(S&&(sl||tp||OT!=='market')&&!TL.noPrev){var sd=PV.side||1,e=entryFor(sd),q=qtyNow();
    L.push({k:'pve',o:PV,f:'e',px:e,col:COL.pv,ghost:true,chips:[{t:(sd>0?'BUY ':'SELL ')+(OT==='market'?'MKT':OT==='limit'?'LMT':'STP')+' '+q+' · preview',bg:'#2A2F3A',fg:'#C9CEDA',act:OT==='market'?'pv-entry':'drag'},{t:'✕',act:'x-pve',tip:'Clear SL / TP'}]});
    if(sl)L.push({k:'pvs',o:PV,f:'sl',px:q4(e-sd*sl),col:COL.sl,ghost:true,chips:[{t:'SL',bg:COL.sl,act:'drag'},{t:'−'+money(sl*q*S.pv+comm(q)).replace('−','')+' · '+fp(sl)+' pt',fg:'#F2A0AA',act:'drag'},{t:'✕',act:'x-pvs',tip:'Remove SL'}]});
    if(tp)L.push({k:'pvt',o:PV,f:'tp',px:q4(e+sd*tp),col:COL.tp,ghost:true,chips:[{t:'TP',bg:COL.tp,act:'drag'},{t:'+'+money(tp*q*S.pv-comm(q)).replace('+','')+' · '+fp(tp)+' pt',fg:'#8FE3C0',act:'drag'},{t:'✕',act:'x-pvt',tip:'Remove TP'}]})}
  return L}
function tlSig(){if(!S)return'';var d=TL.drag;return JSON.stringify([S.positions.map(function(x){return[x.id,x.entry,x.sl,x.tp,x.qty]}),S.orders.map(function(o){return[o.id,o.price,o.sl,o.tp,o.type]}),OT,PV.side,$('oSL').value,$('oTP').value,$('oPrice').value,$('oQty').value,$('oRisk').value,TL.hover&&[TL.hover.k,TL.hover.i],d&&[d.k,d.val],TL.axisPlus,TL.noPrev])}
var lastTL='';
var _dov=G.drawOverlay;
G.drawOverlay=function(){var s=tlSig();if(s!==lastTL){lastTL=s;lastSig=''}var before=lastSig;_dov();if(lastSig!==before&&S&&CT.length)drawTL()};
function rr(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h)}
function drawTL(){var W=plotW(),H=paneH(),L=els();TL.hits=[];ctx.save();ctx.font='600 11px Geist,system-ui,sans-serif';ctx.textBaseline='middle';
  // lines first, labels on top
  L.forEach(function(el){var y=pToY(el.px);el.y=y;if(y==null||y<-2||y>H+2)return;ctx.save();ctx.strokeStyle=el.col;ctx.globalAlpha=el.ghost?.75:el.faint?.8:1;ctx.lineWidth=el.solid?1.5:1.2;
    ctx.setLineDash(el.solid?[]:el.ghost?[2,4]:[6,4]);ctx.beginPath();ctx.moveTo(0,Math.round(y)+.5);ctx.lineTo(W,Math.round(y)+.5);ctx.stroke();ctx.restore()});
  // drag preview: fill between entry and the dragged level
  L.forEach(function(el,idx){var y=el.y;if(y==null||y<-2||y>H+2)return;
    var x=W-12,hov=TL.hover&&TL.hover.k===el.k&&TL.hover.o===el.o,cs2=el.chips.filter(Boolean),ws=cs2.map(function(c){return Math.ceil(ctx.measureText(c.t).width)+(c.t==='✕'?12:14)});
    var tot=ws.reduce(function(a,b){return a+b},0)+(cs2.length-1)*2;x-=tot;
    cs2.forEach(function(c,i){var w=ws[i],h=19,yy=Math.round(y)-9.5;ctx.save();ctx.globalAlpha=el.ghost&&!hov?.92:1;
      if(c.bg){ctx.fillStyle=c.bg;rr(x,yy,w,h,4);ctx.fill();ctx.fillStyle=c.fg||ink(c.bg)}
      else if(c.ol){ctx.fillStyle='#0B0D11';rr(x,yy,w,h,4);ctx.fill();ctx.strokeStyle=c.ol;ctx.lineWidth=1;rr(x+.5,yy+.5,w-1,h-1,4);ctx.stroke();ctx.fillStyle=c.ol}
      else{ctx.fillStyle='#0B0D11';rr(x,yy,w,h,4);ctx.fill();ctx.strokeStyle=el.col;ctx.globalAlpha*=.55;ctx.lineWidth=1;rr(x+.5,yy+.5,w-1,h-1,4);ctx.stroke();ctx.globalAlpha=el.ghost&&!hov?.92:1;ctx.fillStyle=c.fg||'#C9CEDA'}
      if(hov&&TL.hover.i===i){ctx.save();ctx.strokeStyle='#fff';ctx.globalAlpha=.75;rr(x+.5,yy+.5,w-1,h-1,4);ctx.stroke();ctx.restore()}
      ctx.fillText(c.t,x+(c.t==='✕'?6:7),Math.round(y)+.5);ctx.restore();
      TL.hits.push({x:x,y:yy,w:w,h:h,el:el,ci:i,act:c.act,tip:c.tip});x+=w+2});
    // tag on the price axis
    var pw=ovW-W;if(pw>20){ctx.save();ctx.fillStyle=el.ghost?'#2A2F3A':el.col;rr(W+1,Math.round(y)-9,pw-2,18,3);ctx.fill();ctx.fillStyle=el.ghost?'#C9CEDA':ink(el.col);ctx.font='600 11px "Geist Mono",monospace';ctx.fillText(fp(el.px),W+6,Math.round(y)+.5);ctx.restore()}
    TL.hits.push({x:0,y:Math.round(y)-5,w:W,h:10,el:el,ci:-1,act:el.k==='pos'?'drag-pos':el.k==='pve'?(OT==='market'?'pv-entry':'drag'):'drag',line:true})});
  // "+" on the price axis at the mouse price: place a limit/stop order there
  if(TL.axisPlus!=null&&!TL.drag){var ay=pToY(TL.axisPlus);if(ay!=null){ctx.save();ctx.fillStyle='#181C24';rr(W-22,ay-9,18,18,4);ctx.fill();ctx.strokeStyle='#7E8CFF';rr(W-21.5,ay-8.5,17,17,4);ctx.stroke();ctx.strokeStyle='#C9CEDA';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W-13,ay-4.5);ctx.lineTo(W-13,ay+4.5);ctx.moveTo(W-17.5,ay);ctx.lineTo(W-8.5,ay);ctx.stroke();ctx.restore();
    TL.hits.unshift({x:W-22,y:ay-9,w:18,h:18,act:'plus',el:{px:TL.axisPlus}})}}
  ctx.restore()}
function hitAt(m){for(var i=0;i<TL.hits.length;i++){var h=TL.hits[i];if(!h.line&&m.x>=h.x&&m.x<=h.x+h.w&&m.y>=h.y&&m.y<=h.y+h.h)return h}
  var best=null,bd=6;TL.hits.forEach(function(h){if(!h.line)return;var d=Math.abs(m.y-(h.y+5));if(d<bd&&m.x>=0&&m.x<=plotW()){bd=d;best=h}});return best}

/* ---------- mouse: take over before the chart and drawing tools see the event ---------- */
function inChart(e){var t=e.target;return t&&t.closest&&t.closest('#chartwrap')&&!t.closest('#favbar,#drawbar,.dpop,.lgb,.lgi,.tedit,#dom')}
G.addEventListener('mousedown',function(e){if(!S||e.button!==0||!inChart(e)||typeof tool==='undefined'||tool!=='cursor'||cutMode||draft)return;var m=local(e);if(m.x>ovW||m.y>paneH())return;
  var h=hitAt(m);if(!h)return;e.stopImmediatePropagation();e.preventDefault();var el=h.el,o=el.o;
  if(h.act==='plus'){axisMenu(el.px,e.clientX,e.clientY);return}
  if(h.act==='x-pos'){closePos(o,mktExit(o.side),nowT(),'Manual');changed();return}
  if(h.act==='x-ord'){S.orders=S.orders.filter(function(x){return x!==o});toast('Order cancelled');changed();return}
  if(h.act==='x-sl'||h.act==='x-tp'){var f=h.act==='x-sl'?'sl':'tp';o[f]=null;if(el.k==='sl'||el.k==='tp')hpush(o,f+'H',null);changed();return}
  if(h.act==='x-pvs'||h.act==='x-pvt'||h.act==='x-pve'){if(h.act!=='x-pvt')$('oSL').value='';if(h.act!=='x-pvs')$('oTP').value='';if(h.act==='x-pve'&&OT!=='market')setOT('market');TL.hover=null;ui();DV++;return}
  if(h.act==='menu'){posMenu(o,e.clientX,e.clientY);return}
  var start=yToP(m.y);
  if(h.act==='new-tp'||h.act==='new-sl'){var f2=h.act==='new-tp'?'tp':'sl';TL.drag={k:el.k==='pos'?f2:'o'+f2,o:o,f:f2,orig:o[f2],val:o[f2]=q4(start),born:true};lock(true);DV++;return}
  if(h.act==='drag-pos'){TL.drag={k:'pos',o:o,f:null,y0:m.y,val:null};lock(true);return}
  if(h.act==='pv-entry'){TL.drag={k:'pve',o:PV,f:'e',val:start,mkt:true};lock(true);return}
  TL.drag={k:el.k,o:o,f:el.f,orig:el.k.indexOf('pv')===0?null:o[el.f],val:el.px,el:el};lock(true)},true);
G.addEventListener('mousemove',function(e){if(!S||!chart)return;var m=local(e),d=TL.drag;
  if(d){var p=yToP(m.y);if(p==null)return;e.stopImmediatePropagation();
    if(d.k==='pos'){if(Math.abs(m.y-d.y0)<4)return;var o=d.o,f=(p-o.entry)*o.side>0?'tp':'sl';if(o[f]!=null){TL.drag={k:f,o:o,f:f,orig:o[f],val:p}}else{TL.drag={k:f,o:o,f:f,orig:null,val:p,born:true}}o[f]=p;DV++;return}
    if(d.k==='pve'||d.k==='pvs'||d.k==='pvt'){d.val=p;pvSet(d,p);return}
    if(d.k==='ord'){var dv=p-d.o.price;d.o.price=p;if(d.o.sl!=null)d.o.sl=q4(d.o.sl+dv);if(d.o.tp!=null)d.o.tp=q4(d.o.tp+dv)}else{d.o[d.f]=p;if(d.k==='osl')rkOrd(d.o)}d.val=p;DV++;scheduleUI();return}
  // hover state, axis "+" and the price under the mouse
  if(m.x<0||m.y<0||m.x>ovW||m.y>paneH()){if(TL.hover||TL.axisPlus!=null){TL.hover=null;TL.axisPlus=null;DV++}return}
  var h=TL.hits.length?hitAt(m):null,nh=h&&!h.line&&h.act!=='plus'?{k:h.el.k,o:h.el.o,i:h.ci}:null;
  if(JSON.stringify(nh&&[nh.k,nh.i])!==JSON.stringify(TL.hover&&[TL.hover.k,TL.hover.i])||(nh&&TL.hover&&nh.o!==TL.hover.o)){TL.hover=nh;DV++}
  var ap=m.x<=plotW()&&m.x>plotW()-140&&tool==='cursor'?yToP(m.y):null;if(ap!==TL.axisPlus){TL.axisPlus=ap;DV++}
  showTip(h&&h.tip?h.tip:null,e)},true);
G.addEventListener('mouseup',function(e){var d=TL.drag;if(!d)return;TL.drag=null;lock(false);e.stopImmediatePropagation();finishDrag(d);DV++});
var tipEl=null;function showTip(t,e){if(!t){if(tipEl){tipEl.remove();tipEl=null}return}if(!tipEl){tipEl=document.createElement('div');tipEl.id='tlTip';document.body.appendChild(tipEl)}tipEl.textContent=t;tipEl.style.left=(e.clientX+12)+'px';tipEl.style.top=(e.clientY+14)+'px'}
function pvSet(d,p){var sd=PV.side||1,e=entryFor(sd);
  if(d.k==='pve'){if(d.mkt){var mk=price();if(Math.abs(p-mk)<0.5)return;setOT(sd>0?(p<mk?'limit':'stop'):(p>mk?'limit':'stop'),p)}else $('oPrice').value=fp(p);
    var mk2=sd>0?ask():price(),want=sd>0?(p<mk2?'limit':'stop'):(p>mk2?'limit':'stop');if(OT!=='market'&&OT!==want)setOT(want,p)}
  else if(d.k==='pvs'){var v=q4((e-p)*sd);if(v>0)$('oSL').value=fp(v)}
  else if(d.k==='pvt'){var w=q4((p-e)*sd);if(w>0)$('oTP').value=fp(w)}
  ui();DV++}
function finishDrag(d){if(d.k==='pve'||d.k==='pvs'||d.k==='pvt'){ui();return}
  var o=d.o,f=d.f;if(d.k==='pos')return;
  if(d.k==='ord'){var mk=o.side>0?ask():price(),want=o.side>0?(o.price<mk?'limit':'stop'):(o.price>mk?'limit':'stop');if(Math.abs(o.price-mk)<0.25){toast('Order is too close to the price');}
    if(o.type!==want){o.type=want;toast('Changed to '+(o.side>0?'Buy ':'Sell ')+want)}changed();return}
  var v=o[f];if(v==null){changed();return}
  var isPos=S.positions.indexOf(o)>=0,ref=isPos?(o.side>0?price():ask()):o.price,bad=false;
  if(f==='sl')bad=o.side>0?v>=ref:v<=ref;else bad=o.side>0?v<=ref:v>=ref;
  if(bad){o[f]=d.born?null:d.orig;toast(f==='sl'?(isPos?'SL must be on the other side of the current price':'SL must be on the losing side of the order'):(isPos?'TP must be on the profit side of the current price':'TP must be on the profit side of the order'));snd('sl');changed();return}
  if(isPos){if(f==='sl'&&o.sl0==null)o.sl0=v;hpush(o,f+'H',v);if(f==='sl')o.trailed=false}
  else if(f==='sl')rkOrd(o)
  snd('open');changed()}
function axisMenu(px,x,y){var p=price(),a=ask(),q=getQtySilent(),it=[];
  if(px<p)it=[{t:'Buy limit '+q+' @ '+fp(px),fn:function(){placePending(1,'limit',px)}},{t:'Sell stop '+q+' @ '+fp(px),fn:function(){placePending(-1,'stop',px)}}];
  else if(px>a)it=[{t:'Sell limit '+q+' @ '+fp(px),fn:function(){placePending(-1,'limit',px)}},{t:'Buy stop '+q+' @ '+fp(px),fn:function(){placePending(1,'stop',px)}}];
  else it=[{t:'That’s the current price: use BUY / SELL',dis:true}];
  it.push('-',{t:'Alarm at '+fp(px),fn:function(){alarmAt(px)}});openCtx(it,x,y)}
function posMenu(o,x,y){var p=price(),up=(markPx(o.side)-o.entry)*o.side>0;
  openCtx([{t:'Close position',fn:function(){closePos(o,mktExit(o.side),nowT(),'Manual');changed()}},
    {t:'Close half',dis:o.qty<2,fn:function(){closePart(o,Math.max(1,Math.floor(o.qty/2)),mktExit(o.side),nowT(),'Partial');changed()}},
    {t:'Close 1 contract',dis:o.qty<2,fn:function(){closePart(o,1,mktExit(o.side),nowT(),'Partial');changed()}},'-',
    {t:'SL to breakeven',dis:!up,fn:function(){o.sl=o.entry;hpush(o,'slH',o.sl);changed();toast('SL to breakeven')}},
    {t:o.trail?'Turn off trailing stop':'Turn on trailing stop',fn:function(){if(o.trail){o.trail=null;toast('Trailing off')}else{var dist=o.sl!=null?Math.abs(markPx(o.side)-o.sl):(num($('oTrail').value)||20);o.trail=Math.max(0.25,q4(dist));o.best=markPx(o.side);if(o.sl==null){o.sl=q4(markPx(o.side)-o.side*o.trail);o.sl0=o.sl}hpush(o,'slH',o.sl);toast('Trailing '+o.trail+' points')}changed()}},
    {t:'Reverse position',fn:function(){var q=o.qty,s=-o.side;closePos(o,mktExit(o.side),nowT(),'Reversed');openPos(s,q,s>0?q4(ask()+SLP()):q4(price()-SLP()),null,null,nowT(),null,{mk:true});changed()}}],x,y)}

/* the trade table's buttons now also record SL/TP history (for exact rewinds) */
$('bbody').addEventListener('click',function(e){var d=e.target.dataset;if(!S||!(d.be||d.addsl||d.addtp||d.trail))return;setTimeout(function(){S.positions.forEach(function(x){if(x.slH&&x.slH[x.slH.length-1][1]!==x.sl)hpush(x,'slH',x.sl);if(x.tpH&&x.tpH[x.tpH.length-1][1]!==x.tp)hpush(x,'tpH',x.tp)});DV++},0)});

/* ---------- session dialog: spread and slippage ---------- */
(function(){var g=$('nComm').closest('.g3');var row=document.createElement('div');row.className='g3';
  row.innerHTML='<label class="f">Spread (tick po 0.25)<input type="number" id="nSpread" value="1" step="1" min="0"></label><label class="f">Slippage on market/stop (ticks)<input type="number" id="nSlip" value="0" step="1" min="0"></label><div class="hint" style="align-self:end">Buys fill at the ask (price + spread), sells at the bid. Like real MNQ.</div>';
  g.parentNode.insertBefore(row,g.nextSibling)})();

if(S){ui();DV++}

/* ---------- risk: $ or % of the account, kept when the stop moves ---------- */
var RK={u:lsGet('mnqr-riskunit','usd')==='pct'?'pct':'usd',v:+lsGet('mnqr-riskval',0)||0};
function rkUSD(){if(!RK.v)return 0;if(RK.u!=='pct')return RK.v;return S?Math.round(closedBal()*RK.v)/100:0}
function syncRisk(){var u=rkUSD();$('oRisk').value=u?String(u):''}
function rkView(){$('oRkU').textContent=RK.u==='pct'?'%':'$';$('oRk').step=RK.u==='pct'?'0.1':'10';$('oRk').placeholder=RK.u==='pct'?'% of account':'from SL';
  if(document.activeElement!==$('oRk'))$('oRk').value=RK.v||''}
function setRisk(u,v){RK.u=u==='pct'?'pct':'usd';RK.v=+v>0?+v:0;lsSet('mnqr-riskunit',RK.u);lsSet('mnqr-riskval',RK.v);rkView();syncRisk()}
function rkIn(u){if(!RK.v)return 0;if(u===RK.u)return RK.v;if(!S)return 0;var b=closedBal();return u==='pct'?+(rkUSD()/b*100).toFixed(2):Math.round(rkUSD())}
G.setRisk=setRisk;G.__RK=RK;
function rkQty(r,sl){return Math.floor((r+1e-9)/(sl*S.pv+comm(1)))}
function rkOrd(o){if(!o||!o.rk||o.sl==null)return;var d=Math.abs(o.price-o.sl);if(!d)return;o.qty=Math.max(1,rkQty(o.rk,d))}
/* contracts from risk include the commission, so the loss at the stop is never above the risk */
G.getQty=function(){var r=num($('oRisk').value),sl=num($('oSL').value);if(r&&sl){var q=rkQty(r,sl);if(q<1){toast('Risk is too small for 1 contract');return 0}return q}return Math.max(1,parseInt($('oQty').value,10)||1)};
G.getQtySilent=function(){var r=num($('oRisk').value),sl=num($('oSL').value);if(r&&sl)return Math.max(0,rkQty(r,sl));return Math.max(1,parseInt($('oQty').value,10)||1)};
$('oRk').addEventListener('input',function(){var v=num(this.value);RK.v=v>0?v:0;lsSet('mnqr-riskval',RK.v);syncRisk();if(S){ui();DV++}});
$('oRkU').addEventListener('click',function(e){e.preventDefault();var b=RK.u==='pct'?'usd':'pct';setRisk(b,rkIn(b));if(S){ui();DV++}});
$('oQty').addEventListener('input',function(){if(RK.v){setRisk(RK.u,0);toast('Contracts set by hand · risk sizing off')}});
rkView();syncRisk();
var _uiR=G.ui;G.ui=function(){if(S)syncRisk();_uiR.apply(this,arguments);if(S&&RK.v&&slPts()&&document.activeElement!==$('oQty'))$('oQty').value=Math.max(0,getQtySilent())};
var _pp=G.placePending;G.placePending=function(){var n=S?S.orders.length:0,r=_pp.apply(this,arguments);if(S&&S.orders.length>n){var o=S.orders[S.orders.length-1],u=rkUSD();if(u){o.rk=u;rkOrd(o)}}return r};
})();

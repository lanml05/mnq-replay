/* MNQ Replay — friends league.
   A match = the same random days for everyone, played blind (no date, shifted prices).
   Each day the replay runs by itself at the same speed for everyone; you get 5 minutes to take ONE trade
   (stop loss required), otherwise the day is over with 0R. Score = R (profit ÷ the risk at entry), so position size never matters.
   Results go to an online leaderboard (Supabase, js/mconfig.js); without a config it runs in local test mode. */
(function(){
'use strict';
var G=window;
var CFG=G.MQ_CFG||{},ONLINE=!!(CFG.url&&CFG.key);
var PICK_MS=5*60*1000,STEP_MS=3000,FF_MS=50,BAL=50000,RISK$=500,DAY_END=15*60+58;
var esc2=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
if(location.protocol!=='file:')document.body.classList.add('web');

/* ---------- player ---------- */
function me(){return lsGet('mnqr-name',location.protocol==='file:'?'Lan':'')}
G.pName=me;
function askName(){return G.uiPrompt('Your name in the league (friends see it)','e.g. Lan').then(function(n){n=(n||'').trim().slice(0,20);if(!n)return null;lsSet('mnqr-name',n);return n})}
function needName(){var n=lsGet('mnqr-name','');return n?Promise.resolve(n):askName()}

/* ---------- backend: Supabase REST, or local test mode ---------- */
function hdr(extra){var h={apikey:CFG.key,'Content-Type':'application/json'};if(/^eyJ/.test(CFG.key||''))h.Authorization='Bearer '+CFG.key;return Object.assign(h,extra||{})}
function api(path,opt){opt=opt||{};return fetch(CFG.url.replace(/\/$/,'')+'/rest/v1/'+path,{method:opt.method||'GET',headers:hdr(opt.prefer?{Prefer:opt.prefer}:null),body:opt.body?JSON.stringify(opt.body):undefined})
  .then(function(r){if(!r.ok)return r.text().then(function(t){var e=new Error(t||('HTTP '+r.status));e.status=r.status;throw e});return r.status===204||r.status===201&&opt.prefer==='return=minimal'?null:r.json()})}
var MK={get:function(k){return lsGet('mnqr-mock-'+k,[])},set:function(k,v){lsSet('mnqr-mock-'+k,v)}};
var DB={
  create:function(m){if(!ONLINE){var L=MK.get('matches');m.created_at=new Date().toISOString();L.unshift(m);MK.set('matches',L);return Promise.resolve(m)}
    return api('matches',{method:'POST',body:m,prefer:'return=representation'}).then(function(r){return r[0]})},
  match:function(code){if(!ONLINE)return Promise.resolve(MK.get('matches').filter(function(m){return m.code===code})[0]||null);
    return api('matches?code=eq.'+encodeURIComponent(code)).then(function(r){return r[0]||null})},
  matches:function(){if(!ONLINE)return Promise.resolve(MK.get('matches').slice(0,40));return api('matches?order=created_at.desc&limit=40')},
  submit:function(r){if(!ONLINE){var L=MK.get('results');if(L.some(function(x){return x.code===r.code&&x.player===r.player})){var e=new Error('duplicate');e.status=409;return Promise.reject(e)}
      r.created_at=new Date().toISOString();L.push(r);MK.set('results',L);return Promise.resolve()}
    return api('results',{method:'POST',body:r,prefer:'return=minimal'})},
  results:function(code){if(!ONLINE)return Promise.resolve(MK.get('results').filter(function(x){return!code||x.code===code}));
    return api('results?'+(code?'code=eq.'+encodeURIComponent(code)+'&':'')+'order=total_r.desc&limit=2000')}
};
G.__LG={DB:DB,online:ONLINE};

/* ---------- local progress per match ---------- */
function pkey(c){return'mnqr-mt-'+c}
function prog(c){return lsGet(pkey(c),{code:c,results:[],cur:null,submitted:false})}
function psave(P){lsSet(pkey(P.code),P)}
function totals(res){var r=0,p=0,n=0,w=0;res.forEach(function(x){r+=x.r;p+=x.pnl;if(x.n){n++;if(x.r>0)w++}});return{r:Math.round(r*100)/100,pnl:Math.round(p*100)/100,n:n,w:w}}
function fmtR(r){return(r>0?'+':'')+(+r).toFixed(2)+'R'}

/* ---------- picking the days (same seed = same days for everyone) ---------- */
function rng(seed){var s=seed%2147483647;if(s<=0)s+=2147483646;return function(){s=s*16807%2147483647;return(s-1)/2147483646}}
function useMNQ(){return(G.ensureIdx?G.ensureIdx('nq'):Promise.resolve()).then(function(){if(G.setSym)G.setSym('nq')})}
function pickDays(n,seed){return useMNQ().then(function(){var x=MNQ.idx['1m'];if(!x)throw new Error('no 1m data');
  var r=rng(seed),out=[],tries=0,a=x.from+6*86400,b=x.to-20*86400;
  return new Promise(function(res){(function next(){if(out.length>=n||tries>n*15){res(out);return}tries++;
    var t=a+r()*(b-a),d=new Date((t+off(t,NY))*1000),w=d.getUTCDay();if(w<1||w>5){next();return}
    var y=d.getUTCFullYear(),m=d.getUTCMonth()+1,dd=d.getUTCDate(),key=y+'-'+p2(m)+'-'+p2(dd);if(out.indexOf(key)>=0){next();return}
    var st=wallToUtc(y,m,dd,9,25,NY);if(pickSrc(st)!=='1m'){next();return}
    loadFor(st).then(function(){var B=bars('1m'),k=lowerBound(B,st);if(k<B.length&&B[k][0]<=st+300&&k+200<B.length)out.push(key);next()},function(){next()})})()})})}
function newCode(){var A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',s='';for(var i=0;i<6;i++)s+=A[Math.floor(Math.random()*A.length)];return s}

/* ---------- the match while you play ---------- */
var M=null,RK0=null;
function bar(){var b=$('mbar');if(!b){b=document.createElement('div');b.id='mbar';document.body.appendChild(b)}return b}
function lockTicket(on){['oRk','oQty','oRkU'].forEach(function(id){var e=$(id);if(e)e.disabled=on})}
function startMatch(m){needName().then(function(n){if(!n)return;
  var P=prog(m.code);
  if(P.cur){// the app was closed during a day: a day with a trade counts as -1R, without one as 0R
    var D=m.days[P.cur.i];P.results.push({d:D,r:P.cur.entered?-1:0,pnl:P.cur.entered?-RISK$:0,n:P.cur.entered?1:0,lost:true});P.cur=null;psave(P);
    toast('The app was closed during a day · that day counts as '+(P.results[P.results.length-1].r<0?'−1R':'0R'))}
  if(P.results.length>=m.days.length){finishMatch(m);return}
  if(!RK0&&G.__RK)RK0={u:G.__RK.u,v:G.__RK.v};useMNQ().then(function(){playDay(m,P.results.length)})})}
function playDay(m,i){var P=prog(m.code),key=m.days[i],a=key.split('-'),st=wallToUtc(+a[0],+a[1],+a[2],9,25,NY),prevId=S&&S.match?S.id:null;
  document.body.classList.add('matchon');
  loadFor(st).then(function(){var s={id:'mt-'+m.code+'-'+i+'-'+Date.now().toString(36),name:'Match '+m.code+' · Day '+(i+1),start:st,curT:st-1,src:'1m',bal0:BAL,pv:2,sym:'nq',comm:0.5,spread:0.25,slip:0,
      daily:null,maxdd:null,positions:[],orders:[],trades:[],drawings:[],tf:'1m',match:m.code};
    return G.openSession(s)}).then(function(){if(prevId)dropSession(prevId);
    if(!S||!S.match){toast('No data for this day · update the app');stopMatch();return}
    if(G.setBlind)G.setBlind(true);
    if(G.setRisk)G.setRisk('pct',1);lockTicket(true);$('oSL').value='';$('oTP').value='';if(G.setOT)G.setOT('market');
    P.cur={i:i,entered:false};psave(P);
    M={m:m,i:i,phase:'pick',left:PICK_MS,last:performance.now(),acc:0,ff:false,r0:null,iv:0};
    M.iv=setInterval(tick,100);drawBar();ui()})}
function nyMin(t){var d=new Date((t+off(t,NY))*1000);return d.getUTCHours()*60+d.getUTCMinutes()}
function tick(){if(!M||!S)return;var now=performance.now(),dt=Math.min(1000,now-M.last);M.last=now;
  if(M.phase==='pick'){M.left-=dt;if(S.positions.length){enter()}else if(M.left<=0){S.orders=[];endDay('time');return}}
  else if(!S.positions.length&&!S.orders.length){endDay('closed');return}
  M.acc+=dt;var per=M.ff?FF_MS:STEP_MS,n=0;
  while(M.acc>=per&&n<40){M.acc-=per;n++;if(nyMin(nowT())>=DAY_END){endDay('eod');return}reveal(1);
    if(M&&M.phase==='pick'&&S.positions.length){enter();break}
    if(M&&M.phase==='trade'&&!S.positions.length&&!S.orders.length){endDay('closed');return}}
  drawBar()}
function enter(){var p=S.positions[0];M.phase='trade';S.orders=[];
  var risk=p.sl!=null?Math.abs(p.entry-p.sl)*p.qty*S.pv+comm(p.qty):RISK$;M.r0=risk;
  var P=prog(M.m.code);if(P.cur){P.cur.entered=true;P.cur.r0=risk;psave(P)}snd&&snd('open');changed();drawBar()}
function endDay(why){if(!M)return;clearInterval(M.iv);M.iv=0;
  S.orders=[];S.positions.slice().forEach(function(p){closePos(p,mktExit(p.side),nowT(),'Session end')});changed();
  var pnl=S.trades.reduce(function(a,t){return a+t.pnl},0),r0=M.r0||RISK$,r=S.trades.length?pnl/r0:0;
  var P=prog(M.m.code),key=M.m.days[M.i],t0=S.trades[0];
  var rec={d:key,r:Math.round(r*100)/100,pnl:Math.round(pnl*100)/100,n:S.trades.length?1:0,side:t0?t0.side:0};
  P.results.push(rec);P.cur=null;psave(P);M.phase='done';drawBar();
  var a=key.split('-'),dt=new Date(Date.UTC(+a[0],+a[1]-1,+a[2])),last=P.results.length>=M.m.days.length;
  var box=document.createElement('div');box.id='mres';
  box.innerHTML='<div class="mr-c"><span class="heye">Day '+(M.i+1)+' of '+M.m.days.length+(why==='time'?' · no trade in 5 minutes':why==='eod'?' · closed at the end of the day':'')+'</span>'+
    '<b class="mr-r '+(rec.r>0?'pos':rec.r<0?'neg':'')+'">'+(rec.n?fmtR(rec.r):'0R')+'</b>'+(rec.n?'<span class="mr-p">'+money(rec.pnl,1)+'</span>':'<span class="mr-p dim">No trade</span>')+
    '<span class="mr-d">That was <b>'+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getUTCDay()]+', '+dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})+'</b></span>'+
    '<div class="mr-t">Total so far <b class="'+cls(totals(P.results).r)+'">'+fmtR(totals(P.results).r)+'</b></div>'+
    '<button class="hbig" id="mrNext">'+(last?'See results':'Next day')+'</button></div>';
  document.body.appendChild(box);
  $('mrNext').onclick=function(){box.remove();if(last){finishMatch(M.m)}else{var m=M.m,i=M.i+1;M=null;playDay(m,i)}};
  setTimeout(function(){var b=$('mrNext');if(b)b.focus()},50)}
function dropSession(id){try{localStorage.removeItem('mnqr-s-'+id)}catch(e){}lsSet('mnqr-sessions',listSessions().filter(function(x){return x.id!==id}));if(lsGet('mnqr-last',null)===id)lsSet('mnqr-last',null);if(G.imgDelPrefix)imgDelPrefix(id+':')}
function stopMatch(){if(M&&M.iv)clearInterval(M.iv);M=null;document.body.classList.remove('matchon');lockTicket(false);var b=$('mbar');if(b)b.remove();var r=$('mres');if(r)r.remove();
  if(RK0&&G.setRisk){G.setRisk(RK0.u,RK0.v);RK0=null}}
function leave(){if(!M)return;var m=M.m;
  if(M.phase==='done'){var id0=S&&S.id;stopMatch();if(id0)dropSession(id0);S=null;showHome();return}
  uiConfirm(M.phase==='trade'?'Leave the match? Your open trade is closed at the market price and the day counts. You can continue with the next day later.':'Leave the match? This day counts as 0R (no trade). You can continue with the next day later.','Leave').then(function(ok){if(!ok||!M)return;
    var m2=M.m;endDay('left');var r=$('mres');if(r)r.remove();if(prog(m2.code).results.length>=m2.days.length){finishMatch(m2);return}var id=S&&S.id;stopMatch();if(id)dropSession(id);S=null;showHome()})}
function drawBar(){if(!M){return}var b=bar(),m=M.m,mm=Math.max(0,Math.ceil(M.left/1000)),pct=Math.max(0,M.left/PICK_MS*100),T=totals(prog(m.code).results);
  var st=M.phase==='pick'?(S.orders.length?'Order waiting · it must fill within the time':'Take ONE trade · stop loss required · risk is 1 %'):M.phase==='trade'?'Trade running · manage it or fast forward to the end':'Day finished';
  b.innerHTML='<div class="mb-l"><span class="mb-code">'+esc2(m.name)+'</span><span class="mb-day">Day <b>'+(M.i+1)+'</b> / '+m.days.length+' · total <b class="'+cls(T.r)+'">'+fmtR(T.r)+'</b></span></div>'+
    (M.phase==='pick'?'<div class="mb-t'+(mm<=30?' warn':'')+'"><b>'+Math.floor(mm/60)+':'+p2(mm%60)+'</b><i style="width:'+pct+'%"></i></div>':M.phase==='trade'?'<div class="mb-t live"><b>LIVE</b></div>':'')+
    '<span class="mb-s">'+st+'</span>'+
    (M.phase==='trade'?'<button class="mb-b'+(M.ff?' on':'')+'" data-mb="ff">'+(M.ff?'Normal speed':'Fast forward')+'</button>':'')+
    (M.phase==='pick'?'<button class="mb-b" data-mb="skip">Skip day</button>':'')+
    '<button class="mb-b ghost" data-mb="leave">Leave</button>'}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-mb]');if(!b||!M)return;var a=b.dataset.mb;
  if(a==='ff'){M.ff=!M.ff;drawBar()}else if(a==='skip'){uiConfirm('Skip this day with no trade (0R)?','Skip').then(function(ok){if(ok&&M&&M.phase==='pick'){S.orders=[];endDay('skip')}})}else if(a==='leave')leave()});
// fair play: no pause, no stepping, no rewinding, one trade per day, stop loss required
G.addEventListener('keydown',function(e){if(!M)return;var k=e.key;if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(k===' '||k==='ArrowRight'||k==='ArrowLeft'||k==='x'||k==='X'||k==='Escape'&&$('mres')){e.preventDefault();e.stopImmediatePropagation()}
  if(k==='Enter'&&$('mres')){e.preventDefault();e.stopImmediatePropagation();$('mrNext').click()}},true);
['play','stepCandle','jumpTo','rewindTo'].forEach(function(f){var o=G[f];if(typeof o!=='function')return;G[f]=function(){if(M)return;return o.apply(this,arguments)}});
var _ct=G.canTrade;G.canTrade=function(q){if(M&&S&&S.match){if(M.phase!=='pick'){toast('One trade per day in a match');return false}
    if(S.orders.length||S.positions.length){toast('You already have an order');return false}
    if(!(num($('oSL').value)>0)){toast('Set a stop loss first · it decides your R');return false}}return _ct.apply(this,arguments)};
var _home=G.showHome;G.showHome=function(){if(M&&M.phase!=='done'){leave();return}if(M)stopMatch();return _home.apply(this,arguments)};

/* ---------- end of match: send the result, show the table ---------- */
function finishMatch(m){var P=prog(m.code),T=totals(P.results),id=S&&S.match?S.id:null;stopMatch();if(id)dropSession(id);S=null;showHome();
  var send=P.submitted?Promise.resolve():DB.submit({code:m.code,player:me(),total_r:T.r,pnl:T.pnl,trades:T.n,wins:T.w,days:P.results}).then(function(){P.submitted=true;psave(P)},
    function(e){if(e&&e.status===409){P.submitted=true;psave(P);toast('A result with your name was already sent for this match');return}toast('Couldn’t send the result · it’s saved and sent next time');throw e});
  send.catch(function(){}).then(function(){openMatch(m.code)})}
function retryPending(){var n=0;Object.keys(localStorage).forEach(function(k){if(k.indexOf('mnqr-mt-')!==0)return;var P=lsGet(k,null);if(!P||P.submitted||P.cur)return;
  DB.match(P.code).then(function(m){if(!m||P.results.length<m.days.length)return;var T=totals(P.results);
    return DB.submit({code:m.code,player:me(),total_r:T.r,pnl:T.pnl,trades:T.n,wins:T.w,days:P.results}).then(function(){P.submitted=true;psave(P);n++},function(e){if(e&&e.status===409){P.submitted=true;psave(P)}})}).catch(function(){})})}

/* ---------- match window: leaderboard, your days, play / share ---------- */
function shareUrl(code){return location.protocol==='file:'?code:location.origin+location.pathname+'?m='+code}
function modal(html){var m=document.createElement('div');m.className='modal lgm';m.innerHTML='<div class="box lgbox">'+html+'</div>';document.body.appendChild(m);
  m.addEventListener('click',function(e){if(e.target===m||e.target.closest('[data-lx]'))m.remove()});return m}
function openMatch(code){Promise.all([DB.match(code),DB.results(code)]).then(function(a){var m=a[0],R=a[1]||[];if(!m){toast('No match with code '+code);return}
  var live=m.kind==='live',P=prog(code),T=totals(P.results),done=live||P.results.length>=m.days.length,mine=R.filter(function(x){return x.player===me()})[0];
  R.sort(function(x,y){return y.total_r-x.total_r||y.pnl-x.pnl});
  var cols=m.days.map(function(d,i){return'<th>D'+(i+1)+'</th>'}).join('');
  var rows=R.map(function(x,i){var ds=(x.days||[]);return'<tr class="'+(x.player===me()?'me':'')+'"><td class="rk">'+(i===0?'<span class="cr">1</span>':(i+1))+'</td><td class="pl">'+esc2(x.player)+'</td><td class="'+cls(x.total_r)+' tr">'+fmtR(x.total_r)+'</td><td class="'+cls(x.pnl)+'">'+money(x.pnl,1)+'</td><td>'+x.trades+'/'+m.days.length+'</td>'+
      m.days.map(function(d,j){var y=ds[j];return'<td class="dd '+(y?cls(y.r):'')+'">'+(y?(y.n?(+y.r).toFixed(1):'·'):'')+'</td>'}).join('')+'</tr>'}).join('');
  var you=live?(mine?'<div class="lg-you">Your result <b class="'+cls(mine.total_r)+'">'+fmtR(mine.total_r)+'</b> · '+money(mine.pnl,1)+' · '+mine.trades+' trades</div>':''):done?'<div class="lg-you">Your result <b class="'+cls(T.r)+'">'+fmtR(T.r)+'</b> · '+money(T.pnl,1)+' · '+T.n+' trades'+(P.submitted||mine?'':' · <span class="neg">not sent yet</span>')+'</div>'
    :'<div class="lg-you">'+(P.results.length?'You played '+P.results.length+' of '+m.days.length+' days · '+fmtR(T.r):'You haven’t played this match yet')+'</div>';
  var md=modal('<div class="dhead"><b>'+esc2(m.name)+'</b><span class="lg-code" title="Match code">'+code+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
    '<div class="lg-meta">'+(live?'Live daily challenge · everyone played the same day at the same time in 20 minutes · score in R':m.days.length+' days · 5 minutes per day to take one trade · blind · score in R')+(m.created_by?' · by '+esc2(m.created_by):'')+'</div>'+you+
    '<div class="lg-act">'+(live&&R.length&&G.reviewLive?'<button class="hbig" data-lrv="1">'+ico('play')+'Review the day</button>':'')+(done?'':'<button class="hbig" data-lp="1">'+ico('play')+(P.results.length?'Continue match':'Play match')+'</button>')+
      '<button class="hsec" data-ls="1">'+ico('send')+'Copy invite link</button><button class="hsec" data-lr="1">Refresh</button></div>'+
    '<div class="lg-tw">'+(R.length?'<table class="lg-t"><tr><th></th><th>Player</th><th>R</th><th>Profit</th><th>Trades</th>'+cols+'</tr>'+rows+'</table>':'<p class="dim">Nobody has finished this match yet. Be the first.</p>')+'</div>');
  md.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    if(b.dataset.lrv){md.remove();G.reviewLive(code);return}
    if(b.dataset.lp){md.remove();startMatch(m)}
    else if(b.dataset.ls){var u=shareUrl(code),t='MNQ Replay match "'+m.name+'" · '+m.days.length+' days · code '+code+(u!==code?'\n'+u:'');
      (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('Invite copied · paste it in Discord')},function(){G.uiPrompt('Copy this invite',t)})}
    else if(b.dataset.lr){md.remove();openMatch(code)}})}).catch(function(e){toast('League is offline: '+(e&&e.message?e.message.slice(0,80):'error'))})}
G.openMatch=openMatch;G.__MT=function(){return M};
Object.assign(G.__LG,{api:api,me:me,needName:needName,modal:modal,newCode:newCode,dropSession:dropSession,lockTicket:lockTicket,fmtR:fmtR,useMNQ:useMNQ,renderLeague:renderLeague,esc:esc2,nyMin:nyMin,busy:function(){return!!M}});

function newMatch(){needName().then(function(n){if(!n)return;var md=modal('<div class="dhead"><b>New match</b><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
    '<label class="f">Name<input id="lgName" maxlength="40" value="'+esc2(n)+'’s match '+(new Date().getDate())+'. '+(new Date().getMonth()+1)+'."></label>'+
    '<div class="lg-l">Days</div><div class="seg" id="lgDays"><button data-n="3">3</button><button data-n="5" class="on">5</button><button data-n="10">10</button></div>'+
    '<p class="dim lg-h">Everyone gets the same random days, blind. Each day you have 5 minutes to take one trade with a stop loss, otherwise it’s 0R. The most R wins.</p>'+
    '<div class="lg-act"><button class="hbig" id="lgGo">Create match</button></div>');
  var N=5;md.querySelector('#lgDays').addEventListener('click',function(e){var b=e.target.closest('[data-n]');if(!b)return;N=+b.dataset.n;md.querySelectorAll('#lgDays button').forEach(function(x){x.classList.toggle('on',x===b)})});
  md.querySelector('#lgGo').addEventListener('click',function(){var btn=this;btn.disabled=true;btn.textContent='Picking days …';var name=md.querySelector('#lgName').value.trim().slice(0,40)||'Match';
    pickDays(N,Math.floor(Math.random()*2e9)+1).then(function(days){if(days.length<N)throw new Error('not enough days');
      return DB.create({code:newCode(),name:name,days:days,rounds:N,created_by:me()})}).then(function(m){md.remove();toast('Match created · send the invite to your friends');renderLeague();openMatch(m.code)},
      function(e){btn.disabled=false;btn.textContent='Create match';toast('Couldn’t create the match: '+(e&&e.message?e.message.slice(0,80):'error'))})})})}
function joinMatch(){G.uiPrompt('Match code or invite link','e.g. K7QX2M').then(function(v){if(!v)return;var m=/([A-Z2-9]{6})\s*$/i.exec(v.trim())||/[?&]m=([A-Z2-9]{6})/i.exec(v);if(!m){toast('That isn’t a match code');return}openMatch(m[1].toUpperCase())})}

/* ---------- league on the start page ---------- */
function season(R){var by={},pl={};R.forEach(function(x){(by[x.code]=by[x.code]||[]).push(x)});
  Object.keys(by).forEach(function(c){var L=by[c].sort(function(a,b){return b.total_r-a.total_r||b.pnl-a.pnl});L.forEach(function(x,i){var p=pl[x.player]=pl[x.player]||{n:x.player,pts:0,r:0,pnl:0,m:0,w:0};
    p.m++;p.r+=x.total_r;p.pnl+=x.pnl;if(L.length>1){p.pts+=[3,2,1][i]||0;if(i===0)p.w++}})});
  return Object.keys(pl).map(function(k){return pl[k]}).sort(function(a,b){return b.pts-a.pts||b.r-a.r})}
function renderLeague(){var host=$('lgHome');if(!host)return;
  Promise.all([DB.matches(),DB.results()]).then(function(a){var Ms=a[0]||[],R=a[1]||[],S2=season(R),byC={};R.forEach(function(x){(byC[x.code]=byC[x.code]||[]).push(x)});
    var st=S2.length?'<table class="lg-s"><tr><th></th><th>Player</th><th title="3 for a match win, 2 for second, 1 for third">Pts</th><th>Wins</th><th>R</th><th>Matches</th></tr>'+S2.slice(0,10).map(function(p,i){return'<tr class="'+(p.n===me()?'me':'')+'"><td class="rk">'+(i===0?'<span class="cr">1</span>':(i+1))+'</td><td class="pl">'+esc2(p.n)+'</td><td><b>'+p.pts+'</b></td><td>'+p.w+'</td><td class="'+cls(p.r)+'">'+fmtR(p.r)+'</td><td>'+p.m+'</td></tr>'}).join('')+'</table>'
      :'<p class="dim">No results yet. Create a match and send the code to your friends.</p>';
    var ml=Ms.length?Ms.slice(0,8).map(function(m){var L=(byC[m.code]||[]).sort(function(a,b){return b.total_r-a.total_r}),P=prog(m.code),live=m.kind==='live',mine=L.filter(function(x){return x.player===me()})[0],done=live?!!mine:P.results.length>=m.days.length,lead=L[0];
        return'<button class="lg-mi" data-lo="'+m.code+'"><span class="lg-mn"><b>'+esc2(m.name)+'</b><small>'+(live?'Live · 1 day':m.days.length+' days')+' · '+L.length+' played'+(lead?' · leader '+esc2(lead.player)+' '+fmtR(lead.total_r):'')+'</small></span>'+
          '<span class="lg-ms '+(live?(mine?cls(mine.total_r):''):done?cls(totals(P.results).r):'go')+'">'+(live?(mine?fmtR(mine.total_r):'Live'):done?fmtR(totals(P.results).r):P.results.length?'Continue':'Play')+'</span></button>'}).join('')
      :'<p class="dim">No matches yet.</p>';
    host.querySelector('.lg-body').innerHTML='<div class="hcard2"><div class="hct2"><span class="heye">Season table</span><span class="hmini">3 · 2 · 1 points per match</span></div>'+st+'</div>'+
      '<div class="hcard2"><div class="hct2"><span class="heye">Matches</span><span class="hmini">'+Ms.length+'</span></div><div class="lg-ml">'+ml+'</div></div>'},
    function(e){host.querySelector('.lg-body').innerHTML='<div class="hcard2"><p class="dim">League is offline right now ('+esc2(e&&e.message?e.message.slice(0,60):'error')+').</p></div>'})}
function purgeMatchSessions(){listSessions().forEach(function(x){if(String(x.id).indexOf('mt-')===0&&!(M&&S&&S.id===x.id))dropSession(x.id)})}
var _rh=G.renderHome;G.renderHome=function(){purgeMatchSessions();_rh.apply(this,arguments);var d=document.querySelector('#home .hdash');if(!d)return;
  d.insertAdjacentHTML('afterend','<div id="lgHome"><div class="hsec2"><h2>Friends league <small>'+(ONLINE?'online':'test mode · only on this device')+'</small></h2><div class="lg-top">'+
    '<button class="hsec acc" data-lg="new">'+ico('plus')+'New match</button><button class="hsec" data-lg="join">Join with code</button><button class="hsec" data-lg="name" title="Your name in the league">'+esc2(me()||'Set your name')+'</button></div></div><div class="lg-body lgrid"><div class="hcard2"><p class="dim">Loading …</p></div></div></div>');
  renderLeague();retryPending()};
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#lgHome [data-lg],#lgHome [data-lo]');if(!b)return;
  if(b.dataset.lo){openMatch(b.dataset.lo);return}var a=b.dataset.lg;if(a==='new')newMatch();else if(a==='join')joinMatch();else if(a==='name')askName().then(function(n){if(n)G.renderHome()})});
// invite link: ?m=CODE opens the match
(function(){var q=/[?&]m=([A-Z2-9]{6})/i.exec(location.search);if(q)setTimeout(function(){openMatch(q[1].toUpperCase())},900)})();
})();

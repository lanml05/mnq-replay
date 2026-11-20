/* MNQ Replay — live daily challenge with friends.
   Open a room, friends join with the link, the host presses Start and everyone plays the daily challenge day
   at the same moment: 9:00–15:58 NY replayed in 20 real minutes, candles tied to the server clock so nobody is ahead.
   Free trading, risk 1 % per trade, stop loss required. Score = P&L in R (1R = $500). Live standings while you play,
   the final result goes to the league (matches.kind = 'live'). Needs the online league (js/mconfig.js). */
(function(){
'use strict';
var G=window,LG=G.__LG;if(!LG)return;
var GAME_MS=20*60*1000,BAL=50000,RISK$=500,H0=9*60,DAY_END=15*60+58,STEP=GAME_MS/(DAY_END-H0),BEAT=4000,FRESH=15000;
var api=LG.api,me=LG.me,esc=LG.esc,fmtR=LG.fmtR;
var DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ---------- server clock (from the database's own now()) ---------- */
var OFF=0,RTT=1e9;function sNow(){return Date.now()+OFF}
function beat(code,extra){var t0=Date.now(),row=Object.assign({code:code,player:me()},extra||{});
  return api('lobby_players?on_conflict=code,player',{method:'POST',body:row,prefer:'resolution=merge-duplicates,return=representation'}).then(function(r){var t1=Date.now(),x=r&&r[0];
    if(x&&x.seen_at&&t1-t0<RTT){RTT=t1-t0;OFF=Date.parse(x.seen_at)-(t0+t1)/2}return x})}
function getRoom(code){return Promise.all([api('lobbies?code=eq.'+code),api('lobby_players?code=eq.'+code+'&order=pnl.desc,player.asc')]).then(function(a){return a[0][0]?{l:a[0][0],p:a[1]||[]}:null})}
function dayLabel(key){var a=key.split('-'),d=new Date(Date.UTC(+a[0],+a[1]-1,+a[2]));return DN[d.getUTCDay()]+', '+(+a[2])+'. '+(+a[1])+'. '+a[0]}
function online(p){return sNow()-Date.parse(p.seen_at)<FRESH}
function mmss(ms){var s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+p2(s%60)}
function shareUrl(code){return location.protocol==='file:'?code:location.origin+location.pathname+'?l='+code}
function copyInvite(code,day){var u=shareUrl(code),t='MNQ Replay live challenge · '+dayLabel(day)+' · code '+code+(u!==code?'\n'+u:'');
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('Invite copied · paste it in Discord')},function(){G.uiPrompt('Copy this invite',t)})}

/* ---------- the daily challenge window ---------- */
var W=null;// open window: {md, code, iv}
function closeW(){if(W){clearInterval(W.iv);if(W.md.parentNode)W.md.remove();W=null}}
function win(html){closeW();var md=LG.modal(html);md.classList.add('lvm');W={md:md,iv:0};
  var ob=new MutationObserver(function(){if(!md.parentNode){ob.disconnect();if(W&&W.md===md){clearInterval(W.iv);W=null}}});ob.observe(document.body,{childList:true});return md}
function todayKey(){var p=G.dailyPick&&G.dailyPick();return p?p.y+'-'+p2(p.m)+'-'+p2(p.d):null}
function openDaily(){
  if(!LG.online){var p0=G.dailyPick&&G.dailyPick();if(p0)G.startDay(p0.y,p0.m,p0.d,9,0,'Daily challenge · '+p0.d+'. '+p0.m+'. '+p0.y);return}
  LG.needName().then(function(n){if(!n)return;
  LG.useMNQ().then(function(){var key=todayKey();if(!key){toast('Data is still loading');return}
    var md=win('<div class="dhead"><b>Daily challenge</b><span class="lv-day">'+dayLabel(key)+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
      '<p class="lg-meta">Everyone plays this day at the same time: 9:00–16:00 NY runs in <b>20 minutes</b>. No pause, no rewind. Risk is 1 % per trade, stop loss required. Most R wins.</p>'+
      '<div class="lg-act"><button class="hbig" data-lv="new">'+ico('plus')+'Create a room</button><button class="hsec" data-lv="join">Join with code</button><button class="hsec" data-lv="solo">'+ico('play')+'Play alone</button></div>'+
      '<div class="lg-l">Rooms waiting for players</div><div class="lv-rooms"><p class="dim">Loading …</p></div>');
    function rooms(){api('lobbies?start_at=is.null&created_at=gte.'+encodeURIComponent(new Date(Date.now()-3*3600e3).toISOString())+'&order=created_at.desc&limit=8').then(function(L){
        var box=md.querySelector('.lv-rooms');if(!box)return;
        box.innerHTML=L.length?L.map(function(l){return'<button class="lg-mi" data-lj="'+l.code+'"><span class="lg-mn"><b>'+esc(l.host)+'’s room</b><small>'+dayLabel(l.day)+' · code '+l.code+'</small></span><span class="lg-ms go">Join</span></button>'}).join('')
          :'<p class="dim">No open rooms right now. Create one and send the link to your friends.</p>'},function(){})}
    rooms();W.iv=setInterval(rooms,5000);
    md.addEventListener('click',function(e){var b=e.target.closest('[data-lv],[data-lj]');if(!b)return;
      if(b.dataset.lj){joinRoom(b.dataset.lj);return}
      var a=b.dataset.lv;
      if(a==='solo'){closeW();var p=G.dailyPick();if(p)G.startDay(p.y,p.m,p.d,9,0,'Daily challenge · '+p.d+'. '+p.m+'. '+p.y)}
      else if(a==='join')askCode();
      else if(a==='new'){b.disabled=true;createRoom(key).catch(function(err){b.disabled=false;toast('Couldn’t create the room: '+(err&&err.message?err.message.slice(0,80):'error'))})}})})})}
function askCode(){G.uiPrompt('Room code or invite link','e.g. K7QX2M').then(function(v){if(!v)return;var m=/[?&]l=([A-Z2-9]{6})/i.exec(v)||/([A-Z2-9]{6})\s*$/i.exec(v.trim());if(!m){toast('That isn’t a room code');return}joinRoom(m[1].toUpperCase())})}
function dayOk(key){var a=key.split('-'),st=wallToUtc(+a[0],+a[1],+a[2],9,0,NY);return loadFor(st).then(function(){var B=bars('1m'),k=lowerBound(B,st);return k<B.length&&B[k][0]<=st+1800&&k+300<B.length})}
function createRoom(key){var code=LG.newCode();
  return dayOk(key).then(function(ok){if(!ok)throw new Error('no 1-minute data for this day');
    return api('lobbies',{method:'POST',body:{code:code,day:key,host:me()},prefer:'return=minimal'})}).then(function(){
    return LG.DB.create({code:code,name:('Live · '+dayLabel(key)).slice(0,40),days:[key],rounds:1,created_by:me(),kind:'live'})}).then(function(){joinRoom(code)})}

/* ---------- the room: who is in, start for everyone ---------- */
function joinRoom(code){LG.needName().then(function(n){if(!n)return;
  getRoom(code).then(function(R){if(!R){toast('No room with code '+code);return}
    var st=R.l.start_at?Date.parse(R.l.start_at):0,mine=R.p.filter(function(p){return p.player===me()})[0];
    if(mine&&mine.done||st&&sNow()>st+GAME_MS){closeW();G.openMatch(code);return}
    var md=win('<div class="dhead"><b>'+esc(R.l.host)+'’s room</b><span class="lg-code" title="Room code">'+code+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
      '<div class="lg-meta">'+dayLabel(R.l.day)+' · 9:00–16:00 NY in 20 minutes · risk 1 % per trade · most R wins</div>'+
      '<div class="lv-state"></div><div class="lg-act lv-act"></div><div class="lg-l">Players</div><div class="lv-pl"></div>');
    W.code=code;lsSet('mnqr-lv-room',code);
    md.addEventListener('click',function(e){var b=e.target.closest('[data-lr]');if(!b)return;var a=b.dataset.lr;
      if(a==='copy')copyInvite(code,R.l.day);
      else if(a==='start'){b.disabled=true;api('lobbies?code=eq.'+code+'&start_at=is.null',{method:'PATCH',body:{start_at:new Date(sNow()+6000).toISOString()},prefer:'return=representation'}).then(tick,function(){b.disabled=false;toast('Couldn’t start · try again')})}
      else if(a==='play'){closeW();begin(R.l)}
      else if(a==='leave'){lsSet('mnqr-lv-room',null);closeW()}});
    var last=0;
    function tick(){if(!W||W.md!==md)return;var now=Date.now();
      if(now-last>=BEAT){last=now;beat(code).catch(function(){})}
      getRoom(code).then(function(R2){if(!R2||!W||W.md!==md)return;R=R2;var l=R.l,host=l.host===me(),st=l.start_at?Date.parse(l.start_at):0,left=st-sNow();
        md.querySelector('.lv-pl').innerHTML=R.p.length?R.p.map(function(p){return'<div class="lv-p'+(p.player===me()?' me':'')+'"><i class="'+(online(p)?'on':'')+'"></i><b>'+esc(p.player)+'</b>'+(p.player===l.host?'<span class="lv-h">host</span>':'')+'<span class="hsp"></span><small>'+(online(p)?'ready':'away')+'</small></div>'}).join(''):'<p class="dim">Nobody yet.</p>';
        var S1=md.querySelector('.lv-state'),A=md.querySelector('.lv-act');
        if(!st){S1.innerHTML=host?'<p>Send the link to your friends. When everyone is here, press <b>Start for everyone</b>.</p>':'<p>Waiting for <b>'+esc(l.host)+'</b> to start …</p>';
          A.innerHTML=(host?'<button class="hbig" data-lr="start">'+ico('play')+'Start for everyone</button>':'')+'<button class="hsec" data-lr="copy">'+ico('send')+'Copy invite link</button><button class="hsec" data-lr="leave">Leave room</button>'}
        else if(left>0){S1.innerHTML='<div class="lv-cd">Starting in <b>'+Math.ceil(left/1000)+'</b></div>';A.innerHTML=''}
        else if(-left<GAME_MS){closeW();begin(l)}
        else{closeW();G.openMatch(code)}},function(){})}
    tick();W.iv=setInterval(tick,1000)})})}

/* ---------- playing ---------- */
var L=null,RK0=null;
function stats(){var t=S?S.trades:[],p=0,w=0;t.forEach(function(x){p+=x.pnl;if(x.pnl>0)w++});var b=L.base;
  p=Math.round((b.pnl+p)*100)/100;return{pnl:p,r:Math.round(p/RISK$*100)/100,trades:b.trades+t.length,wins:b.wins+w}}
function begin(l){if(L||LG.busy())return;var a=l.day.split('-'),st=wallToUtc(+a[0],+a[1],+a[2],9,0,NY),code=l.code;
  LG.useMNQ().then(function(){return loadFor(st)}).then(function(){
    var s={id:'mt-L'+code+'-'+Date.now().toString(36),name:'Live '+code,start:st,curT:st-1,src:'1m',bal0:BAL,pv:2,sym:'nq',comm:0.5,spread:0.25,slip:0,
      daily:null,maxdd:null,positions:[],orders:[],trades:[],drawings:[],tf:'1m',match:code};
    return G.openSession(s)}).then(function(){
    if(!S||S.match!==code){toast('No data for this day · update the app');return}
    if(G.hideHome)G.hideHome();
    if(!RK0&&G.__RK)RK0={u:G.__RK.u,v:G.__RK.v};if(G.setRisk)G.setRisk('pct',1);LG.lockTicket(true);
    document.body.classList.add('matchon','liveon');if(G.setOT)G.setOT('market');
    L={l:l,code:code,start:Date.parse(l.start_at),n:0,base:lsGet('mnqr-lv-'+code,{pnl:0,trades:0,wins:0}),nt:0,lastBeat:0,board:[],iv:0};
    L.iv=setInterval(step,200);step();ui()})}
function step(){if(!L||!S)return;var el=sNow()-L.start;
  if(el>=GAME_MS){end('time');return}
  var target=Math.min(DAY_END-H0,Math.floor(el/STEP)+1),k=0;
  while(L.n<target&&k<600){if(LG.nyMin(nowT())>=DAY_END)break;reveal(1);L.n++;k++}
  if(S.trades.length!==L.nt){L.nt=S.trades.length;var t=stats();lsSet('mnqr-lv-'+L.code,{pnl:t.pnl,trades:t.trades,wins:t.wins})}
  if(Date.now()-L.lastBeat>=BEAT){L.lastBeat=Date.now();send(false)}
  draw(el)}
function send(done){var t=stats(),code=L.code;
  return beat(code,{r:t.r,pnl:t.pnl,trades:t.trades,open:!!S.positions.length,done:!!done}).then(function(){return getRoom(code)}).then(function(R){if(R&&L&&L.code===code){L.board=R.p;drawBoard()}return R},function(){})}
function draw(el){var b=$('mbar');if(!b){b=document.createElement('div');b.id='mbar';document.body.appendChild(b)}var t=stats(),left=GAME_MS-el;
  b.innerHTML='<div class="mb-l"><span class="mb-code">Live · '+esc(L.l.host)+'’s room</span><span class="mb-day">You <b class="'+cls(t.r)+'">'+fmtR(t.r)+'</b> · '+t.trades+' trades</span></div>'+
    '<div class="mb-t'+(left<=60000?' warn':'')+'"><b>'+mmss(left)+'</b><i style="width:'+Math.max(0,left/GAME_MS*100)+'%"></i></div>'+
    '<span class="mb-s">Risk 1 % per trade · stop loss required · the day runs for everyone at the same speed</span>'+
    '<button class="mb-b ghost" data-lb="leave">Leave</button>'}
function drawBoard(){var d=$('lvbd');if(!d){d=document.createElement('div');d.id='lvbd';document.body.appendChild(d)}
  var P=(L.board||[]).slice().sort(function(a,b){return b.r-a.r||b.pnl-a.pnl});
  d.innerHTML='<div class="lv-bt">Live</div>'+P.map(function(p,i){return'<div class="lv-br'+(p.player===me()?' me':'')+'"><span class="rk">'+(i+1)+'</span><b>'+esc(p.player)+'</b>'+(p.open?'<i title="trade open"></i>':'')+'<span class="hsp"></span><span class="'+cls(p.r)+'">'+fmtR(p.r)+'</span></div>'}).join('')}
function cleanup(){if(!L)return;clearInterval(L.iv);var id=S&&S.match===L.code?S.id:null;L=null;
  document.body.classList.remove('matchon','liveon');LG.lockTicket(false);['mbar','lvbd'].forEach(function(i){var e=$(i);if(e)e.remove()});
  if(RK0&&G.setRisk){G.setRisk(RK0.u,RK0.v);RK0=null}if(id)LG.dropSession(id);S=null}
function end(why){if(!L)return;clearInterval(L.iv);
  S.orders=[];S.positions.slice().forEach(function(p){closePos(p,mktExit(p.side),nowT(),'Session end')});changed();
  var t=stats(),code=L.code,day=L.l.day,res={code:code,player:me(),total_r:Math.max(-60,Math.min(300,t.r)),pnl:t.pnl,trades:t.trades,wins:t.wins,days:[{d:day,r:t.r,pnl:t.pnl,n:t.trades}]};
  lsSet('mnqr-lv-'+code,{pnl:t.pnl,trades:t.trades,wins:t.wins});lsSet('mnqr-lv-res-'+code,res);lsSet('mnqr-lv-room',null);
  send(true).then(function(){return LG.DB.submit(res)}).then(function(){lsSet('mnqr-lv-res-'+code,null)},function(e){if(e&&e.status===409)lsSet('mnqr-lv-res-'+code,null)});
  cleanup();G.showHome();results(code,day,t,why)}
function results(code,day,t,why){var md=win('<div class="dhead"><b>Live challenge · results</b><span class="lg-code">'+code+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
    '<div class="lg-meta">That was <b>'+dayLabel(day)+'</b>'+(why==='left'?' · you left early':'')+'</div>'+
    '<div class="lv-you"><b class="mr-r '+(t.r>0?'pos':t.r<0?'neg':'')+'">'+fmtR(t.r)+'</b><span class="mr-p">'+money(t.pnl,1)+' · '+t.trades+' trades</span></div>'+
    '<div class="lg-l">Standings <small class="dim">· updates until everyone is done</small></div><div class="lv-fin"></div>'+
    '<div class="lg-act"><button class="hsec" data-lr2="league">Open in the league</button></div>');
  md.addEventListener('click',function(e){if(e.target.closest('[data-lr2]')){closeW();G.openMatch(code)}});
  var n=0;function f(){getRoom(code).then(function(R){if(!R||!W||W.md!==md)return;var P=R.p.slice().sort(function(a,b){return b.r-a.r||b.pnl-a.pnl});
    md.querySelector('.lv-fin').innerHTML='<table class="lg-t"><tr><th></th><th>Player</th><th>R</th><th>Profit</th><th>Trades</th><th></th></tr>'+P.map(function(p,i){return'<tr class="'+(p.player===me()?'me':'')+'"><td class="rk">'+(i===0?'<span class="cr">1</span>':(i+1))+'</td><td class="pl">'+esc(p.player)+'</td><td class="'+cls(p.r)+' tr">'+fmtR(p.r)+'</td><td class="'+cls(p.pnl)+'">'+money(p.pnl,1)+'</td><td>'+p.trades+'</td><td class="dim">'+(p.done?'done':'playing')+'</td></tr>'}).join('')+'</table>';
    if(P.every(function(p){return p.done})||++n>120){clearInterval(W.iv)}},function(){})}
  f();W.iv=setInterval(f,3000);if(LG.renderLeague)setTimeout(LG.renderLeague,1500)}
function leaveLive(){if(!L)return;uiConfirm('Leave the live challenge? Open trades are closed now and your result so far counts.','Leave').then(function(ok){if(ok&&L)end('left')})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-lb]');if(b&&L)leaveLive()});

/* ---------- fair play: no pause, no stepping, no rewinding, stop loss required ---------- */
G.addEventListener('keydown',function(e){if(!L)return;var k=e.key;if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(k===' '||k==='ArrowRight'||k==='ArrowLeft'||k==='x'||k==='X'){e.preventDefault();e.stopImmediatePropagation()}},true);
['play','stepCandle','jumpTo','rewindTo'].forEach(function(f){var o=G[f];if(typeof o!=='function')return;G[f]=function(){if(L)return;return o.apply(this,arguments)}});
var _ct=G.canTrade;G.canTrade=function(q){if(L&&S&&S.match===L.code&&!(num($('oSL').value)>0)){toast('Set a stop loss first · it decides your R');return false}return _ct.apply(this,arguments)};
var _home=G.showHome;G.showHome=function(){if(L){leaveLive();return}return _home.apply(this,arguments)};

/* ---------- entry points ---------- */
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-hdaily]');if(!b)return;e.preventDefault();e.stopPropagation();openDaily()},true);
function retry(){Object.keys(localStorage).forEach(function(k){if(k.indexOf('mnqr-lv-res-')!==0)return;var r=lsGet(k,null);if(!r)return;
  LG.DB.submit(r).then(function(){lsSet(k,null)},function(e){if(e&&e.status===409)lsSet(k,null)})})}
if(LG.online)setTimeout(function(){retry();
  var q=/[?&]l=([A-Z2-9]{6})/i.exec(location.search);if(q){joinRoom(q[1].toUpperCase());return}
  // the app was closed during a live game: offer to jump back in while it is still running
  var c=lsGet('mnqr-lv-room',null);if(c)getRoom(c).then(function(R){var st=R&&R.l.start_at?Date.parse(R.l.start_at):0;if(st&&sNow()<st+GAME_MS)joinRoom(c);else lsSet('mnqr-lv-room',null)},function(){})},1000);
G.__LV={L:function(){return L},sNow:sNow,openDaily:openDaily,joinRoom:joinRoom,end:end,GAME_MS:GAME_MS,setGame:function(ms){GAME_MS=ms;STEP=GAME_MS/(DAY_END-H0)}};
})();

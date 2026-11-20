/* MNQ Replay — live daily challenge with friends.
   Open a room, friends join with the link, the host presses Start and everyone plays the daily challenge day
   at the same moment: 9:00–15:58 NY replayed in 20 real minutes, candles tied to the server clock so nobody is ahead.
   Free trading, risk 1 % per trade, stop loss required. Score = P&L in R (1R = $500). Live standings while you play,
   the final result goes to the league (matches.kind = 'live'). Needs the online league (js/mconfig.js). */
(function(){
'use strict';
var G=window,LG=G.__LG;if(!LG)return;
var PAUSE_MS=60*1000,CATCH=2,PREP=2*60*1000,GAME_MS=20*60*1000,BAL=50000,RISK$=500,H0=9*60,DAY_END=15*60+58,STEP=GAME_MS/(DAY_END-H0),BEAT=4000,FRESH=15000;
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
  var ob=new MutationObserver(function(){if(!md.parentNode){ob.disconnect();if(W&&W.md===md){clearInterval(W.iv);W=null}if(!W&&!L&&!RV)evStop()}});ob.observe(document.body,{childList:true});return md}
function todayKey(){var p=G.dailyPick&&G.dailyPick();return p?p.y+'-'+p2(p.m)+'-'+p2(p.d):null}
function openDaily(){
  if(!LG.online){var p0=G.dailyPick&&G.dailyPick();if(p0)G.startDay(p0.y,p0.m,p0.d,9,0,'Daily challenge · '+p0.d+'. '+p0.m+'. '+p0.y);return}
  LG.needName().then(function(n){if(!n)return;
  LG.useMNQ().then(function(){var key=todayKey();if(!key){toast('Data is still loading');return}
    var md=win('<div class="dhead"><b>Daily challenge</b><span class="lv-day">'+dayLabel(key)+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
      '<p class="lg-meta">Everyone plays this day at the same time: 9:00–16:00 NY runs in <b>20 minutes</b>. First 2 minutes to look at the chart and mark your levels. No rewind. When you open BUY/SELL your chart pauses for you (60 s per game), then it catches up. Risk is 1 % per trade, stop loss required. Most R wins.</p>'+
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
    if(mine&&mine.done||st&&sNow()>st+PREP+GAME_MS){closeW();G.openMatch(code);return}
    var md=win('<div class="dhead"><b>'+esc(R.l.host)+'’s room</b><span class="lg-code" title="Room code">'+code+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
      '<div class="lg-meta">'+dayLabel(R.l.day)+' · 2 min to mark levels, then 9:00–16:00 NY in 20 minutes · risk 1 % per trade · most R wins</div>'+
      '<div class="lv-state"></div><div class="lg-act lv-act"></div><div class="lv-two"><div><div class="lg-l">Players</div><div class="lv-pl"></div></div>'+
      '<div><div class="lg-l">Chat</div><div class="lv-log"></div>'+rxHtml()+'</div></div>');
    W.code=code;lsSet('mnqr-lv-room',code);evStart(code);evLog();
    if(!lsGet('mnqr-lv-j-'+code,false)){lsSet('mnqr-lv-j-'+code,true);evSend('join','')}
    md.addEventListener('click',function(e){var b=e.target.closest('[data-lr]');if(!b)return;var a=b.dataset.lr;
      if(a==='copy')copyInvite(code,R.l.day);
      else if(a==='start'){b.disabled=true;api('lobbies?code=eq.'+code+'&start_at=is.null',{method:'PATCH',body:{start_at:new Date(sNow()+6000).toISOString()},prefer:'return=representation'}).then(tick,function(){b.disabled=false;toast('Couldn’t start · try again')})}
      else if(a==='play'){closeW();begin(R.l)}
      else if(a==='leave'){lsSet('mnqr-lv-room',null);closeW();evStop()}});
    var last=0;
    function tick(){if(!W||W.md!==md)return;var now=Date.now();
      if(now-last>=BEAT){last=now;beat(code).catch(function(){})}
      getRoom(code).then(function(R2){if(!R2||!W||W.md!==md)return;R=R2;var l=R.l,st=l.start_at?Date.parse(l.start_at):0,left=st-sNow();
        md.querySelector('.lv-pl').innerHTML=R.p.length?R.p.map(function(p){return'<div class="lv-p'+(p.player===me()?' me':'')+'"><i class="'+(online(p)?'on':'')+'"></i><b>'+esc(p.player)+'</b>'+(p.player===l.host?'<span class="lv-h">host</span>':'')+'<span class="hsp"></span><small>'+(online(p)?'ready':'away')+'</small></div>'}).join(''):'<p class="dim">Nobody yet.</p>';
        var S1=md.querySelector('.lv-state'),A=md.querySelector('.lv-act');
        if(!st){S1.innerHTML='<p>Send the link to your friends. When everyone is here, <b>anyone in the room</b> can press <b>Start for everyone</b>.</p>';
          if(!A.querySelector('[data-lr=start]'))A.innerHTML='<button class="hbig" data-lr="start">'+ico('play')+'Start for everyone</button><button class="hsec" data-lr="copy">'+ico('send')+'Copy invite link</button><button class="hsec" data-lr="leave">Leave room</button>'}
        else if(left>0){S1.innerHTML='<div class="lv-cd">Starting in <b>'+Math.ceil(left/1000)+'</b></div>';A.innerHTML=''}
        else if(-left<PREP+GAME_MS){closeW();begin(l)}
        else{closeW();G.openMatch(code)}},function(){})}
    tick();W.iv=setInterval(tick,1000)})})}

/* ---------- playing ---------- */
var L=null,RK0=null;
function tlog(){var b=(L.base.log||[]).slice();(S?S.trades:[]).forEach(function(t){b.push({s:t.side,q:t.qty,et:t.openT,ep:t.entry,xt:t.closeT,xp:t.exit,pnl:Math.round(t.pnl*100)/100,r:Math.round(t.pnl/RISK$*100)/100})});return b.slice(-60)}
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
    L={l:l,code:code,start:Date.parse(l.start_at)+PREP,n:0,base:lsGet('mnqr-lv-'+code,{pnl:0,trades:0,wins:0,log:[]}),nt:0,np:0,lastBeat:0,board:[],iv:0,lag:0,budget:PAUSE_MS,man:false,frozen:false,lastT:performance.now(),bh:''};
    L.cf0=lsGet('mnqr-cfmode','qty');lsSet('mnqr-cfmode','pct');// the order panel sizes by risk only (1 %)
    L.iv=setInterval(step,250);(function fr(){if(!L||L.code!==code)return;step();L.raf=requestAnimationFrame(fr)})();ui();evStart(code)})}
function step(){if(!L||!S)return;var now=performance.now(),dt=Math.min(1000,now-L.lastT);if(dt<8)return;L.lastT=now;var el=sNow()-L.start;
  // personal pause: while the order panel is open (or Pause is on) your chart stands still, then it catches up at 3x
  if(el>=0){var want=(L.man||!!$('ocf'))&&L.budget>0;if(want){L.lag+=dt;L.budget-=dt;if(L.budget<=0){L.budget=0;L.man=false;toast('Your pause time is used up')}}
    else if(L.lag>0)L.lag=Math.max(0,L.lag-dt*CATCH);L.frozen=want;el-=L.lag}
  if(el<0){if(Date.now()-L.lastBeat>=BEAT){L.lastBeat=Date.now();send(false)}draw(el);return}// prep: the chart stands still, mark your levels
  if(!L.go){L.go=1;if(typeof snd==='function')snd('open');toast('The chart is running · good luck')}
  if(el>=GAME_MS){end('time');return}
  var target=Math.min(DAY_END-H0,Math.floor(el/STEP)+1),k=0;
  while(L.n<target&&k<600){if(LG.nyMin(nowT())>=DAY_END)break;reveal(1);L.n++;k++}
  if(!L.frozen)smooth((el-(L.n-1)*STEP)/STEP);
  if(S.positions.length>L.np)evSend('open','');L.np=S.positions.length;
  if(S.trades.length!==L.nt){var lt=S.trades[S.trades.length-1];if(S.trades.length>L.nt&&lt)evSend('close',fmtR(lt.pnl/RISK$));L.nt=S.trades.length;var t=stats();lsSet('mnqr-lv-'+L.code,{pnl:t.pnl,trades:t.trades,wins:t.wins,log:tlog()})}
  if(Date.now()-L.lastBeat>=BEAT){L.lastBeat=Date.now();send(false)}
  draw(el)}
function smooth(f){try{if(cur>=SRC.length-1)return;f=Math.max(0,Math.min(.999,f));var nb=SRC[cur+1],up=nb[4]>=nb[1],P=up?[nb[1],nb[3],nb[2],nb[4]]:[nb[1],nb[2],nb[3],nb[4]],seg=f*3,i=Math.min(2,Math.floor(seg)),fr=seg-i,px=P[i]+(P[i+1]-P[i])*fr;
  var hi=nb[1],lo=nb[1];for(var k=0;k<=i;k++){hi=Math.max(hi,P[k]);lo=Math.min(lo,P[k])}hi=Math.max(hi,px);lo=Math.min(lo,px);px=q4(px);
  var key=keyOf(nb[0],TF),cb=curBar&&curBar.key===key?{t:ctOf(key,TF),o:curBar.o,h:Math.max(curBar.h,hi),l:Math.min(curBar.l,lo)}:{t:ctOf(key,TF),o:nb[1],h:hi,l:lo};
  if(CT.length&&cb.t<CT[CT.length-1])return;cs.update({time:cb.t,open:cb.o,high:cb.h,low:cb.l,close:px})}catch(e){}}
function send(done){var t=stats(),code=L.code;
  return beat(code,{r:t.r,pnl:t.pnl,trades:t.trades,open:!!S.positions.length,done:!!done,log:tlog()}).then(function(){return getRoom(code)}).then(function(R){if(R&&L&&L.code===code){L.board=R.p;drawBoard()}return R},function(){})}
function setBar(b,h){if(L.bh!==h){L.bh=h;b.innerHTML=h}}
function draw(el){var b=$('mbar');if(!b){b=document.createElement('div');b.id='mbar';document.body.appendChild(b);L.bh=''}var t=stats(),left=GAME_MS-el;
  if(el<0){setBar(b,'<div class="mb-l"><span class="mb-code">Live · '+esc(L.l.host)+'’s room</span><span class="mb-day">Preparation</span></div>'+
    '<div class="mb-t prep"><b>'+mmss(-el)+'</b><i style="width:'+Math.max(0,-el/PREP*100)+'%"></i></div>'+
    '<span class="mb-s">Look at the chart and mark your levels · the chart starts for everyone when the time runs out · trading opens then</span>'+
    '<button class="mb-b ghost" data-lb="leave">Leave</button>');return}
  var ps=Math.ceil(L.budget/1000),st=L.frozen?'<b class="lv-pz">Paused for you</b> · '+ps+' s of pause left · the others keep playing, you catch up after':L.lag>500?'Catching up ×'+(CATCH+1)+' · '+Math.ceil(L.lag/1000)+' s behind':'Risk 1 % per trade · stop loss required · opening BUY/SELL pauses your chart';
  setBar(b,'<div class="mb-l"><span class="mb-code">Live · '+esc(L.l.host)+'’s room</span><span class="mb-day">You <b class="'+cls(t.r)+'">'+fmtR(t.r)+'</b> · '+t.trades+' trades</span></div>'+
    '<div class="mb-t'+(L.frozen?' prep':left<=60000?' warn':'')+'"><b>'+mmss(left)+'</b><i style="width:'+Math.max(0,left/GAME_MS*100).toFixed(1)+'%"></i></div>'+
    '<span class="mb-s">'+st+'</span>'+
    '<button class="mb-b ghost lv-rxb" data-lb="react" title="Reactions">😀</button>'+
    '<button class="mb-b'+(L.man?' on':'')+'" data-lb="pause"'+(L.budget>0?'':' disabled')+' title="Pause your chart (P) · 60 s per game">'+(L.man?'Resume':'Pause · '+ps+' s')+'</button>'+
    '<button class="mb-b ghost" data-lb="leave">Leave</button>')}
function drawBoard(){var d=$('lvbd');if(!d){d=document.createElement('div');d.id='lvbd';document.body.appendChild(d)}
  var P=(L.board||[]).slice().sort(function(a,b){return b.r-a.r||b.pnl-a.pnl});
  d.innerHTML='<div class="lv-bt">Live</div>'+P.map(function(p,i){return'<div class="lv-br'+(p.player===me()?' me':'')+'"><span class="rk">'+(i+1)+'</span><b>'+esc(p.player)+'</b>'+(p.open?'<i title="trade open"></i>':'')+'<span class="hsp"></span><span class="'+cls(p.r)+'">'+fmtR(p.r)+'</span></div>'}).join('')}
function cleanup(){if(!L)return;clearInterval(L.iv);cancelAnimationFrame(L.raf);if(L.cf0)lsSet('mnqr-cfmode',L.cf0);var cf=$('ocf');if(cf)cf.remove();var id=S&&S.match===L.code?S.id:null;L=null;
  document.body.classList.remove('matchon','liveon');LG.lockTicket(false);['mbar','lvbd'].forEach(function(i){var e=$(i);if(e)e.remove()});
  if(RK0&&G.setRisk){G.setRisk(RK0.u,RK0.v);RK0=null}if(id)LG.dropSession(id);S=null}
function end(why){if(!L)return;clearInterval(L.iv);cancelAnimationFrame(L.raf);
  S.orders=[];S.positions.slice().forEach(function(p){closePos(p,mktExit(p.side),nowT(),'Session end')});changed();
  var t=stats(),code=L.code,day=L.l.day,res={code:code,player:me(),total_r:Math.max(-60,Math.min(300,t.r)),pnl:t.pnl,trades:t.trades,wins:t.wins,days:[{d:day,r:t.r,pnl:t.pnl,n:t.trades}]};
  lsSet('mnqr-lv-'+code,{pnl:t.pnl,trades:t.trades,wins:t.wins,log:tlog()});lsSet('mnqr-lv-res-'+code,res);lsSet('mnqr-lv-room',null);
  send(true).then(function(){return LG.DB.submit(res)}).then(function(){lsSet('mnqr-lv-res-'+code,null)},function(e){if(e&&e.status===409)lsSet('mnqr-lv-res-'+code,null)});
  cleanup();G.showHome();results(code,day,t,why)}
function results(code,day,t,why){var md=win('<div class="dhead"><b>Live challenge · results</b><span class="lg-code">'+code+'</span><span class="hsp"></span><button class="hb" data-lx="1">'+ico('x')+'</button></div>'+
    '<div class="lg-meta">That was <b>'+dayLabel(day)+'</b>'+(why==='left'?' · you left early':'')+'</div>'+
    '<div class="lv-you"><b class="mr-r '+(t.r>0?'pos':t.r<0?'neg':'')+'">'+fmtR(t.r)+'</b><span class="mr-p">'+money(t.pnl,1)+' · '+t.trades+' trades</span></div>'+
    '<div class="lg-l">Standings <small class="dim">· updates until everyone is done</small></div><div class="lv-fin"></div>'+
    '<div class="lg-act"><button class="hbig" data-lr2="review">'+ico('play')+'Review the day</button><button class="hsec" data-lr2="league">Open in the league</button></div>'+
    '<div class="lg-l">Chat</div><div class="lv-log"></div>'+rxHtml());
  evStart(code);evLog();
  md.addEventListener('click',function(e){var b=e.target.closest('[data-lr2]');if(!b)return;if(b.dataset.lr2==='review'){closeW();review(code)}else{closeW();G.openMatch(code)}});
  var n=0;function f(){getRoom(code).then(function(R){if(!R||!W||W.md!==md)return;var P=R.p.slice().sort(function(a,b){return b.r-a.r||b.pnl-a.pnl});
    md.querySelector('.lv-fin').innerHTML='<table class="lg-t"><tr><th></th><th>Player</th><th>R</th><th>Profit</th><th>Trades</th><th></th></tr>'+P.map(function(p,i){return'<tr class="'+(p.player===me()?'me':'')+'"><td class="rk">'+(i===0?'<span class="cr">1</span>':(i+1))+'</td><td class="pl">'+esc(p.player)+'</td><td class="'+cls(p.r)+' tr">'+fmtR(p.r)+'</td><td class="'+cls(p.pnl)+'">'+money(p.pnl,1)+'</td><td>'+p.trades+'</td><td class="dim">'+(p.done?'done':'playing')+'</td></tr>'}).join('')+'</table>';
    if(P.every(function(p){return p.done})||++n>120){clearInterval(W.iv)}},function(){})}
  f();W.iv=setInterval(f,3000);if(LG.renderLeague)setTimeout(LG.renderLeague,1500)}
function leaveLive(){if(!L)return;uiConfirm('Leave the live challenge? Open trades are closed now and your result so far counts.','Leave').then(function(ok){if(ok&&L)end('left')})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-lb]');if(!b||!L)return;if(b.dataset.lb==='pause'){togglePause();return}if(b.dataset.lb==='react'){rxPop();return}leaveLive()});
function togglePause(){if(!L||sNow()<L.start)return;if(!L.man&&L.budget<=0){toast('No pause time left');return}L.man=!L.man;L.bh=''}
// the risk field in the order panel stays at 1 %
document.addEventListener('focusin',function(e){if(L&&e.target&&e.target.id==='cfR')e.target.readOnly=true});


/* ---------- reactions: emoji, quick messages, chat, trade notices ---------- */
var EMO=['🔥','🚀','😂','👏','😬','💀','🤡','👀'],QM=['Nice trade!','Let’s go','GG','Stop hunted 😩','Patience …','Who’s long?'];
var EV={code:null,last:0,iv:0,busy:false,first:true,hist:[],sent:0};
function rxHtml(){return'<div class="lv-rx"><div class="lv-em">'+EMO.map(function(e){return'<button data-rx="'+e+'">'+e+'</button>'}).join('')+'</div>'+
  '<div class="lv-qm">'+QM.map(function(m){return'<button data-rq="'+esc(m)+'">'+esc(m)+'</button>'}).join('')+'</div>'+
  '<form class="lv-in"><input maxlength="60" placeholder="Say something …" autocomplete="off"><button class="hsec">Send</button></form></div>'}
function evStart(code){if(EV.code===code&&EV.iv)return;evStop();EV.code=code;EV.last=0;EV.first=true;EV.hist=[];evPoll();EV.iv=setInterval(evPoll,2000)}
function evStop(){clearInterval(EV.iv);EV.iv=0;EV.code=null;var p=$('lvrx');if(p)p.remove()}
function evPoll(){if(!EV.code||EV.busy)return;EV.busy=true;var code=EV.code;
  api('lobby_events?code=eq.'+code+'&id=gt.'+EV.last+'&order=id.asc&limit=60').then(function(A){EV.busy=false;if(EV.code!==code)return;
    A.forEach(function(e){EV.last=Math.max(EV.last,e.id);EV.hist.push(e);if(!EV.first&&e.player!==me())bubble(e)});
    EV.first=false;if(EV.hist.length>40)EV.hist=EV.hist.slice(-40);if(A.length)evLog()},function(){EV.busy=false})}
function evText(e){var n='<b>'+esc(e.player)+'</b>';
  return e.kind==='emoji'?n+' <span class="lv-big">'+esc(e.body)+'</span>':e.kind==='msg'?n+': '+esc(e.body):e.kind==='open'?n+' opened a trade':e.kind==='close'?n+' closed a trade · <span class="'+(/^-|^−/.test(e.body||'')?'neg':'pos')+'">'+esc(e.body)+'</span>':n+' joined the room'}
function evLog(){document.querySelectorAll('.lv-log').forEach(function(box){var H=EV.hist.slice(-14);
  box.innerHTML=H.length?H.map(function(e){return'<div class="lv-le'+(e.player===me()?' me':'')+'">'+evText(e)+'</div>'}).join(''):'<p class="dim">No messages yet. Say hi 👋</p>';box.scrollTop=1e6})}
function bubble(e){if(e.player===me()&&e.kind!=='emoji'&&e.kind!=='msg')return;var f=$('lvfeed');if(!f){f=document.createElement('div');f.id='lvfeed';document.body.appendChild(f)}
  var b=document.createElement('div');b.className='lv-bub k-'+e.kind;b.innerHTML=evText(e);f.appendChild(b);while(f.children.length>5)f.firstChild.remove();
  setTimeout(function(){b.classList.add('out');setTimeout(function(){b.remove()},500)},e.kind==='emoji'?4000:6500)}
function evSend(kind,body){if(!EV.code&&!(L&&L.code))return;var code=EV.code||L.code,now=Date.now();
  if((kind==='emoji'||kind==='msg')){if(now-EV.sent<1200){toast('Slow down a little');return}EV.sent=now;bubble({player:me(),kind:kind,body:body})}
  api('lobby_events',{method:'POST',body:{code:code,player:me(),kind:kind,body:body||null},prefer:'return=minimal'}).catch(function(){})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-rx],[data-rq]');if(!b||!EV.code)return;e.preventDefault();
  if(b.dataset.rx)evSend('emoji',b.dataset.rx);else evSend('msg',b.dataset.rq);var p=$('lvrx');if(p&&p.contains(b))p.remove()});
document.addEventListener('submit',function(e){var f=e.target.closest&&e.target.closest('.lv-in');if(!f)return;e.preventDefault();var i=f.querySelector('input'),v=(i.value||'').trim().slice(0,60);if(!v)return;i.value='';evSend('msg',v);var p=$('lvrx');if(p&&p.contains(f))p.remove()});
function rxPop(){var p=$('lvrx');if(p){p.remove();return}p=document.createElement('div');p.id='lvrx';p.innerHTML=rxHtml();document.body.appendChild(p);
  var i=p.querySelector('input');setTimeout(function(){document.addEventListener('mousedown',function off(e){if(!p.contains(e.target)&&!e.target.closest('[data-lb=react]')){p.remove();document.removeEventListener('mousedown',off)}})},0)}

/* ---------- review after the game: everyone's trades on the chart ---------- */
var RV=null,COL=['#7E8CFF','#E4B24C','#2FCB8C','#F2576B','#4CC3E4','#C77DFF','#FF9F5A','#D7DBE3'];
function review(code){getRoom(code).then(function(R){if(!R){toast('Room not found');return}var l=R.l,a=l.day.split('-'),st=wallToUtc(+a[0],+a[1],+a[2],9,0,NY),en=wallToUtc(+a[0],+a[1],+a[2],16,0,NY);
  var P=R.p.slice().sort(function(x,y){return y.r-x.r||y.pnl-x.pnl}).map(function(p,i){return{n:p.player,c:COL[i%COL.length],r:p.r,pnl:p.pnl,log:p.log||[],on:true}});
  LG.useMNQ().then(function(){return loadFor(st)}).then(function(){
    return G.openSession({id:'mt-R'+code+'-'+Date.now().toString(36),name:'Review '+code,start:st,curT:st-1,src:'1m',bal0:BAL,pv:2,sym:'nq',comm:0.5,spread:0.25,slip:0,daily:null,maxdd:null,positions:[],orders:[],trades:[],drawings:[],tf:'1m',review:code})}).then(function(){
    if(!S||S.review!==code){toast('No data for this day · update the app');return}if(G.hideHome)G.hideHome();
    RV={code:code,day:l.day,P:P};document.body.classList.add('rvon');jumpTo(en);$('oSL').value='';$('oTP').value='';ui();rvPanel();updMarkers(true);
    setTimeout(function(){try{chart.timeScale().setVisibleRange({from:ctOf(keyOf(st,TF),TF)-15*60,to:ctOf(keyOf(en,TF),TF)})}catch(x){}},150)})})}
function rvMarkers(){if(!CT.length){cs.setMarkers([]);return}var t0=CT[0],tl=CT[CT.length-1],M=[];function ct(t){return Math.min(tl,ctOf(keyOf(t,TF),TF))}
  RV.P.forEach(function(p){if(!p.on)return;p.log.forEach(function(t){var a=ct(t.et),b=ct(t.xt-1),lg=t.s>0;
    if(a>=t0)M.push({time:a,position:lg?'belowBar':'aboveBar',color:p.c,shape:lg?'arrowUp':'arrowDown',text:p.n+(lg?' L':' S')});
    if(b>=t0)M.push({time:b,position:lg?'aboveBar':'belowBar',color:p.c,shape:'circle',text:fmtR(t.r)})})});
  M.sort(function(x,y){return x.time-y.time});cs.setMarkers(M)}
var _um=G.updMarkers;G.updMarkers=function(){if(RV&&S&&S.review===RV.code){try{rvMarkers()}catch(e){}return}return _um.apply(this,arguments)};
function hm(t){var d=new Date((t+off(t,NY))*1000);return p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())}
function rvPanel(){var d=$('rvp');if(!d){d=document.createElement('div');d.id='rvp';document.body.appendChild(d)}
  d.innerHTML='<div class="rv-h"><div><span class="heye">Review</span><b>'+dayLabel(RV.day)+'</b></div><button class="mb-b ghost" data-rv="close">Close</button></div>'+
    '<p class="dim rv-t">Everyone’s trades are on the chart. Click a trade to jump to it, click a name to hide it.</p>'+
    RV.P.map(function(p,i){return'<div class="rv-p'+(p.on?'':' off')+'"><button class="rv-n" data-rvp="'+i+'"><i style="background:'+p.c+'"></i><b>'+esc(p.n)+'</b><span class="hsp"></span><span class="'+cls(p.r)+'">'+fmtR(p.r)+'</span></button>'+
      (p.log.length?p.log.map(function(t){return'<button class="rv-tr" data-rvt="'+t.et+'"><span>'+hm(t.et)+'</span><span class="'+(t.s>0?'pos':'neg')+'">'+(t.s>0?'Long':'Short')+' '+t.q+'</span><span>'+fp(t.ep)+' → '+fp(t.xp)+'</span><span class="'+cls(t.r)+'">'+fmtR(t.r)+'</span></button>'}).join(''):'<div class="dim rv-none">No trades</div>')+'</div>'}).join('')}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#rvp [data-rv],#rvp [data-rvp],#rvp [data-rvt]');if(!b||!RV)return;
  if(b.dataset.rv){rvClose();return}
  if(b.dataset.rvp!=null){var p=RV.P[+b.dataset.rvp];p.on=!p.on;rvPanel();updMarkers(true);return}
  var t=ctOf(keyOf(+b.dataset.rvt,TF),TF);try{chart.timeScale().setVisibleRange({from:t-45*60,to:t+75*60})}catch(x){}});
function rvClose(fromHome){if(!RV)return;RV=null;document.body.classList.remove('rvon');var d=$('rvp');if(d)d.remove();var id=S&&S.review?S.id:null;if(id)LG.dropSession(id);if(!fromHome){S=null;G.showHome()}}

/* ---------- fair play: no pause, no stepping, no rewinding, stop loss required ---------- */
G.addEventListener('keydown',function(e){if(!L)return;var k=e.key;if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(k===' '||k==='ArrowRight'||k==='ArrowLeft'||k==='x'||k==='X'){e.preventDefault();e.stopImmediatePropagation()}
  if(k==='p'||k==='P'){e.preventDefault();e.stopImmediatePropagation();togglePause()}},true);
['play','stepCandle','jumpTo','rewindTo'].forEach(function(f){var o=G[f];if(typeof o!=='function')return;G[f]=function(){if(L)return;return o.apply(this,arguments)}});
var _ct=G.canTrade;G.canTrade=function(q){if(L&&sNow()<L.start){toast('Preparation · trading opens when the chart starts');return false}if(L&&S&&S.match===L.code&&!(num($('oSL').value)>0)){toast('Set a stop loss first · it decides your R');return false}return _ct.apply(this,arguments)};
var _home=G.showHome;G.showHome=function(){if(L){leaveLive();return}if(RV)rvClose(true);return _home.apply(this,arguments)};
var _ct2=G.canTrade;G.canTrade=function(){if(RV&&S&&S.review){toast('This is a review · trading is off');return false}return _ct2.apply(this,arguments)};

/* ---------- entry points ---------- */
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-hdaily]');if(!b)return;e.preventDefault();e.stopPropagation();openDaily()},true);
function retry(){Object.keys(localStorage).forEach(function(k){if(k.indexOf('mnqr-lv-res-')!==0)return;var r=lsGet(k,null);if(!r)return;
  LG.DB.submit(r).then(function(){lsSet(k,null)},function(e){if(e&&e.status===409)lsSet(k,null)})})}
if(LG.online)setTimeout(function(){retry();
  var q=/[?&]l=([A-Z2-9]{6})/i.exec(location.search);if(q){joinRoom(q[1].toUpperCase());return}
  // the app was closed during a live game: offer to jump back in while it is still running
  var c=lsGet('mnqr-lv-room',null);if(c)getRoom(c).then(function(R){var st=R&&R.l.start_at?Date.parse(R.l.start_at):0;if(st&&sNow()<st+PREP+GAME_MS)joinRoom(c);else lsSet('mnqr-lv-room',null)},function(){})},1000);
G.reviewLive=review;G.__smoothBar=smooth;G.__LV={RV:function(){return RV},EV:EV,L:function(){return L},sNow:sNow,openDaily:openDaily,joinRoom:joinRoom,end:end,GAME_MS:GAME_MS,setGame:function(ms,pr){GAME_MS=ms;STEP=GAME_MS/(DAY_END-H0);if(pr!=null)PREP=pr}};
})();

/* MNQ Replay v2 — start page: intro animation, live chart in the background, practice dashboard, sessions. */
(function(){
'use strict';
var G=window;
var MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
var DAYN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function dkey(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}

/* ---------- practice log: which real days Lan practised (for the streak and calendar) ---------- */
function plog(){return lsGet('mnqr-practice',{})}
function pmark(n){var L=plog(),k=dkey(new Date());L[k]=(L[k]||0)+(n||1);lsSet('mnqr-practice',L)}
var _tr=G.tradeRec;G.tradeRec=function(){var r=_tr.apply(this,arguments);r.rt=Date.now();pmark(1);return r};
(function seed(){if(lsGet('mnqr-practice-seeded',false))return;var L=plog();sessData().forEach(function(x){if(x.m.upd&&x.s.trades.length){var k=dkey(new Date(x.m.upd));L[k]=(L[k]||0)+x.s.trades.length}});lsSet('mnqr-practice',L);lsSet('mnqr-practice-seeded',true)})();
function streak(){var L=plog(),d=new Date(),n=0;if(!L[dkey(d)])d.setDate(d.getDate()-1);while(L[dkey(d)]){n++;d.setDate(d.getDate()-1)}return n}

/* ---------- daily challenge: the same random weekday for the whole day ---------- */
function dailyPick(){var x=MNQ.idx&&MNQ.idx['1m'];if(!x)return null;var seed=+dkey(new Date()).replace(/-/g,''),r=function(){seed=(seed*16807)%2147483647;return seed/2147483647};
  for(var i=0;i<60;i++){var t=x.from+5*86400+r()*(x.to-x.from-8*86400),d=new Date((t+off(t,NY))*1000),w=d.getUTCDay();if(w>0&&w<6)return{y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate(),w:w}}return null}
function startDay(y,m,d,hh,mm,name,tries){var start=wallToUtc(y,m,d,hh,mm,NY),src=pickSrc(start);if(!src){toast('No data for that day');return}
  loadFor(start).then(function(){var B=bars(src),k=lowerBound(B,start);if(k>=B.length||B[k][0]>start+3*3600){toast('That day was a holiday, pick another');return}
    var s={id:uid(),name:name,start:start,curT:start-1,src:src,bal0:50000,pv:lsGet('mnqr-sym','nq')==='es'?5:2,comm:0.5,spread:0.25,slip:0,daily:null,maxdd:null,positions:[],orders:[],trades:[],drawings:[],tf:null};
    openSession(s).then(function(){if(S)hideHome()})})}
G.startDay=startDay;

/* ---------- live chart in the background ---------- */
var BG={raf:0,c:null,bars:null,off:0,last:0};
function bgBars(){var d=MNQ.data&&MNQ.data['1h'],out=[];if(d){Object.keys(d).forEach(function(k){out=out.concat(d[k])})}
  if(out.length>400){out.sort(function(a,b){return a[0]-b[0]});var i=Math.floor(Math.random()*(out.length-400));return out.slice(i,i+400)}
  var p=20000,r=[];for(var j=0;j<400;j++){var o=p,c=o+(Math.random()-.49)*60;r.push([j,o,Math.max(o,c)+Math.random()*25,Math.min(o,c)-Math.random()*25,c]);p=c}return r}
function bgStart(){var cv=document.getElementById('hbg');if(!cv)return;BG.c=cv;if(!BG.bars)BG.bars=bgBars();cancelAnimationFrame(BG.raf);BG.last=performance.now();
  (function tick(now){var dt=Math.min(64,now-BG.last);BG.last=now;BG.off+=dt*0.006;bgDraw();BG.raf=requestAnimationFrame(tick)})(BG.last)}
function bgStop(){cancelAnimationFrame(BG.raf)}
function bgDraw(){var cv=BG.c,dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;if(!W)return;if(cv.width!==W*dpr){cv.width=W*dpr;cv.height=H*dpr}
  var g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);var B=BG.bars,cw=11,n=Math.ceil(W/cw)+2,start=Math.floor(BG.off)%(B.length-n),frac=BG.off%1;
  var vis=B.slice(start,start+n),lo=Infinity,hi=-Infinity;vis.forEach(function(b){lo=Math.min(lo,b[3]);hi=Math.max(hi,b[2])});var pad=(hi-lo)*.12;lo-=pad;hi+=pad;
  var top=H*.30,bot=H*.98,Y=function(v){return bot-(v-lo)/(hi-lo)*(bot-top)};
  vis.forEach(function(b,i){var x=(i-frac)*cw,up=b[4]>=b[1];g.strokeStyle=g.fillStyle=up?'rgba(47,203,140,.55)':'rgba(242,87,107,.55)';g.lineWidth=1;
    g.beginPath();g.moveTo(x+cw/2,Y(b[2]));g.lineTo(x+cw/2,Y(b[3]));g.stroke();var y1=Y(Math.max(b[1],b[4])),y2=Y(Math.min(b[1],b[4]));g.fillRect(x+2,y1,cw-4,Math.max(1,y2-y1))});
  // a soft "price" line following the closes
  g.beginPath();vis.forEach(function(b,i){var x=(i-frac)*cw+cw/2,y=Y(b[4]);if(i)g.lineTo(x,y);else g.moveTo(x,y)});g.strokeStyle='rgba(126,140,255,.55)';g.lineWidth=1.5;g.stroke()}

/* ---------- count-up numbers ---------- */
function countUp(root){root.querySelectorAll('[data-cu]').forEach(function(el){var to=+el.dataset.cu,dec=+(el.dataset.dec||0),pre=el.dataset.pre||'',suf=el.dataset.suf||'',t0=performance.now(),D=900;
  (function f(now){var k=Math.min(1,(now-t0)/D),e=1-Math.pow(1-k,3),v=to*e;el.textContent=pre+(dec?v.toFixed(dec):Math.round(v).toLocaleString('en-US'))+suf;if(k<1)requestAnimationFrame(f)})(t0)})}
function moneyCU(v,cls2){return'<b class="'+(cls2||cls(v))+'" data-cu="'+Math.abs(v).toFixed(2)+'" data-dec="2" data-pre="'+(v<0?'−$':v>0?'+$':'$')+'">'+money(v,1)+'</b>'}

/* ---------- calendar heatmap (last 18 weeks) ---------- */
function heatHtml(){var L=plog(),end=new Date(),cells='',wk=18,start=new Date(end);start.setDate(start.getDate()-(wk*7-1)-((end.getDay()+6)%7)+((end.getDay()+6)%7));
  var first=new Date(end);first.setDate(first.getDate()-((end.getDay()+6)%7)-(wk-1)*7);
  for(var w=0;w<wk;w++){cells+='<div class="hcol">';for(var d=0;d<7;d++){var x=new Date(first);x.setDate(first.getDate()+w*7+d);var k=dkey(x),n=L[k]||0,fut=x>end;
    cells+='<i class="'+(fut?'fut':n>=8?'l4':n>=4?'l3':n>=2?'l2':n?'l1':'')+'" title="'+x.getDate()+'. '+(x.getMonth()+1)+'. · '+(n?n+' trades':'no practice')+'"></i>'}cells+='</div>'}
  return'<div class="heat">'+cells+'</div>'}

/* ---------- weekly R progress ---------- */
function weekBars(D){var by={},now=new Date();D.forEach(function(x){x.s.trades.forEach(function(t){var ts=t.rt||x.m.upd;if(!ts||t.r==null)return;var d=new Date(ts),mon=new Date(d);mon.setDate(d.getDate()-((d.getDay()+6)%7));var k=dkey(mon);(by[k]=by[k]||[]).push(t)})});
  var weeks=[];for(var i=9;i>=0;i--){var m=new Date(now);m.setDate(now.getDate()-((now.getDay()+6)%7)-i*7);var k=dkey(m),a=by[k]||[];weeks.push({k:k,n:a.length,r:a.reduce(function(s,t){return s+t.r},0),wr:a.length?Math.round(a.filter(function(t){return t.pnl>0}).length/a.length*100):null,d:m})}
  var mx=Math.max(1,Math.max.apply(null,weeks.map(function(w){return Math.abs(w.r)})));
  return'<div class="wbars">'+weeks.map(function(w){var h=Math.round(Math.abs(w.r)/mx*100);return'<div class="wb" title="Week of '+w.d.getDate()+'. '+(w.d.getMonth()+1)+'. · '+w.n+' trades · '+(w.r>=0?'+':'')+w.r.toFixed(1)+'R'+(w.wr!=null?' · win '+w.wr+' %':'')+'"><span class="'+(w.r>=0?'up':'dn')+'" style="height:'+Math.max(w.n?4:0,h)+'%"></span></div>'}).join('')+'</div>'+
    '<div class="wlbl"><span>10 weeks ago</span><span>this week</span></div>'}

/* ---------- the page ---------- */
G.renderHome=function(){var D=sessData(),last=lsGet('mnqr-last',null),L=D.filter(function(x){return x.m.id===last})[0]||D[0],A=allStats(D),idx=MNQ.idx||{},now=new Date(),h='';
  var st=streak(),dp=dailyPick(),i1=idx['1m'];
  h+='<canvas id="hbg"></canvas><div class="hfade"></div><div class="hwrap2">';
  h+='<div class="hnav"><div class="hbrand"><i>'+ico('logo')+'</i><div><b>MNQ Replay</b><span>Backtest trainer · Micro Nasdaq</span></div></div><div class="hsp"></div>'+
    (i1?'<span class="hpill"><i></i>Data to '+dshort(i1.to)+'</span>':'')+
    '<label class="hbtn" title="Import backup">'+ico('ul')+'<input type="file" id="hImp" accept=".json" hidden></label><button class="hbtn" id="hExp" title="Export everything (backup)">'+ico('dl')+'</button><button class="hbtn" id="hSettings" title="Settings">'+ico('gear')+'</button></div>';
  // hero
  h+='<div class="hhero"><div class="hh1"><span class="heye">'+DAYN[now.getDay()]+', '+now.getDate()+'. '+MON[now.getMonth()]+'</span><h1>'+greet()+(G.pName&&G.pName()?', '+esc(G.pName()):'')+'.</h1><p>Every replay day is one more day of experience. Consistency beats the perfect setup.</p>'+
    '<div class="hact">'+(L?'<button class="hbig" data-hopen="'+L.s.id+'">'+ico('play')+'Continue session</button>':'<button class="hbig" data-hq="random">'+ico('dice')+'Start a random day</button>')+
    '<button class="hsec" data-hq="random">'+ico('dice')+'Random day</button><button class="hsec" data-hq="date">'+ico('cal')+'Pick a date</button><button class="hsec" data-hq="ch">'+ico('target')+'Prop challenge</button></div></div>';
  if(L){var s=L.s,pnl=s.trades.reduce(function(a,t){return a+t.pnl},0),wr=winRate(s.trades),chs=s.ch?s.ch.status:null;
    h+='<div class="hlast" data-hopen="'+s.id+'"><div class="hlt"><span class="heye">Continue where you left off</span>'+(chs?'<span class="chb '+(chs==='passed'?'ok':chs==='failed'?'bad':'')+'">'+(chs==='passed'?'PASSED':chs==='failed'?'FAILED':'CHALLENGE')+'</span>':'')+'</div>'+
      '<b class="hln">'+esc(cleanName(s.name))+'</b><span class="hld">'+fmtWall(s.curT+(SRC_STEP[s.src]||60),NY,true)+' NY</span>'+
      '<div class="hlspark">'+spark(s.trades,s.bal0,360,80)+'</div><div class="hlst"><div><small>Trades</small><b>'+s.trades.length+'</b></div><div><small>Win rate</small><b>'+(wr!=null?wr+' %':'–')+'</b></div><div><small>P&amp;L</small>'+moneyCU(pnl)+'</div></div></div>'}
  else h+='<div class="hlast empty"><span class="heye">First step</span><b class="hln">Start your first replay day</b><span class="hld">Pick a random day, trade it like live and check your stats at the end.</span></div>';
  h+='</div>';
  // dashboard
  h+='<div class="hdash"><div class="hcard2"><div class="hct2"><span class="heye">Practice streak</span><span class="hstreak"><b>'+st+'</b> '+(st===1?'day':st===2?'days':st<5&&st>0?'days':'days')+' in a row</span></div>'+heatHtml()+'<div class="hleg"><span>Less</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>More</span></div></div>'+
    '<div class="hcard2"><div class="hct2"><span class="heye">Weekly progress</span><span class="hmini">sum of R</span></div>'+weekBars(D)+'</div>'+
    '<div class="hcard2 hdaily"><div class="hct2"><span class="heye">Daily challenge</span><span class="hmini">same day for everyone today</span></div>'+
      (dp?'<b class="hdd">'+DAYN[dp.w]+', '+dp.d+'. '+dp.m+'. '+dp.y+'</b><span class="hld">Starts 9:00 NY, half an hour before the open. Trade only your A setup and see what you make of this day.</span><button class="hsec acc" data-hdaily="1">'+ico('play')+'Accept challenge</button>':'<span class="hld">Data is still loading.</span>')+'</div></div>';
  // stats
  if(A){var tiles=[['Trades','<b data-cu="'+A.n+'">'+A.n+'</b>'],['Win rate','<b data-cu="'+A.wr+'" data-suf=" %">'+A.wr+' %</b>'],['Net P&amp;L',moneyCU(A.net)],['Profit factor','<b>'+(A.pf!=null?A.pf.toFixed(2):'∞')+'</b>'],['Avg. R','<b class="'+cls(A.ar||0)+'">'+(A.ar!=null?A.ar.toFixed(2)+'R':'–')+'</b>'],
      ['Best hour','<b>'+(A.bh&&A.bh.v>0?p2(A.bh.k)+':00':'–')+'</b>'+(A.bh&&A.bh.v>0?'<small class="pos">'+money(A.bh.v,1)+'</small>':'')],['Worst hour','<b>'+(A.worstH&&A.worstH.v<0?p2(A.worstH.k)+':00':'–')+'</b>'+(A.worstH&&A.worstH.v<0?'<small class="neg">'+money(A.worstH.v,1)+'</small>':'')],['Best day','<b>'+(A.bd&&A.bd.v>0?WD[A.bd.k]:'–')+'</b>']];
    h+='<div class="hsec2"><h2>Your stats <small>all sessions together</small></h2></div><div class="hstats2">'+tiles.map(function(x){return'<div><small>'+x[0]+'</small>'+x[1]+'</div>'}).join('')+'</div>'}
  // sessions
  h+='<div class="hsec2"><h2>Sessions <small>'+D.length+'</small></h2>'+(D.length?'<div class="hfilt" id="hFilt"><button data-f="all" class="on">All</button><button data-f="ch">Challenge</button><button data-f="free">Free practice</button></div>':'')+'</div>';
  h+=D.length?'<div class="hsess2">'+D.map(function(x,i){var s=x.s,pnl=s.trades.reduce(function(a,t){return a+t.pnl},0),wr=winRate(s.trades),chs=s.ch?s.ch.status:null,lt=s.trades.slice().reverse().filter(function(t){return t.img})[0];
      return'<div class="hsc" data-kind="'+(s.ch?'ch':'free')+'" style="animation-delay:'+(i*40)+'ms"><div class="hth" data-sid="'+s.id+'" data-tid="'+(lt?lt.id:'')+'">'+spark(s.trades,s.bal0,300,90)+'</div>'+
        '<div class="hsb"><div class="hsn"><b>'+esc(cleanName(s.name))+'</b>'+(chs?'<span class="chb '+(chs==='passed'?'ok':chs==='failed'?'bad':'')+'">'+(chs==='passed'?'PASSED':chs==='failed'?'FAILED':'CHALLENGE')+'</span>':'')+'</div>'+
        '<span class="hsd">'+fmtWall(s.curT+(SRC_STEP[s.src]||60),NY,true)+' NY · '+s.src+(s.pv===20?' · NQ':'')+'</span>'+
        '<div class="hss"><span>'+s.trades.length+' trades</span><span>'+(wr!=null?wr+' % win':'–')+'</span><b class="'+cls(pnl)+'">'+money(pnl,1)+'</b></div>'+
        '<div class="hsa"><button class="hsec acc" data-hopen="'+s.id+'">'+ico('play')+'Continue</button><button class="hbtn" data-hdel="'+s.id+'" title="Delete session">'+ico('trash')+'</button></div></div></div>'}).join('')+'</div>'
    :'<div class="hempty2">'+ico('chart')+'<b>No sessions yet</b><span>Click Random day above to start.</span></div>';
  var lb=lsGet('mnqr-lastbackup',0),ago=lb?Math.floor((Date.now()-lb)/86400000):null;
  h+='<div class="hfoot">'+(i1?'<span>1m candles from <b>'+dshort(i1.from)+'</b> to <b>'+dshort(i1.to)+'</b>'+(i1.realFrom?' · real MNQ from '+dshort(i1.realFrom)+', before that Nasdaq-100 shifted to MNQ':'')+' · updated '+new Date(idx.updated*1000).toLocaleString('en-US',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})+'</span>':'')+
    '<span class="'+(D.length&&(!lb||ago>=7)?'hwarn':'')+'">'+(lb?'Last backup '+(ago===0?'less than a day':ago+' days'):'You haven’t made a backup yet')+' · <button class="hlink" id="hExp2">Export now</button></span></div>';
  h+='</div>';
  $('home').innerHTML=h;countUp($('home'));bgStart();
  // thumbnails: the last trade's chart picture, if there is one
  $('home').querySelectorAll('.hth[data-tid]').forEach(function(el){var tid=el.dataset.tid;if(!tid)return;imgGet(el.dataset.sid+':'+tid).then(function(u){if(u){el.style.backgroundImage='url('+u+')';el.classList.add('img')}}).catch(function(){})})};
var _hide=G.hideHome;G.hideHome=function(){bgStop();_hide.apply(this,arguments)};
$('home').addEventListener('click',function(e){
  if(e.target.closest('#hExp2')){exportAll();return}
  var f=e.target.closest('[data-f]');if(f){$('hFilt').querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b===f)});$('home').querySelectorAll('.hsc').forEach(function(c){c.style.display=f.dataset.f==='all'||c.dataset.kind===f.dataset.f?'':'none'});return}
  if(e.target.closest('[data-hdaily]')){var p=dailyPick();if(p)startDay(p.y,p.m,p.d,9,0,'Daily challenge · '+p.d+'. '+p.m+'. '+p.y)}});

/* ---------- intro animation (once per app start) ---------- */
(function intro(){var el=document.createElement('div');el.id='intro2';var n=window.innerWidth<700?16:26,p=50,c='';
  for(var i=0;i<n;i++){var o=p,cl=Math.max(8,Math.min(92,p+(Math.random()*18-7.5))),hi=Math.max(o,cl)+2+Math.random()*7,lo=Math.min(o,cl)-2-Math.random()*7;p=cl;
    c+='<div class="ic2'+(cl<o?' dn':'')+'" style="--i:'+i+'"><span class="w" style="bottom:'+lo.toFixed(1)+'%;height:'+(hi-lo).toFixed(1)+'%"></span><span class="b" style="bottom:'+Math.min(o,cl).toFixed(1)+'%;height:'+Math.max(1.2,Math.abs(cl-o)).toFixed(1)+'%"></span></div>'}
  el.innerHTML='<div class="i2c">'+c+'</div><div class="i2t"><i>'+ico('logo')+'</i><b>MNQ Replay</b><span>'+greet()+(G.pName&&G.pName()?', '+esc(G.pName()):'')+'</span></div>';
  document.body.appendChild(el);var gone=false;function hide(){if(gone)return;gone=true;el.classList.add('out');setTimeout(function(){el.remove()},650)}
  el.addEventListener('click',hide);document.addEventListener('keydown',hide,{once:true});setTimeout(hide,2300)})();

if(!$('home').classList.contains('hide'))renderHome();
})();

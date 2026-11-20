/* MNQ Replay v2 — news on the chart (BLS + FOMC), blind mode, smooth intrabar price, multi-chart layouts. */
(function(){
'use strict';
var G=window;

/* =================== NEWS =================== */
var NEWS=[],NEWS_ON=lsGet('mnqr-news',true),NEWS_STOP=lsGet('mnqr-newsstop',true);
var NN={CPI:'Inflation (CPI)',NFP:'Jobs report (NFP)',FOMC:'Fed rate decision (FOMC)',PPI:'Producer prices (PPI)',JOLTS:'Job openings (JOLTS)',ECI:'Labor costs (ECI)'};
var NC={CPI:'#F2576B',NFP:'#F2576B',FOMC:'#F2576B',PPI:'#E4B24C',JOLTS:'#E4B24C',ECI:'#C9A44C'};
loadScript('data/news.js').then(function(){NEWS=(MNQ.news||[]).map(function(x){return{t:x[0],k:x[1]}});DV++},function(){});
function newsIn(a,b){return NEWS.filter(function(n){return n.t>=a&&n.t<=b})}
G.nextNews=function(t){for(var i=0;i<NEWS.length;i++)if(NEWS[i].t>t)return NEWS[i];return null};
function newsIco(){$('bNews').classList.toggle('on',NEWS_ON)}
$('bNews').addEventListener('click',function(e){if(e.shiftKey){NEWS_STOP=!NEWS_STOP;lsSet('mnqr-newsstop',NEWS_STOP);toast(NEWS_STOP?'Replay stops a minute before news':'No stopping before news');return}
  NEWS_ON=!NEWS_ON;lsSet('mnqr-news',NEWS_ON);newsIco();DV++;lastSig='';toast(NEWS_ON?'News on the chart on (Shift+click: stop before news '+(NEWS_STOP?'is on':'is off')+')':'News hidden')});
$('bNews').title='News on the chart: CPI, NFP, FOMC, PPI, JOLTS (Shift+click: stop the replay before news)';newsIco();
// stop the replay one minute before a news release
var _ca=G.checkAlarms;G.checkAlarms=function(b){var r=_ca(b);if(r||!NEWS_ON||!NEWS_STOP||!playing||!S)return r;var end=b[0]+SRC_STEP[S.src],n=newsIn(end,end+60)[0];
  S.newsSeen=S.newsSeen||{};if(n&&!S.newsSeen[n.t]){S.newsSeen[n.t]=1;stop();snd('fill');toast(NN[n.k]+' ob '+fmtWall(n.t,SET.tz).split(' ').pop()+' · replay paused');return true}return r};
// "jump to next news": 5 minutes before it
$('jump').addEventListener('change',function(){},true);
$('jump').addEventListener('change',function(e){if(this.value!=='news')return;e.stopImmediatePropagation();this.value='';if(!S)return;stop();var n=nextNews(nowT()+60);if(!n){toast('No more news in the data');return}jumpTo(n.t-300);toast('Next news: '+NN[n.k]+' · '+fmtWall(n.t,SET.tz,true))},true);
function drawNews(){if(!NEWS_ON||!NEWS.length||!S||!CT.length)return;var W=plotW(),H=paneH(),t0=KEYS[0],t1=KEYS[KEYS.length-1]+TF.s*60;
  newsIn(t0,t1).forEach(function(n){var x=tToX(TF.id==='1D'?keyOf(n.t,TF):n.t+off(n.t,SET.tz));if(x==null||x<0||x>W)return;var c=NC[n.k]||'#E4B24C',fut=n.t>nowT();ctx.save();ctx.strokeStyle=c;ctx.globalAlpha=fut?.55:.35;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(Math.round(x)+.5,18);ctx.lineTo(Math.round(x)+.5,H);ctx.stroke();
    ctx.globalAlpha=fut?1:.75;ctx.setLineDash([]);ctx.font='700 10px Geist,system-ui,sans-serif';var lb=n.k+' '+fmtWall(n.t,SET.tz).split(' ').pop(),w=ctx.measureText(lb).width+10;ctx.fillStyle=c;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-w/2,H-20,w,16,4);else ctx.rect(x-w/2,H-20,w,16);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(lb,x-w/2+5,H-8.5);ctx.restore()})}

/* =================== BLIND MODE =================== */
var _bars=G.bars,BC={};
G.bars=function(tf){var r=_bars(tf);if(!S||!S.blind)return r;var k=tf+'|'+S.blind.off+'|'+r.length+'|'+(r.length?r[0][0]:0);if(BC[tf]&&BC[tf].k===k)return BC[tf].v;
  var o=S.blind.off,v=r.map(function(b){return[b[0],b[1]+o,b[2]+o,b[3]+o,b[4]+o,b[5]]});BC[tf]={k:k,v:v};return v};
function shiftSession(d){var sh=function(x){return x==null?x:q4(x+d)},H=function(a){return a?a.map(function(h){return[h[0],h[1]==null?null:q4(h[1]+d)]}):a};
  S.positions.forEach(function(p){p.entry=sh(p.entry);p.sl=sh(p.sl);p.tp=sh(p.tp);p.sl0=sh(p.sl0);if(p.best!=null)p.best=sh(p.best);p.slH=H(p.slH);p.tpH=H(p.tpH);if(p.ord){p.ord.price=sh(p.ord.price);p.ord.sl=sh(p.ord.sl);p.ord.tp=sh(p.ord.tp)}});
  S.orders.forEach(function(o){o.price=sh(o.price);o.sl=sh(o.sl);o.tp=sh(o.tp)});
  S.trades.forEach(function(t){t.entry=sh(t.entry);t.exit=sh(t.exit);t.sl=sh(t.sl);t.tp=sh(t.tp);t.sl0=sh(t.sl0);t.slH=H(t.slH);t.tpH=H(t.tpH);if(t.ord){t.ord.price=sh(t.ord.price);t.ord.sl=sh(t.ord.sl);t.ord.tp=sh(t.ord.tp)}});
  S.drawings.forEach(function(dw){(dw.p||[]).forEach(function(pt){pt.p=pt.p+d});if(dw.sl!=null)dw.sl=sh(dw.sl);if(dw.tp!=null)dw.tp=sh(dw.tp)})}
function blindFmt(on){if(!chart)return;var tf=function(t){var d=new Date(t*1000);return on?(TF.id==='1D'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]:p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())):d.getUTCDate()+'. '+(d.getUTCMonth()+1)+'. '+String(d.getUTCFullYear()).slice(2)+(TF.id==='1D'?'':'  '+p2(d.getUTCHours())+':'+p2(d.getUTCMinutes()))};
  var tm=on?function(t){var d=new Date(t*1000);return p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())}:undefined;
  chart.applyOptions({localization:{timeFormatter:tf},timeScale:{tickMarkFormatter:on?function(t){var d=new Date(t*1000);return TF.id==='1D'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]:p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())}:undefined}});
  SEC.forEach(function(sc){sc.ch.c.applyOptions({localization:{timeFormatter:on?tm:function(t){var d=new Date(t*1000);return d.getUTCDate()+'. '+(d.getUTCMonth()+1)+'. '+p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())}},timeScale:{tickMarkFormatter:tm}})})}
function blindIco(){$('bBlind').classList.toggle('on',!!(S&&S.blind))}
function setBlind(on){if(!S)return;stop();if(on===!!S.blind)return;var real=null;
  if(on){var off=q4((Math.random()<.5?-1:1)*(800+Math.random()*3200));shiftSession(off);S.blind={off:off,start:S.curT}}
  else{var o=S.blind.off;shiftSession(-o);real=fmtWall(nowT(),SET.tz,true);delete S.blind}
  BC={};CACHE={};SRC=bars(S.src);cur=lowerBound(SRC,S.curT+1)-1;blindFmt(!!S.blind);fullRender(true);changed();blindIco();
  toast(on?'Blind mode: the date and real prices are hidden. Price movement is the same.':'Revealed: that was '+real+' (NY)')}
G.setBlind=setBlind;
$('bBlind').addEventListener('click',function(){if(!S)return;if(S.blind)uiConfirm('Reveal the date and real prices? This ends the blind session.','Reveal').then(function(ok){if(ok)setBlind(false)});else setBlind(true)});
var _open=G.openSession;G.openSession=function(s){BC={};return _open.apply(this,arguments).then(function(r){blindFmt(!!(S&&S.blind));blindIco();if(S&&S.blind){fullRender(false)}if(S)layoutApply();return r})};
// clock, legend and session name never show the date in blind mode
var _ui=G.ui;G.ui=function(){_ui.apply(this,arguments);if(!S||!S.blind)return;var day=Math.max(1,Math.round((tradeDay(nowT())-tradeDay(S.blind.start))+1)),w=fmtWall(nowT(),SET.tz);
  setH('clock','<span class="wd">Blind</span><b>Day '+day+'</b><b>'+w.split(' ').pop()+'</b><span class="tz">'+(SET.tz===NY?'NY':'CET')+'</span>');setT('sName','Blind session')};
var _leg=G.legend;G.legend=function(p){_leg.apply(this,arguments);if(S&&S.blind){var e=$('legend');e.innerHTML=e.innerHTML.replace(/<span[^>]*>NAS100→MNQ<\/span>/,'')}};

/* =================== SMOOTH INTRABAR PRICE =================== */
// In "v živo" mode the next 1m bar forms smoothly (open → low/high → close), then it is revealed and processed as usual.
var _tp=G.tickPlay,partKey=null;
var _stop=G.stop;G.stop=function(){var had=partKey!=null&&S;_stop.apply(this,arguments);if(had){partKey=null;try{fullRender(true)}catch(e){}}};
G.tickPlay=function(){_tp.apply(this,arguments);if(!playing||!S||!$('smooth').checked||cur>=SRC.length-1)return;var sp=+$('speed').value||1;if(sp>10)return;
  var nb=SRC[cur+1],f=Math.max(0,Math.min(.999,playAcc)),up=nb[4]>=nb[1],P=up?[nb[1],nb[3],nb[2],nb[4]]:[nb[1],nb[2],nb[3],nb[4]],seg=f*3,i=Math.min(2,Math.floor(seg)),fr=seg-i,px=P[i]+(P[i+1]-P[i])*fr;
  var hi=nb[1],lo=nb[1];for(var k=0;k<=i;k++){hi=Math.max(hi,P[k]);lo=Math.min(lo,P[k])}hi=Math.max(hi,px);lo=Math.min(lo,px);px=q4(px);
  var key=keyOf(nb[0],TF),cb=curBar&&curBar.key===key?{t:ctOf(key,TF),o:curBar.o,h:Math.max(curBar.h,hi),l:Math.min(curBar.l,lo)}:{t:ctOf(key,TF),o:nb[1],h:hi,l:lo};
  if(CT.length&&cb.t<CT[CT.length-1])return;try{cs.update({time:cb.t,open:cb.o,high:cb.h,low:cb.l,close:px});partKey=key}catch(e){}};

/* =================== MULTI-CHART LAYOUTS =================== */
var LAY=lsGet('mnqr-layout',{n:1,tfs:['15m','1h','4h']}),SEC=[];
var secBox=document.createElement('div');secBox.id='sec';$('chartwrap').appendChild(secBox);
// the chart height is cached (reading clientHeight every frame forced a full page layout); a ResizeObserver resets it
var PH=null;G.paneH=function(){if(PH==null)PH=$('chart').clientHeight-(chart.timeScale().height?chart.timeScale().height():28);return PH};
if(window.ResizeObserver)new ResizeObserver(function(){PH=null}).observe($('chart'));G.addEventListener('resize',function(){PH=null});
G.resizeOv=function(){var r=$('chart').getBoundingClientRect(),dpr=window.devicePixelRatio||1;ovW=r.width;ovH=r.height;lastSig='';ov.width=r.width*dpr;ov.height=r.height*dpr;ov.style.width=r.width+'px';ov.style.height=r.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0)};
function secChart(el){var c=LightweightCharts.createChart(el,{autoSize:true,layout:{background:{type:'solid',color:'#050608'},textColor:'#A1A7B4',fontFamily:'Geist,system-ui,sans-serif',fontSize:11},
    grid:{vertLines:{color:'#0E1116'},horzLines:{color:'#0E1116'}},rightPriceScale:{borderColor:'#1A1E26',scaleMargins:{top:.08,bottom:.08}},timeScale:{borderColor:'#1A1E26',timeVisible:true,secondsVisible:false,rightOffset:6,barSpacing:6},crosshair:{mode:0},
    localization:{priceFormatter:function(p){return p.toFixed(2)},timeFormatter:function(t){var d=new Date(t*1000);return d.getUTCDate()+'. '+(d.getUTCMonth()+1)+'. '+p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())}}});
  var s=c.addCandlestickSeries({upColor:'#2FCB8C',downColor:'#F2576B',borderVisible:false,wickUpColor:'#2FCB8C',wickDownColor:'#F2576B',priceFormat:{type:'price',precision:2,minMove:0.25}});if(G.chartOpts){c.applyOptions(G.chartOpts());s.applyOptions(G.seriesOpts())}return{c:c,s:s}}
function secData(tf){var T=SRC[cur][0],ck=keyOf(T,tf),base=bars(tf.base),end=lowerBound(base,T+1),start=Math.max(0,end-Math.ceil(1500*tf.s/(SRC_STEP[tf.base]||60)));
  var hist=agg(base.slice(start,end),tf,ck).slice(-1500),si=lowerBound(SRC,ck-(tf.id==='1D'?2*86400:0)),cb=null;
  for(var i=si;i<=cur;i++){var b=SRC[i];if(keyOf(b[0],tf)!==ck)continue;if(!cb)cb={key:ck,o:b[1],h:b[2],l:b[3],c:b[4],v:b[5]};else{cb.h=Math.max(cb.h,b[2]);cb.l=Math.min(cb.l,b[3]);cb.c=b[4]}}
  if(hist.length&&cb&&hist[hist.length-1].key===cb.key)hist.pop();var all=hist.concat(cb?[cb]:[]),out=[],last=-Infinity;
  all.forEach(function(b){var t=ctOf(b.key,tf);if(t<=last)return;last=t;out.push({time:t,open:b.o,high:b.h,low:b.l,close:b.c})});return out}
function secFull(sc){if(!S||cur<0)return;try{var d=secData(TFM[sc.tf]);sc.ch.s.setData(d);sc.n=d.length;sc.k=keyOf(SRC[cur][0],TFM[sc.tf]);sc.ch.c.timeScale().setVisibleLogicalRange({from:d.length-80,to:d.length+6});secLines(sc)}catch(e){}}
function secStep(sc){if(!S||cur<0)return;var tf=TFM[sc.tf],ck=keyOf(SRC[cur][0],tf);if(ck!==sc.k&&sc.k!=null&&ck<sc.k){secFull(sc);return}
  var i=cur,cb=null;while(i>=0&&keyOf(SRC[i][0],tf)===ck){var b=SRC[i];if(!cb)cb={o:b[1],h:b[2],l:b[3],c:b[4]};else{cb.o=b[1];cb.h=Math.max(cb.h,b[2]);cb.l=Math.min(cb.l,b[3])}i--}
  if(!cb)return;try{sc.ch.s.update({time:ctOf(ck,tf),open:cb.o,high:cb.h,low:cb.l,close:cb.c});sc.k=ck}catch(e){secFull(sc)}}
function secLines(sc){(sc.pl||[]).forEach(function(l){try{sc.ch.s.removePriceLine(l)}catch(e){}});sc.pl=[];if(!S)return;
  var add=function(p,c,st,t){sc.pl.push(sc.ch.s.createPriceLine({price:p,color:c,lineWidth:1,lineStyle:st,axisLabelVisible:true,title:t}))};
  S.positions.forEach(function(x){add(x.entry,x.side>0?'#7E8CFF':'#E4B24C',0,(x.side>0?'L ':'S ')+x.qty);if(x.sl!=null)add(x.sl,'#F2576B',2,'SL');if(x.tp!=null)add(x.tp,'#2FCB8C',2,'TP')});
  S.orders.forEach(function(o){add(o.price,'#9AA6FF',1,(o.side>0?'B ':'S ')+o.qty)})}
function layoutApply(){var n=LAY.n||1;document.body.dataset.lay=n;SEC.forEach(function(sc){try{sc.ch.c.remove()}catch(e){}});SEC=[];secBox.innerHTML='';
  for(var i=0;i<n-1;i++){var w=document.createElement('div');w.className='scw';var allowed=TFS.filter(function(t){return!S||t.s>=SRC_STEP[S.src]}).map(function(t){return t.id});
    var tf=LAY.tfs[i]&&allowed.indexOf(LAY.tfs[i])>=0?LAY.tfs[i]:allowed[Math.min(allowed.length-1,4+i)];
    w.innerHTML='<div class="sch"><select data-i="'+i+'">'+allowed.map(function(id){return'<option'+(id===tf?' selected':'')+'>'+id+'</option>'}).join('')+'</select></div><div class="scc"></div>';
    secBox.appendChild(w);var sc={tf:tf,el:w,ch:secChart(w.querySelector('.scc')),k:null,pl:[]};SEC.push(sc)}
  G.__SEC=SEC;$('bLayout').classList.toggle('on',n>1);blindFmt(!!(S&&S.blind));setTimeout(function(){resizeOv();if(chart)chart.timeScale().applyOptions({});SEC.forEach(secFull);DV++},60)}
secBox.addEventListener('change',function(e){var s=e.target.closest('select[data-i]');if(!s)return;var i=+s.dataset.i;LAY.tfs[i]=s.value;lsSet('mnqr-layout',LAY);SEC[i].tf=s.value;secFull(SEC[i])});
$('bLayout').addEventListener('click',function(e){var r=this.getBoundingClientRect();openCtx([1,2,3,4].map(function(n){return{t:(n===1?'One chart':n===2?'Two charts (main + 1)':n===3?'Three charts (main + 2)':'Four charts (2 × 2)')+(LAY.n===n?'  ✓':''),fn:function(){LAY.n=n;lsSet('mnqr-layout',LAY);layoutApply()}}}),r.left,r.bottom+6)});
var lastSecUI=0,lastSecSig='';
var _ui2=G.ui;G.ui=function(){_ui2.apply(this,arguments);if(!SEC.length||!S)return;var now=performance.now();if(now-lastSecUI<120&&playing)return;lastSecUI=now;SEC.forEach(secStep);
  var sig=JSON.stringify([S.positions.map(function(x){return[x.entry,x.sl,x.tp]}),S.orders.map(function(o){return o.price})]);if(sig!==lastSecSig){lastSecSig=sig;SEC.forEach(secLines)}};
var _fr=G.fullRender;G.fullRender=function(){_fr.apply(this,arguments);SEC.forEach(secFull)};

/* overlay: news lines are drawn after everything else */
var _dov=G.drawOverlay;G.drawOverlay=function(){var b=lastSig;_dov();if(lastSig!==b&&S&&CT.length&&NEWS_ON){ctx.save();ctx.beginPath();ctx.rect(0,0,plotW(),ovH);ctx.clip();drawNews();ctx.restore()}};
if(LAY.n>1)layoutApply();
})();

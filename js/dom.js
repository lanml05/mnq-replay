/* MNQ Replay v2 — DOM price ladder (NinjaTrader / Tradovate style): click a price to place a limit or stop order,
   see working orders, the position, SL/TP and today's volume at each price. */
(function(){
'use strict';
var G=window,ON=!!lsGet('mnqr-dom',false),STEP=lsGet('mnqr-domstep',1),ROWS=41,center=null,pinned=false;
var el=document.createElement('section');el.id='dom';el.className='hide';document.body.appendChild(el);
el.innerHTML='<div class="dmh"><b>DOM</b><select id="domStep" title="Price step"><option value="0.25">0.25</option><option value="1">1</option><option value="2.5">2.5</option><option value="5">5</option></select><button class="hb" id="domC" title="Center on price">'+ico('target')+'</button><button class="hb" id="domX" title="Close DOM">'+ico('x')+'</button></div>'+
  '<div class="dmcol"><span>Buy</span><span>Price</span><span>Sell</span><span>Vol</span></div><div class="dml" id="domL"></div>'+
  '<div class="dmf"><button class="buy2" id="domB">Buy MKT</button><button class="sell2" id="domS">Sell MKT</button><button class="btn" id="domF">Close all</button><button class="btn" id="domK">Cancel orders</button></div>';
$('domStep').value=String(STEP);
function setOn(v){ON=v;lsSet('mnqr-dom',v);document.body.classList.toggle('domon',v);el.classList.toggle('hide',!v);$('bDom').classList.toggle('on',v);pinned=false;if(v)draw();setTimeout(function(){if(G.chart)resizeOv()},40)}
$('bDom').addEventListener('click',function(){setOn(!ON)});
$('domX').addEventListener('click',function(){setOn(false)});
$('domC').addEventListener('click',function(){pinned=false;draw()});
$('domStep').addEventListener('change',function(){STEP=+this.value;lsSet('mnqr-domstep',STEP);pinned=false;draw()});
el.addEventListener('wheel',function(e){if(!S)return;e.preventDefault();pinned=true;center=(center||price())+(e.deltaY>0?-1:1)*STEP*3;draw()},{passive:false});
function rnd(p){return Math.round(p/STEP)*STEP}
// volume at price for the current trading day (from 18:00 NY), spread evenly across each bar's range
var VP={key:null,map:{}};
function volProfile(){if(!S||cur<0)return VP.map;var day=tradeDay(SRC[cur][0]),k=day+'|'+STEP;
  if(VP.key!==k){VP={key:k,map:{},i:null};var i=cur;while(i>0&&tradeDay(SRC[i-1][0])===day)i--;VP.i=i}
  for(;VP.i<=cur;VP.i++){var b=SRC[VP.i];if(!b)break;var lo=rnd(b[3]),hi=rnd(b[2]),n=Math.round((hi-lo)/STEP)+1,v=(b[5]||0)/n;for(var j=0;j<n;j++){var px=(lo+j*STEP).toFixed(2);VP.map[px]=(VP.map[px]||0)+v}}
  return VP.map}
function draw(){if(!ON||!S||cur<0){$('domL').innerHTML='';return}var p=price(),a=ask(),c=pinned&&center!=null?center:rnd(p);center=c;
  var vp=volProfile(),half=Math.floor(ROWS/2),rows=[],mx=1;for(var i=half;i>=-half;i--){var px=+(c+i*STEP).toFixed(2);rows.push(px);var v=vp[px.toFixed(2)]||0;if(v>mx)mx=v}
  var near=function(x,px){return Math.abs(x-px)<STEP/2};
  $('domL').innerHTML=rows.map(function(px){var bo=S.orders.filter(function(o){return o.side>0&&near(o.price,px)}),so=S.orders.filter(function(o){return o.side<0&&near(o.price,px)});
    var pos=S.positions.filter(function(x){return near(x.entry,px)}),sl=S.positions.some(function(x){return x.sl!=null&&near(x.sl,px)}),tp=S.positions.some(function(x){return x.tp!=null&&near(x.tp,px)});
    var v=vp[px.toFixed(2)]||0,cl=[];if(px>=rnd(a)&&px<rnd(a)+STEP)cl.push('ask');if(near(rnd(p),px))cl.push('bid');if(pos.length)cl.push('pe');if(sl)cl.push('psl');if(tp)cl.push('ptp');
    return'<div class="dmr '+cl.join(' ')+'" data-px="'+px+'"><span class="dmb" data-side="1">'+(bo.length?'<i data-cx="'+bo.map(function(o){return o.id}).join(',')+'">'+bo.reduce(function(s,o){return s+o.qty},0)+' '+(bo[0].type==='limit'?'L':'S')+'</i>':'')+'</span>'+
      '<span class="dmp">'+fp(px)+(pos.length?'<em>'+(pos[0].side>0?'L':'S')+pos.reduce(function(s,x){return s+x.qty},0)+'</em>':'')+(sl?'<em class="r">SL</em>':'')+(tp?'<em class="g">TP</em>':'')+'</span>'+
      '<span class="dms" data-side="-1">'+(so.length?'<i data-cx="'+so.map(function(o){return o.id}).join(',')+'">'+so.reduce(function(s,o){return s+o.qty},0)+' '+(so[0].type==='limit'?'L':'S')+'</i>':'')+'</span>'+
      '<span class="dmv"><b style="width:'+(v/mx*100).toFixed(1)+'%"></b></span></div>'}).join('')}
G.domDraw=draw;
el.addEventListener('click',function(e){if(!S)return;var cx=e.target.closest('[data-cx]');
  if(cx){var ids=cx.dataset.cx.split(',');S.orders=S.orders.filter(function(o){return ids.indexOf(o.id)<0});toast('Order cancelled');changed();draw();return}
  var cell=e.target.closest('[data-side]');if(cell){var px=+cell.parentNode.dataset.px,side=+cell.dataset.side,p=price(),a=ask(),type;
    if(side>0)type=px<a?'limit':px>a?'stop':null;else type=px>p?'limit':px<p?'stop':null;
    if(!type){side>0?placeMarket(1):placeMarket(-1);draw();return}placePending(side,type,px);draw();return}
  if(e.target.id==='domB'){placeMarket(1);draw()}else if(e.target.id==='domS'){placeMarket(-1);draw()}
  else if(e.target.id==='domF'){S.positions.slice().forEach(function(x){closePos(x,mktExit(x.side),nowT(),'Manual')});changed();draw()}
  else if(e.target.id==='domK'){S.orders=[];changed();draw()}});
var _ui=G.ui;G.ui=function(){_ui.apply(this,arguments);if(ON)draw()};
if(ON)setOn(true);
})();

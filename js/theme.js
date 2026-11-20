/* MNQ Replay v2 — chart colours: background, grid, candles (body / wick / border), volume. Saved in mnqr-chartcol. */
(function(){
'use strict';
var G=window;
var PRESETS={
  'Default':{bg:'#050608',grid:'#0E1116',up:'#2FCB8C',dn:'#F2576B',wup:'#2FCB8C',wdn:'#F2576B',border:false,gridOn:true},
  'TradingView':{bg:'#131722',grid:'#1E222D',up:'#089981',dn:'#F23645',wup:'#089981',wdn:'#F23645',border:false,gridOn:true},
  'Classic':{bg:'#000000',grid:'#111111',up:'#FFFFFF',dn:'#5D606B',wup:'#FFFFFF',wdn:'#5D606B',border:false,gridOn:false},
  'Hollow':{bg:'#0B0D11',grid:'#151922',up:'#0B0D11',dn:'#F2576B',wup:'#2FCB8C',wdn:'#F2576B',border:true,bup:'#2FCB8C',bdn:'#F2576B',gridOn:true},
  'Blue / Orange':{bg:'#060913',grid:'#0F1525',up:'#3B82F6',dn:'#F59E0B',wup:'#3B82F6',wdn:'#F59E0B',border:false,gridOn:true},
  'Light':{bg:'#FFFFFF',grid:'#F0F3FA',up:'#089981',dn:'#F23645',wup:'#089981',wdn:'#F23645',border:false,gridOn:true}};
var C=Object.assign({},PRESETS.Default,lsGet('mnqr-chartcol',{}));
G.CHC=C;
function lum(h){var m=/^#([0-9a-f]{6})$/i.exec(h||'');if(!m)return 0;var n=parseInt(m[1],16);return(0.299*(n>>16)+0.587*((n>>8)&255)+0.114*(n&255))/255}
function rgba(h,a){var n=parseInt(h.slice(1),16);return'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'}
function opts(){var light=lum(C.bg)>0.6;return{layout:{background:{type:'solid',color:C.bg},textColor:light?'#4B5563':'#A1A7B4'},
  grid:{vertLines:{color:C.grid,visible:C.gridOn!==false},horzLines:{color:C.grid,visible:C.gridOn!==false}},
  rightPriceScale:{borderColor:light?'#D1D5DB':'#1A1E26'},timeScale:{borderColor:light?'#D1D5DB':'#1A1E26'}}}
function sopts(){return{upColor:C.up,downColor:C.dn,wickUpColor:C.wup||C.up,wickDownColor:C.wdn||C.dn,borderVisible:!!C.border,borderUpColor:C.bup||C.wup||C.up,borderDownColor:C.bdn||C.wdn||C.dn}}
function apply(){if(!G.chart)return;try{chart.applyOptions(opts());cs.applyOptions(sopts())}catch(e){}
  document.documentElement.style.setProperty('--chartbg',C.bg);(G.__SEC||[]).forEach(function(sc){try{sc.ch.c.applyOptions(opts());sc.ch.s.applyOptions(sopts())}catch(e){}});
  if(G.S&&G.fullRender)fullRender(true)}
G.applyChartColors=apply;G.chartOpts=opts;G.seriesOpts=sopts;
G.toVol=function(b){return{time:ctOf(b.key,TF),value:b.v,color:rgba(b.c>=b.o?(C.wup||C.up):(C.wdn||C.dn),.35)}};
var _mk=G.makeChart;G.makeChart=function(){_mk.apply(this,arguments);apply()};
if(G.chart)apply();
function save(){lsSet('mnqr-chartcol',C);G.CHC=C;apply()}

/* settings section */
var box=$('mSettings').querySelector('.box'),sec=document.createElement('div');sec.className='ccol';
function field(k,l){return'<label class="ccf"><input type="color" data-k="'+k+'" value="'+(C[k]||'#000000')+'"><span>'+l+'</span></label>'}
function draw(){sec.innerHTML='<div class="ccol-h"><b>Chart colors</b><select id="ccPre"><option value="">Preset …</option>'+Object.keys(PRESETS).map(function(k){return'<option>'+k+'</option>'}).join('')+'</select></div>'+
  '<div class="ccg">'+field('bg','Background')+field('grid','Grid')+field('up','Bullish candle')+field('dn','Bearish candle')+field('wup','Bullish wick')+field('wdn','Bearish wick')+
  (C.border?field('bup','Bullish border')+field('bdn','Bearish border'):'')+'</div>'+
  '<div class="ccx"><label class="chk"><input type="checkbox" id="ccGrid"'+(C.gridOn!==false?' checked':'')+'> Show grid</label><label class="chk"><input type="checkbox" id="ccBorder"'+(C.border?' checked':'')+'> Candle borders</label><button class="btn" id="ccReset">Reset</button></div>'+
  '<div class="ccprev" id="ccPrev"></div>';preview()}
function preview(){var p=sec.querySelector('#ccPrev');if(!p)return;var h='',v=[30,42,36,50,46,58,52,40,48,62,56,70,64,60,74];v.forEach(function(c,i){var o=i?v[i-1]:28,up=c>=o,top=Math.max(c,o),bot=Math.min(c,o);
    h+='<i style="left:'+(6+i*19)+'px;bottom:'+(bot-6)+'%;height:'+(top-bot+12)+'%;background:'+(up?(C.wup||C.up):(C.wdn||C.dn))+'"></i><b style="left:'+(1+i*19)+'px;bottom:'+bot+'%;height:'+Math.max(2,top-bot)+'%;background:'+(up?C.up:C.dn)+';'+(C.border?'box-shadow:inset 0 0 0 1px '+(up?(C.bup||C.wup):(C.bdn||C.wdn)):'')+'"></b>'});
  p.style.background=C.bg;p.style.backgroundImage=C.gridOn!==false?'linear-gradient('+C.grid+' 1px,transparent 1px),linear-gradient(90deg,'+C.grid+' 1px,transparent 1px)':'none';p.innerHTML=h}
draw();box.insertBefore(sec,box.querySelector('#dataInfo'));
sec.addEventListener('input',function(e){var k=e.target.dataset.k;if(!k)return;C[k]=e.target.value;if(k==='up'&&!C.border)C.wup=C.wup===undefined?C.up:C.wup;preview();save()});
sec.addEventListener('change',function(e){if(e.target.id==='ccPre'&&e.target.value){C=Object.assign({},PRESETS[e.target.value]);save();draw()}
  else if(e.target.id==='ccGrid'){C.gridOn=e.target.checked;save();preview()}else if(e.target.id==='ccBorder'){C.border=e.target.checked;if(C.border){C.bup=C.bup||C.wup||C.up;C.bdn=C.bdn||C.wdn||C.dn}save();draw()}});
sec.addEventListener('click',function(e){if(e.target.id==='ccReset'){C=Object.assign({},PRESETS.Default);save();draw()}});
})();

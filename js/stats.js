/* MNQ Replay v2 — analytics: KPIs, equity, R distribution, MAE/MFE, exit optimizer ("what if"), Monte Carlo,
   P&L calendar, hour/weekday heatmap, mistakes, trade notes, session summary, export to Funded Journal. */
(function(){
'use strict';
var G=window;
var MISTAKES=['FOMO','Revenge trade','No confirmation','Early entry','Moved SL','Early exit','Risk too big','Against HTF trend'];
G.MISTAKES=MISTAKES;
/* tags were Slovenian before the English UI; Funded Journal still uses the Slovenian names */
var SL_TAG={'Brez potrditve':'No confirmation','Prezgoden vstop':'Early entry','Premaknil SL':'Moved SL','Prezgoden izhod':'Early exit','Prevelik risk':'Risk too big','Proti HTF trendu':'Against HTF trend'},EN_TAG={};
Object.keys(SL_TAG).forEach(function(k){EN_TAG[SL_TAG[k]]=k});
function fixTags(t){if(t&&t.tags)t.tags=t.tags.map(function(x){return SL_TAG[x]||x});return t}
function sum(a,f){return a.reduce(function(s,x){return s+(f?f(x):x)},0)}
function pctl(a,p){if(!a.length)return 0;var b=a.slice().sort(function(x,y){return x-y});return b[Math.min(b.length-1,Math.max(0,Math.round(p*(b.length-1))))]}
function R0(t){return t.sl0!=null?Math.abs(t.entry-t.sl0):null}
function nyH(t){return new Date((t+off(t,NY))*1000)}
function kpis(T,bal0){var w=T.filter(function(t){return t.pnl>0}),l=T.filter(function(t){return t.pnl<=0}),sw=sum(w,function(t){return t.pnl}),sl=-sum(l,function(t){return t.pnl});
  var eq=[bal0],peak=bal0,mdd=0;T.forEach(function(t){var v=eq[eq.length-1]+t.pnl;eq.push(v);if(v>peak)peak=v;if(peak-v>mdd)mdd=peak-v});
  var rs=T.filter(function(t){return t.r!=null}),ws=0,ls=0,bw=0,bl=0;T.forEach(function(t){if(t.pnl>0){ws++;ls=0}else{ls++;ws=0}bw=Math.max(bw,ws);bl=Math.max(bl,ls)});
  var dur=T.map(function(t){return t.closeT-t.openT});
  return{n:T.length,net:sw-sl,wr:T.length?w.length/T.length*100:0,pf:sl?sw/sl:null,aw:w.length?sw/w.length:0,al:l.length?-sl/l.length:0,ar:rs.length?sum(rs,function(t){return t.r})/rs.length:null,totR:sum(rs,function(t){return t.r}),
    exp:T.length?(sw-sl)/T.length:0,mdd:mdd,eq:eq,bw:bw,bl:bl,best:T.length?Math.max.apply(null,T.map(function(t){return t.pnl})):0,worst:T.length?Math.min.apply(null,T.map(function(t){return t.pnl})):0,adur:dur.length?sum(dur)/dur.length:0}}

/* ---------- small SVG charts ---------- */
function eqSvg(eq,W,H){var lo=Math.min.apply(null,eq),hi=Math.max.apply(null,eq);if(hi===lo){hi+=1;lo-=1}var b0=eq[0],y=function(v){return H-6-(v-lo)/(hi-lo)*(H-12)};
  var pts=eq.map(function(v,i){return(i/(eq.length-1||1)*W).toFixed(1)+','+y(v).toFixed(1)}).join(' '),up=eq[eq.length-1]>=b0,c=up?'#2FCB8C':'#F2576B';
  return'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" class="eqs"><defs><linearGradient id="eqg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+c+'" stop-opacity=".28"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></linearGradient></defs>'+
    '<line x1="0" x2="'+W+'" y1="'+y(b0).toFixed(1)+'" y2="'+y(b0).toFixed(1)+'" stroke="#2A2F3A" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>'+
    '<polygon fill="url(#eqg)" points="0,'+H+' '+pts+' '+W+','+H+'"/><polyline fill="none" stroke="'+c+'" stroke-width="2" vector-effect="non-scaling-stroke" points="'+pts+'"/></svg>'}
function histSvg(vals,lo,hi,step,W,H){var n=Math.round((hi-lo)/step),bins=[];for(var i=0;i<n;i++)bins.push(0);vals.forEach(function(v){var k=Math.floor((Math.max(lo,Math.min(hi-1e-9,v))-lo)/step);bins[k]++});
  var mx=Math.max(1,Math.max.apply(null,bins)),bw=W/n;
  return'<svg viewBox="0 0 '+W+' '+(H+16)+'" class="hist">'+bins.map(function(c,i){var x0=lo+i*step,h=c/mx*H;return'<rect x="'+(i*bw+1).toFixed(1)+'" y="'+(H-h).toFixed(1)+'" width="'+(bw-2).toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2" fill="'+(x0>=0?'#2FCB8C':'#F2576B')+'" opacity=".8"><title>'+x0.toFixed(1)+'R to '+(x0+step).toFixed(1)+'R: '+c+'</title></rect>'}).join('')+
    [lo,0,hi].map(function(v){var x=(v-lo)/(hi-lo)*W;return'<text x="'+Math.max(10,Math.min(W-10,x)).toFixed(0)+'" y="'+(H+13)+'" text-anchor="middle">'+v+'R</text>'}).join('')+'</svg>'}

/* ---------- exit optimizer: replay every trade with another stop / target ---------- */
function simTrade(t,m,r){var R=R0(t);if(!R)return null;var s=t.side,k=lowerBound(SRC,t.openT);if(k>=SRC.length||k<1||SRC[k][0]-t.openT>3600)return null;
  var sl=t.entry-s*R*m,tp=t.entry+s*R*r,sp=t.spread||0,lim=Math.min(SRC.length,k+2880);
  for(var i=k;i<lim;i++){var b=SRC[i],sh=s>0?b[3]<=sl:b[2]+sp>=sl,th=s>0?b[2]>=tp:b[3]+sp<=tp;if(sh)return -m;if(th)return r}
  return null}
function optimizer(T){var M=[0.5,0.75,1,1.5,2],RR=[1,1.5,2,3,4],ok=T.filter(function(t){return!t.partial&&R0(t)}),grid=[],best=null;
  M.forEach(function(m){var row=[];RR.forEach(function(r){var res=[];ok.forEach(function(t){var v=simTrade(t,m,r);if(v!=null)res.push(v)});
    var c={m:m,r:r,n:res.length,tot:sum(res),wr:res.length?res.filter(function(v){return v>0}).length/res.length*100:0};c.exp=c.n?c.tot/c.n:0;row.push(c);if(c.n&&(!best||c.tot>best.tot))best=c});grid.push(row)});
  var act=ok.filter(function(t){return t.r!=null});return{grid:grid,best:best,n:ok.length,actual:sum(act,function(t){return t.r})}}

/* ---------- Monte Carlo on the R of the trades ---------- */
function monte(T){var rs=T.filter(function(t){return t.r!=null}).map(function(t){return t.r});if(rs.length<5)return null;var runs=2000,N=100,fin=[],dds=[];
  for(var k=0;k<runs;k++){var e=0,pk=0,dd=0;for(var i=0;i<N;i++){e+=rs[Math.floor(Math.random()*rs.length)];if(e>pk)pk=e;if(pk-e>dd)dd=pk-e}fin.push(e);dds.push(dd)}
  var risk=T.filter(function(t){return t.sl0!=null}).map(function(t){return Math.abs(t.entry-t.sl0)*t.qty*S.pv}),ar=risk.length?sum(risk)/risk.length:null;
  return{fin:fin,dds:dds,ar:ar,n:rs.length,p5:pctl(fin,.05),p50:pctl(fin,.5),p95:pctl(fin,.95),d50:pctl(dds,.5),d95:pctl(dds,.95),neg:fin.filter(function(v){return v<0}).length/runs*100}}

/* ---------- views ---------- */
var VIEW='pregled',SCOPE='seja';
function trades(){if(SCOPE==='vse'){var A=[];sessData().forEach(function(x){(x.s.id===S.id?S:x.s).trades.forEach(function(t){A.push(t)})});A.forEach(fixTags);return A.sort(function(a,b){return a.closeT-b.closeT})}S.trades.forEach(fixTags);return S.trades.slice()}
function tile(l,v,c,sub){return'<div class="kt"><small>'+l+'</small><b class="'+(c||'')+'">'+v+'</b>'+(sub?'<span>'+sub+'</span>':'')+'</div>'}
function vPregled(T){var K=kpis(T,S.bal0);
  return'<div class="kgrid">'+tile('Net P&amp;L',money(K.net,1),cls(K.net),K.n+' trades')+tile('Win rate',K.wr.toFixed(0)+' %','',T.filter(function(t){return t.pnl>0}).length+' W · '+T.filter(function(t){return t.pnl<=0}).length+' L')+
    tile('Profit factor',K.pf!=null?K.pf.toFixed(2):'∞')+tile('Avg. R',K.ar!=null?K.ar.toFixed(2)+'R':'–',cls(K.ar||0),'total '+K.totR.toFixed(1)+'R')+
    tile('Avg. win',money(K.aw),'pos')+tile('Avg. loss',money(K.al),'neg')+tile('Expectancy',money(K.exp,1),cls(K.exp),'per trade')+tile('Max drawdown',money(-K.mdd),'neg')+
    tile('Win streak',K.bw)+tile('Loss streak',K.bl,K.bl>=4?'neg':'')+tile('Best',money(K.best,1),'pos')+tile('Worst',money(K.worst,1),'neg')+'</div>'+
    '<div class="agrid2"><div class="acard"><h4>Equity</h4>'+eqSvg(K.eq,700,180)+'</div><div class="acard"><h4>R distribution</h4>'+histSvg(T.filter(function(t){return t.r!=null}).map(function(t){return t.r}),-3,5,0.5,360,150)+'</div></div>'+
    '<div class="acard"><h4>By setup and grade</h4>'+(setupTable(T)||'<p class="dim">Pick a setup and grade when you place orders and their stats show up here.</p>')+'</div>'}
function vMae(T){var P=T.filter(function(t){return R0(t)&&t.mae!=null});if(!P.length)return'<p class="dim">MAE/MFE needs trades with a stop loss (recorded from this version on).</p>';
  var W=520,H=300,mx=3,pts=P.map(function(t){var R=R0(t),x=Math.min(mx,(t.mae||0)/R),y=Math.min(mx,(t.mfe||0)/R);return'<circle cx="'+(30+x/mx*(W-40)).toFixed(1)+'" cy="'+(H-24-y/mx*(H-40)).toFixed(1)+'" r="5" fill="'+(t.pnl>0?'#2FCB8C':'#F2576B')+'" opacity=".8"><title>'+(t.side>0?'Long':'Short')+' · MAE '+((t.mae||0)/R).toFixed(2)+'R · MFE '+((t.mfe||0)/R).toFixed(2)+'R · '+money(t.pnl,1)+'</title></circle>'}).join('');
  var ax='';for(var i=0;i<=mx;i++){var x=30+i/mx*(W-40),y=H-24-i/mx*(H-40);ax+='<line x1="'+x+'" x2="'+x+'" y1="16" y2="'+(H-24)+'" stroke="#1A1E26"/><line x1="30" x2="'+(W-10)+'" y1="'+y+'" y2="'+y+'" stroke="#1A1E26"/><text x="'+x+'" y="'+(H-8)+'" text-anchor="middle">'+i+'R</text><text x="22" y="'+(y+4)+'" text-anchor="end">'+i+'R</text>'}
  var wins=P.filter(function(t){return t.pnl>0}),loss=P.filter(function(t){return t.pnl<=0}),deep=wins.filter(function(t){return t.mae/R0(t)>0.5}).length,gave=loss.filter(function(t){return t.mfe/R0(t)>=1}).length;
  var mfeL=loss.length?sum(loss,function(t){return t.mfe/R0(t)})/loss.length:0,maeW=wins.length?sum(wins,function(t){return t.mae/R0(t)})/wins.length:0;
  return'<div class="agrid2"><div class="acard"><h4>MAE (against you) ↔ MFE (in your favour), in R</h4><svg viewBox="0 0 '+W+' '+H+'" class="sct">'+ax+pts+'<text x="'+(W/2)+'" y="'+(H)+'" text-anchor="middle" class="axl">MAE</text></svg></div>'+
    '<div class="acard ins"><h4>What this means</h4><ul>'+
    '<li>Winning trades went on average <b>'+maeW.toFixed(2)+'R</b> against you. '+(maeW<0.4?'Your stop could be tighter.':maeW>0.8?'Your SL is where it should be.':'')+'</li>'+
    '<li><b>'+deep+'</b> od '+wins.length+' winners went more than 0.5R against you before working out.</li>'+
    '<li>Losing trades went on average <b>'+mfeL.toFixed(2)+'R</b> in your favour before they turned.</li>'+
    '<li><b>'+gave+'</b> losing trades were already 1R in profit. '+(gave?'BE at 1R or a partial close would have saved them.':'')+'</li></ul></div></div>'}
function vOpt(T){var O=optimizer(T);if(!O.n)return'<p class="dim">What-if needs trades with a stop loss in this session.</p>';
  var cell=function(c){var b=O.best===c;return'<td class="'+(b?'best ':'')+(c.tot>0?'pos':c.tot<0?'neg':'')+'"><b>'+(c.n?(c.tot>=0?'+':'')+c.tot.toFixed(1)+'R':'–')+'</b><small>'+(c.n?c.wr.toFixed(0)+' % · '+c.n:'')+'</small></td>'};
  return'<div class="acard"><h4>What if: a different stop and target on the same entries</h4><p class="dim">Every entry from this session was replayed on the real candles with a different SL (as multiples of your SL) and TP (in R). Your actual result: <b class="'+cls(O.actual)+'">'+(O.actual>=0?'+':'')+O.actual.toFixed(1)+'R</b> na '+O.n+' trades.</p>'+
    '<table class="opt"><tr><th>SL \\ TP</th>'+O.grid[0].map(function(c){return'<th>'+c.r+'R</th>'}).join('')+'</tr>'+O.grid.map(function(row){return'<tr><th>'+row[0].m+'× SL</th>'+row.map(cell).join('')+'</tr>'}).join('')+'</table>'+
    (O.best?'<p class="ins1">Best combination: <b>SL '+O.best.m+'× yours</b> in <b>TP '+O.best.r+'R</b> → <b class="'+cls(O.best.tot)+'">'+(O.best.tot>=0?'+':'')+O.best.tot.toFixed(1)+'R</b> (win rate '+O.best.wr.toFixed(0)+' %). Careful: with few trades this can be luck.</p>':'')+'</div>'}
function vMonte(T){var M=monte(T);if(!M)return'<p class="dim">Monte Carlo needs at least 5 trades with R (with a stop loss).</p>';var ar=M.ar;
  var ch=S.ch,ddR=ch&&ar?ch.dd/ar:null,pf=ddR?M.dds.filter(function(d){return d>=ddR}).length/M.dds.length*100:null;
  return'<div class="agrid2"><div class="acard"><h4>Next 100 trades · 2000 simulations from your '+M.n+' R</h4>'+histSvg(M.fin,Math.floor(pctl(M.fin,.01)/5)*5,Math.ceil(pctl(M.fin,.99)/5)*5+5,5,520,150)+
    '<div class="kgrid k3">'+tile('Worst 5 %',(M.p5>=0?'+':'')+M.p5.toFixed(1)+'R',cls(M.p5),ar?money(M.p5*ar,1):'')+tile('Median',(M.p50>=0?'+':'')+M.p50.toFixed(1)+'R',cls(M.p50),ar?money(M.p50*ar,1):'')+tile('Best 5 %',(M.p95>=0?'+':'')+M.p95.toFixed(1)+'R',cls(M.p95),ar?money(M.p95*ar,1):'')+'</div></div>'+
    '<div class="acard"><h4>Drawdown you can expect</h4>'+histSvg(M.dds,0,Math.ceil(pctl(M.dds,.99)/2)*2+2,1,520,150).replace(/#2FCB8C/g,'#F2576B')+
    '<div class="kgrid k3">'+tile('Typical max DD',M.d50.toFixed(1)+'R','neg',ar?money(-M.d50*ar):'')+tile('Bad case (95 %)',M.d95.toFixed(1)+'R','neg',ar?money(-M.d95*ar):'')+tile('Chance of a loss',M.neg.toFixed(0)+' %',M.neg>30?'neg':'','after 100 trades')+'</div>'+
    (pf!=null?'<p class="ins1">In a challenge with DD '+money(ch.dd)+' (≈ '+ddR.toFixed(1)+'R at your avg. risk) the drawdown would break the limit in <b class="'+(pf>20?'neg':'pos')+'">'+pf.toFixed(0)+' %</b> of simulations.</p>':'')+'</div></div>'}
function vKoledar(T){if(!T.length)return'';var days={};T.forEach(function(t){var d=tradeDay(t.closeT-1);(days[d]=days[d]||{p:0,n:0});days[d].p+=t.pnl;days[d].n++});
  var keys=Object.keys(days).map(Number).sort(function(a,b){return a-b}),months={};keys.forEach(function(d){var dt=new Date(d*86400000+43200000),k=dt.getUTCFullYear()+'-'+p2(dt.getUTCMonth()+1);(months[k]=months[k]||[]).push(d)});
  var mx=Math.max.apply(null,keys.map(function(d){return Math.abs(days[d].p)}))||1,MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var cal=Object.keys(months).map(function(mk){var y=+mk.slice(0,4),m=+mk.slice(5)-1,first=new Date(Date.UTC(y,m,1)),pad=(first.getUTCDay()+6)%7,nd=new Date(Date.UTC(y,m+1,0)).getUTCDate(),c='';
    for(var i=0;i<pad;i++)c+='<i></i>';for(var d=1;d<=nd;d++){var k=Math.floor(Date.UTC(y,m,d)/86400000),x=days[k];c+=x?'<i class="cd '+(x.p>=0?'up':'dn')+'" style="--a:'+(0.25+0.75*Math.abs(x.p)/mx).toFixed(2)+'" title="'+d+'. '+(m+1)+'. · '+x.n+' trades · '+money(x.p,1)+'"><b>'+d+'</b><span>'+money(x.p,1).replace('.00','')+'</span></i>':'<i class="ce"><b>'+d+'</b></i>'}
    return'<div class="calm"><h5>'+MN[m]+' '+y+'</h5><div class="calg"><s>M</s><s>T</s><s>W</s><s>T</s><s>F</s><s>S</s><s>S</s>'+c+'</div></div>'}).join('');
  var H={},Wd={};T.forEach(function(t){var d=nyH(t.openT),h=d.getUTCHours(),w=(d.getUTCDay()+6)%7,k=w+'-'+h;(H[k]=H[k]||{p:0,n:0});H[k].p+=t.pnl;H[k].n++});
  var hrs=[];Object.keys(H).forEach(function(k){var h=+k.split('-')[1];if(hrs.indexOf(h)<0)hrs.push(h)});hrs.sort(function(a,b){return a-b});var mh=Math.max.apply(null,Object.keys(H).map(function(k){return Math.abs(H[k].p)}))||1;
  var hm='<table class="hm"><tr><th></th>'+hrs.map(function(h){return'<th>'+p2(h)+'h</th>'}).join('')+'</tr>'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(dn,w){if(w>4&&!hrs.some(function(h){return H[w+'-'+h]}))return'';
    return'<tr><th>'+dn+'</th>'+hrs.map(function(h){var x=H[w+'-'+h];return x?'<td style="background:'+(x.p>=0?'rgba(47,203,140,':'rgba(242,87,107,')+(0.15+0.6*Math.abs(x.p)/mh).toFixed(2)+')" title="'+dn+' '+p2(h)+':00 · '+x.n+' trades · '+money(x.p,1)+'">'+money(x.p,1).replace('.00','')+'</td>':'<td class="e"></td>'}).join('')+'</tr>'}).join('')+'</table>';
  return'<div class="agrid2"><div class="acard"><h4>P&amp;L by day (replay dates)</h4><div class="cals">'+cal+'</div></div><div class="acard"><h4>When you make money · entry hour (NY)</h4>'+hm+'</div></div>'}
function vNapake(T){var by={};T.forEach(function(t){(t.tags||[]).forEach(function(m){(by[m]=by[m]||{n:0,p:0});by[m].n++;by[m].p+=t.pnl})});
  var clean=T.filter(function(t){return!(t.tags||[]).length}),dirty=T.filter(function(t){return(t.tags||[]).length});
  var rows=Object.keys(by).sort(function(a,b){return by[a].p-by[b].p});
  return'<div class="agrid2"><div class="acard"><h4>What your mistakes cost</h4>'+(rows.length?'<table class="mt">'+rows.map(function(k){return'<tr><td>'+esc(k)+'</td><td>'+by[k].n+'×</td><td class="'+cls(by[k].p)+'">'+money(by[k].p,1)+'</td></tr>'}).join('')+'</table>':'<p class="dim">In History click the note icon on a trade and tag your mistakes. This shows what they cost you.</p>')+'</div>'+
    '<div class="acard"><h4>Clean vs with mistakes</h4><div class="kgrid k2">'+tile('Clean',money(sum(clean,function(t){return t.pnl}),1),cls(sum(clean,function(t){return t.pnl})),clean.length+' trades')+tile('With mistakes',money(sum(dirty,function(t){return t.pnl}),1),cls(sum(dirty,function(t){return t.pnl})),dirty.length+' trades')+'</div></div></div>'}
var VIEWS=[['pregled','Overview',vPregled],['mae','MAE / MFE',vMae],['opt','What if',vOpt],['monte','Monte Carlo',vMonte],['kol','Calendar and hours',vKoledar],['nap','Mistakes',vNapake]];
function openAnalytics(view){if(!S)return;VIEW=view||VIEW;var m=document.createElement('div');m.className='modal anm';document.body.appendChild(m);
  function draw(){var T=trades(),v=VIEWS.filter(function(x){return x[0]===VIEW})[0];
    m.innerHTML='<div class="box anb"><div class="anh"><b>Analytics</b><div class="seg ansc"><button data-sc="seja" class="'+(SCOPE==='seja'?'on':'')+'">This session</button><button data-sc="vse" class="'+(SCOPE==='vse'?'on':'')+'">All sessions</button></div><span class="hsp"></span><button class="btn" data-sum="1">Session summary</button><button class="btn" data-fj="1">'+ico('send')+'Send to Funded Journal</button><button class="hb" data-x="1">'+ico('x')+'</button></div>'+
      '<div class="antabs">'+VIEWS.map(function(x){return'<button data-v="'+x[0]+'" class="'+(x[0]===VIEW?'on':'')+'">'+x[1]+'</button>'}).join('')+'</div>'+
      '<div class="anbody">'+(T.length?v[2](T):'<p class="dim">No closed trades yet.</p>')+'</div></div>'}
  draw();
  m.addEventListener('click',function(e){var b=e.target.closest('[data-v],[data-sc],[data-x],[data-sum],[data-fj]');if(e.target===m){m.remove();return}if(!b)return;
    if(b.dataset.x){m.remove();return}if(b.dataset.v){VIEW=b.dataset.v;draw();return}if(b.dataset.sc){SCOPE=b.dataset.sc;draw();return}
    if(b.dataset.sum){m.remove();sessionSummary();return}if(b.dataset.fj){toJournal(trades())}});
  m.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Escape')m.remove()})}
G.openAnalytics=openAnalytics;

/* the bottom "Statistika" tab: compact KPIs + equity + a button to the full analytics */
G.statsHtml=function(){var T=S.trades;if(!T.length)return'<div class="none">Stats show up after the first closed trade. <button class="btn" data-an="pregled">Open analytics</button></div>';var K=kpis(T,S.bal0);
  return'<div class="sbar"><div class="kgrid kb">'+tile('Net',money(K.net,1),cls(K.net))+tile('Trades',K.n)+tile('Win rate',K.wr.toFixed(0)+' %')+tile('PF',K.pf!=null?K.pf.toFixed(2):'∞')+tile('Avg. R',K.ar!=null?K.ar.toFixed(2)+'R':'–',cls(K.ar||0))+tile('Max DD',money(-K.mdd),'neg')+tile('Win / loss streak',K.bw+' / '+K.bl)+'</div>'+
    '<div class="sbq">'+eqSvg(K.eq,500,92)+'<div class="sbb"><button class="btn on" data-an="pregled">Open analytics</button><button class="btn" data-an="opt">What if</button><button class="btn" data-an="monte">Monte Carlo</button><button class="btn" data-an="mae">MAE / MFE</button></div></div></div>'};
$('bbody').addEventListener('click',function(e){var b=e.target.closest('[data-an]');if(b)openAnalytics(b.dataset.an);var n=e.target.closest('[data-note]');if(n)noteDialog(n.dataset.note)});
// analytics button in the bottom tabs
(function(){var b=document.createElement('button');b.className='btn';b.id='bAnal';b.innerHTML=ico('chart')+'Analytics';b.style.margin='0 4px 6px';$('bCloseAll').parentNode.insertBefore(b,$('bCloseAll'));b.addEventListener('click',function(){openAnalytics()});
  var s2=document.createElement('button');s2.className='btn';s2.innerHTML=ico('check')+'Summary';s2.style.margin='0 4px 6px';$('bCloseAll').parentNode.insertBefore(s2,$('bCloseAll'));s2.addEventListener('click',function(){sessionSummary()})})();

/* ---------- trade notes + mistake tags (from the history table) ---------- */
function noteDialog(id){var t=S.trades.filter(function(x){return x.id===id})[0];if(!t)return;fixTags(t);var tags=(t.tags||[]).slice(),m=document.createElement('div');m.className='modal';
  m.innerHTML='<div class="box nbox"><div class="dhead"><b>'+(t.side>0?'Long':'Short')+' '+t.qty+' · '+fmtWall(t.openT,SET.tz)+' · <span class="'+cls(t.pnl)+'">'+money(t.pnl,1)+'</span></b><span class="hsp"></span><button class="hb" data-x="1">'+ico('x')+'</button></div>'+
    '<div class="pbody"><img id="nImg" class="nimg hide"><label class="f">Notes: why I entered, what I saw, what I’d do differently<textarea id="nTxt" rows="4">'+esc(t.note||'')+'</textarea></label>'+
    '<div><span class="glbl">Mistakes</span><div class="ntags">'+MISTAKES.map(function(k){return'<button class="'+(tags.indexOf(k)>=0?'on':'')+'" data-tg="'+esc(k)+'">'+esc(k)+'</button>'}).join('')+'</div></div>'+
    (t.mae!=null&&R0(t)?'<p class="dim">MAE '+(t.mae/R0(t)).toFixed(2)+'R · MFE '+(t.mfe/R0(t)).toFixed(2)+'R · duration '+dur(t.closeT-t.openT)+'</p>':'')+'</div>'+
    '<div class="dfoot"><button class="btn" data-x="1">Cancel</button><button class="btn ok" data-ok="1">Save</button></div></div>';
  document.body.appendChild(m);imgGet(S.id+':'+t.id).then(function(u){if(u){var im=m.querySelector('#nImg');im.src=u;im.classList.remove('hide')}}).catch(function(){});
  m.addEventListener('keydown',function(e){e.stopPropagation()});
  m.addEventListener('click',function(e){var b=e.target.closest('[data-tg],[data-x],[data-ok]');if(e.target===m){m.remove();return}if(!b)return;
    if(b.dataset.tg){var k=b.dataset.tg,i=tags.indexOf(k);if(i>=0)tags.splice(i,1);else tags.push(k);b.classList.toggle('on');return}
    if(b.dataset.ok){t.note=m.querySelector('#nTxt').value.trim();t.tags=tags;bottom._k=null;changed();toast('Notes saved')}m.remove()})}
// a note button in every history row
var _bottom=G.bottom;G.bottom=function(){_bottom.apply(this,arguments);if(BT!=='hist'||!S)return;var rows=$('bbody').querySelectorAll('tr');var T=S.trades.slice().reverse();
  rows.forEach(function(r,i){if(!i)return;var t=T[i-1];if(!t||r.querySelector('[data-note]'))return;var td=r.lastElementChild;td.insertAdjacentHTML('beforeend','<button class="mini'+(t.note||(t.tags&&t.tags.length)?' on':'')+'" data-note="'+t.id+'" title="Notes and mistakes">'+ico('book')+'</button>')})};

/* ---------- session summary ---------- */
function sessionSummary(){if(!S)return;var T=S.trades,K=kpis(T,S.bal0),m=document.createElement('div');m.className='modal';
  var bestT=T.slice().sort(function(a,b){return b.pnl-a.pnl})[0],worstT=T.slice().sort(function(a,b){return a.pnl-b.pnl})[0],tg={};T.forEach(function(t){(t.tags||[]).forEach(function(k){tg[k]=(tg[k]||0)+t.pnl})});
  var mk=Object.keys(tg).sort(function(a,b){return tg[a]-tg[b]})[0];
  m.innerHTML='<div class="box sumb"><div class="dhead"><b>Session summary · '+esc(cleanName(S.name))+'</b><span class="hsp"></span><button class="hb" data-x="1">'+ico('x')+'</button></div><div class="pbody">'+
    (T.length?'<div class="sumhero"><div><small>Net</small><b class="'+cls(K.net)+'">'+money(K.net,1)+'</b></div><div><small>Total R</small><b class="'+cls(K.totR)+'">'+(K.totR>=0?'+':'')+K.totR.toFixed(1)+'R</b></div><div><small>Win rate</small><b>'+K.wr.toFixed(0)+' %</b></div><div><small>Trades</small><b>'+K.n+'</b></div></div>'+
      eqSvg(K.eq,600,110)+
      '<ul class="sumli"><li>Best trade: <b class="pos">'+money(bestT.pnl,1)+'</b> ('+fmtWall(bestT.openT,SET.tz)+')</li><li>Worst trade: <b class="neg">'+money(worstT.pnl,1)+'</b> ('+fmtWall(worstT.openT,SET.tz)+')</li>'+
      '<li>Max drawdown: <b class="neg">'+money(-K.mdd)+'</b> · loss streak: <b>'+K.bl+'</b></li>'+(mk?'<li>Most expensive mistake: <b>'+esc(mk)+'</b> ('+money(tg[mk],1)+')</li>':'<li>No mistakes tagged. In History click the note on a trade.</li>')+
      (S.ch?'<li>Challenge: <b>'+(S.ch.status==='passed'?'passed':S.ch.status==='failed'?'failed ('+esc(S.ch.reason||'')+')':'in progress')+'</b></li>':'')+'</ul>'
    :'<p class="dim">No closed trades in this session yet.</p>')+'</div><div class="dfoot"><button class="btn" data-an="1">'+ico('chart')+'Analytics</button><button class="btn" data-fj="1">'+ico('send')+'Send to Funded Journal</button><button class="btn ok" data-x="1">Close</button></div></div>';
  document.body.appendChild(m);m.addEventListener('click',function(e){var b=e.target.closest('[data-x],[data-an],[data-fj]');if(e.target===m){m.remove();return}if(!b)return;if(b.dataset.an){m.remove();openAnalytics();return}if(b.dataset.fj){toJournal(S.trades);return}m.remove()})}
G.sessionSummary=sessionSummary;

/* ---------- export to Funded Journal (same file:// storage): its own "Backtest" account, nothing else is touched ---------- */
function toJournal(T){if(!T.length){toast('No trades to export');return}
  uiConfirm('Send '+T.length+' trades to Funded Journal? They go to a separate account "Backtest · MNQ Replay", your real accounts stay untouched. Sending the same session again only updates the trades.','Send').then(function(ok){if(!ok)return;
    var rq=indexedDB.open('funded-journal',1);rq.onupgradeneeded=function(){rq.result.createObjectStore('docs');rq.result.createObjectStore('blobs')};
    rq.onerror=function(){toast('Couldn’t open the Funded Journal storage')};
    rq.onsuccess=function(){var db=rq.result,now=Date.now(),acc='bt-mnqreplay',jobs=[];
      var put=function(store,key,val){return new Promise(function(res,rej){var tx=db.transaction(store,'readwrite');tx.objectStore(store).put(val,key);tx.oncomplete=res;tx.onerror=function(){rej(tx.error)}})};
      jobs.push(put('docs','accounts/'+acc,{name:'Backtest · MNQ Replay',firm:'MNQ Replay',phase:'Personal',size:S.bal0||50000,currency:'USD',riskPct:0.5,defaultRR:2,targetPct:0,maxDDPct:0,maxDailyPct:0,createdAt:now}));
      var gmap={'A+++':'A+','A+':'A+','A':'A','B+':'B+','B':'B'};
      Promise.all(T.map(function(t){var d=nyH(t.openT),hh=d.getUTCHours(),setup=t.setup&&setupById(t.setup),sid=(t.sid||S.id);
        var doc={date:d.toISOString().slice(0,10),time:p2(hh)+':'+p2(d.getUTCMinutes()),symbol:instName(),direction:t.side>0?'long':'short',session:hh>=18||hh<3?'Asia':hh<9?'London':'New York',setup:setup?setup.n:'',grade:gmap[t.grade]||'B',
          riskPct:t.sl0!=null?Math.round(Math.abs(t.entry-t.sl0)*t.qty*S.pv/S.bal0*10000)/100:0,rr:t.tp!=null&&t.sl0!=null&&t.entry!==t.sl0?Math.round(Math.abs(t.tp-t.entry)/Math.abs(t.entry-t.sl0)*100)/100:0,
          result:t.pnl>0?'win':t.pnl<0?'loss':'be',r:t.r!=null?Math.round(t.r*100)/100:0,pnl:Math.round(t.pnl*100)/100,followedPlan:!(t.tags&&t.tags.length),reason:t.note||'',lesson:'',
          notes:'Backtest v MNQ Replay · '+cleanName(S.name)+' · '+t.qty+' contr. · entry '+fp(t.entry)+' → exit '+fp(t.exit)+' ('+t.reason+')',mistakes:(fixTags(t).tags||[]).filter(function(x){return MISTAKES.indexOf(x)>=0}).map(function(x){return EN_TAG[x]||x}),confluences:[],ttype:'',accountId:acc,images:[],createdAt:t.rt||now,updatedAt:now};
        var key='bt-'+sid+'-'+String(t.id).replace(/[^\w-]/g,'');
        return imgGet(S.id+':'+t.id).then(function(u){if(!u)return null;return fetch(u).then(function(r){return r.blob()}).then(function(b){var bid='loc_'+key;return put('blobs',bid,b).then(function(){doc.images=[{id:bid,caption:'Chart from MNQ Replay'}]})})}).catch(function(){}).then(function(){return put('docs','trades/'+key,doc)})}).concat(jobs))
      .then(function(){db.close();toast('Sent to Funded Journal: '+T.length+' trades. Open the journal and pick the account Backtest · MNQ Replay.')},function(e){db.close();toast('Sending failed: '+(e&&e.message||e))})}})}
G.toJournal=toJournal;
/* sessions saved before the English UI keep Slovenian exit reasons: show them in English */
(function(){var RS={'Delno':'Partial','Ročno':'Manual','Obrnjeno':'Reversed','Pravilo':'Rule','Dnevni limit':'Daily limit'};
var _open=G.openSession;G.openSession=function(s){try{(s&&s.trades||[]).forEach(function(t){if(RS[t.reason])t.reason=RS[t.reason];fixTags(t)})}catch(e){}return _open.apply(this,arguments)}})();
})();

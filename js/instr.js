/* MNQ Replay v2 — instruments: Nasdaq (MNQ/NQ, data/) and S&P 500 (MES/ES, data/es/). */
(function(){
'use strict';
var G=window,NQD=G.MNQ;
G.MES={idx:null,data:{},index:function(o){this.idx=o},add:function(tf,m,rows){(this.data[tf]=this.data[tf]||{})[m]=rows}};
var DS={nq:NQD,es:G.MES},SYM='nq',idxP={};
function symOfPv(pv){return pv===5||pv===50?'es':'nq'}
function ensureIdx(sym){if(DS[sym].idx)return Promise.resolve();if(!idxP[sym])idxP[sym]=loadScript(sym==='es'?'data/es/index.js':'data/index.js').catch(function(){idxP[sym]=null;throw new Error('no data')});return idxP[sym]}
function setSym(sym){if(SYM===sym&&G.MNQ===DS[sym])return;SYM=sym;G.MNQ=DS[sym];CACHE={}}
G.setSym=setSym;G.ensureIdx=ensureIdx;
G.fileFor=function(tf,m){var pre=G.MNQ===G.MES?'data/es/':'data/';return m==='all'?pre+tf+'.js':m==='dall'?pre+tf+'_old.js':pre+tf+'/'+m+'.js'};
G.instName=function(){var pv=S&&S.pv;return pv===20?'NQ':pv===5?'MES':pv===50?'ES':'MNQ'};
function homeSym(){return lsGet('mnqr-sym','nq')}
var _open=G.openSession;G.openSession=function(s){var sym=s.sym||symOfPv(s.pv);s.sym=sym;return ensureIdx(sym).then(function(){setSym(sym);return _open(s)},function(){toast('No '+(sym==='es'?'S&P 500 (MES/ES)':'Nasdaq')+' data yet');return null})};
var _new=G.newSession;G.newSession=function(){var sym=symOfPv(+$('nInst').value);ensureIdx(sym).then(function(){setSym(sym);_new()},function(){toast('No S&P 500 data yet. Run the data update.')})};
$('bCreate').replaceWith($('bCreate').cloneNode(true));$('bCreate').addEventListener('click',function(){G.newSession()});
var _qr=G.quickRandom;G.quickRandom=function(tries){var sym=homeSym();ensureIdx(sym).then(function(){setSym(sym);_qr(tries)},function(){toast('No data for this instrument yet')})};
// the random/daily sessions get the right point value for the chosen instrument
var _tr=G.startDay;G.startDay=function(y,m,d,hh,mm,name){var sym=homeSym();ensureIdx(sym).then(function(){setSym(sym);_tr(y,m,d,hh,mm,name)})};
// session dialog: more instruments
(function(){var sel=$('nInst');if(sel&&!sel.querySelector('option[value="5"]'))sel.insertAdjacentHTML('beforeend','<option value="5">MES · $5 / point (S&amp;P 500)</option><option value="50">ES · $50 / point (S&amp;P 500)</option>');
  sel.addEventListener('change',function(){var sym=symOfPv(+this.value);ensureIdx(sym).then(function(){setSym(sym);renderSessions()},function(){toast('No S&P 500 data yet')})})})();
// legend: the Dukascopy era is NAS100 or SPX500
var _leg=G.legend;G.legend=function(){_leg.apply(this,arguments);if(G.MNQ===G.MES){var e=$('legend');e.innerHTML=e.innerHTML.replace('NAS100→MNQ','SPX500→MES').replace('Nasdaq-100 1m (Dukascopy), shifted to the MNQ price','S&amp;P 500 1m (Dukascopy), shifted to the MES price')}};
// start page: instrument switch for random day / daily challenge
var _rh=G.renderHome;G.renderHome=function(){_rh.apply(this,arguments);var nav=document.querySelector('.hnav .hsp');if(!nav)return;var s=homeSym();
  nav.insertAdjacentHTML('afterend','<div class="hfilt hsym" title="Instrument for random day and daily challenge"><button data-sym="nq" class="'+(s==='nq'?'on':'')+'">MNQ</button><button data-sym="es" class="'+(s==='es'?'on':'')+'">MES</button></div>')};
$('home').addEventListener('click',function(e){var b=e.target.closest('[data-sym]');if(!b)return;lsSet('mnqr-sym',b.dataset.sym);ensureIdx(b.dataset.sym).then(function(){setSym(b.dataset.sym);renderHome()},function(){lsSet('mnqr-sym','nq');toast('No S&P 500 data yet');renderHome()})});
})();

let toastTimer=0, hudKey='', greenHudKey='';
function say(msg,ms){ const t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('on'),ms||1000); }
function hintText(L){
 if(state==='warp') return '휘익! 행성을 곧장 가로질러요!';
 if(state!=='play') return '';
 if(sink&&sink.phase!=='close') return '앞에 싱크홀! 방향을 돌리거나 행성 반대편으로 떨어지세요!';
 if(fright>0) return '박쥐가 겁먹었어요 — 잡으세요! '+Math.ceil(fright)+'초';
 if(boostT>0) return '베리 가속! '+Math.ceil(boostT)+'초';
 if(berry) return '하늘 베리가 익었어요 — 자주색 화살표를 따라가세요';
 if(L<0.35&&bats.some(g=>g.home===player.t&&(g.mode==='live'||g.mode==='wait')&&!g.asleep)) return '밤의 박쥐 섬: 빛나는 눈을 조심하세요';
 if(dotsLeft<=CFG.radar) return '남은 마지막 거품을 향한 금색 화살표를 따라가세요';
 if(waypoint>=0) return '분홍 화살표를 따라 '+tiles[waypoint].num+'번 섬으로';
 if(tiles[player.t].left===0) return '섬 완료! 금색 화살표가 다음 거품을 가리켜요';
 if(holeNeighbors().some(n=>lightSlot(n.c,n.r)>=CFG.slideLight)) return PAD.idx>=0?'LB/RB로 섬을 고르고 A로 밀기':'빛나는 섬(또는 지도)을 탭해서 밀기';
 return '섬은 햇빛을 받을 때만 움직여요 — 해가 뜰 때까지 기다리세요';
}
function greenHud(){
 if(state!=='play'&&state!=='warp'&&state!=='clear'&&state!=='dying') return;
 const g=ecologyCount(ecologyState), pct=planetGreenPercent(g,initialGreenTarget);
 const key=g+'|'+pct+'|'+initialGreenTarget;
 if(key===greenHudKey) return; greenHudKey=key;
 const ring=$('greenGoal'), el=$('greenPct');
 if(!ring||!el) return;
 const label=formatGreenPercent(pct);
 el.textContent=label;
 ring.style.setProperty('--green-pct',String(pct));
 ring.setAttribute('aria-valuenow',String(pct));
 ring.setAttribute('aria-valuetext',label+' 행성 초록');
}
function hud(){
 const w=actorWorld(player), L=lightAt(w[0],w[1]);
 const lab=L>0.6?'낮':L>0.2?'황혼':'밤', home=tiles.filter(isHome).length;
 const key=[score,level,dotsLeft,lives,lab,home,state,hintText(L)].join('|');
 if(key===hudKey) greenHud();
 else{
 hudKey=key;
 $('score').textContent=score; $('level').textContent=level; $('left').textContent=dotsLeft; $('home').textContent=home+'/15';
 $('lives').textContent=lives<=5?'●'.repeat(Math.max(0,lives)):'●×'+lives;
 const chip=$('chip'); chip.textContent=lab; chip.style.color=L>0.6?'#ffd25e':L>0.2?'#ff9a6a':'#8f9cff';
 $('hint').textContent=hintText(L);
 greenHud();
 }
}

function slotDist(a,b){ const dc=Math.abs(a.c-b.c); return Math.min(dc,COLS-dc)+Math.abs(a.r-b.r); }
function newLevel(){
  if(!ecologyState) ecologyState=createEcologyState(); else clearEcology(ecologyState);
  if(typeof resetTileBatches==='function') resetTileBatches();
  tiles=[]; for(let i=0;i<NT;i++) tiles.push(makeTile(i));
  slotGrid=[...Array(ROWS)].map(()=>Array(COLS).fill(-1));
  let k=0; for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ if(r===3&&c===3) continue; slotGrid[r][c]=k; tiles[k].slot={c,r}; k++; }
  let last=-1;
  for(let i=0;i<70+level*10;i++){ const opts=holeNeighbors().filter(n=>slotGrid[n.r][n.c]!==last); const n=opts[ri(opts.length)]; last=slotGrid[n.r][n.c]; slideInstant(n.c,n.r); }
  for(const T of tiles) T.homeAwarded=isHome(T);
  aligned=tiles.every(isHome);
  const p=Math.min(CFG.moteMax,CFG.moteBase+CFG.moteStep*(level-1));
  for(const T of tiles) for(let i=0;i<N;i++) T.dots[i]=Math.random()<p?1:0;
  let ss={c:1,r:1}; if(slotGrid[1][1]<0) ss={c:2,r:1};
  startTile=slotGrid[ss.r][ss.c];
  const startSlot=tiles[startTile].slot;
  const cand=[]; for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ const id=slotGrid[r][c]; if(id>=0&&id!==startTile) cand.push({c,r,id}); }
  const nb=Math.min(CFG.maxBats,3+level,cand.length), chosen=[];
  while(chosen.length<nb){
    let bestS=null,bs=-1;
    for(const s of cand){ if(chosen.includes(s)) continue; let m=slotDist(s,startSlot); for(const ch of chosen) m=Math.min(m,slotDist(s,ch)); m+=Math.random()*0.6; if(m>bs){bs=m;bestS=s;} }
    chosen.push(bestS);
  }
  bats=chosen.map((s,i)=>({a:mkActor(s.id,3,1),type:i%4,idx:i,home:s.id,mode:'wait',timer:1.6+i*1.1,dir:-1,asleep:false}));
  player=mkActor(startTile,3,2);
  tiles[startTile].dots[2*TW+3]=0;
  for(const g of bats) tiles[g.home].dots[1*TW+3]=0;
  const pool=tiles.filter(T=>T.id!==startTile);
  for(let i=0;i<CFG.sunstones;i++){ const T=pool.splice(ri(pool.length),1)[0]; T.dots[ri(N)]=2; }
  dotsLeft=0; initialGreenTarget=0;
  let bubbleDots=0;
  for(const T of tiles) for(let i=0;i<N;i++){
    if(T.dots[i]===1){ initialGreenTarget++; bubbleDots++; }
    if(T.dots[i]) dotsLeft++;
  }
  sectorPar=computeParMoves(level,tiles,bubbleDots);
  planetGreenCelebrated=false;
  runMoves=0;
  for(const T of tiles){ T.left=T.dots.reduce((a,v)=>a+(v?1:0),0); if(!T.left){ T.cleared=true; T.clearedAt=-99; } }
  sink=null; sinkTimer=12+Math.random()*6; exitFx=null;
  berry=null; berryTimer=16+Math.random()*10; waypoint=-1; combo=0; comboT=9; boostT=0; deaths=0;
  const w=actorWorld(player); sunLon=mod(gx2lon(w[0])+0.35,TAU); camLon=gx2lon(w[0]); camLat=gy2lat(w[1]);
  want=-1; fright=0; chain=0; cooldown=0;
  if(typeof frog!=='undefined') frog.yaw=Math.PI;
  for(const T of tiles) buildTileRender(T);
}
function resetActors(){
  player=mkActor(startTile,3,2); frog.yaw=Math.PI;
  bats.forEach((g,i)=>{ g.a=mkActor(g.home,3,1); g.mode='wait'; g.timer=1.4+i*0.9; g.dir=-1; });
  want=-1; fright=0; chain=0;
}
function addScore(n){
  score+=n;
  if(score>=nextLife){ nextLife+=CFG.lifeEvery; lives++; SFX.life(); say('목숨 +1!',1200); }
}
function playerCell(){ const a=player; return a.moving?{t:a.nt,x:a.nx,y:a.ny}:{t:a.t,x:a.x,y:a.y}; }
function eatAt(t,x,y){
  checkBerry(t,x,y);
  const T=tiles[t], i=y*TW+x, v=T.dots[i]; if(!v) return;
  T.dots[i]=0; dotsLeft--; T.left--;
  const mult=isHome(T)?2:1, pos=cellWorld(t,x,y,0.035);
  if(v===1){
    markBubbleCollected(ecologyState,t,x,y,gameClock);
    if(typeof syncAmbientGreen==='function') syncAmbientGreen();
    maybeCelebratePlanetGreen();
    combo=comboT<CFG.comboWin?combo+1:1; comboT=0;
    haptics.bubbleCollect();
    addScore((10+Math.min(20,(combo-1)*2))*mult); SFX.pop(combo-1); emit(pos,10,PC.bubble,0.2,0.007,0.45,0.25);
    if(combo>=5&&combo%5===0){ floatAt(pos,'콤보 ×'+combo,'#7fe8ff'); if(combo%20===0) say('콤보 ×'+combo+'!',900); }
  }
  else {
    rumble(160,0.2,0.6); addScore(50*mult); fright=Math.max(CFG.frightMin,CFG.frightBase-0.4*(level-1)); chain=0;
    SFX.sun(); emit(pos,34,PC.gold,0.32,0.01,0.95,0.15); say('햇살 돌! 박쥐를 쫓아가세요',1300);
  }
  if(mult>1) floatAt(pos,'×2','#ffd25e');
  if(!T.cleared&&!T.dots.some(v=>v)) islandCleared(T);
  frog.tongueT=0.16; frog.tongueLen=clamp(frog.root.position.distanceTo(pos)-0.02,0.01,0.12);
}
function islandCleared(T){
  T.cleared=true; T.clearedAt=gameClock; T.left=0; if(waypoint===T.id) waypoint=-1;
  const bonus=300+50*level; addScore(bonus); SFX.bloom();
  const bat=bats.find(g=>g.home===T.id&&g.mode!=='gone');
  if(bat){ bat.mode='gone'; bat.goneT=0; }
  if(dotsLeft>0) say('섬 '+T.num+' 클리어! 꽃이 피었어요'+(bat?' 그리고 박쥐가 날아갔어요':''),1800);
  const p=tilePos(T); frameAt(p.x+TW/2,p.y+TH/2); const c=_R.clone().multiplyScalar(1.03);
  floatAt(c,'+'+bonus,'#ffb3d9');
  for(let k=0;k<10;k++){ frameAt(p.x+0.5+Math.random()*(TW-1),p.y+0.5+Math.random()*(TH-1)); emit(_R.clone().multiplyScalar(1.02),6,PC.petal,0.16,0.012,1.2,0.1,1.0); }
}
function spawnBerry(){
  const c=tiles.filter(T=>!T.cleared&&!T.anim&&T.id!==player.t);
  if(!c.length){ berryTimer=10; return; }
  const T=c[ri(c.length)], cell=ri(N);
  berry={t:T.id,x:cell%TW,y:(cell/TW)|0,ttl:CFG.berryTTL};
  say('섬 '+T.num+'에 하늘 열매가 익었어요!',1600); SFX.berry();
}
function checkBerry(t,x,y){
  if(!berry||berry.t!==t||berry.x!==x||berry.y!==y) return;
  const pts=500+100*(level-1), pos=cellWorld(t,x,y,0.05);
  addScore(pts); boostT=CFG.boostT; SFX.berry(); emit(pos,40,PC.berry,0.3,0.012,1.0,0.1); floatAt(pos,'+'+pts+' 스피드!','#ff8fe6');
  berry=null; berryTimer=CFG.berryEvery[0]+Math.random()*(CFG.berryEvery[1]-CFG.berryEvery[0]);
}
function spawnSink(){
  const a=player;
  if(!a.moving||a.dir<0){ sinkTimer=1.5; return; }
  let c={t:a.nt,x:a.nx,y:a.ny}; const path=[];
  for(let i=0;i<4;i++){ const n=nbr(c.t,c.x,c.y,a.dir); if(!n) break; c=n; path.push(n); }
  if(path.length<3){ sinkTimer=1.2; return; }
  const tg=path[Math.min(path.length-1,2+ri(2))];
  if(tiles[tg.t].dots[tg.y*TW+tg.x]===2||(berry&&berry.t===tg.t&&berry.x===tg.x&&berry.y===tg.y)){ sinkTimer=1; return; }
  sink={t:tg.t,x:tg.x,y:tg.y,phase:'warn',timer:CFG.sinkWarn,open:0};
  SFX.rumble(); say('싱크홀! 피하세요!',900); shakeT=Math.max(shakeT,0.15);
}
function antipode(){
  const w=actorWorld(player), gx=mod(Math.floor(w[0])+GW/2,GW), gy=GH-1-Math.floor(w[1]);
  let c=Math.floor(gx/TW), r=Math.floor(gy/TH), lx=gx-c*TW, ly=gy-r*TH;
  if(slotGrid[r][c]<0){ c=(c+1)%COLS; lx=0; }
  return {t:slotGrid[r][c],x:lx,y:ly};
}
function startWarp(){
  rumble(300,0.4,0.9);
  state='warp'; warpT=0; warped=false; warpDest=antipode(); combo=0; want=-1;
  sink.phase='close'; sink.timer=0.6; SFX.fall(); shakeT=Math.max(shakeT,0.25);
  emit(actorPos(player,0.01),24,PC.warp,0.12,0.012,0.7,0.6,-0.4);
}
function updateSink(dt){
  if(!sink){ if((sinkTimer-=dt)<=0) spawnSink(); return; }
  sink.timer-=dt;
  if(sink.phase==='warn'){ sink.open=0; if(sink.timer<=0){ sink.phase='open'; sink.timer=CFG.sinkOpen; SFX.whoosh(); } }
  else if(sink.phase==='open'){ sink.open=Math.min(1,sink.open+dt*6); if(sink.timer<=0){ sink.phase='close'; sink.timer=0.5; } }
  else { sink.open=Math.max(0,sink.timer/0.5); if(sink.timer<=0){ sink=null; sinkTimer=CFG.sinkEvery[0]+Math.random()*(CFG.sinkEvery[1]-CFG.sinkEvery[0]); return; } }
  if(sink.phase==='open'&&sink.open>0.5){
    const a=player, at=(t,x,y)=>t===sink.t&&x===sink.x&&y===sink.y;
    if((!a.moving&&at(a.t,a.x,a.y))||(a.moving&&a.prog>0.55&&at(a.nt,a.nx,a.ny))||(a.moving&&a.prog<0.3&&at(a.t,a.x,a.y))) startWarp();
  }
}
function updateWarp(dt){
  warpT+=dt;
  if(!warped&&warpT>=0.55){
    warped=true; player=mkActor(warpDest.t,warpDest.x,warpDest.y); exitFx={t:warpDest.t,x:warpDest.x,y:warpDest.y,age:0};
    SFX.boing(); const pos=actorPos(player,0.02); emit(pos,40,PC.warp,0.35,0.012,1.0,0.5,1.4); floatAt(pos,'휙!','#d6b3ff');
  }
  if(warpT>=1.5){ state='play'; invuln=Math.max(invuln,1.2); eatAt(player.t,player.x,player.y); }
}
function playerChoose(a){
  if(want>=0&&nbr(a.t,a.x,a.y,want)) return want;          // buffered turn
  if(a.dir>=0&&nbr(a.t,a.x,a.y,a.dir)) return a.dir;       // keep going
  return -1;
}
function updatePlayer(dt){
  const a=player;
  if(a.moving&&want>=0&&want===((a.dir+2)&3)){
    const t=a.t,x=a.x,y=a.y; a.t=a.nt;a.x=a.nx;a.y=a.ny;a.nt=t;a.nx=x;a.ny=y; a.prog=1-a.prog; a.dir=want;
  }
  stepActor(a,dt,CFG.pSpeed*(boostT>0?CFG.boostMul:1),playerChoose,b=>eatAt(b.t,b.x,b.y));
  if(a.moving&&a.prog>0.45) eatAt(a.nt,a.nx,a.ny);       // tongue snaps the bubble ahead
}
function batSpeed(g){
  if(fright>0) return CFG.batScared;
  const w=actorWorld(g.a); return lerp(CFG.batNight,CFG.batDay,lightAt(w[0],w[1]))+CFG.batLvl*(level-1);
}
function batChoose(g){
  const a=g.a, opts=[];
  for(let d=0;d<4;d++) if(nbrLocal(a.t,a.x,a.y,d)) opts.push(d);
  if(!opts.length) return -1;
  const rev=(g.dir+2)&3; let cand=opts.filter(d=>d!==rev); if(!cand.length) cand=opts;
  let d=-1; const pc=playerCell();
  if(pc.t===a.t){
    if(fright>0){
      let bd=-1; for(const o of cand){ const n=nbrLocal(a.t,a.x,a.y,o); const dd=Math.abs(n.x-pc.x)+Math.abs(n.y-pc.y); if(dd>bd){bd=dd;d=o;} }
    } else {
      let tgt=pc;
      if(g.type===1){ let c=tgt; for(let i=0;i<3&&player.dir>=0;i++){ const n=nbrLocal(c.t,c.x,c.y,player.dir); if(!n) break; c=n; } tgt=c; }
      bfs(a,idx(tgt),true); d=bDir;
      if(g.type===2&&bDist>6) d=-1;
      if(g.type===3&&bDist<=2) d=-1;
    }
  }
  if(d<0||!opts.includes(d)) d=cand[ri(cand.length)];
  g.dir=d; return d;
}
function updateBats(dt){
  const pw=actorWorld(player);
  for(const g of bats){
    if(g.mode==='wait'){
      g.timer-=dt;
      if(g.timer<=0){ const w=actorWorld(g.a), dx=wrapD(w[0]-pw[0]), dy=w[1]-pw[1]; if(dx*dx+dy*dy<2.5) g.timer=0.5; else g.mode='live'; }
      continue;
    }
    if(g.mode==='dead'){ g.timer-=dt; if(g.timer<=0){ if(tiles[g.home].cleared){ g.mode='gone'; g.goneT=9; } else { g.a=mkActor(g.home,3,1); g.mode='wait'; g.timer=1.2; g.dir=-1; } } continue; }
    if(g.mode==='gone'){ g.goneT+=dt; continue; }
    if(g.asleep&&!g.a.moving) continue;
    stepActor(g.a,dt,batSpeed(g),()=>g.asleep?-1:batChoose(g),null);
  }
}
function collide(){
  if(invuln>0) return;
  const pw=actorWorld(player);
  for(const g of bats){
    if(g.mode!=='live'||g.asleep) continue;
    const w=actorWorld(g.a), dx=wrapD(w[0]-pw[0]), dy=w[1]-pw[1];
    if(dx*dx+dy*dy<0.36){
      if(fright>0){
        chain++; const pts=100*(1<<chain); addScore(pts); g.mode='dead'; g.timer=4; SFX.batEat();
        const pos=actorPos(g.a,0.05); emit(pos,28,PC.bat,0.17,0.013,0.9,-0.04); floatAt(pos,'+'+pts,'#d4c2ff');
      } else { die(); return; }
    }
  }
}
function gamepadRumble(ms,strong,weak){
  try{ const gp=PAD.idx>=0&&navigator.getGamepads?navigator.getGamepads()[PAD.idx]:null, va=gp&&gp.vibrationActuator;
    if(va&&va.playEffect) va.playEffect('dual-rumble',{duration:ms,strongMagnitude:strong,weakMagnitude:weak}).catch(()=>{});
  }catch(e){}
}
function rumble(ms,strong,weak){
  gamepadRumble(ms,strong,weak);
  try{
    if(navigator.vibrate&&matchMedia('(pointer:coarse)').matches) navigator.vibrate(Math.round(ms*0.6));
  }catch(e){}
}
function die(){
  rumble(450,0.9,0.5);
  state='dying'; dyingT=1.4; SFX.die(); deaths++; shakeT=0.35; combo=0; boostT=0;
  emit(actorPos(player,0.03),30,PC.teal,0.2,0.01,0.9,0.1);
}
function slideBlocked(T){
  for(const a of [player,...bats.map(g=>g.a)]) if(a.moving&&a.t!==a.nt&&(a.t===T.id||a.nt===T.id)) return true;
  return false;
}
function trySlide(c,r){
  if(state!=='play'||paused) return '';
  if(sink&&sink.t===slotGrid[r][c]) return '그 자리는 싱크홀이 열려 있어 안 돼요';
  const id=slotGrid[r][c]; if(id<0) return '';
  const h=findHole(); if(!holeNeighbors().some(n=>n.c===c&&n.r===r)) return '이 섬은 빈 초원 옆에 없어요';
  if(tiles.some(t=>t.anim)||cooldown>0) return '';
  if(lightSlot(c,r)<CFG.slideLight) return '너무 어두워요 — 섬은 햇빛 아래서만 밀 수 있어요';
  const T=tiles[id]; if(slideBlocked(T)) return '잠깐만요 — 누군가 지나가고 있어요';
  let dc=h.c-c; if(dc>2) dc-=COLS; if(dc<-2) dc+=COLS;
  T.anim={t:0,fc:c,fr:r,dc,dr:h.r-r};
  slotGrid[h.r][h.c]=id; slotGrid[r][c]=-1; T.slot={c:h.c,r:h.r};
  runMoves++;
  SFX.slide(); refreshTiles();
  return '';
}
function onSlideEnd(T){
  refreshTiles(); SFX.thump(); dustAround(T); shakeT=Math.max(shakeT,0.2); gamepadRumble(90,0.5,0.2); haptics.tileLock();
  if(isHome(T)&&!T.homeAwarded){
    T.homeAwarded=true; addScore(250); SFX.home();
    const hasBat=bats.some(g=>g.home===T.id);
    say('섬 '+T.num+'이 제자리에 왔어요!'+(hasBat?' 박쥐가 잠들었어요':' 방울 점수 ×2'),1800);
    const p=tilePos(T); frameAt(p.x+TW/2,p.y+TH/2); const c=_R.clone().multiplyScalar(1.03);
    emit(c,60,PC.gold,0.35,0.012,1.4,-0.12,1.2); floatAt(c,'+250','#ffd25e');
  }
  if(!aligned&&tiles.every(isHome)){ aligned=true; addScore(3000); say('모든 섬이 제자리에! +3000',2400); SFX.clear(); }
}
function update(dt){
  gameClock+=dt;
  if(state==='play'||state==='warp'||state==='dying') runTimeMs+=dt*1000;
  sunLon=mod(sunLon-dt*TAU/dayLen(),TAU);
  shakeT=Math.max(0,shakeT-dt);
  cooldown=Math.max(0,cooldown-dt);
  for(const T of tiles) if(T.anim){ T.anim.t+=dt/slideSnapDurationSeconds(REDUCED); if(T.anim.t>=1){ T.anim=null; cooldown=CFG.slideCool; onSlideEnd(T); } }
  for(const g of bats) g.asleep=isHome(tiles[g.home]);
  if(state==='play'){
    if(readyT>0) readyT-=dt;
    else {
      if(tiles[player.t].cleared&&Math.random()<dt*0.45) SFX.buzz();
      invuln=Math.max(0,invuln-dt); comboT+=dt; boostT=Math.max(0,boostT-dt);
      if(berry){ berry.ttl-=dt; if(berry.ttl<=0){ berry=null; berryTimer=CFG.berryEvery[0]+Math.random()*10; } }
      else if((berryTimer-=dt)<=0) spawnBerry();
      updateSink(dt); if(state!=='play') return;
      if(waypoint>=0&&(player.t===waypoint||tiles[waypoint].cleared)){ if(player.t===waypoint) SFX.tick(); waypoint=-1; }
      if(fright>0){ fright-=dt; if(fright<=0){ fright=0; chain=0; } }
      updatePlayer(dt); updateBats(dt); collide();
      if(dotsLeft<=0&&state==='play') levelClear();
    }
  } else if(state==='warp'){
    updateWarp(dt); if(sink) updateSink(dt);
  } else if(state==='dying'){
    dyingT-=dt;
    if(dyingT<=0){ lives--; if(lives<=0) gameOver(); else { resetActors(); state='play'; readyT=1.0; invuln=2.5; say('준비',900); } }
  } else if(state==='clear'){
    clearT-=dt;
    if(Math.random()<dt*7){ const d=new THREE.Vector3(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize().multiplyScalar(1.12); emit(d,30,[PC.gold[0],PC.teal[0],PC.bubble[1]],0.3,0.013,1.1,0.05); }
    if(clearT<=0){
      if(typeof window.__ssHideClearStars==='function') window.__ssHideClearStars();
      level++; newLevel(); state='play'; readyT=1.6; invuln=2; zoomT=1; say('섹터 '+level,1300);
    }
  }
  updateCameraTarget(dt);
}
function maybeCelebratePlanetGreen(){
  if(planetGreenCelebrated||state!=='play'||initialGreenTarget<=0) return;
  if(!isPlanetFullyGreen(ecologyCount(ecologyState),initialGreenTarget)) return;
  planetGreenCelebrated=true;
  const goalEl=document.getElementById('greenGoal');
  if(goalEl){ goalEl.classList.add('celebrate'); setTimeout(()=>goalEl.classList.remove('celebrate'),REDUCED?0:1200); }
  if(REDUCED){ say('행성이 완전히 초록으로 물들었어요!',2200); SFX.bloom(); return; }
  say('행성이 완전히 초록으로 물들었어요!',2600); SFX.bloom(); SFX.clear();
  const pos=cellWorld(player.t,player.x,player.y,0.05);
  frameAt(pos.x,pos.y);
  for(let k=0;k<14;k++){
    emit(pos,10,PC.petal,0.22,0.01,1.1,0.12,0.6);
  }
  shakeT=Math.max(shakeT,0.12);
}
function levelClear(){
  maybeCelebratePlanetGreen();
  const stars=starsForMoves(runMoves,sectorPar);
  recordSectorStars(store,level,stars);
  if(typeof window.__ssShowClearStars==='function'){
    window.__ssShowClearStars({ sector: level, moves: runMoves, par: sectorPar, stars });
  }
  state='clear'; clearT=2.8; addScore(1000); if(!deaths) addScore(1000);
  say('섹터 클리어 · '+formatStarRow(stars)+' ('+runMoves+'수, 기준 '+sectorPar+'수)',2600); SFX.clear();
}
function gameOver(){
  state='over';
  if(score>scoreBest){ scoreBest=score; store.set('scoreBest',scoreBest); }
  $('res').innerHTML='점수 <b>'+score+'</b> &middot; 섹터 <b>'+level+'</b><br>최고 점수 <b>'+scoreBest+'</b>';
  $('tBlock').classList.add('hide'); $('oBlock').classList.remove('hide'); $('wBlock').classList.add('hide'); $('ov').classList.remove('hide');
}
function goTitle(){
  state='title'; paused=false;
  if(typeof refreshShadowMap==='function') refreshShadowMap();
  $('ov').classList.remove('hide');
  $('tBlock').classList.remove('hide');
  $('oBlock').classList.add('hide');
  $('wBlock').classList.add('hide');
  $('pause').classList.add('hide');
}
function startGame(){
  if(useBloom&&typeof ensurePostPipeline==='function') ensurePostPipeline();
  score=0; lives=3; level=1; nextLife=CFG.lifeEvery; runMoves=0; runTimeMs=0; deaths=0; newLevel();
  if(typeof window.__ssHideClearStars==='function') window.__ssHideClearStars();
  if(typeof window.__ssRefreshTitleStars==='function') window.__ssRefreshTitleStars();
  state='play'; readyT=1.6; invuln=2; zoomT=1; perfStart=performance.now();
  if(typeof refreshShadowMap==='function') refreshShadowMap();
  $('ov').classList.add('hide'); $('wBlock').classList.add('hide'); say('준비',1200); SFX.start();
  if(typeof syncAmbientGreen==='function') syncAmbientGreen();
}

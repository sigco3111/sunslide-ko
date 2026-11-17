const stageEl=$('stage'), glc=$('gl'), fxc=$('fx'), fctx=fxc.getContext('2d'), mapC=$('map'), mctx=mapC.getContext('2d');
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas:glc,antialias:true,powerPreference:'high-performance'}); }
catch(e){ window.__ssFail('이 브라우저는 Sunslide에 필요한 WebGL을 지원하지 않아요.'); throw e; }
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate=false;
const MAXANI=Math.min(8,renderer.capabilities.getMaxAnisotropy());
glc.addEventListener('webglcontextlost',e=>{ e.preventDefault(); if(state==='play') setPaused(true); say('브라우저가 그래픽을 초기화했어요 — 화질을 낮춥니다',2500); });
glc.addEventListener('webglcontextrestored',()=>{ qMode=Math.max(0,qLevel-1); qLevel=qMode; store.set('quality',qMode); location.reload(); });
const scene=new THREE.Scene(); scene.background=new THREE.Color('#04050d');
const camera=new THREE.PerspectiveCamera(50,1,0.02,200);
const U={time:{value:0},sun:{value:new THREE.Vector3(1,0,0)}};
const TAIL='\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
const v3=()=>new THREE.Vector3();
const _R=v3(),_E=v3(),_N=v3(),_F=v3(),_X=v3(),_P=v3(),_e1=v3(),_e2=v3(),_E2=v3(),_N2=v3(),_tA=v3(),_tB=v3(),_tC=v3(),_pA=v3(),_pB=v3(),_uA=v3(),_uB=v3();
const _M=new THREE.Matrix4(), _Q=new THREE.Quaternion(), _Q2=new THREE.Quaternion(), _Y=new THREE.Vector3(0,1,0), _S=v3();
function latLonFrame(lat,lon,R,E,Nn){ const cl=Math.cos(lat), sl=Math.sin(lat), co=Math.cos(lon), so=Math.sin(lon); R.set(cl*so,sl,cl*co); E.set(co,0,-so); Nn.set(-sl*so,cl,-sl*co); }
function frameAt(gx,gy){ latLonFrame(gy2lat(gy),gx2lon(gx),_R,_E,_N); }
function cellWorld(t,x,y,h){ const T=tiles[t], p=tilePos(T); frameAt(p.x+x+0.5,p.y+y+0.5); return _R.clone().multiplyScalar(1+h+liftOf(T)); }
function actorPos(a,h){ const w=actorWorld(a); frameAt(w[0],w[1]); return _R.clone().multiplyScalar(1+h+actorLift(a)); }
function poseObject(obj,gx,gy,height,yaw){
  frameAt(gx,gy); const c=Math.cos(yaw), s=Math.sin(yaw);
  _F.copy(_N).multiplyScalar(c).addScaledVector(_E,s); _X.crossVectors(_R,_F);
  _M.makeBasis(_X,_R,_F); obj.quaternion.setFromRotationMatrix(_M); obj.position.copy(_R).multiplyScalar(1+height);
}
function canvasTex(c){ const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=MAXANI; return t; }
function radial(stops,size=128){
  const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  const gr=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2); stops.forEach(s=>gr.addColorStop(s[0],s[1]));
  g.fillStyle=gr; g.fillRect(0,0,size,size); return canvasTex(c);
}
const TEX_GLOW=radial([[0,'rgba(255,255,255,1)'],[0.22,'rgba(255,255,255,.5)'],[1,'rgba(255,255,255,0)']]);
const additive=(map,color)=>new THREE.SpriteMaterial({map,color,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});

/* ---------- post-processing (lazy — see lazy-post.js + ensurePostPipeline) ---------- */

/* ---------- lights ---------- */
const sunL=new THREE.DirectionalLight('#fff0d9',3.3);
sunL.castShadow=true; sunL.shadow.mapSize.set(1024,1024);
{ const c=sunL.shadow.camera; c.left=SHADOW_FRUSTUM.left;c.right=SHADOW_FRUSTUM.right;c.top=SHADOW_FRUSTUM.top;c.bottom=SHADOW_FRUSTUM.bottom;c.near=SHADOW_FRUSTUM.near;c.far=SHADOW_FRUSTUM.far;c.updateProjectionMatrix(); }
sunL.shadow.bias=-0.0005; sunL.shadow.normalBias=0.004;
scene.add(sunL,sunL.target);
const moonL=new THREE.DirectionalLight('#8aa0ff',0.75); moonL.castShadow=false; scene.add(moonL,moonL.target);
const ambL=new THREE.AmbientLight('#7080c0',0.55); scene.add(ambL);

/* ---------- sky: stars, sun, moon, atmosphere ---------- */
const starMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time,uDpr:{value:1},uDay:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute float aS; attribute float aP; attribute vec3 aC; uniform float uTime; uniform float uDpr; varying vec3 vC; varying float vA;
    uniform float uDay; void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=aS*uDpr; vC=aC; vA=(0.55+0.45*sin(uTime*1.6+aP))*(1.0-0.97*uDay); }`,
  fragmentShader:`varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor=vec4(vC*vA*(1.0-r*r),1.0);`+TAIL+`}`});
{
  const n=2600, pos=new Float32Array(n*3), sz=new Float32Array(n), ph=new Float32Array(n), col=new Float32Array(n*3), c=new THREE.Color();
  for(let i=0;i<n;i++){
    const u=Math.random()*2-1, t=Math.random()*TAU, s=Math.sqrt(1-u*u), r=60;
    pos[i*3]=s*Math.cos(t)*r; pos[i*3+1]=u*r; pos[i*3+2]=s*Math.sin(t)*r;
    sz[i]=0.7+Math.pow(Math.random(),3)*2.8; ph[i]=Math.random()*TAU;
    c.setHSL(Math.random()<0.25?0.08:0.6,0.5,0.75).multiplyScalar(0.7+Math.random()*0.8); col.set([c.r,c.g,c.b],i*3);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('aS',new THREE.BufferAttribute(sz,1));
  g.setAttribute('aP',new THREE.BufferAttribute(ph,1)); g.setAttribute('aC',new THREE.BufferAttribute(col,3));
  const stars=new THREE.Points(g,starMat); stars.frustumCulled=false; scene.add(stars);
}
const skyMat=new THREE.ShaderMaterial({uniforms:{uDay:{value:0},uUp:{value:new THREE.Vector3(0,1,0)},uSun:U.sun},side:THREE.BackSide,depthWrite:false,
  vertexShader:`varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform float uDay; uniform vec3 uUp; uniform vec3 uSun; varying vec3 vD; void main(){
    float h=dot(vD,uUp);
    vec3 zen=vec3(0.0,0.13,0.62), hor=vec3(0.16,0.42,0.9);
    vec3 day=mix(hor,zen,smoothstep(-0.1,0.75,h));
    float sg=max(dot(vD,uSun),0.0); day+=vec3(1.0,0.85,0.6)*pow(sg,24.0)*0.6+vec3(0.9,0.75,0.6)*pow(1.0-abs(h),8.0)*0.08;
    vec3 night=mix(vec3(0.016,0.02,0.05),vec3(0.006,0.008,0.022),smoothstep(-0.1,0.8,h));
    gl_FragColor=vec4(mix(night,day,uDay),1.0);`+TAIL+`}`});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(90,48,24),skyMat); skyDome.renderOrder=-1; skyDome.frustumCulled=false; scene.add(skyDome);
let skyDay=0;
const sunGlow=new THREE.Sprite(additive(TEX_GLOW,new THREE.Color().setRGB(2.6,1.9,1.1))); sunGlow.scale.setScalar(18); scene.add(sunGlow);
const sunCore=new THREE.Sprite(additive(TEX_GLOW,new THREE.Color().setRGB(8,6.6,4.5))); sunCore.scale.setScalar(4); scene.add(sunCore);
const moon=new THREE.Mesh(new THREE.SphereGeometry(0.9,32,20),new THREE.MeshStandardMaterial({color:'#d8dded',roughness:1,emissive:'#2c3660',emissiveIntensity:0.9}));
scene.add(moon);
const atmo=new THREE.Mesh(new THREE.SphereGeometry(1.09,64,40),new THREE.ShaderMaterial({uniforms:{uSun:U.sun},
  side:THREE.BackSide,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,
  vertexShader:`varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normalMatrix*normal); vW=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){
    float i=pow(max(0.0,0.62-dot(vN,vec3(0.0,0.0,1.0))),4.0);
    float s=0.22+0.78*smoothstep(-0.35,0.45,dot(vW,uSun));
    gl_FragColor=vec4(vec3(0.22,0.48,1.0)*i*s*1.5,1.0);`+TAIL+`}`}));
scene.add(atmo);

/* ---------- meadow planet, grass blades, flowers, polar forest ---------- */
function meadowTexture(){
  const W=MEADOW_CANVAS.width,H=MEADOW_CANVAS.height,c=document.createElement('canvas'); c.width=W;c.height=H; const g=c.getContext('2d');
  g.fillStyle='#4a8c35'; g.fillRect(0,0,W,H);
  for(let i=0;i<520;i++){ const x=Math.random()*W,y=Math.random()*H,r=8+Math.random()*40, gr=g.createRadialGradient(x,y,0,x,y,r), l=Math.random()<0.5;
    gr.addColorStop(0,l?'rgba(160,210,90,0.2)':'rgba(15,55,15,0.22)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(x-r,y-r,2*r,2*r); }
  for(let i=0;i<15000;i++){ g.fillStyle=Math.random()<0.5?'rgba(190,230,120,.16)':'rgba(10,40,10,.2)'; g.fillRect(Math.random()*W,Math.random()*H,1,2+Math.random()*3); }
  const fc=['#fff8e8','#ffe066','#ff9ec4','#c9a8ff'];
  for(let i=0;i<1400;i++){ g.fillStyle=fc[ri(4)]; g.beginPath(); g.arc(Math.random()*W,Math.random()*H,0.8+Math.random()*1.2,0,TAU); g.fill(); }
  const t=canvasTex(c); t.wrapS=THREE.RepeatWrapping; return t;
}
const meadow=new THREE.Mesh(new THREE.SphereGeometry(0.955,160,90),new THREE.MeshStandardMaterial({map:meadowTexture(),roughness:0.95}));
meadow.receiveShadow=true; scene.add(meadow);

function randDir(o=v3()){ const u=Math.random()*2-1, t=Math.random()*TAU, s=Math.sqrt(1-u*u); return o.set(s*Math.cos(t),u,s*Math.sin(t)); }
function polarDir(a,b,o=v3()){ const lat=(a+Math.random()*(b-a))*DEG*(Math.random()<0.5?1:-1); latLonFrame(lat,Math.random()*TAU,o,_e2,_N2); return o; }
const _t=v3(),_b=v3(),_up=v3();
function surfMatrix(m,R,yaw,sx,sy,sz,rad){
  _up.copy(R).normalize(); _t.set(0,1,0); if(Math.abs(_up.y)>0.95) _t.set(1,0,0);
  _t.cross(_up).normalize(); _b.crossVectors(_t,_up);
  const c=Math.cos(yaw), s=Math.sin(yaw);
  const tx=_t.x*c+_b.x*s, ty=_t.y*c+_b.y*s, tz=_t.z*c+_b.z*s, bx=_b.x*c-_t.x*s, by=_b.y*c-_t.y*s, bz=_b.z*c-_t.z*s;
  return m.set(tx*sx,_up.x*sy,bx*sz,_up.x*rad, ty*sx,_up.y*sy,by*sz,_up.y*rad, tz*sx,_up.z*sy,bz*sz,_up.z*rad, 0,0,0,1);
}
const BLADES_MAX=30000;
const blades=(()=>{
  const g=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0, 1,0,0, -0.7,0.34,0, 0.7,0.34,0, -0.38,0.68,0, 0.38,0.68,0, 0,1,0],3));
  g.setIndex([0,1,3, 0,3,2, 2,3,5, 2,5,4, 4,5,6]);
  const dir=new Float32Array(BLADES_MAX*3), prm=new Float32Array(BLADES_MAX*4), d=v3();
  for(let i=0;i<BLADES_MAX;i++){ randDir(d); dir.set([d.x,d.y,d.z],i*3); prm.set([Math.random()*TAU,0.009+Math.random()*0.02,Math.random()*TAU,Math.random()],i*4); }
  g.setAttribute('iDir',new THREE.InstancedBufferAttribute(dir,3)); g.setAttribute('iP',new THREE.InstancedBufferAttribute(prm,4));
  g.instanceCount=BLADES_MAX;
  const m=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:{uTime:U.time,uSun:U.sun},side:THREE.DoubleSide,
    vertexShader:`attribute vec3 iDir; attribute vec4 iP; uniform float uTime; uniform vec3 uSun; varying vec3 vCol;
      void main(){
        vec3 R=normalize(iDir); vec3 A=abs(R.y)<0.95?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0);
        vec3 T=normalize(cross(A,R)); vec3 B=cross(R,T);
        float c=cos(iP.x), s=sin(iP.x); vec3 side=T*c+B*s, fwd=B*c-T*s;
        float h=position.y, w=sin(uTime*1.9+iP.z+R.x*7.0+R.z*5.0)*0.5+0.4;
        vec3 p=R*(0.953+h*iP.y)+side*(position.x*0.0028)+fwd*(w*h*h*iP.y*0.45);
        float day=smoothstep(-0.12,0.35,dot(R,uSun));
        vec3 base=mix(vec3(0.03,0.10,0.02),vec3(0.17,0.43,0.06),h)*(0.75+0.5*iP.w);
        vCol=base*(0.16+1.25*day)+vec3(0.008,0.012,0.03)*(1.0-day);
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
      }`,
    fragmentShader:`varying vec3 vCol; void main(){ gl_FragColor=vec4(vCol,1.0);`+TAIL+`}`}));
  m.frustumCulled=false; return m;
})();
scene.add(blades);
const FLOWERS_MAX=2800;
const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({roughness:0.55,flatShading:true}),FLOWERS_MAX);
{ const m=new THREE.Matrix4(), c=new THREE.Color(), d=v3(), fc=['#fff6e6','#ffd84a','#ff8fbf','#b99bff','#8fd0ff'];
  for(let i=0;i<FLOWERS_MAX;i++){ randDir(d); const s=0.0035+Math.random()*0.003; surfMatrix(m,d,Math.random()*TAU,s,s*0.7,s,0.966+Math.random()*0.012); flowers.setMatrixAt(i,m); flowers.setColorAt(i,c.set(fc[ri(5)])); } }
flowers.frustumCulled=false; scene.add(flowers);
(function polarDecor(){
  const m=new THREE.Matrix4(), d=v3();
  // Polar trees/rocks sit on a tight cap; at grazing sun they cast planet-spanning shadow-map streaks.
  const inst=(geo,mat,n,shadow=false)=>{ const im=new THREE.InstancedMesh(geo,mat,n); im.castShadow=shadow; im.receiveShadow=true; im.frustumCulled=false; scene.add(im); return im; };
  const nT=150;
  const trunk=inst(new THREE.CylinderGeometry(0.12,0.18,1,6).translate(0,0.5,0),new THREE.MeshStandardMaterial({color:'#6b4a2e',roughness:0.9}),nT);
  const crown1=inst(new THREE.ConeGeometry(0.55,0.95,7).translate(0,1.0,0),new THREE.MeshStandardMaterial({color:'#2f6f3d',roughness:0.8,flatShading:true}),nT);
  const crown2=inst(new THREE.ConeGeometry(0.4,0.75,7).translate(0,1.5,0),new THREE.MeshStandardMaterial({color:'#3f8c4a',roughness:0.8,flatShading:true}),nT);
  const snow=inst(new THREE.ConeGeometry(0.22,0.34,7).translate(0,1.79,0),new THREE.MeshStandardMaterial({color:'#f2f6ff',roughness:0.7,flatShading:true}),nT);
  for(let i=0;i<nT;i++){ polarDir(75.5,88.5,d); const s=0.028+Math.random()*0.037; surfMatrix(m,d,Math.random()*TAU,s,s*(1.05+Math.random()*0.45),s,0.951); trunk.setMatrixAt(i,m); crown1.setMatrixAt(i,m); crown2.setMatrixAt(i,m); snow.setMatrixAt(i,m); }
  const rocks=inst(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#8f8b84',roughness:0.95,flatShading:true}),110);
  for(let i=0;i<110;i++){ polarDir(72,89,d); const s=0.007+Math.random()*0.016; surfMatrix(m,d,Math.random()*TAU,s*(0.8+Math.random()*0.5),s*0.7,s,0.952); rocks.setMatrixAt(i,m); }
  const caps=inst(new THREE.SphereGeometry(1,12,6,0,TAU,0,Math.PI/2).translate(0,1.0,0),new THREE.MeshStandardMaterial({color:'#e2453b',roughness:0.5}),60);
  const stems=inst(new THREE.CylinderGeometry(0.35,0.45,1,8).translate(0,0.5,0),new THREE.MeshStandardMaterial({color:'#f3ead8',roughness:0.8}),60);
  for(let i=0;i<60;i++){ polarDir(72,87,d); const s=0.006+Math.random()*0.006; surfMatrix(m,d,Math.random()*TAU,s,s*1.1,s,0.953); stems.setMatrixAt(i,m); caps.setMatrixAt(i,m); }
})();

/* ---------- islands: sphere-mapped standard materials (shadows work) ---------- */
const SPH_HEAD=`
uniform vec2 uOff; uniform float uLift;
void sphFrame(out vec3 R,out vec3 E,out vec3 Nn){
  float gx=uOff.x+position.x, gy=uOff.y+position.y;
  float lon=gx*${CW.toFixed(9)}, lat=${LATR.toFixed(9)}-gy*${CH.toFixed(9)};
  float cl=cos(lat), sl=sin(lat), co=cos(lon), so=sin(lon);
  R=vec3(cl*so,sl,cl*co); E=vec3(co,0.0,-so); Nn=vec3(-sl*so,cl,-sl*co);
}`;
const SPH_NORMAL=`vec3 sR0,sE0,sN0; sphFrame(sR0,sE0,sN0);
vec3 objectNormal=normalize(normal.x*sE0-normal.y*sN0+normal.z*sR0);
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif`;
const SPH_POS=`vec3 sR1,sE1,sN1; sphFrame(sR1,sE1,sN1);
vec3 transformed=sR1*(1.0+position.z+uLift);
#ifdef USE_ALPHAHASH
vPosition=vec3(position);
#endif`;
const SPH_HEAD_BATCH=`
uniform vec2 uTileOff[${NT}];
uniform float uTileLift[${NT}];
varying float vTileId;
void sphFrame(out vec3 R,out vec3 E,out vec3 Nn){
  int tid=int(vTileId+0.5);
  vec2 off=uTileOff[tid];
  float gx=off.x+position.x, gy=off.y+position.y;
  float lon=gx*${CW.toFixed(9)}, lat=${LATR.toFixed(9)}-gy*${CH.toFixed(9)};
  float cl=cos(lat), sl=sin(lat), co=cos(lon), so=sin(lon);
  R=vec3(cl*so,sl,cl*co); E=vec3(co,0.0,-so); Nn=vec3(-sl*so,cl,-sl*co);
}`;
const SPH_NORMAL_BATCH=`vec3 sR0,sE0,sN0; sphFrame(sR0,sE0,sN0);
vec3 objectNormal=normalize(normal.x*sE0-normal.y*sN0+normal.z*sR0);
#ifdef USE_TANGENT
vec3 objectTangent=vec3(tangent.xyz);
#endif`;
const SPH_POS_BATCH=`vec3 sR1,sE1,sN1; sphFrame(sR1,sE1,sN1);
float tileLift=uTileLift[int(vTileId+0.5)];
vec3 transformed=sR1*(1.0+position.z+tileLift);
#ifdef USE_ALPHAHASH
vPosition=vec3(position);
#endif`;
const uTileOff=Array.from({length:NT},()=>new THREE.Vector2());
const uTileLift=new Float32Array(NT);
const uFloorEmissive=Array.from({length:NT},()=>new THREE.Color());
const uFloorEmissiveI=new Float32Array(NT);
const uWallEmissive=Array.from({length:NT},()=>new THREE.Color());
const uLampEmissive=Array.from({length:NT},()=>new THREE.Color());
const uLampEmissiveI=new Float32Array(NT);
const _IDENT_BATCH=new THREE.Matrix4();
let floorBatch,wallBatch,lampBatch,slabBatch,floorAtlasTex=null;
let lastFrameDrawCalls=0;
function wireBatchSphereMat(mat,kind){
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uTileOff={value:uTileOff};
    sh.uniforms.uTileLift={value:uTileLift};
    sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>\n${SPH_HEAD_BATCH}`)
      .replace('#include <beginnormal_vertex>',SPH_NORMAL_BATCH)
      .replace('#include <begin_vertex>',`vTileId=batchId;\n${SPH_POS_BATCH}`);
    if(kind==='floor'){
      sh.uniforms.uFloorEmissive={value:uFloorEmissive};
      sh.uniforms.uFloorEmissiveI={value:uFloorEmissiveI};
      sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
#ifdef USE_BATCHING
totalEmissiveRadiance=uFloorEmissive[int(vTileId+0.5)]*uFloorEmissiveI[int(vTileId+0.5)];
#endif`);
    }else if(kind==='wall'){
      sh.uniforms.uWallEmissive={value:uWallEmissive};
      sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
#ifdef USE_BATCHING
totalEmissiveRadiance+=uWallEmissive[int(vTileId+0.5)];
#endif`);
    }else if(kind==='lamp'){
      sh.uniforms.uLampEmissive={value:uLampEmissive};
      sh.uniforms.uLampEmissiveI={value:uLampEmissiveI};
      sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
#ifdef USE_BATCHING
totalEmissiveRadiance=uLampEmissive[int(vTileId+0.5)]*uLampEmissiveI[int(vTileId+0.5)];
#endif`);
    }
  };
  mat.customProgramCacheKey=()=>'sphere-tile-batch-'+kind;
  return mat;
}
function buildFloorAtlas(){
  const {cols,rows}=atlasGridForCount(NT);
  const cellW=512,cellH=256,c=document.createElement('canvas');
  c.width=cols*cellW; c.height=rows*cellH; const g=c.getContext('2d');
  for(let i=0;i<tiles.length;i++){
    const tex=floorTexture(tiles[i]), cx=(i%cols)*cellW, cy=Math.floor(i/cols)*cellH;
    g.drawImage(tex.image,cx,cy,cellW,cellH); tex.dispose();
  }
  return canvasTex(c);
}
function remapFloorUvs(geo,tileId){
  const {cols,rows}=atlasGridForCount(NT);
  const rect=atlasRectForTile(tileId,cols,rows), uv=geo.attributes.uv;
  if(!uv) return;
  for(let i=0;i<uv.count;i++){ const m=mapUvToAtlas(uv.getX(i),uv.getY(i),rect); uv.setXY(i,m.u,m.v); }
  uv.needsUpdate=true;
}
function maxTilePartGeos(T){
  let fv=0,fi=0,wv=0,wi=0,lv=0,li=0,sv=0,si=0;
  for(let mask=0;mask<32;mask++){
    const g=tileGeos(T,mask);
    fv=Math.max(fv,g.floor.attributes.position.count); fi=Math.max(fi,g.floor.getIndex()?.count||0);
    wv=Math.max(wv,g.walls.attributes.position.count); wi=Math.max(wi,g.walls.getIndex()?.count||0);
    lv=Math.max(lv,g.lamps.attributes.position.count); li=Math.max(li,g.lamps.getIndex()?.count||0);
    sv=Math.max(sv,g.slab.attributes.position.count); si=Math.max(si,g.slab.getIndex()?.count||0);
  }
  return {floor:{v:fv,i:fi},walls:{v:wv,i:wi},lamps:{v:lv,i:li},slab:{v:sv,i:si}};
}
function estimateTilePools(){
  let fV=0,fI=0,wV=0,wI=0,lV=0,lI=0,sV=0,sI=0;
  for(const T of tiles){
    const c=maxTilePartGeos(T);
    fV+=c.floor.v; fI+=c.floor.i; wV+=c.walls.v; wI+=c.walls.i;
    lV+=c.lamps.v; lI+=c.lamps.i; sV+=c.slab.v; sI+=c.slab.i;
  }
  return {floor:{v:fV+64,i:fI+128},walls:{v:wV+64,i:wI+128},lamps:{v:lV+64,i:lI+128},slab:{v:sV+64,i:sI+128}};
}
function resetTileBatches(){
  if(!floorBatch) return;
  scene.remove(floorBatch,wallBatch,lampBatch,slabBatch);
  floorBatch.geometry.dispose(); wallBatch.geometry.dispose(); lampBatch.geometry.dispose(); slabBatch.geometry.dispose();
  floorBatch.material.dispose(); wallBatch.material.dispose(); lampBatch.material.dispose(); slabBatch.material.dispose();
  floorAtlasTex?.dispose(); floorAtlasTex=null;
  floorBatch=wallBatch=lampBatch=slabBatch=null;
}
function ensureTileBatches(){
  if(floorBatch) return;
  const pools=estimateTilePools();
  floorAtlasTex=buildFloorAtlas();
  const floorMat=wireBatchSphereMat(new THREE.MeshStandardMaterial({map:floorAtlasTex,roughness:0.93,emissive:'#000'}),'floor');
  const wallMat=wireBatchSphereMat(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.82,emissive:'#000'}),'wall');
  const lampMat=wireBatchSphereMat(new THREE.MeshStandardMaterial({color:'#fff3cf',emissive:'#ffb24a',emissiveIntensity:1,roughness:0.3}),'lamp');
  const slabMat=wireBatchSphereMat(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,shadowSide:THREE.DoubleSide}),'slab');
  wallMat.customDepthMaterial=wireBatchSphereMat(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),'wall');
  slabMat.customDepthMaterial=wireBatchSphereMat(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),'slab');
  floorBatch=new THREE.BatchedMesh(NT,pools.floor.v,pools.floor.i,floorMat);
  wallBatch=new THREE.BatchedMesh(NT,pools.walls.v,pools.walls.i,wallMat);
  lampBatch=new THREE.BatchedMesh(NT,pools.lamps.v,pools.lamps.i,lampMat);
  slabBatch=new THREE.BatchedMesh(NT,pools.slab.v,pools.slab.i,slabMat);
  for(const b of [floorBatch,wallBatch,lampBatch,slabBatch]){ b.frustumCulled=false; b.receiveShadow=true; scene.add(b); }
  floorBatch.castShadow=false; wallBatch.castShadow=slabBatch.castShadow=true; lampBatch.castShadow=false;
}
function syncTileBatchUniforms(){
  if(!floorBatch) return;
  for(const T of tiles){
    if(!T.mFloor) continue;
    uTileOff[T.id].copy(T.uOff.value); uTileLift[T.id]=T.uLift.value;
    uFloorEmissive[T.id].copy(T.mFloor.emissive); uFloorEmissiveI[T.id]=T.mFloor.emissiveIntensity;
    uWallEmissive[T.id].copy(T.mWall.emissive);
    uLampEmissive[T.id].copy(T.mLamp.emissive); uLampEmissiveI[T.id]=T.mLamp.emissiveIntensity;
  }
}
function sphMat(mat,T){
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uOff=T.uOff; sh.uniforms.uLift=T.uLift;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+SPH_HEAD)
      .replace('#include <beginnormal_vertex>',SPH_NORMAL).replace('#include <begin_vertex>',SPH_POS);
  };
  mat.customProgramCacheKey=()=>'sphere-tile';
  return mat;
}
function sphMesh(mat,T,cast,recv){
  const m=new THREE.Mesh(new THREE.BufferGeometry(),sphMat(mat,T));
  m.frustumCulled=false; m.castShadow=cast; m.receiveShadow=recv;
  if(cast) m.customDepthMaterial=sphMat(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),T);
  return m;
}
/* Geometry is authored in tile space (x,y in cells, z in world units). The tile->sphere map
   mirrors handedness, so triangles are oriented against their normals and stored reversed. */
const ZS=6;
class GB{
  constructor(){ this.p=[]; this.n=[]; this.uv=[]; this.c=[]; this.i=[]; }
  v(x,y,z,nx,ny,nz,u,w,col){ const l=Math.hypot(nx,ny,nz)||1; this.p.push(x,y,z); this.n.push(nx/l,ny/l,nz/l); this.uv.push(u||0,w||0); if(col) this.c.push(col.r,col.g,col.b); return this.p.length/3-1; }
  tri(a,b,c){
    const P=this.p, Nn=this.n;
    const ux=P[b*3]-P[a*3], uy=P[b*3+1]-P[a*3+1], uz=(P[b*3+2]-P[a*3+2])*ZS;
    const vx=P[c*3]-P[a*3], vy=P[c*3+1]-P[a*3+1], vz=(P[c*3+2]-P[a*3+2])*ZS;
    const gx=uy*vz-uz*vy, gy=uz*vx-ux*vz, gz=ux*vy-uy*vx;
    const nx=Nn[a*3]+Nn[b*3]+Nn[c*3], ny=Nn[a*3+1]+Nn[b*3+1]+Nn[c*3+1], nz=Nn[a*3+2]+Nn[b*3+2]+Nn[c*3+2];
    if(gx*nx+gy*ny+gz*nz>=0) this.i.push(a,c,b); else this.i.push(a,b,c);
  }
  quad(a,b,c,d){ this.tri(a,b,c); this.tri(a,c,d); }
  geo(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    if(this.c.length) g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
    g.setIndex(this.i); return g;
  }
}
const WALL_T=0.0125, WALL_H=0.034, POST_R=0.0165, POST_H=0.046, LAMP_R=0.0085;
const kx=gy=>1/(CW*Math.max(0.25,Math.cos(gy2lat(gy)))), ky=1/CH;
const PROF=[[-1,0,-1,0],[-1,0.72,-1,0.1],[-0.86,0.95,-0.6,0.8],[-0.55,1.0,-0.15,1],[0.55,1.0,0.15,1],[0.86,0.95,0.6,0.8],[1,0.72,1,0.1],[1,0,1,0]];
const COL=h=>new THREE.Color(h);
const C_STONE=COL('#cbc2ae'), C_CAP=COL('#ece5d3'), C_BASE=COL('#7f7766'), C_MOSS=COL('#86b35a'), C_POST=COL('#b3a993'), C_SOIL=COL('#7a5232'), C_ROCK=COL('#3a312c');
const C_WHITE=COL('#ffffff'), C_BLACK=COL('#000000'), C_GOLDWALL=COL('#ffd477'), C_GOLDE=COL('#7a4a00'), C_LAMP=COL('#ffb24a'), C_LAMPHOME=COL('#ffd25e'), C_HI=COL('#ffcc55'), C_HIDARK=COL('#4a5cff'), C_BLOOM=COL('#ff9ccf');
function applyRendererTheme(cb){
  const t=highlightTheme(!!cb);
  C_HI.copy(COL(t.hi)); C_HIDARK.copy(COL(t.hiDark)); C_BLOOM.copy(COL(t.bloom));
  C_MOSS.copy(COL(cb?'#6aaee0':'#86b35a'));
}
function seamMask(T){
  if(T.anim) return 0;
  const c=T.slot.c, r=T.slot.r;
  const at=(dc,dr)=>{ const rr=r+dr; if(rr<0||rr>=ROWS) return false; const id=slotGrid[rr][(c+dc+COLS)%COLS]; return id>=0&&!tiles[id].anim; };
  return (at(1,0)?1:0)|(at(0,1)?2:0)|(at(-1,0)?4:0)|(at(0,-1)?8:0)|(at(1,1)?16:0);
}
function tileGeos(T,m){
  const b=INSET, gyo=T.slot.r*TH, wl=T.walls;
  const ex=X=>X===0?b:X===TW?TW-b:X, ey=Y=>Y===0?b:Y===TH?TH-b:Y;
  // floor + bridges over seams to neighbouring islands
  const fl=new GB();
  const grid=(x0,y0,x1,y1,nx,ny)=>{
    const base=fl.p.length/3;
    for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++){ const x=x0+(x1-x0)*i/nx, y=y0+(y1-y0)*j/ny; fl.v(x,y,0,0,0,1,clamp(x/TW,0.002,0.998),1-clamp(y/TH,0.004,0.996)); }
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){ const a=base+j*(nx+1)+i; fl.quad(a,a+1,a+nx+2,a+nx+1); }
  };
  grid(b,b,TW-b,TH-b,32,12);
  if(m&1) grid(TW-b,b,TW+b,TH-b,1,12);
  if(m&2) grid(b,TH-b,TW-b,TH+b,32,1);
  if((m&1)&&(m&2)&&(m&16)) grid(TW-b,TH-b,TW+b,TH+b,1,1);
  // walls: no wall on a side where another island touches
  const hasH=(x,Y)=>{ if(x<0||x>=TW) return false; if(Y===0) return !(m&8); if(Y===TH) return !(m&2); return !!(wl[Y*TW+x]&1); };
  const hasV=(X,y)=>{ if(y<0||y>=TH) return false; if(X===0) return !(m&4); if(X===TW) return !(m&1); return !!(wl[y*TW+X]&8); };
  const wg=new GB(), lg=new GB();
  const run=(horiz,line,a0,a1,salt)=>{
    const cap=hash(T.id,salt,line)<0.45?C_MOSS:C_CAP, L=a1-a0, S=Math.max(1,Math.ceil(L*3)), rows=[];
    for(let s=0;s<=S;s++){
      const a=a0+L*s/S, row=[];
      for(const [u,w,nu,nw] of PROF){
        const col=w>0.9?cap:(w>0.2?C_STONE:C_BASE);
        if(horiz) row.push(wg.v(a,line+u*WALL_T*ky,w*WALL_H,0,nu,nw,0,0,col));
        else row.push(wg.v(line+u*WALL_T*kx(gyo+a),a,w*WALL_H,nu,0,nw,0,0,col));
      }
      rows.push(row);
    }
    for(let s=0;s<S;s++) for(let k=0;k<PROF.length-1;k++) wg.quad(rows[s][k],rows[s+1][k],rows[s+1][k+1],rows[s][k+1]);
  };
  for(let Y=0;Y<=TH;Y++){ let x=0; while(x<TW){ if(hasH(x,Y)){ const s=x; while(x<TW&&hasH(x,Y)) x++; run(true,ey(Y),ex(s),ex(x),Y*16+s); } else x++; } }
  for(let X=0;X<=TW;X++){ let y=0; while(y<TH){ if(hasV(X,y)){ const s=y; while(y<TH&&hasV(X,y)) y++; run(false,ex(X),ey(s),ey(y),100+X*16+s); } else y++; } }
  const post=(px,py,lamp)=>{
    const K=10, rx=POST_R*kx(gyo+py), ry=POST_R*ky, rings=[];
    for(const [sc,h,col,nz] of [[1.0,0,C_BASE,0.05],[1.0,0.8,C_POST,0.1],[1.18,0.84,C_CAP,-0.3],[1.18,0.93,C_CAP,0.2],[0.8,1.0,C_CAP,0.9]]){
      const r=[]; for(let k=0;k<K;k++){ const a=k/K*TAU, c=Math.cos(a), s=Math.sin(a); r.push(wg.v(px+c*rx*sc,py+s*ry*sc,h*POST_H,c,s,nz,0,0,col)); } rings.push(r);
    }
    const top=wg.v(px,py,POST_H*1.04,0,0,1,0,0,C_CAP);
    for(let q=0;q<rings.length-1;q++) for(let k=0;k<K;k++){ const k2=(k+1)%K; wg.quad(rings[q][k],rings[q][k2],rings[q+1][k2],rings[q+1][k]); }
    const lr=rings[rings.length-1]; for(let k=0;k<K;k++) wg.tri(lr[k],lr[(k+1)%K],top);
    if(lamp){
      const cz=POST_H*1.04+LAMP_R*0.85, lrx=LAMP_R*kx(gyo+py), lry=LAMP_R*ky, rowsL=[];
      for(let i=0;i<=4;i++){ const th=i/4*Math.PI, row=[]; for(let k=0;k<8;k++){ const ph=k/8*TAU, sx=Math.sin(th)*Math.cos(ph), sy=Math.sin(th)*Math.sin(ph), sz=Math.cos(th); row.push(lg.v(px+sx*lrx,py+sy*lry,cz+sz*LAMP_R,sx,sy,sz)); } rowsL.push(row); }
      for(let i=0;i<4;i++) for(let k=0;k<8;k++){ const k2=(k+1)%8; lg.quad(rowsL[i][k],rowsL[i][k2],rowsL[i+1][k2],rowsL[i+1][k]); }
    }
  };
  for(let Y=0;Y<=TH;Y++) for(let X=0;X<=TW;X++){
    const l=hasH(X-1,Y), r=hasH(X,Y), u=hasV(X,Y-1), d=hasV(X,Y), cnt=l+r+u+d;
    if(!cnt||(cnt===2&&((l&&r)||(u&&d)))) continue;
    const h=hash(T.id,X,Y);
    post(ex(X),ey(Y),cnt>=3?h<0.8:cnt===2?h<0.4:h<0.25);
  }
  // cliff sides: grass lip, soil, rock
  const sg=new GB(), edgeCol=COL(PALETTE[T.id]).multiplyScalar(0.55), midCol=C_SOIL.clone().lerp(C_ROCK,0.5);
  const levels=[[0,edgeCol,0.15],[-0.008,C_SOIL,0],[-SLAB*0.6,midCol,0],[-SLAB,C_ROCK,-0.2]];
  const edge=(xa,ya,xb,yb,nx,ny,segs)=>{
    const rows=[];
    for(let s=0;s<=segs;s++){ const x=xa+(xb-xa)*s/segs, y=ya+(yb-ya)*s/segs, row=[]; for(const [z,col,nz] of levels) row.push(sg.v(x,y,z,nx,ny,nz,0,0,col)); rows.push(row); }
    for(let s=0;s<segs;s++) for(let k=0;k<levels.length-1;k++) sg.quad(rows[s][k],rows[s+1][k],rows[s+1][k+1],rows[s][k+1]);
  };
  edge(b,b,TW-b,b,0,-1,32); edge(TW-b,b,TW-b,TH-b,1,0,12); edge(TW-b,TH-b,b,TH-b,0,1,32); edge(b,TH-b,b,b,-1,0,12);
  return {floor:fl.geo(),walls:wg.geo(),lamps:lg.geo(),slab:sg.geo()};
}
function floorTexture(T){
  const W=FLOOR_CANVAS.width,H=FLOOR_CANVAS.height,c=document.createElement('canvas'); c.width=W;c.height=H; const g=c.getContext('2d');
  g.fillStyle=PALETTE[T.id]; g.fillRect(0,0,W,H);
  for(let y=0;y<TH;y++) for(let x=0;x<TW;x++){ g.fillStyle=((x+y)&1)?'rgba(255,255,230,0.07)':'rgba(0,30,0,0.07)'; g.fillRect(x*64,y*64,64,64); }
  for(let i=0;i<6500;i++){ g.fillStyle=Math.random()<0.5?'rgba(255,255,220,.13)':'rgba(0,25,0,.16)'; g.fillRect(Math.random()*W,Math.random()*H,1.2,2+Math.random()*4); }
  const fc=['#ffffff','#fff06a','#ffd0e6'];
  g.globalAlpha=0.8; for(let i=0;i<90;i++){ g.fillStyle=fc[ri(3)]; g.beginPath(); g.arc(Math.random()*W,Math.random()*H,1.3+Math.random()*1.3,0,TAU); g.fill(); } g.globalAlpha=1;
  g.font='900 200px system-ui,-apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle='rgba(255,255,235,0.22)'; g.fillText(String(T.num),W/2,H/2+14);
  g.lineWidth=5; g.strokeStyle='rgba(0,30,0,0.12)'; g.strokeText(String(T.num),W/2,H/2+14);
  return canvasTex(c);
}
function buildTileRender(T){
  ensureTileBatches();
  T.mFloor=new THREE.MeshStandardMaterial({roughness:0.93,emissive:'#000000'});
  T.mWall=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.82,emissive:'#000000'});
  T.mLamp=new THREE.MeshStandardMaterial({color:'#fff3cf',emissive:'#ffb24a',emissiveIntensity:1,roughness:0.3});
  T.mSlab=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,shadowSide:THREE.DoubleSide});
  T.group=null; T.floorMesh=T.wallMesh=T.lampMesh=T.slabMesh=null;
  T.geoKey=''; rebuildTile(T);
}
function rebuildTile(T){
  const m=seamMask(T), key=m+'_'+T.slot.r; if(key===T.geoKey) return; T.geoKey=key;
  const g=tileGeos(T,m);
  remapFloorUvs(g.floor,T.id);
  if(T.batchFloorId==null){
    const cap=maxTilePartGeos(T);
    T.batchFloorId=floorBatch.addGeometry(g.floor,cap.floor.v,cap.floor.i);
    T.batchWallId=wallBatch.addGeometry(g.walls,cap.walls.v,cap.walls.i);
    T.batchLampId=lampBatch.addGeometry(g.lamps,cap.lamps.v,cap.lamps.i);
    T.batchSlabId=slabBatch.addGeometry(g.slab,cap.slab.v,cap.slab.i);
    for(const[b,id] of [[floorBatch,T.batchFloorId],[wallBatch,T.batchWallId],[lampBatch,T.batchLampId],[slabBatch,T.batchSlabId]])
      b.setMatrixAt(id,_IDENT_BATCH);
  }else{
    floorBatch.setGeometryAt(T.batchFloorId,g.floor);
    wallBatch.setGeometryAt(T.batchWallId,g.walls);
    lampBatch.setGeometryAt(T.batchLampId,g.lamps);
    slabBatch.setGeometryAt(T.batchSlabId,g.slab);
  }
}
function refreshTiles(){ for(const T of tiles) if(T.batchFloorId!=null) rebuildTile(T); }
function disposeTileRender(T){
  if(T.batchFloorId==null) return;
  floorBatch.setVisibleAt(T.batchFloorId,false);
  wallBatch.setVisibleAt(T.batchWallId,false);
  lampBatch.setVisibleAt(T.batchLampId,false);
  slabBatch.setVisibleAt(T.batchSlabId,false);
  T.batchFloorId=T.batchWallId=T.batchLampId=T.batchSlabId=null;
}

/* ---------- bubbles & sunstones ---------- */
const BUB_MAX=520;
const bubbleMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time,uSun:U.sun},transparent:true,depthWrite:false,
  vertexShader:`varying vec3 vN; varying vec3 vW; void main(){ vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0); vW=wp.xyz; vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader:`uniform float uTime; uniform vec3 uSun; varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 n=normalize(vN), v=normalize(cameraPosition-vW); float f=pow(1.0-clamp(abs(dot(n,v)),0.0,1.0),2.2);
      vec3 ir=0.5+0.5*cos(6.2832*(f*1.3+vec3(0.0,0.33,0.67)+uTime*0.06+vW.y*3.0));
      float day=smoothstep(-0.15,0.35,dot(normalize(vW),uSun));
      vec3 col=mix(vec3(0.75,0.9,1.0),ir,0.7)*(0.2+1.3*f)*(0.4+0.9*day);
      float sp=pow(max(dot(reflect(-uSun,n),v),0.0),70.0)*2.2*day;
      gl_FragColor=vec4(col+vec3(sp),clamp(0.12+0.75*f+sp*0.2,0.0,0.95));`+TAIL+`}`});
const G_BUB=new THREE.SphereGeometry(1,22,16);
function inst(geo,mat,n,order=0){ const m=new THREE.InstancedMesh(geo,mat,n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled=false; m.count=0; m.renderOrder=order; scene.add(m); return m; }
const bubbles=inst(G_BUB,bubbleMat,BUB_MAX,3);
const seeds=inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'#ffd36b',emissive:'#ff9a28',emissiveIntensity:0.7,roughness:0.35,metalness:0.1}),BUB_MAX);
const bigBubbles=inst(G_BUB,bubbleMat,16,3);
const gems=inst(new THREE.OctahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#ffe38a',emissive:'#ffb020',emissiveIntensity:2.6,roughness:0.15,metalness:0.3,flatShading:true}),16);

/* ---------- ecology: bubble-pop green cells (instanced, capped) ---------- */
const ECO_PATCH_MAX=ECOLOGY.maxCells;
const ecoPatchMat=new THREE.MeshStandardMaterial({color:'#4caf5a',roughness:0.9,emissive:'#1e3d24',emissiveIntensity:0.12});
const ecoPatches=inst(new THREE.BoxGeometry(1,1,1),ecoPatchMat,ECO_PATCH_MAX,0);
ecoPatches.receiveShadow=true;
const ecoGrass=inst(new THREE.CylinderGeometry(0.35,0.45,1,4),new THREE.MeshStandardMaterial({color:'#6ec454',roughness:0.85}),ECOLOGY.maxDecorTotal,1);
const ecoFlower=inst(new THREE.IcosahedronGeometry(0.35,0),new THREE.MeshStandardMaterial({color:'#ffb8d8',roughness:0.55,emissive:'#55152a',emissiveIntensity:0.25}),ECOLOGY.maxDecorTotal,1);
const ecoTreeTrunk=inst(new THREE.CylinderGeometry(0.2,0.24,0.5,5),new THREE.MeshStandardMaterial({color:'#7a5a3a',roughness:0.95}),ECOLOGY.maxDecorTotal,1);
const ecoTreeTop=inst(new THREE.ConeGeometry(0.38,0.7,6),new THREE.MeshStandardMaterial({color:'#3f9a48',roughness:0.88}),ECOLOGY.maxDecorTotal,1);
ecoGrass.castShadow=ecoTreeTrunk.castShadow=ecoTreeTop.castShadow=true;

/* ---------- blooming flowers on cleared islands ---------- */
const BLOOM_PER=56, BLOOM_MAX=NT*BLOOM_PER;
const flowerHead=(()=>{ const sh=new THREE.Shape(); for(let i=0;i<=60;i++){ const t=i/60*TAU, r=0.55+0.45*Math.abs(Math.cos(2.5*t)); const x=Math.cos(t)*r, y=Math.sin(t)*r; if(i) sh.lineTo(x,y); else sh.moveTo(x,y); }
  const g=new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI/2); g.translate(0,1,0); return g; })();
const bloomHeads=inst(flowerHead,new THREE.MeshStandardMaterial({roughness:0.6,side:THREE.DoubleSide,emissive:'#331122',emissiveIntensity:0.3}),BLOOM_MAX);
const bloomStems=inst(new THREE.CylinderGeometry(0.05,0.07,1,5).translate(0,0.5,0),new THREE.MeshStandardMaterial({color:'#3f8f3a',roughness:0.8}),BLOOM_MAX);
const bloomCores=inst(G_BUB,new THREE.MeshStandardMaterial({color:'#ffd84a',emissive:'#ff9d2e',emissiveIntensity:0.5,roughness:0.5}),BLOOM_MAX);
bloomHeads.castShadow=bloomStems.castShadow=true;
const BLOOMCOL=['#ff8fbf','#fff6e6','#ffd84a','#b99bff','#ff6b6b','#8fd0ff'].map(COL);
const easeBack=t=>{ const c=1.7; t=clamp(t,0,1); return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); };
function syncBloom(){
  let n=0;
  for(const T of tiles){
    if(!T.cleared) continue;
    const p=tilePos(T), lf=liftOf(T), age=gameClock-T.clearedAt;
    for(let k=0;k<BLOOM_PER;k++){
      const g=easeBack((age-k*0.035)/0.55); if(g<=0.001) continue;
      const cx=0.3+hash(T.id,k,1)*(TW-0.6), cy=0.3+hash(T.id,k,2)*(TH-0.6);
      frameAt(p.x+cx,p.y+cy);
      const s=(0.013+hash(T.id,k,3)*0.008)*g, h=(0.016+hash(T.id,k,4)*0.014)*g, yaw=hash(T.id,k,5)*TAU, rad=1+lf;
      surfMatrix(_M,_R,yaw,s,h,s,rad); bloomHeads.setMatrixAt(n,_M);
      surfMatrix(_M,_R,yaw,s*0.9,h,s*0.9,rad); bloomStems.setMatrixAt(n,_M);
      _M.makeScale(s*0.32,s*0.22,s*0.32); _P.copy(_R).multiplyScalar(rad+h+0.0006); _M.setPosition(_P); bloomCores.setMatrixAt(n,_M);
      bloomHeads.setColorAt(n,BLOOMCOL[(T.id*7+k)%BLOOMCOL.length]); n++;
    }
  }
  bloomHeads.count=bloomStems.count=bloomCores.count=n;
  bloomHeads.instanceMatrix.needsUpdate=bloomStems.instanceMatrix.needsUpdate=bloomCores.instanceMatrix.needsUpdate=true;
  if(bloomHeads.instanceColor) bloomHeads.instanceColor.needsUpdate=true;
}

/* ---------- orchard on cleared islands: trees, beehive, bees (they stay) ---------- */
const TREES_PER=6, TREE_MAX=NT*TREES_PER, BEES_PER=5, BEE_MAX=NT*BEES_PER;
const CANOPY=['#7ccf5a','#f6a6c9','#f2a23c','#9bd84f','#ffd36b','#e8829a'].map(COL);
function orchardSpots(T){
  if(T.spots) return T.spots;
  const w=T.walls, open=[];
  for(let Y=1;Y<TH;Y++) for(let X=1;X<TW;X++){
    const h=(x)=>!!(w[Y*TW+x]&1), v=(y)=>!!(w[y*TW+X]&8);
    if(!h(X-1)&&!h(X)&&!v(Y-1)&&!v(Y)) open.push([X,Y,hash(T.id,X,Y)]);
  }
  open.sort((a,b)=>a[2]-b[2]);
  // the hive takes the first open corner, trees the next ones (corners never sit on a path)
  const hv=open.length>=2?[open[0][0],open[0][1]]:[TW/2,TH/2-0.5];
  const spots=open.slice(open.length>=2?1:0,TREES_PER+1).map(([X,Y])=>[X,Y]);
  return (T.spots={trees:spots,hive:hv});
}
const trunks=inst(new THREE.CylinderGeometry(0.1,0.16,1,6).translate(0,0.5,0),new THREE.MeshStandardMaterial({color:'#7a5232',roughness:0.9}),TREE_MAX);
const canopies=inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({roughness:0.75,flatShading:true}),TREE_MAX*3);
trunks.castShadow=canopies.castShadow=true; trunks.receiveShadow=canopies.receiveShadow=true;
for(let i=0;i<TREE_MAX*3;i++) canopies.setColorAt(i,CANOPY[0]);
const skepGeo=new THREE.LatheGeometry([[0,0],[0.55,0.02],[0.92,0.14],[1.0,0.28],[0.86,0.38],[0.97,0.5],[0.82,0.64],[0.84,0.74],[0.62,0.87],[0.5,0.95],[0.22,1.05],[0,1.08]].map(([x,y])=>new THREE.Vector2(x,y)),14);
const hives=inst(skepGeo,new THREE.MeshStandardMaterial({color:'#d9a23a',roughness:0.8,flatShading:true}),NT);
const hiveDoors=inst(new THREE.SphereGeometry(1,10,8),new THREE.MeshStandardMaterial({color:'#2a1a08',roughness:1}),NT);
hives.castShadow=true;
const beeGeo=(()=>{
  const body=new THREE.SphereGeometry(1,12,8); body.scale(0.62,0.6,1);
  const pos=[...body.attributes.position.array], nor=[...body.attributes.normal.array], idx=[...body.index.array], part=new Array(pos.length/3).fill(0);
  for(const sd of [1,-1]){ const base=pos.length/3; pos.push(sd*0.3,0.45,0); nor.push(0,1,0); part.push(1);
    for(let i=0;i<=10;i++){ const a=i/10*TAU; pos.push(sd*(1.05+Math.cos(a)*0.75),0.45,Math.sin(a)*0.42-0.15); nor.push(0,1,0); part.push(1); }
    for(let i=0;i<10;i++) idx.push(base,base+1+i,base+2+i); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('aPart',new THREE.Float32BufferAttribute(part,1)); g.setIndex(idx); return g; })();
const beeMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time,uSun:U.sun},side:THREE.DoubleSide,
  vertexShader:`attribute float aPart; uniform float uTime; uniform vec3 uSun; varying vec3 vC;
    void main(){
      vec3 p=position; float ph=dot(instanceMatrix[3].xyz,vec3(41.3,13.7,29.1));
      if(aPart>0.5){ float sg=sign(p.x), dx=abs(p.x)-0.3, a=sin(uTime*70.0+ph)*0.7; p.x=sg*(0.3+dx*cos(a)); p.y=0.45+dx*sin(a); }
      vec4 wp=modelMatrix*instanceMatrix*vec4(p,1.0);
      vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
      float day=smoothstep(-0.15,0.3,dot(normalize(wp.xyz),uSun)), lam=0.35+0.65*max(dot(n,uSun),0.0);
      vec3 c;
      if(aPart>0.5) c=vec3(0.85,0.93,1.0);
      else { c=mix(vec3(0.07,0.05,0.02),vec3(1.0,0.72,0.06),step(0.0,sin(position.z*11.0+0.6))); if(position.z>0.72) c=vec3(0.06,0.05,0.04); }
      vC=c*(0.25+0.95*day*lam);
      gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader:`varying vec3 vC; void main(){ gl_FragColor=vec4(vC,1.0);`+TAIL+`}`});
const bees=inst(beeGeo,beeMat,BEE_MAX);
function syncOrchard(time){
  let nt=0, nc=0, nh=0, nb=0;
  for(const T of tiles){
    if(!T.cleared) continue;
    const p=tilePos(T), lf=liftOf(T), age=gameClock-T.clearedAt, sp=orchardSpots(T), rad=1+lf;
    sp.trees.forEach(([X,Y],k)=>{
      const g=easeBack((age-0.7-k*0.18)/0.7); if(g<=0.001) return;
      frameAt(p.x+X,p.y+Y); const R=_R.clone(), s=0.03*(0.85+0.35*hash(T.id,k,7))*g, yaw=hash(T.id,k,8)*TAU;
      surfMatrix(_M,R,yaw,s*0.5,s*1.9,s*0.5,rad); trunks.setMatrixAt(nt++,_M);
      const col=CANOPY[(T.id*3+k)%CANOPY.length];
      for(let b=0;b<3;b++){
        const a=yaw+b*2.1, off=b===2?0:0.016*g, up=b===2?0.082:0.064;
        frameAt(p.x+X+Math.cos(a)*off*kx(p.y+Y)*1.2,p.y+Y+Math.sin(a)*off*ky*1.2);
        const r=(b===2?0.026:0.023)*g*(0.9+0.2*hash(T.id,k,b));
        _P.copy(_R).multiplyScalar(rad+up*g); _M.makeScale(r,r,r).setPosition(_P); canopies.setMatrixAt(nc,_M); canopies.setColorAt(nc,col); nc++;
      }
    });
    const hg=easeBack((age-1.1)/0.6);
    if(hg>0.001){
      frameAt(p.x+sp.hive[0],p.y+sp.hive[1]); const R=_R.clone();
      surfMatrix(_M,R,0,0.016*hg,0.021*hg,0.016*hg,rad); hives.setMatrixAt(nh,_M);
      frameAt(p.x+sp.hive[0],p.y+sp.hive[1]+0.1); _P.copy(_R).multiplyScalar(rad+0.005*hg);
      _M.makeScale(0.0045*hg,0.0045*hg,0.0045*hg).setPosition(_P); hiveDoors.setMatrixAt(nh,_M); nh++;
      const out=clamp((age-1.6)/1.2,0,1);
      for(let k=0;k<BEES_PER&&out>0;k++){
        const pos=(tt)=>{ const a=tt*(1.3+0.25*k)+k*1.7, r=(0.5+0.9*out)*(0.8+0.3*Math.sin(tt*0.7+k));
          return [p.x+sp.hive[0]+Math.cos(a)*r*1.5+0.45*Math.sin(a*2.3+k), clamp(p.y+sp.hive[1]+Math.sin(a)*r*0.7+0.25*Math.cos(a*1.7),p.y+0.3,p.y+TH-0.3)]; };
        const [gx,gy]=pos(time), [gx2,gy2]=pos(time+0.05), lat=gy2lat(gy);
        const yaw=Math.atan2(wrapD(gx2-gx)*CW*Math.cos(lat),-(gy2-gy)*CH);
        poseObject(_dummy,gx,gy,lf+0.04+0.02*Math.sin(time*3.1+k*1.3),yaw); _dummy.scale.setScalar(0.0095); _dummy.updateMatrix();
        bees.setMatrixAt(nb++,_dummy.matrix);
      }
    }
  }
  trunks.count=nt; canopies.count=nc; hives.count=hiveDoors.count=nh; bees.count=nb;
  for(const m of [trunks,canopies,hives,hiveDoors,bees]) m.instanceMatrix.needsUpdate=true;
  if(canopies.instanceColor) canopies.instanceColor.needsUpdate=true;
}

/* ---------- particles (GPU points) ---------- */
const PMAX=900, pPos=new Float32Array(PMAX*3), pCol=new Float32Array(PMAX*3), pSize=new Float32Array(PMAX), pAlpha=new Float32Array(PMAX);
const pVel=new Float32Array(PMAX*3), pLife=new Float32Array(PMAX), pMaxL=new Float32Array(PMAX), pGrav=new Float32Array(PMAX), pSize0=new Float32Array(PMAX);
const pGeo=new THREE.BufferGeometry();
const pAttr=(name,arr,k)=>{ const a=new THREE.BufferAttribute(arr,k); a.setUsage(THREE.DynamicDrawUsage); pGeo.setAttribute(name,a); return a; };
const aPos=pAttr('position',pPos,3), aCol=pAttr('aCol',pCol,3), aSize=pAttr('aSize',pSize,1), aAlp=pAttr('aAlpha',pAlpha,1);
const pMat=new THREE.ShaderMaterial({uniforms:{uPx:{value:400}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute vec3 aCol; attribute float aSize; attribute float aAlpha; uniform float uPx; varying vec3 vC; varying float vA;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uPx/max(0.01,-mv.z); vC=aCol; vA=aAlpha; }`,
  fragmentShader:`varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor=vec4(vC,(1.0-r)*(1.0-r)*vA);`+TAIL+`}`});
const points=new THREE.Points(pGeo,pMat); points.frustumCulled=false; points.renderOrder=5; scene.add(points);
let pNext=0;
const PCOL=(h,m)=>COL(h).multiplyScalar(m);
const PC={bubble:[PCOL('#e8f6ff',1.6),PCOL('#ffd0f0',1.4),PCOL('#b8f3ff',1.6)],gold:[PCOL('#ffd36b',3),PCOL('#fff2b0',3)],
  bat:[PCOL('#b394ff',1.3),PCOL('#6f58b8',1)],dust:[PCOL('#c9a77a',0.5),PCOL('#8f7556',0.45)],teal:[PCOL('#5fe6ff',1.8),PCOL('#ffffff',1.2)],warp:[PCOL('#b07bff',2.0),PCOL('#5fe6ff',1.8),PCOL('#ffffff',1.4)],berry:[PCOL('#ff4fd8',2.2),PCOL('#ffd0f4',1.8),PCOL('#9f6bff',1.8)],petal:[PCOL('#ff8fbf',1.6),PCOL('#fff6e6',1.4),PCOL('#ffd84a',1.6),PCOL('#c9a8ff',1.5)]};
function emit(pos,n,cols,speed,size,life,grav=0.5,up=0.5){
  _e1.copy(pos).normalize();
  for(let k=0;k<n;k++){
    const i=pNext; pNext=(pNext+1)%PMAX;
    let dx=Math.random()*2-1, dy=Math.random()*2-1, dz=Math.random()*2-1; const l=Math.hypot(dx,dy,dz)||1, sp=speed*(0.35+Math.random()*0.65);
    pVel[i*3]=(dx/l+_e1.x*up)*sp; pVel[i*3+1]=(dy/l+_e1.y*up)*sp; pVel[i*3+2]=(dz/l+_e1.z*up)*sp;
    pPos[i*3]=pos.x; pPos[i*3+1]=pos.y; pPos[i*3+2]=pos.z;
    const c=cols[ri(cols.length)]; pCol[i*3]=c.r; pCol[i*3+1]=c.g; pCol[i*3+2]=c.b;
    pSize0[i]=size*(0.6+Math.random()*0.8); pLife[i]=pMaxL[i]=life*(0.6+Math.random()*0.6); pGrav[i]=grav;
  }
}
function updateParticles(dt){
  const dr=Math.exp(-2.4*dt);
  for(let i=0;i<PMAX;i++){
    if(pLife[i]<=0){ pAlpha[i]=0; continue; }
    pLife[i]-=dt; const j=i*3, x=pPos[j],y=pPos[j+1],z=pPos[j+2], l=Math.hypot(x,y,z)||1, g=pGrav[i]*dt/l;
    pVel[j]=(pVel[j]-x*g)*dr; pVel[j+1]=(pVel[j+1]-y*g)*dr; pVel[j+2]=(pVel[j+2]-z*g)*dr;
    pPos[j]+=pVel[j]*dt; pPos[j+1]+=pVel[j+1]*dt; pPos[j+2]+=pVel[j+2]*dt;
    const t=Math.max(0,pLife[i]/pMaxL[i]); pAlpha[i]=t; pSize[i]=pSize0[i]*(0.45+0.55*t);
  }
  aPos.needsUpdate=aCol.needsUpdate=aSize.needsUpdate=aAlp.needsUpdate=true;
}
function dustAround(T){
  const p=tilePos(T);
  for(let k=0;k<14;k++){ const e=k%4, f=Math.random(); const gx=e===0?p.x+f*TW:e===1?p.x+TW:e===2?p.x+f*TW:p.x, gy=e===0?p.y:e===1?p.y+f*TH:e===2?p.y+TH:p.y+f*TH;
    frameAt(gx,gy); emit(_R.clone().multiplyScalar(0.99),4,PC.dust,0.08,0.016,0.9,0.05,0.8); }
}

/* ---------- creatures ---------- */
const G_SPH=new THREE.SphereGeometry(1,28,20), G_SPHL=new THREE.SphereGeometry(1,14,10), G_CONE=new THREE.ConeGeometry(1,1,12), G_BOX=new THREE.BoxGeometry(1,1,1);
const PM=(c,o)=>new THREE.MeshPhysicalMaterial(Object.assign({color:c,roughness:0.5},o||{}));
const SM=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.6},o||{}));
function part(geo,mat,x,y,z,sx,sy,sz,parent){ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true; if(parent) parent.add(m); return m; }
function alignTo(m,nx,ny,nz){ m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(nx,ny,nz).normalize()); }

const FROG_S=0.034;
function buildFrog(){
  const s=FROG_S, A=1.15*s, B=0.8*s, C=1.02*s, CY=0.8*s;
  const ellZ=(x,y)=>{ const a=x/A, b=(y-CY)/B; return C*Math.sqrt(Math.max(0,1-a*a-b*b)); };
  const ellY=(x,z)=>{ const a=x/A, c=z/C; return CY+B*Math.sqrt(Math.max(0,1-a*a-c*c)); };
  const root=new THREE.Group(), hop=new THREE.Group(); root.add(hop);
  const skin=PM('#2fc4ea',{roughness:0.3,clearcoat:1,clearcoatRoughness:0.18});
  const spotM=PM('#1574ab',{roughness:0.35,clearcoat:1,clearcoatRoughness:0.2});
  const belly=PM('#fff0c8',{roughness:0.55,sheen:0.4,sheenColor:new THREE.Color('#ffffff')});
  const white=PM('#ffffff',{roughness:0.06,clearcoat:1}), black=SM('#0b0f16',{roughness:0.12});
  const orange=SM('#ff9840',{roughness:0.5}), pink=SM('#ff7fa5',{roughness:0.85});
  const mouthM=SM('#0b3346'), tongueM=PM('#ff4f86',{roughness:0.35,clearcoat:0.6});
  part(G_SPH,skin,0,CY,0,A,B,C,hop);
  part(G_SPH,belly,0,0.62*s,0.34*s,0.92*s,0.6*s,0.74*s,hop);
  for(const [x,z,r] of [[-0.48,-0.42,0.26],[0.5,-0.3,0.21],[0.05,-0.72,0.19],[-0.18,0.0,0.14],[0.6,0.28,0.12]]){
    const X=x*s, Z=z*s, Y=ellY(X,Z); const m=part(G_SPHL,spotM,X,Y-0.012*s,Z,r*s,r*s,0.1*s,hop);
    alignTo(m,X/(A*A),(Y-CY)/(B*B),Z/(C*C));
  }
  const eyes=[];
  for(const sd of [-1,1]){
    const eg=new THREE.Group(); eg.position.set(sd*0.5*s,1.42*s,0.2*s); hop.add(eg);
    part(G_SPH,skin,0,-0.1*s,-0.05*s,0.48*s,0.46*s,0.48*s,eg);
    const ball=new THREE.Group(); eg.add(ball);
    part(G_SPH,white,0,0,0.02*s,0.41*s,0.41*s,0.41*s,ball);
    part(G_SPHL,black,0.03*sd*s,0.02*s,0.33*s,0.21*s,0.24*s,0.12*s,ball);
    part(G_SPHL,white,-0.05*sd*s,0.12*s,0.43*s,0.07*s,0.07*s,0.035*s,ball);
    eyes.push(ball);
  }
  const pts=[]; for(let i=0;i<=12;i++){ const t=i/12*2-1, x=t*0.6*s, y=0.86*s-0.13*s*(1-t*t); pts.push(new THREE.Vector3(x,y,ellZ(x,y)+0.012*s)); }
  hop.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,0.045*s,6),mouthM));
  for(const sd of [-1,1]){ const x=sd*0.74*s, y=0.88*s, z=ellZ(x,y); const m=part(G_SPHL,pink,x,y,z-0.03*s,0.17*s,0.11*s,0.06*s,hop); m.castShadow=false; alignTo(m,x/(A*A),(y-CY)/(B*B),z/(C*C)); }
  for(const sd of [-1,1]){
    part(G_SPH,skin,sd*0.46*s,0.3*s,0.6*s,0.17*s,0.3*s,0.17*s,hop);
    part(G_SPHL,orange,sd*0.48*s,0.07*s,0.76*s,0.3*s,0.11*s,0.36*s,hop);
    part(G_SPH,skin,sd*0.88*s,0.42*s,-0.28*s,0.42*s,0.4*s,0.62*s,hop);
    part(G_SPHL,orange,sd*1.0*s,0.06*s,0.16*s,0.38*s,0.1*s,0.55*s,hop);
    for(let k=-1;k<=1;k++) part(G_SPHL,orange,sd*(1.0+k*0.2)*s,0.06*s,(0.66+(k===0?0.07:0))*s,0.1*s,0.08*s,0.1*s,hop);
  }
  const leaf=part(G_SPH,SM('#4cc24a',{roughness:0.45}),0.08*s,1.66*s,-0.32*s,0.5*s,0.07*s,0.34*s,hop); leaf.rotation.set(0.12,0.55,-0.22);
  const stem=part(new THREE.CylinderGeometry(0.035*s,0.035*s,0.32*s,5),SM('#3a7a2a'),-0.12*s,1.78*s,-0.42*s,1,1,1,hop); stem.rotation.z=0.5;
  const tongue=new THREE.Group(); tongue.position.set(0,0.74*s,0.92*s); hop.add(tongue);
  const tg=new THREE.CylinderGeometry(0.08*s,0.1*s,1,8); tg.rotateX(Math.PI/2); tg.translate(0,0,0.5);
  const tStem=new THREE.Mesh(tg,tongueM); tongue.add(tStem);
  const tTip=part(G_SPHL,tongueM,0,0,0,0.17*s,0.13*s,0.17*s,tongue);
  tongue.visible=false;
  return {root,hop,eyes,tongue,tStem,tTip,yaw:0,blinkT:2,tongueT:0,tongueLen:0.05};
}
function wingGeo(r){
  const sh=new THREE.Shape();
  sh.moveTo(0,r*0.25);
  sh.quadraticCurveTo(r*1.2,r*0.9,r*2.6,r*0.35);
  sh.quadraticCurveTo(r*2.15,r*0.0,r*2.0,-r*0.45);
  sh.quadraticCurveTo(r*1.6,-r*0.18,r*1.25,-r*0.72);
  sh.quadraticCurveTo(r*0.88,-r*0.38,r*0.45,-r*0.78);
  sh.quadraticCurveTo(r*0.22,-r*0.3,0,-r*0.3);
  sh.lineTo(0,r*0.25);
  const g=new THREE.ShapeGeometry(sh,8); g.rotateX(Math.PI/2); return g;
}
function buildBat(i){
  const type=i%4, col=COL(BATCOL[type]), r=0.024;
  const root=new THREE.Group(), body=new THREE.Group(); root.add(body);
  const furC=COL('#3a2c58'), scaredC=COL('#9fb2ff'), flashC=COL('#f0f3ff');
  const fur=PM('#3a2c58',{roughness:0.9,sheen:1,sheenRoughness:0.45,sheenColor:new THREE.Color('#b8a4ff')});
  const furL=PM('#5c4b88',{roughness:0.9,sheen:0.7,sheenRoughness:0.5,sheenColor:new THREE.Color('#e0d4ff')});
  const memb=SM(COL('#2a1f46').lerp(col,0.28),{roughness:0.55,side:THREE.DoubleSide});
  const inner=SM(col,{emissive:col,emissiveIntensity:0.2});
  const eyeM=SM('#000000',{emissive:col,emissiveIntensity:2,roughness:0.25});
  const white=SM('#ffffff',{roughness:0.2}), black=SM('#07070c',{roughness:0.3}), bone=SM('#1a1230');
  part(G_SPH,fur,0,0,0,r,r*0.95,r*0.92,body);
  part(G_SPH,furL,0,-r*0.22,r*0.45,r*0.68,r*0.62,r*0.5,body);
  for(const sd of [-1,1]){
    const e=part(G_CONE,fur,sd*r*0.52,r*1.08,-r*0.04,r*0.34,r*0.78,r*0.24,body); e.rotation.z=-sd*0.4;
    const ei=part(G_CONE,inner,sd*r*0.52,r*1.03,r*0.08,r*0.2,r*0.52,r*0.06,body); ei.rotation.z=-sd*0.4; ei.castShadow=false;
  }
  const eyes=[];
  for(const sd of [-1,1]){
    const g=new THREE.Group(); g.position.set(sd*r*0.38,r*0.2,r*0.76); body.add(g);
    part(G_SPH,eyeM,0,0,0,r*0.27,r*0.31,r*0.17,g);
    part(G_SPHL,black,0,-r*0.02,r*0.12,r*0.1,r*0.18,r*0.06,g);
    part(G_SPHL,white,-sd*r*0.08,r*0.12,r*0.15,r*0.055,r*0.055,r*0.03,g);
    eyes.push(g);
  }
  const brows=[]; for(const sd of [-1,1]){ const bw=part(G_BOX,black,sd*r*0.36,r*0.56,r*0.74,r*0.36,r*0.07,r*0.07,body); bw.rotation.z=sd*0.38; brows.push(bw); }
  for(const sd of [-1,1]){ const f=part(G_CONE,white,sd*r*0.14,-r*0.3,r*0.84,r*0.06,r*0.16,r*0.06,body); f.rotation.x=Math.PI; }
  for(const sd of [-1,1]) part(G_SPHL,black,sd*r*0.32,-r*0.92,r*0.1,r*0.12,r*0.08,r*0.16,body);
  const wg=wingGeo(r), wings=[];
  const tips=[[2.6,0.35],[2.0,-0.45],[1.25,-0.72],[0.45,-0.78]];
  for(const sd of [-1,1]){
    const piv=new THREE.Group(); piv.position.set(sd*r*0.78,r*0.18,-r*0.12); body.add(piv);
    const wing=new THREE.Group(); wing.scale.set(sd,1,1); piv.add(wing);
    const w=new THREE.Mesh(wg,memb); w.castShadow=true; wing.add(w);
    for(const [tx,tz] of tips){ const len=Math.hypot(tx,tz)*r; const bn=part(G_BOX,bone,tx*r/2,0.0008,tz*r/2,0.0014,0.0014,len,wing); bn.rotation.y=Math.atan2(tx,tz); bn.castShadow=false; }
    wings.push(piv);
  }
  return {root,body,fur,eyeM,eyes,brows,wings,col,furC,scaredC,flashC,yaw:0,zz:[]};
}
function zTexture(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.font='900 52px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#ffffff'; g.fillText('z',32,34); return canvasTex(c); }
const TEX_Z=zTexture();
const frog=buildFrog(); scene.add(frog.root);
const batObjs=[];
for(let i=0;i<CFG.maxBats;i++){
  const o=buildBat(i); scene.add(o.root);
  for(let k=0;k<2;k++){ const z=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX_Z,color:'#cfd8ff',transparent:true,depthWrite:false})); z.visible=false; scene.add(z); o.zz.push(z); }
  batObjs.push(o);
}
const firefly=new THREE.Group();
part(G_SPHL,SM('#fff6c0',{emissive:'#ffd24a',emissiveIntensity:5}),0,0,0,0.0045,0.0045,0.0045,firefly).castShadow=false;
const ffGlow=new THREE.Sprite(additive(TEX_GLOW,new THREE.Color().setRGB(1.6,1.2,0.4))); ffGlow.scale.setScalar(0.045); firefly.add(ffGlow);
const ffLight=new THREE.PointLight('#ffcc66',0.02,0.5,2); firefly.add(ffLight);
scene.add(firefly);

/* ---------- drifting clouds ---------- */
const CLOUDS=12, PUFFS=7;
const cloudMat=new THREE.ShaderMaterial({uniforms:{uSun:U.sun},transparent:true,depthWrite:false,
  vertexShader:`varying vec3 vN; varying vec3 vW; void main(){ vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0); vW=wp.xyz; vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader:`uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){
    vec3 n=normalize(vN), v=normalize(cameraPosition-vW); float sd=dot(normalize(vW),uSun);
    float day=smoothstep(-0.2,0.3,sd), lit=0.45+0.55*max(dot(n,uSun),0.0);
    vec3 col=mix(vec3(0.07,0.09,0.18),vec3(1.0,0.97,0.93)*lit,day)+vec3(1.0,0.5,0.3)*pow(1.0-abs(sd),8.0)*0.45*day;
    float a=0.85*pow(clamp(dot(n,v),0.0,1.0),0.7)*smoothstep(0.55,1.15,length(cameraPosition-vW));
    gl_FragColor=vec4(col,a);`+TAIL+`}`});
const clouds=inst(new THREE.SphereGeometry(1,16,12),cloudMat,CLOUDS*PUFFS,4); clouds.count=CLOUDS*PUFFS;
const cloudData=[...Array(CLOUDS)].map(()=>{ const axis=randDir(), st=randDir(); st.addScaledVector(axis,-st.dot(axis)).normalize();
  return {axis,st,spd:(0.012+Math.random()*0.02)*(Math.random()<0.5?1:-1),r:1.2+Math.random()*0.08,
    puffs:[...Array(PUFFS)].map(()=>[(Math.random()-0.5)*0.17,Math.random()*0.03,(Math.random()-0.5)*0.08,0.035+Math.random()*0.04])}; });
function syncClouds(time){
  let n=0;
  for(const c of cloudData){
    _e1.copy(c.st).applyAxisAngle(c.axis,time*c.spd);
    _t.set(0,1,0); if(Math.abs(_e1.y)>0.95) _t.set(1,0,0); _t.cross(_e1).normalize(); _b.crossVectors(_t,_e1);
    for(const [ox,oy,oz,sc] of c.puffs){ _P.copy(_e1).multiplyScalar(c.r+oy).addScaledVector(_t,ox).addScaledVector(_b,oz); _M.makeScale(sc,sc,sc).setPosition(_P); clouds.setMatrixAt(n++,_M); }
  }
  clouds.instanceMatrix.needsUpdate=true;
}
/* ---------- aurora curtains over the night-side poles ---------- */
const auroraMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time,uSun:U.sun},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform float uTime; uniform vec3 uSun; varying vec2 vUv; varying vec3 vW; void main(){
    float x=vUv.x*60.0, y=vUv.y;
    float c=(0.5+0.5*sin(x+uTime*0.6+2.0*sin(x*0.37-uTime*0.25)))*(0.6+0.4*sin(x*2.3-uTime*1.1));
    float fall=pow(1.0-y,1.6)*smoothstep(0.0,0.12,y);
    float night=1.0-smoothstep(-0.35,0.05,dot(normalize(vW),uSun));
    vec3 col=mix(vec3(0.15,1.0,0.55),vec3(0.75,0.3,1.0),smoothstep(0.35,0.95,y));
    gl_FragColor=vec4(col*c*fall*night*1.3,1.0);`+TAIL+`}`});
for(const sign of [1,-1]){
  const seg=160, pos=[], uv=[], idx=[];
  for(let j=0;j<=seg;j++){ const lon=j/seg*TAU, lat=sign*(73+2.5*Math.sin(lon*3)+1.5*Math.sin(lon*7+1))*DEG; latLonFrame(lat,lon,_e1,_E2,_N2);
    for(const [r,v] of [[1.07,0],[1.3,1]]){ pos.push(_e1.x*r,_e1.y*r,_e1.z*r); uv.push(j/seg,v); } }
  for(let j=0;j<seg;j++){ const a=j*2; idx.push(a,a+2,a+1,a+1,a+2,a+3); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx);
  const m=new THREE.Mesh(g,auroraMat); m.frustumCulled=false; m.renderOrder=6; scene.add(m);
}
/* ---------- night fireflies (animated entirely on the GPU) ---------- */
const FF_MAX=600;
const ffMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time,uSun:U.sun,uPx:{value:400}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute vec4 aP; uniform float uTime; uniform vec3 uSun; uniform float uPx; varying float vA;
    void main(){ vec3 d=normalize(position+0.035*vec3(sin(uTime*0.6+aP.x),sin(uTime*0.8+aP.y),cos(uTime*0.7+aP.z)));
      vec3 p=d*(1.035+0.03*sin(uTime*1.1+aP.w));
      vA=(1.0-smoothstep(-0.25,0.12,dot(d,uSun)))*pow(0.5+0.5*sin(uTime*2.2+aP.w*5.0),3.0);
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=(vA>0.01?0.012:0.0)*uPx/max(0.01,-mv.z); }`,
  fragmentShader:`varying float vA; void main(){ float r=length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor=vec4(vec3(2.2,2.0,0.6),(1.0-r)*(1.0-r)*vA);`+TAIL+`}`});
const ffPts=(()=>{ const pos=new Float32Array(FF_MAX*3), ph=new Float32Array(FF_MAX*4), d=v3();
  for(let i=0;i<FF_MAX;i++){ randDir(d); pos.set([d.x,d.y,d.z],i*3); ph.set([Math.random()*TAU,Math.random()*TAU,Math.random()*TAU,Math.random()*TAU],i*4); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('aP',new THREE.BufferAttribute(ph,4));
  const p=new THREE.Points(g,ffMat); p.frustumCulled=false; p.renderOrder=5; scene.add(p); return p; })();
/* ---------- butterflies over bloomed islands ---------- */
const BF_PER=3, BF_MAX=NT*BF_PER, _dummy=new THREE.Object3D();
const bfGeo=(()=>{ const pts=[[0,0.15],[-0.9,0.9],[-1.05,0.2],[-0.5,-0.1],[-0.75,-0.75],[-0.2,-0.5],[0,-0.3]], pos=[], idx=[];
  for(const sd of [1,-1]){ const base=pos.length/3; pos.push(0,0,0); for(const [x,z] of pts) pos.push(x*sd,0,z); for(let i=0;i<pts.length-1;i++) idx.push(base,base+1+i,base+2+i); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); return g; })();
const bfMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time,uSun:U.sun},side:THREE.DoubleSide,
  vertexShader:`uniform float uTime; uniform vec3 uSun; varying vec3 vC; varying float vDay; void main(){
    vec3 p=position; float ph=dot(instanceMatrix[3].xyz,vec3(37.1,17.3,23.7)), a=sin(uTime*16.0+ph)*0.95+0.25, ax=abs(p.x);
    p.y=ax*sin(a); p.x=sign(p.x)*ax*cos(a);
    vec4 wp=modelMatrix*instanceMatrix*vec4(p,1.0); vDay=smoothstep(-0.15,0.3,dot(normalize(wp.xyz),uSun));
    #ifdef USE_INSTANCING_COLOR
      vC=instanceColor;
    #else
      vC=vec3(1.0,0.6,0.2);
    #endif
    gl_Position=projectionMatrix*viewMatrix*wp; }`,
  fragmentShader:`varying vec3 vC; varying float vDay; void main(){ gl_FragColor=vec4(vC*(0.25+0.95*vDay),1.0);`+TAIL+`}`});
const butterflies=inst(bfGeo,bfMat,BF_MAX);
for(let i=0;i<BF_MAX;i++) butterflies.setColorAt(i,COL(['#ffb03a','#ff6fa8','#7fd8ff','#fff27a','#c58cff'][i%5]));
function syncButterflies(time){
  let n=0;
  for(const T of tiles){
    if(!T.cleared||gameClock-T.clearedAt<0.8) continue;
    const p=tilePos(T), lf=liftOf(T);
    for(let k=0;k<BF_PER;k++){
      const sg=k%2?1:-1, sp=0.5+0.15*k, a=time*sp*sg+k*2.1+T.id;
      const gx=p.x+TW/2+Math.cos(a)*2.6, gy=p.y+TH/2+Math.sin(a)*1.1, lat=gy2lat(gy);
      const yaw=Math.atan2(-Math.sin(a)*2.6*sg*CW*Math.cos(lat),-Math.cos(a)*1.1*sg*CH);
      poseObject(_dummy,gx,gy,lf+0.045+0.014*Math.sin(time*2.3+k+T.id),yaw); _dummy.scale.setScalar(0.014); _dummy.updateMatrix();
      butterflies.setMatrixAt(n++,_dummy.matrix);
    }
  }
  butterflies.count=n; butterflies.instanceMatrix.needsUpdate=true;
}
/* ---------- golden banners on home islands ---------- */
const flagGeo=new THREE.PlaneGeometry(1,0.62,12,4); flagGeo.translate(0.5,0,0);
const flagBase=flagGeo.attributes.position.array.slice();
const flagMat=new THREE.MeshStandardMaterial({color:'#ffd25e',emissive:'#7a4a00',emissiveIntensity:0.3,roughness:0.55,side:THREE.DoubleSide});
const flags=[...Array(NT)].map(()=>{
  const g=new THREE.Group();
  part(new THREE.CylinderGeometry(0.0016,0.0016,0.09,6).translate(0,0.045,0),SM('#8a6a45'),0,0,0,1,1,1,g);
  part(G_SPHL,SM('#ffe08a',{emissive:'#ffb020',emissiveIntensity:0.8}),0,0.092,0,0.004,0.004,0.004,g);
  const f=new THREE.Mesh(flagGeo,flagMat); f.castShadow=true; f.position.set(0.0016,0.07,0); f.scale.setScalar(0.042); g.add(f);
  g.visible=false; scene.add(g); return g; });
function syncFlags(time){
  const a=flagGeo.attributes.position.array;
  for(let i=0;i<a.length;i+=3){ const x=flagBase[i]; a[i+2]=Math.sin(time*6-x*5)*0.12*x; a[i+1]=flagBase[i+1]-0.04*x*x; }
  flagGeo.attributes.position.needsUpdate=true; flagGeo.computeVertexNormals();
  tiles.forEach((T,i)=>{ const f=flags[i], on=isHome(T); f.visible=on; if(!on) return; const p=tilePos(T); poseObject(f,p.x+0.45,p.y+0.45,liftOf(T),2.3+0.15*Math.sin(time*0.7+i)); });
  for(let i=tiles.length;i<NT;i++) flags[i].visible=false;
}
/* ---------- light pillars: sunstones, berry, waypoint ---------- */
const pillarMat=new THREE.ShaderMaterial({uniforms:{uTime:U.time},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  vertexShader:`varying vec2 vUv; varying vec3 vC; void main(){ vUv=uv;
    #ifdef USE_INSTANCING_COLOR
      vC=instanceColor;
    #else
      vC=vec3(1.0);
    #endif
    gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform float uTime; varying vec2 vUv; varying vec3 vC; void main(){ float a=pow(1.0-vUv.y,2.0)*(0.6+0.25*sin(uTime*4.0+vUv.y*12.0)); gl_FragColor=vec4(vC*1.6,a*0.55);`+TAIL+`}`});
const pillars=inst(new THREE.CylinderGeometry(1,1,1,16,1,true).translate(0,0.5,0),pillarMat,24,6);
for(let i=0;i<24;i++) pillars.setColorAt(i,C_WHITE);
const C_PGOLD=COL('#ffc94a'), C_PBERRY=COL('#ff4fd8'), C_PWAY=COL('#ff7fb8');
function syncPillars(){
  let n=0;
  const add=(R,rad,r,h,c)=>{ surfMatrix(_M,R,0,r,h,r,rad); pillars.setMatrixAt(n,_M); pillars.setColorAt(n,c); n++; };
  for(const T of tiles){ if(T.cleared) continue; const p=tilePos(T), lf=liftOf(T); for(let i=0;i<N;i++) if(T.dots[i]===2&&n<20){ frameAt(p.x+(i%TW)+0.5,p.y+((i/TW)|0)+0.5); add(_R.clone(),1+lf,0.012,0.35,C_PGOLD); } }
  if(berry){ const T=tiles[berry.t], p=tilePos(T); frameAt(p.x+berry.x+0.5,p.y+berry.y+0.5); add(_R.clone(),1+liftOf(T),0.015,0.5,C_PBERRY); }
  if(waypoint>=0){ const T=tiles[waypoint], p=tilePos(T); frameAt(p.x+TW/2,p.y+TH/2); add(_R.clone(),1+liftOf(T),0.05,0.65,C_PWAY); }
  pillars.count=n; pillars.instanceMatrix.needsUpdate=true; if(pillars.instanceColor) pillars.instanceColor.needsUpdate=true;
}
/* ---------- sky berry ---------- */
const berry3=new THREE.Group();
{ const bm=PM('#d6246e',{roughness:0.25,clearcoat:1,emissive:'#5a0a2a',emissiveIntensity:0.5}), r=0.0105;
  for(const [x,y,z] of [[0,0,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0.55,0.8,0.55],[-0.55,0.8,-0.55],[0.55,0.8,-0.55],[-0.55,0.8,0.55],[0,1.5,0],[0,-0.85,0],[0.6,-0.6,0],[-0.6,-0.6,0]]) part(G_SPHL,bm,x*r*0.9,y*r*0.9,z*r*0.9,r,r,r,berry3);
  const lf=part(G_SPHL,SM('#3fae4a'),0,r*2.2,0,r*1.5,r*0.25,r*0.75,berry3); lf.rotation.y=0.6;
  const gl=new THREE.Sprite(additive(TEX_GLOW,new THREE.Color().setRGB(2.0,0.5,1.4))); gl.scale.setScalar(0.1); berry3.add(gl);
  berry3.visible=false; scene.add(berry3); }
function syncBerry(time){
  berry3.visible=!!berry; if(!berry) return;
  const T=tiles[berry.t], p=tilePos(T);
  poseObject(berry3,p.x+berry.x+0.5,p.y+berry.y+0.5,liftOf(T)+0.05+0.008*Math.sin(time*3),time*1.5);
  berry3.scale.setScalar(1.6+0.15*Math.sin(time*5)); if(berry.ttl<3&&(Math.floor(time*8)&1)) berry3.visible=false;
}
/* ---------- shooting stars ---------- */
const meteors=[0,1].map(()=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3)); g.setAttribute('color',new THREE.BufferAttribute(new Float32Array([3,3,3.2,0,0,0]),3));
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})); l.frustumCulled=false; l.visible=false; scene.add(l); return {l,t:1,p:v3(),v:v3()}; });
let meteorTimer=3;
function syncMeteors(dt){
  if((meteorTimer-=dt)<=0){ meteorTimer=3+Math.random()*6; const m=meteors.find(q=>q.t>=1);
    if(m){ randDir(m.p); if(m.p.dot(camera.position)<0) m.p.negate(); m.p.multiplyScalar(45); randDir(m.v); m.v.addScaledVector(m.p,-m.v.dot(m.p)/m.p.lengthSq()).normalize().multiplyScalar(40); m.t=0; } }
  for(const m of meteors){
    if(m.t>=1){ m.l.visible=false; continue; }
    m.t+=dt/0.9; m.l.visible=true; m.p.addScaledVector(m.v,dt);
    const a=m.l.geometry.attributes.position.array, c=m.l.geometry.attributes.color.array, k=Math.sin(Math.PI*Math.min(1,m.t))*3;
    a[0]=m.p.x;a[1]=m.p.y;a[2]=m.p.z; a[3]=m.p.x-m.v.x*0.25;a[4]=m.p.y-m.v.y*0.25;a[5]=m.p.z-m.v.z*0.25; c[0]=c[1]=k; c[2]=k*1.1;
    m.l.geometry.attributes.position.needsUpdate=m.l.geometry.attributes.color.needsUpdate=true;
  }
}

/* ---------- sinkhole vortex ---------- */
const vortexMat=()=>new THREE.ShaderMaterial({uniforms:{uTime:U.time,uOpen:{value:0},uCrack:{value:0}},transparent:true,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-4,
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform float uTime; uniform float uOpen; uniform float uCrack; varying vec2 vUv;
    void main(){
      vec2 p=vUv-0.5; float r=length(p)*2.0, a=atan(p.y,p.x);
      float hole=smoothstep(uOpen*0.82,uOpen*0.82-0.1,r)*step(0.01,uOpen);
      float sw=0.5+0.5*sin(a*3.0+r*16.0-uTime*7.0);
      vec3 deep=mix(vec3(0.01,0.0,0.03),vec3(0.55,0.2,1.1),sw*(1.0-r)*1.3);
      float rim=smoothstep(0.1,0.0,abs(r-uOpen*0.82))*step(0.01,uOpen);
      float cr=pow(abs(sin(a*5.0+sin(r*9.0+a)*0.7)),36.0)*smoothstep(1.0,0.15,r)*uCrack;
      vec3 col=mix(vec3(0.06,0.035,0.02),deep,hole)+vec3(0.8,0.5,1.4)*rim*1.5;
      gl_FragColor=vec4(col,clamp(max(max(hole,rim),cr*0.95),0.0,1.0));`+TAIL+`}`});
function mkVortex(){ const g=new THREE.Group(), m=new THREE.Mesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),vortexMat()); m.renderOrder=2; g.add(m);
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:'#6f5a48',roughness:0.95,flatShading:true}),10); rocks.castShadow=true; rocks.frustumCulled=false; g.add(rocks);
  g.visible=false; scene.add(g); return {g,m,rocks}; }
const sinkVis=mkVortex(), exitVis=mkVortex();
function poseVortex(v,t,x,y,open,crack,time,size){
  const T=tiles[t], p=tilePos(T);
  poseObject(v.g,p.x+x+0.5,p.y+y+0.5,liftOf(T)+0.0012,0); v.g.visible=true;
  v.m.scale.setScalar(size); v.m.material.uniforms.uOpen.value=open; v.m.material.uniforms.uCrack.value=crack;
  for(let i=0;i<10;i++){ const a=i/10*TAU+hash(t,x,i)*0.4, rr=size*(0.32+0.12*open), jig=crack*0.004*Math.sin(time*40+i*3);
    _M.compose(_P.set(Math.cos(a)*rr,0.002+jig+(1-open)*0.0,Math.sin(a)*rr),_Q.setFromAxisAngle(_Y,a*3+i),_S.setScalar(0.006+0.004*hash(i,t,y)+open*0.002)); v.rocks.setMatrixAt(i,_M); }
  v.rocks.instanceMatrix.needsUpdate=true;
}
function syncSinks(time,dt){
  if(sink){ const warn=sink.phase==='warn'; poseVortex(sinkVis,sink.t,sink.x,sink.y,warn?0:sink.open,warn?1-sink.timer/CFG.sinkWarn:Math.max(0.3,sink.open),time,0.16);
    if(warn&&Math.random()<0.5){ const v=cellWorld(sink.t,sink.x,sink.y,0.005); emit(v,1,PC.dust,0.05,0.012,0.6,0.05,0.8); } }
  else sinkVis.g.visible=false;
  if(exitFx){ exitFx.age+=dt; const a=exitFx.age, open=a<0.25?a/0.25:Math.max(0,1-(a-0.6)/0.5);
    if(open<=0&&a>0.6){ exitFx=null; exitVis.g.visible=false; } else poseVortex(exitVis,exitFx.t,exitFx.x,exitFx.y,open,open*0.5,time,0.14); }
  else exitVis.g.visible=false;
}

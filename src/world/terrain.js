import * as THREE from 'three';
import { uTime } from './kit.js';
import { SIZE, SEG, STATIONS, sm, height, pathDist, fbm } from './height.js';
export * from './height.js';

export function buildTerrain() {
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).toNonIndexed(); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const G1 = new THREE.Color('#6fc24a'), G2 = new THREE.Color('#9bd653'), G3 = new THREE.Color('#47a552'), S = new THREE.Color('#f0dfa4'), W = new THREE.Color('#c8ad77'), R = new THREE.Color('#8f9a8a'), PT = new THREE.Color('#e2c98f'), PL = new THREE.Color('#d9d4c2');
  for (let i = 0; i < p.count; i += 3) {
    let cx = 0, cz = 0, cy = 0;
    for (let k = 0; k < 3; k++) { const x = p.getX(i + k), z = p.getZ(i + k), y = height(x, z); p.setY(i + k, y); cx += x; cz += z; cy += y; }
    cx /= 3; cz /= 3; cy /= 3;
    const n = fbm(cx * 0.05, cz * 0.05), f = fbm(cx * .3, cz * .3);
    c.copy(G1).lerp(G2, sm(.35, .7, n)).lerp(G3, sm(.5, .8, f) * .7);
    if (cx < -20) c.lerp(G3, .3);                                   // Orman daha koyu
    if (cy > 6.5) c.lerp(R, sm(6.5, 10, cy));
    const pd = pathDist(cx, cz), hub = Math.hypot(cx, cz);
    if (pd < 2.4) c.lerp(PT, sm(2.4, 1.5, pd));
    if (hub < 17) c.copy(PL).lerp(PT, f * .4);
    for (const s of STATIONS) if (Math.hypot(cx - s.pos[0], cz - s.pos[1]) < s.r + 3) c.lerp(PT, .75);
    if (cy < 0.9) c.lerp(S, sm(.9, .35, cy));
    if (cy < -0.1) c.lerp(W, sm(-.1, -.9, cy));
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  m.receiveShadow = true; return m;
}

export function buildWater(seg) {
  const g = new THREE.PlaneGeometry(2, 2, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, sh = new Float32Array(p.count);
  // Izgara adada sık, açık denizde seyrek olacak şekilde esnetilir.
  const warp = u => { const a = Math.abs(u); return Math.sign(u) * (a < .85 ? a / .85 * SIZE / 2 : SIZE / 2 + ((a - .85) / .15) ** 2 * 900); };
  for (let i = 0; i < p.count; i++) { const x = warp(p.getX(i)), z = warp(p.getZ(i)); p.setX(i, x); p.setZ(i, z); sh[i] = height(x, z); }
  g.setAttribute('aDepth', new THREE.BufferAttribute(sh, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, uniforms: { uTime, fogC: { value: new THREE.Color('#bfe9e6') } },
    vertexShader: `attribute float aDepth; varying float vD; varying vec3 vW; uniform float uTime;
      void main(){ vD=aDepth; vec3 p=position; p.y+=sin(p.x*.25+uTime)*.05+cos(p.z*.3+uTime*1.2)*.05; vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying float vD; varying vec3 vW; uniform float uTime; uniform vec3 fogC;
      void main(){ float s=clamp(1.+vD*.42,0.,1.); vec3 deep=vec3(.05,.45,.6), sh=vec3(.28,.85,.82); vec3 c=mix(deep,sh,s);
        float r=sin(vW.x*.9+uTime*.8+sin(vW.z*.5))*sin(vW.z*.8-uTime*.6+sin(vW.x*.4)); c+=smoothstep(.72,.98,r)*.22;
        float foam=smoothstep(.72,1.,s)*(.55+.45*sin(uTime*1.4+vD*18.)); c=mix(c,vec3(1.),foam*.65);
        float d=length(vW-cameraPosition); c=mix(c,fogC,1.-exp(-d*d*.000012));
        gl_FragColor=vec4(c,mix(.72,.96,1.-s));
#include <colorspace_fragment>
      }`,
  });
  const w = new THREE.Mesh(g, m); w.position.y = 0; return w;
}

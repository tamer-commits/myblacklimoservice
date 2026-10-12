'use client';
// Experimental hero treatment — "The Lacquer". Renders a glossy, reflective
// surface in place of the static homepage master image, with ripples that
// follow the cursor/touch. Falls back to the original approved hero image
// (see ../heroData.js) on reduced-motion, WebGL failure, or any runtime
// error, so the production fallback is always the same image this is
// replacing — nothing is lost if this doesn't work on a given device.
import { useEffect, useRef, useState } from 'react';
import { HERO_IMAGE } from '../heroData';

export default function LacquerHero({ alt }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      setFailed(true);
      return;
    }
    let destroy = () => {};
    let cancelled = false;
    import('three')
      .then((THREE) => {
        if (cancelled || !mountRef.current) return;
        try {
          destroy = mountScene(THREE, mountRef.current);
        } catch (e) {
          console.error('LacquerHero: falling back to static hero image', e);
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      destroy();
    };
  }, []);

  if (failed) {
    return (
      <img
        className="masterImage"
        src={HERO_IMAGE}
        alt={alt}
        width={1536}
        height={512}
        loading="eager"
      />
    );
  }

  return (
    <>
      <div ref={mountRef} className="masterImage lacquerHero" aria-hidden="true" />
      {/* keep the real alt text available to screen readers / crawlers */}
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      >
        {alt}
      </span>
    </>
  );
}

function mountScene(THREE, container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x050707, 1);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;

  const geo = new THREE.PlaneGeometry(2, 2, 64, 48);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0.5, 0.5, -999)) },
      uStrength: { value: new Array(8).fill(1) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 pos = position;
        float bulge = (1.0 - (uv.x*2.0-1.0)*(uv.x*2.0-1.0)) * 0.03;
        pos.z += bulge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAspect;
      uniform vec3 uRipples[8];
      uniform float uStrength[8];

      void main(){
        vec2 uv = vUv;
        vec2 wuv = vec2(uv.x*uAspect, uv.y);

        vec2 disp = vec2(0.0);
        for (int i=0;i<8;i++){
          vec2 rp = vec2(uRipples[i].x*uAspect, uRipples[i].y);
          float age = uTime - uRipples[i].z;
          float waveR = age*0.9;
          float dist = distance(wuv, rp);
          float band = exp(-pow((dist-waveR)*14.0, 2.0));
          float amp = band * exp(-age*1.7) * 0.05 * uStrength[i];
          vec2 dir = (wuv-rp)/max(dist,0.0001);
          disp += dir*amp;
        }
        vec2 duv = uv + disp;

        /* base: near-black brand ink, lifting slightly toward the open
           (text-free) right side of the banner */
        float leftGuard = smoothstep(0.0, 0.46, duv.x);
        vec3 base = mix(vec3(0.0196,0.0275,0.0275), vec3(0.055,0.062,0.065), leftGuard*0.6);

        /* soft reflected light streaks — warm gold + cool white, evoking
           harbour lights on a wet lacquered surface */
        vec3 glow = vec3(0.0);
        float streaks[6]; streaks[0]=0.54; streaks[1]=0.63; streaks[2]=0.74; streaks[3]=0.82; streaks[4]=0.90; streaks[5]=0.97;
        for (int i=0;i<6;i++){
          float sx = streaks[i] * uAspect;
          float dx = (duv.x*uAspect - sx);
          float core = exp(-pow(dx*9.0, 2.0));
          float fall = pow(1.0 - clamp(duv.y,0.0,1.0), 1.6);
          bool warm = (i == 1 || i == 3 || i == 5);
          vec3 c = warm ? vec3(0.851,0.647,0.149) : vec3(0.80,0.84,0.86);
          glow += c * core * fall * (warm ? 0.5 : 0.28) * leftGuard;
        }

        /* slow specular sheen sweeping across the surface */
        float sweepX = mod(uTime*0.035, 1.6) - 0.3;
        float sheen = exp(-pow((duv.x*uAspect - sweepX*uAspect)*2.2, 2.0)) * 0.10 * leftGuard;

        /* ripple rings themselves catch the light */
        float ring = 0.0;
        for (int i=0;i<8;i++){
          vec2 rp = vec2(uRipples[i].x*uAspect, uRipples[i].y);
          float age = uTime - uRipples[i].z;
          float waveR = age*0.9;
          float dist = distance(wuv, rp);
          ring += exp(-pow((dist-waveR)*20.0,2.0)) * exp(-age*1.5) * 0.4;
        }

        vec3 color = base + glow + sheen*vec3(1.0,0.92,0.75) + ring*vec3(0.95,0.8,0.5);
        color = mix(color, vec3(0.0196,0.0275,0.0275), (1.0-leftGuard)*0.55);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const plane = new THREE.Mesh(geo, mat);
  scene.add(plane);

  const MAX_RIPPLES = 8;
  let idx = 0;
  const clock = new THREE.Clock();
  function addRipple(u, v, strength) {
    mat.uniforms.uRipples.value[idx].set(u, v, clock.getElapsedTime());
    mat.uniforms.uStrength.value[idx] = strength;
    idx = (idx + 1) % MAX_RIPPLES;
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mat.uniforms.uAspect.value = w / h;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  setTimeout(() => addRipple(0.42, 0.5, 1.2), 300);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let lastAdd = 0;
  function toRipple(clientX, clientY, strength) {
    const r = container.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(plane)[0];
    if (hit && hit.uv) {
      const now = clock.getElapsedTime();
      if (strength > 1 || now - lastAdd > 0.05) {
        addRipple(hit.uv.x, hit.uv.y, strength || 0.6);
        lastAdd = now;
      }
    }
  }
  let down = false;
  const onMove = (e) => toRipple(e.clientX, e.clientY, down ? 1.0 : 0.5);
  const onDown = (e) => { down = true; toRipple(e.clientX, e.clientY, 1.1); };
  const onUp = () => { down = false; };
  const onTouchMove = (e) => { if (e.touches[0]) toRipple(e.touches[0].clientX, e.touches[0].clientY, 0.6); };
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchstart', onTouchMove, { passive: true });

  let raf = requestAnimationFrame(function loop() {
    mat.uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  });

  return function destroy() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchstart', onTouchMove);
    geo.dispose();
    mat.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
  };
}

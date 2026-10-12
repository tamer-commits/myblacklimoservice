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
           (text-free) right

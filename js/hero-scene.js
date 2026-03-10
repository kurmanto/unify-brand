import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ─── Simplex 3D noise GLSL — Ashima Arts ─────────────────────────────
const noiseGLSL = `
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const hashGLSL = `
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
`;

// ─── Star Helpers ─────────────────────────────────────────────────────
function blackbodyColor(tempK) {
  const t = tempK / 100.0;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  return [
    Math.min(Math.max(r, 0), 255) / 255,
    Math.min(Math.max(g, 0), 255) / 255,
    Math.min(Math.max(b, 0), 255) / 255,
  ];
}

function powerLawBrightness(exp) {
  return Math.pow(Math.random(), exp);
}

function randomStarTemperature() {
  const roll = Math.random();
  if (roll < 0.05) return 20000 + Math.random() * 15000;
  if (roll < 0.15) return 8000 + Math.random() * 4000;
  if (roll < 0.45) return 5000 + Math.random() * 1500;
  if (roll < 0.80) return 3500 + Math.random() * 1500;
  return 2500 + Math.random() * 1000;
}

function tintStarColor(bb, tint, amt) {
  return [
    bb[0] * (1 - amt) + tint.r * amt,
    bb[1] * (1 - amt) + tint.g * amt,
    bb[2] * (1 - amt) + tint.b * amt,
  ];
}

// ─── DeepGreen Palette (locked) ──────────────────────────────────────
const palette = {
  color0: new THREE.Vector3(1.0, 0.97, 0.92),
  color1: new THREE.Vector3(0.6, 0.95, 0.7),
  color2: new THREE.Vector3(0.16, 0.55, 0.35),
  color3: new THREE.Vector3(0.15, 0.65, 0.6),
  color4: new THREE.Vector3(0.08, 0.3, 0.15),
  glowColor:    new THREE.Color(0.3, 0.8, 0.45),
  sparkColor:   new THREE.Color(0.4, 1.0, 0.55),
  ringColor:    new THREE.Vector3(0.5, 1.0, 0.7),
  ambientColor: 0x88ccaa,
  nebulaColor1: new THREE.Color(0.1, 0.4, 0.25),
  nebulaColor2: new THREE.Color(0.08, 0.25, 0.35),
  starTint:     new THREE.Color(0.7, 1.0, 0.85),
  meteorColor:  new THREE.Color(0.5, 1.0, 0.7),
  galaxyCore:   new THREE.Color(0.15, 0.5, 0.3),
  galaxyArm1:   new THREE.Color(0.08, 0.35, 0.2),
  galaxyArm2:   new THREE.Color(0.05, 0.2, 0.3),
  nebulaVivid1: new THREE.Color(0.05, 0.85, 0.70),
  nebulaVivid2: new THREE.Color(0.10, 0.70, 0.95),
  nebulaVivid3: new THREE.Color(0.20, 0.95, 0.40),
  nebulaVivid4: new THREE.Color(0.02, 0.45, 0.55),
  bgColor: 0x060606,
  textShadow: 'rgba(42,107,69, 0.3)',
};

// ─── initHero ────────────────────────────────────────────────────────
export function initHero(container, options = {}) {
  const isMobile = options.mobile ?? (window.innerWidth < 768);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starMultiplier = isMobile ? 0.4 : 1;
  const maxPixelRatio = isMobile ? 1.5 : 2;

  let paused = false;
  let destroyed = false;
  let scrollOffset = 0;

  // IO-based pause: stop rAF entirely when hero offscreen
  let heroPaused = false;
  let frameCount = 0;
  const ATOM_BASE_Y = 0.75;
  const BASE_BLOOM = 0.55;

  const width = () => container.clientWidth;
  const height = () => container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 100);
  camera.position.set(0, 0.7, 5.5);

  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
  renderer.setSize(width(), height());
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxPixelRatio));
  renderer.setClearColor(0x060606);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.prepend(renderer.domElement);

  // Post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width(), height()),
    0.55, 0.4, 0.75
  );
  composer.addPass(bloomPass);

  const chromaticShader = {
    uniforms: {
      tDiffuse: { value: null },
      uIntensity: { value: 0.003 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 center = vec2(0.5);
        vec2 dir = vUv - center;
        float dist = length(dir);
        float offset = dist * uIntensity;
        vec2 shift = normalize(dir + 0.0001) * offset;
        float r = texture2D(tDiffuse, vUv + shift).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - shift).b;
        float a = texture2D(tDiffuse, vUv).a;
        gl_FragColor = vec4(r, g, b, a);
      }
    `,
  };
  const chromaticPass = new ShaderPass(chromaticShader);
  composer.addPass(chromaticPass);
  composer.addPass(new OutputPass());

  // Scene graph
  const atomGroup = new THREE.Group();
  scene.add(atomGroup);

  // ─── 1. Energy Sphere ───────────────────────────────────────────────
  const energyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor0: { value: palette.color0.clone() },
      uColor1: { value: palette.color1.clone() },
      uColor2: { value: palette.color2.clone() },
      uColor3: { value: palette.color3.clone() },
      uColor4: { value: palette.color4.clone() },
      uFade: { value: 1.0 },
    },
    vertexShader: `
      ${noiseGLSL}
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying float vDisplacement;

      void main() {
        vec3 pos = position;
        float slow = uTime * 0.35;
        float n = snoise(pos * 1.4 + slow) * 0.15;
        n += snoise(pos * 2.8 + uTime * 0.5) * 0.05;
        float displacement = n;
        vDisplacement = displacement;

        vec3 displaced = pos + normal * displacement;
        vPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
        vWorldPos = displaced;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      ${noiseGLSL}
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uColor0;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPos;
      varying float vDisplacement;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.5);

        float n1 = snoise(vWorldPos * 1.8 + uTime * 0.3) * 0.5 + 0.5;
        float n2 = snoise(vWorldPos * 3.5 + uTime * 0.5) * 0.3;

        float colorParam = clamp(n1 + n2 * fresnel, 0.0, 1.0);

        vec3 color;
        if (colorParam < 0.25) {
          color = mix(uColor0, uColor1, colorParam / 0.25);
        } else if (colorParam < 0.5) {
          color = mix(uColor1, uColor2, (colorParam - 0.25) / 0.25);
        } else if (colorParam < 0.75) {
          color = mix(uColor2, uColor3, (colorParam - 0.5) / 0.25);
        } else {
          color = mix(uColor3, uColor4, (colorParam - 0.75) / 0.25);
        }

        color = mix(color, uColor0, fresnel * 0.4);

        float pulse = 0.85 + 0.15 * sin(uTime * 0.8);
        float intensity = (1.2 + fresnel * 1.5) * pulse;

        gl_FragColor = vec4(color * intensity, (0.9 + fresnel * 0.1) * uFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const energySphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, isMobile ? 32 : 48, isMobile ? 32 : 48),
    energyMat
  );
  atomGroup.add(energySphere);

  // ─── 2. Outer Glow Halo ────────────────────────────────────────────
  const outerGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 32, 32),
    new THREE.MeshBasicMaterial({
      color: palette.glowColor.clone(),
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  atomGroup.add(outerGlow);

  // ─── 3. Spark Particles ────────────────────────────────────────────
  const SPARK_COUNT = isMobile ? 50 : 100;
  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  const sparkColors = new Float32Array(SPARK_COUNT * 3);
  const sparkSizes = new Float32Array(SPARK_COUNT);
  const sparkOpacities = new Float32Array(SPARK_COUNT);
  const sparkVelocities = [];
  const sparkLifetimes = new Float32Array(SPARK_COUNT);
  const sparkMaxLifetimes = new Float32Array(SPARK_COUNT);

  let sc = palette.sparkColor;
  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkMaxLifetimes[i] = 0.8 + Math.random() * 1.7;
    sparkLifetimes[i] = Math.random() * sparkMaxLifetimes[i];
    sparkSizes[i] = 0.012 + Math.random() * 0.016;
    sparkOpacities[i] = 1.0;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = 0.2 + Math.random() * 0.6;
    sparkVelocities.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed
    ));

    const brightness = 0.8 + Math.random() * 1.0;
    sparkColors[i * 3]     = sc.r * brightness;
    sparkColors[i * 3 + 1] = sc.g * brightness;
    sparkColors[i * 3 + 2] = sc.b * brightness;
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1));
  sparkGeo.setAttribute('aOpacity', new THREE.BufferAttribute(sparkOpacities, 1));

  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {
      uFade: { value: 1.0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vColor = color;
        vOpacity = aOpacity;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uFade;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float falloff = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * falloff, vOpacity * falloff * uFade);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  atomGroup.add(sparkPoints);

  // ─── 4. Orbit Rings ────────────────────────────────────────────────
  const ringDefs = [
    { rx: 2.0, ry: 0.7,  rotZ: -20 * Math.PI / 180, baseOpacity: 0.6,  tube: 0.012, phase: 0.0 },
    { rx: 2.0, ry: 0.85, rotZ:  15 * Math.PI / 180, baseOpacity: 0.35, tube: 0.010, phase: 2.1 },
    { rx: 2.0, ry: 0.9,  rotZ:  50 * Math.PI / 180, baseOpacity: 0.2,  tube: 0.010, phase: 4.2 },
  ];

  const ringCurves = [];
  const ringMeshes = [];
  const ringMaterials = [];

  for (const def of ringDefs) {
    const ellipse = new THREE.EllipseCurve(0, 0, def.rx, def.ry, 0, Math.PI * 2, false, 0);
    const pts2d = ellipse.getPoints(128);
    const pts3d = pts2d.map(p => new THREE.Vector3(p.x, 0, p.y));
    const curve = new THREE.CatmullRomCurve3(pts3d, true);
    ringCurves.push(curve);

    const tubeGeo = new THREE.TubeGeometry(curve, 128, def.tube, 8, true);

    const ringMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseOpacity: { value: def.baseOpacity },
        uRingColor: { value: palette.ringColor.clone() },
        uPhase: { value: def.phase },
        uFade: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uFade;
        uniform float uBaseOpacity;
        uniform vec3 uRingColor;
        uniform float uPhase;
        varying vec2 vUv;

        void main() {
          float t = vUv.x;

          float pulse1 = pow(max(sin((t - uTime * 0.3 + uPhase) * 6.2831853 * 2.0), 0.0), 6.0);
          float pulse2 = pow(max(sin((t - uTime * 0.2 + uPhase * 0.7) * 6.2831853 * 3.0), 0.0), 6.0);
          float pulse3 = pow(max(sin((t + uTime * 0.15 + uPhase * 1.3) * 6.2831853 * 1.0), 0.0), 12.0);

          float brightness = uBaseOpacity + 0.25 * pulse1 + 0.15 * pulse2 + 0.1 * pulse3;

          vec3 color = mix(vec3(1.0), uRingColor, 0.2 + 0.15 * (pulse1 + pulse2));

          gl_FragColor = vec4(color * brightness, brightness * uFade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const mesh = new THREE.Mesh(tubeGeo, ringMat);
    mesh.rotation.z = def.rotZ;
    atomGroup.add(mesh);
    ringMeshes.push(mesh);
    ringMaterials.push(ringMat);
  }

  // ─── 5. Orbit Particles (electrons) ────────────────────────────────
  const PARTICLES_PER_RING = 4;
  const orbitParticleGroups = [];

  for (let ri = 0; ri < ringDefs.length; ri++) {
    const count = PARTICLES_PER_RING;
    const posArr = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.04,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.rotation.z = ringDefs[ri].rotZ;
    atomGroup.add(points);

    const phases = [];
    for (let i = 0; i < count; i++) {
      phases.push(i / count);
    }
    const speed = 0.15 + ri * 0.02;

    orbitParticleGroups.push({ points, curve: ringCurves[ri], phases, speed, posArr });
  }

  // ─── 6. Cosmic Space Background ────────────────────────────────────
  const gCenterX = -0.15 * 20;
  const gCenterY = 0.1 * 20;
  const spiralTightness = 0.5;

  function spiralArmBias(x, y) {
    const dx = x - gCenterX, dy = y - gCenterY;
    const r = Math.sqrt(dx * dx + dy * dy) / 20;
    const theta = Math.atan2(dy, dx);
    return Math.cos((theta - Math.log(r + 0.001) / spiralTightness) * 2.0);
  }

  function placeStar(spread, useSpiralBias, useCenterBias) {
    let x, y;
    if (useSpiralBias) {
      let attempts = 0;
      do {
        x = (Math.random() - 0.5) * spread;
        y = (Math.random() - 0.5) * spread;
        if (spiralArmBias(x, y) > 0.3 || attempts >= 5) break;
        attempts++;
      } while (true);
    } else {
      x = (Math.random() - 0.5) * spread;
      y = (Math.random() - 0.5) * spread;
    }
    if (useCenterBias) {
      const bias = 0.3;
      x = x * (1 - bias) + gCenterX * bias + (Math.random() - 0.5) * 2;
      y = y * (1 - bias) + gCenterY * bias + (Math.random() - 0.5) * 2;
    }
    return [x, y];
  }

  // Background Stars
  function createBackgroundStars() {
    const count = Math.round(6000 * starMultiplier);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const [x, y] = placeStar(20, false, false);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -12 + Math.random() * 8;

      const brightness = powerLawBrightness(3.5);
      const brightnessScale = 0.4 + brightness * 0.6;
      sizes[i] = (0.03 + Math.random() * 0.08) * brightnessScale;
      phases[i] = Math.random() * 43758.0;

      const temp = randomStarTemperature();
      const bb = blackbodyColor(temp);
      const tinted = tintStarColor(bb, palette.starTint, 0.2);
      colors[i * 3]     = tinted[0] * brightnessScale;
      colors[i * 3 + 1] = tinted[1] * brightnessScale;
      colors[i * 3 + 2] = tinted[2] * brightnessScale;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        varying float vPhase;
        varying vec3 vColor;
        void main() {
          vPhase = aPhase;
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(aSize * (600.0 / -mvPos.z), 1.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        ${hashGLSL}
        uniform float uTime;
        varying float vPhase;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float falloff = 1.0 - smoothstep(0.0, 0.5, d);
          float breath = 0.75 + 0.25 * sin(uTime * 0.3 + vPhase * 6.2831853);
          float alpha = breath * falloff * 1.1;
          gl_FragColor = vec4(vColor * breath * 1.5, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const points = new THREE.Points(geo, mat);
    points.userData.rotSpeed = 0.003;
    scene.add(points);
    return { points, mat };
  }

  // Mid-field Stars
  function createMidFieldStars() {
    const count = Math.round(2500 * starMultiplier);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const brightnesses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const [x, y] = placeStar(20, false, false);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -12 + Math.random() * 10;

      const brightness = powerLawBrightness(2.5);
      brightnesses[i] = 0.3 + brightness * 0.7;
      sizes[i] = (0.04 + Math.random() * 0.10) * (0.5 + brightness * 0.5);
      phases[i] = Math.random() * Math.PI * 2;

      const temp = randomStarTemperature();
      const bb = blackbodyColor(temp);
      const tinted = tintStarColor(bb, palette.starTint, 0.15);
      colors[i * 3]     = tinted[0];
      colors[i * 3 + 1] = tinted[1];
      colors[i * 3 + 2] = tinted[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute float aBrightness;
        varying float vPhase;
        varying vec3 vColor;
        varying float vBrightness;
        void main() {
          vPhase = aPhase;
          vColor = color;
          vBrightness = aBrightness;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(aSize * (500.0 / -mvPos.z), 1.2);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vPhase;
        varying vec3 vColor;
        varying float vBrightness;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float falloff = 1.0 - smoothstep(0.0, 0.5, d);

          float t1 = sin(uTime * 0.3 + vPhase * 6.2831853);
          float t2 = sin(uTime * 0.5 + vPhase * 4.1234567);
          float twinkle = 0.7 + 0.3 * ((t1 + t2) / 2.0 * 0.5 + 0.5);

          twinkle = mix(0.8, twinkle, 0.3 + vBrightness * 0.7);

          float chromaShift = 0.01 * vBrightness * sin(uTime * 0.3 + vPhase);
          vec3 color = vColor;
          color.r += chromaShift;
          color.b -= chromaShift;

          float alpha = vBrightness * twinkle * falloff * 1.2;
          gl_FragColor = vec4(color * twinkle * 1.2, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const points = new THREE.Points(geo, mat);
    points.userData.rotSpeed = 0.008;
    scene.add(points);
    return { points, mat };
  }

  // Feature Stars
  function createFeatureStars() {
    const count = Math.round(200 * starMultiplier);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const brightnesses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 20;
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -8 + Math.random() * 8;

      const brightness = powerLawBrightness(1.5);
      brightnesses[i] = 0.4 + brightness * 0.6;
      sizes[i] = (0.06 + Math.random() * 0.14) * (0.5 + brightness * 0.5);
      phases[i] = Math.random() * Math.PI * 2;

      const temp = randomStarTemperature();
      const bb = blackbodyColor(temp);
      const tinted = tintStarColor(bb, palette.starTint, 0.12);
      colors[i * 3]     = tinted[0];
      colors[i * 3 + 1] = tinted[1];
      colors[i * 3 + 2] = tinted[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlareIntensity: { value: 0 },
        uFlareSeed: { value: 0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute float aBrightness;
        varying float vPhase;
        varying vec3 vColor;
        varying float vBrightness;
        void main() {
          vPhase = aPhase;
          vColor = color;
          vBrightness = aBrightness;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(aSize * (450.0 / -mvPos.z), 2.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        ${hashGLSL}
        uniform float uTime;
        uniform float uFlareIntensity;
        uniform float uFlareSeed;
        varying float vPhase;
        varying vec3 vColor;
        varying float vBrightness;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;

          float core = exp(-d * d * 80.0);
          float halo = 0.02 / (d * d + 0.01);
          float shape = core + halo * vBrightness;

          float t1 = sin(uTime * 0.3 + vPhase * 6.2831853);
          float t2 = sin(uTime * 0.5 + vPhase * 4.1234567);
          float twinkle = 0.7 + 0.3 * ((t1 + t2) / 2.0 * 0.5 + 0.5);

          float chromaShift = 0.02 * vBrightness * sin(uTime * 0.3 + vPhase);
          vec3 color = vColor;
          color.r += chromaShift;
          color.b -= chromaShift;

          color = mix(color, vec3(1.0), core * vBrightness * 0.6);

          float flareMask = step(0.92, hash(vPhase * 100.0 + uFlareSeed));
          float flareBoost = 1.0 + uFlareIntensity * flareMask * 3.0;

          float alpha = vBrightness * twinkle * shape * flareBoost;
          gl_FragColor = vec4(color * twinkle * flareBoost, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const points = new THREE.Points(geo, mat);
    points.userData.rotSpeed = 0.012;
    scene.add(points);
    return { points, mat };
  }

  // Background Galaxies
  function createBackgroundGalaxies() {
    const count = 20;
    const positions = new Float32Array(count * 3);
    const aAxes = new Float32Array(count);
    const aRotations = new Float32Array(count);
    const aBrights = new Float32Array(count);
    const aTypes = new Float32Array(count);
    const aSizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = (Math.random() - 0.5) * 20;
        y = (Math.random() - 0.5) * 14;
      } while (Math.sqrt(x * x + y * y) < 3.0);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -10 - Math.random() * 4;

      aAxes[i] = 0.3 + Math.random() * 0.7;
      aRotations[i] = Math.random() * Math.PI * 2;
      aBrights[i] = 0.06 + Math.random() * 0.10;
      aTypes[i] = Math.random() < 0.4 ? 1.0 : 0.0;
      aSizes[i] = 0.4 + Math.random() * 0.5;

      const mix = Math.random();
      const gc = palette.galaxyCore, ga1 = palette.galaxyArm1, ga2 = palette.galaxyArm2;
      colors[i * 3]     = gc.r * (1 - mix) + ga1.r * mix;
      colors[i * 3 + 1] = gc.g * (1 - mix) + ga1.g * mix;
      colors[i * 3 + 2] = gc.b * (1 - mix) + ga2.b * mix;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aAxis', new THREE.BufferAttribute(aAxes, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(aRotations, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(aBrights, 1));
    geo.setAttribute('aType', new THREE.BufferAttribute(aTypes, 1));
    geo.setAttribute('aGalaxySize', new THREE.BufferAttribute(aSizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aAxis;
        attribute float aRot;
        attribute float aBright;
        attribute float aType;
        attribute float aGalaxySize;
        varying float vAxis;
        varying float vRot;
        varying float vBright;
        varying float vType;
        varying vec3 vColor;
        void main() {
          vAxis = aAxis;
          vRot = aRot;
          vBright = aBright;
          vType = aType;
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(aGalaxySize * (800.0 / -mvPos.z), 4.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        ${hashGLSL}
        uniform float uTime;
        varying float vAxis;
        varying float vRot;
        varying float vBright;
        varying float vType;
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float c = cos(vRot), s = sin(vRot);
          vec2 ruv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
          ruv.y /= max(vAxis, 0.3);
          float r = length(ruv);
          if (r > 0.5) discard;

          float body = exp(-r * r * 25.0);

          float spiral = 0.0;
          if (vType > 0.5) {
            float theta = atan(ruv.y, ruv.x);
            spiral = 0.3 * pow(max(cos(theta * 2.0 - r * 12.0 + uTime * 0.02), 0.0), 3.0);
            spiral *= smoothstep(0.0, 0.1, r) * smoothstep(0.45, 0.15, r);
          }

          float noise = hash2(ruv * 10.0 + 7.3) * 0.15;

          float brightness = (body + spiral + noise * body) * vBright;
          float alpha = brightness;
          gl_FragColor = vec4(vColor * brightness, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, mat };
  }

  const starLayers = [
    createBackgroundStars(),
    createMidFieldStars(),
    createFeatureStars(),
  ];
  const bgGalaxies = createBackgroundGalaxies();

  // ─── Spiral Galaxy Background Shader ───────────────────────────────
  const galaxyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1.0 },
      uGalaxyCore: { value: palette.galaxyCore.clone() },
      uGalaxyArm1: { value: palette.galaxyArm1.clone() },
      uGalaxyArm2: { value: palette.galaxyArm2.clone() },
      uGalaxyCenter: { value: new THREE.Vector2(-0.15, 0.1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      ${noiseGLSL}
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uGalaxyCore;
      uniform vec3 uGalaxyArm1;
      uniform vec3 uGalaxyArm2;
      uniform vec2 uGalaxyCenter;
      varying vec2 vUv;

      void main() {
        vec2 center = uGalaxyCenter;
        vec2 p = vUv - 0.5 - center;
        p *= 1.5;

        float r = length(p);
        float theta = atan(p.y, p.x);
        theta += uTime * 0.005;

        float warp1 = snoise(vec3(p * 1.5, uTime * 0.004)) * 0.5;
        float warp2 = snoise(vec3(p * 3.0 + 7.0, uTime * 0.006)) * 0.25;
        float warpedTheta = theta + warp1 + warp2;

        float arm1 = cos(warpedTheta * 2.0 - log(r + 0.001) * 2.0);
        float arm2 = cos(warpedTheta * 2.0 - log(r + 0.001) * 2.0 + 2.4) * 0.7;
        float arm3 = cos(warpedTheta * 2.0 - log(r + 0.001) * 2.0 + 4.2) * 0.4;
        float arms = max(max(arm1, arm2), arm3);
        arms = smoothstep(-0.3, 0.8, arms);

        arms *= smoothstep(0.04, 0.18, r);

        float fbm = snoise(vec3(p * 4.0, uTime * 0.003)) * 0.5
                   + snoise(vec3(p * 8.0 + 3.0, uTime * 0.005)) * 0.25
                   + snoise(vec3(p * 16.0 + 7.0, uTime * 0.007)) * 0.125;
        float wisps = smoothstep(-0.2, 0.6, fbm) * 0.4;

        float breakup = snoise(vec3(p * 5.0 + 15.0, uTime * 0.004));
        arms *= 0.6 + 0.4 * breakup;

        float coreWarp = snoise(vec3(p * 2.0, uTime * 0.01)) * 0.08;
        vec2 coreP = p + coreWarp;
        coreP.x *= 1.3;
        float core = exp(-dot(coreP, coreP) * 5.0) * 0.8;

        float falloff = smoothstep(0.9, 0.05, r);

        float diffuse = exp(-r * r * 1.5) * 0.08;

        float brightness = (arms * 0.14 + wisps * 0.06 + core * 0.12 + diffuse) * falloff;

        vec3 color = mix(uGalaxyCore * 1.3, uGalaxyArm1, smoothstep(0.0, 0.25, r));
        color = mix(color, uGalaxyArm2, smoothstep(0.25, 0.6, r));

        gl_FragColor = vec4(color * brightness, brightness) * uFade;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const galaxyQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    galaxyMat
  );
  galaxyQuad.position.set(0, 0, -15);
  scene.add(galaxyQuad);

  // ─── Nebula Clouds ─────────────────────────────────────────────────
  const nebulaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uFade:   { value: 1.0 },
      uVivid1: { value: new THREE.Vector3(palette.nebulaVivid1.r, palette.nebulaVivid1.g, palette.nebulaVivid1.b) },
      uVivid2: { value: new THREE.Vector3(palette.nebulaVivid2.r, palette.nebulaVivid2.g, palette.nebulaVivid2.b) },
      uVivid3: { value: new THREE.Vector3(palette.nebulaVivid3.r, palette.nebulaVivid3.g, palette.nebulaVivid3.b) },
      uVivid4: { value: new THREE.Vector3(palette.nebulaVivid4.r, palette.nebulaVivid4.g, palette.nebulaVivid4.b) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uVivid1;
      uniform vec3 uVivid2;
      uniform vec3 uVivid3;
      uniform vec3 uVivid4;
      varying vec2 vUv;

      ${noiseGLSL}

      float fbm(vec3 p) {
        float val = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          val += amp * snoise(p * freq);
          p.xy = rot * p.xy;
          p.yz = rot * p.yz;
          freq *= 2.1;
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec2 uv = vUv - 0.5;
        float slowTime = uTime * 0.012;

        float warp1 = snoise(vec3(uv * 1.5, slowTime * 0.7)) * 0.35;
        float warp2 = snoise(vec3(uv * 1.5 + 5.0, slowTime * 0.6)) * 0.35;
        vec2 warped = uv + vec2(warp1, warp2);

        float density = fbm(vec3(warped * 2.5, slowTime));
        density = smoothstep(-0.1, 0.8, density);

        float region1 = smoothstep(-0.2, 0.4, snoise(vec3(uv * 1.2 + 10.0, slowTime * 0.5)));
        float region2 = smoothstep(-0.2, 0.4, snoise(vec3(uv * 1.3 + 20.0, slowTime * 0.4)));
        float region3 = 1.0 - region1 * 0.5 - region2 * 0.5;
        float totalW = region1 + region2 + region3 + 0.001;
        region1 /= totalW;
        region2 /= totalW;
        region3 /= totalW;

        vec3 nebulaCol = uVivid1 * region1 + uVivid2 * region2 + uVivid3 * region3;

        float coreBoost = smoothstep(0.6, 0.9, density);
        nebulaCol = mix(nebulaCol, nebulaCol + vec3(0.15, 0.12, 0.08), coreBoost * 0.5);

        float dust = fbm(vec3(warped * 4.0 + 30.0, slowTime * 0.8));
        dust = smoothstep(0.05, 0.55, dust);
        nebulaCol = mix(nebulaCol, uVivid4, dust * 0.45);
        density *= mix(1.0, 0.3, dust);

        float vignette = 1.0 - smoothstep(0.25, 0.52, length(uv));
        float alpha = density * vignette * 0.12;
        alpha = clamp(alpha, 0.0, 1.0);

        gl_FragColor = vec4(nebulaCol * alpha, alpha) * uFade;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const nebulaQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    nebulaMat
  );
  nebulaQuad.position.set(0, 0, -14);
  scene.add(nebulaQuad);

  // ─── Energy Pulse Waves ────────────────────────────────────────────
  const pulseMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1.0 },
      uGlowColor: { value: new THREE.Vector3(palette.glowColor.r, palette.glowColor.g, palette.glowColor.b) },
      uRingColor: { value: palette.ringColor.clone() },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uGlowColor;
      uniform vec3 uRingColor;
      varying vec2 vUv;
      void main() {
        vec2 center = vec2(0.5);
        float dist = length(vUv - center) * 2.0;
        float totalAlpha = 0.0;
        vec3 totalColor = vec3(0.0);

        float period = 12.0;
        float expandTime = 4.0;
        float raw = mod(uTime, period);
        if (raw < expandTime) {
          float phase = raw / expandTime;
          float ringPos = phase;
          float ringDist = abs(dist - ringPos);
          float ringWidth = 0.04 + phase * 0.02;
          float ring = smoothstep(ringWidth, 0.0, ringDist);
          float fade = (1.0 - phase) * (1.0 - phase);
          totalAlpha += ring * fade * 0.15;
          totalColor += mix(uGlowColor, uRingColor, phase) * ring * fade * 0.15;
        }

        if (totalAlpha < 0.001) discard;
        gl_FragColor = vec4(totalColor, totalAlpha * uFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const pulsePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    pulseMat
  );
  scene.add(pulsePlane);

  // ─── Cosmic Dust ───────────────────────────────────────────────────
  function createCosmicDust() {
    const count = isMobile ? 40 : 80;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const tint = palette.starTint;
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = -6 - Math.random() * 6;
      sizes[i] = 0.08 + Math.random() * 0.15;
      opacities[i] = 0.04 + Math.random() * 0.03;
      phases[i] = Math.random() * Math.PI * 2;
      colors[i * 3]     = tint.r * (0.6 + Math.random() * 0.4);
      colors[i * 3 + 1] = tint.g * (0.6 + Math.random() * 0.4);
      colors[i * 3 + 2] = tint.b * (0.6 + Math.random() * 0.4);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 1.0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        attribute float aPhase;
        varying float vOpacity;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uFade;
        void main() {
          vOpacity = aOpacity * uFade;
          vColor = color;
          vec3 pos = position;
          pos.x += sin(uTime * 0.07 + aPhase) * 0.3;
          pos.y += cos(uTime * 0.05 + aPhase * 1.3) * 0.2;
          pos.z += sin(uTime * 0.03 + aPhase * 0.7) * 0.15;
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = max(aSize * (500.0 / -mvPos.z), 1.5);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float falloff = exp(-d * d * 12.0);
          gl_FragColor = vec4(vColor * falloff, vOpacity * falloff);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, mat };
  }

  const cosmicDust = createCosmicDust();

  // ─── Shooting Stars (Meteors) ──────────────────────────────────────
  const meteors = [];
  for (let mi = 0; mi < 3; mi++) {
    const meteGeo = new THREE.BufferGeometry();
    const metePos = new Float32Array(6);
    meteGeo.setAttribute('position', new THREE.BufferAttribute(metePos, 3));
    const meteMat = new THREE.LineBasicMaterial({
      color: palette.meteorColor.clone(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const meteLine = new THREE.Line(meteGeo, meteMat);
    scene.add(meteLine);

    meteors.push({
      line: meteLine,
      geo: meteGeo,
      mat: meteMat,
      positions: metePos,
      idle: true,
      timer: 8 + Math.random() * 12,
      elapsed: 0,
      duration: 0.4 + Math.random() * 0.3,
      startPos: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
    });
  }

  function resetMeteor(m) {
    m.idle = true;
    m.timer = 8 + Math.random() * 12;
    m.elapsed = 0;
    m.duration = 0.4 + Math.random() * 0.3;
    m.mat.opacity = 0;
  }

  function fireMeteor(m) {
    m.idle = false;
    m.elapsed = 0;
    const side = Math.floor(Math.random() * 4);
    const sx = side === 0 ? -8 : side === 1 ? 8 : (Math.random() - 0.5) * 16;
    const sy = side === 2 ? -6 : side === 3 ? 6 : (Math.random() - 0.5) * 12;
    m.startPos.set(sx, sy, -5 - Math.random() * 5);
    const angle = Math.atan2(-sy, -sx) + (Math.random() - 0.5) * 0.5;
    const speed = 15 + Math.random() * 10;
    m.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, 0);
  }

  // ─── Comet ─────────────────────────────────────────────────────────
  const COMET_TAIL_VERTS = isMobile ? 25 : 50;
  const COMET_TRAIL_COUNT = isMobile ? 15 : 30;

  const cometTailPositions = new Float32Array(COMET_TAIL_VERTS * 3);
  const cometTailColors = new Float32Array(COMET_TAIL_VERTS * 3);
  const cometTailGeo = new THREE.BufferGeometry();
  cometTailGeo.setAttribute('position', new THREE.BufferAttribute(cometTailPositions, 3));
  cometTailGeo.setAttribute('color', new THREE.BufferAttribute(cometTailColors, 3));
  const cometTailMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const cometTailLine = new THREE.Line(cometTailGeo, cometTailMat);
  scene.add(cometTailLine);

  const cometTrailPositions = new Float32Array(COMET_TRAIL_COUNT * 3);
  const cometTrailSizes = new Float32Array(COMET_TRAIL_COUNT);
  const cometTrailOpacities = new Float32Array(COMET_TRAIL_COUNT);
  const cometTrailColors = new Float32Array(COMET_TRAIL_COUNT * 3);
  const cometTrailGeo = new THREE.BufferGeometry();
  cometTrailGeo.setAttribute('position', new THREE.BufferAttribute(cometTrailPositions, 3));
  cometTrailGeo.setAttribute('aSize', new THREE.BufferAttribute(cometTrailSizes, 1));
  cometTrailGeo.setAttribute('aOpacity', new THREE.BufferAttribute(cometTrailOpacities, 1));
  cometTrailGeo.setAttribute('color', new THREE.BufferAttribute(cometTrailColors, 3));

  const cometTrailMat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vOpacity = aOpacity;
        vColor = color;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(aSize * (300.0 / -mvPos.z), 1.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float falloff = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * falloff, vOpacity * falloff);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const cometTrailPoints = new THREE.Points(cometTrailGeo, cometTrailMat);
  scene.add(cometTrailPoints);

  const cometHeadGeo = new THREE.BufferGeometry();
  const cometHeadPos = new Float32Array(3);
  const cometHeadSize = new Float32Array([0.15]);
  cometHeadGeo.setAttribute('position', new THREE.BufferAttribute(cometHeadPos, 3));
  cometHeadGeo.setAttribute('aSize', new THREE.BufferAttribute(cometHeadSize, 1));
  const cometHeadMat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float aSize;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(aSize * (600.0 / -mvPos.z), 3.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = exp(-d * d * 20.0);
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.9) * glow * 2.0, glow);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const cometHeadPoints = new THREE.Points(cometHeadGeo, cometHeadMat);
  cometHeadPoints.visible = false;
  scene.add(cometHeadPoints);

  const cometState = {
    active: false,
    timer: 40 + Math.random() * 40,
    elapsed: 0,
    duration: 3.0,
    p0: new THREE.Vector3(),
    p1: new THREE.Vector3(),
    p2: new THREE.Vector3(),
    posHistory: [],
    trailIndex: 0,
  };
  for (let i = 0; i < COMET_TAIL_VERTS; i++) {
    cometState.posHistory.push(new THREE.Vector3(0, 0, -100));
  }

  const mc = palette.meteorColor;

  function fireComet(cs) {
    cs.active = true;
    cs.elapsed = 0;
    cs.duration = 2.5 + Math.random() * 1.5;
    cs.trailIndex = 0;
    const edge = Math.random() * 4;
    const z = -4 - Math.random() * 4;
    if (edge < 1) cs.p0.set(-9, (Math.random() - 0.5) * 8, z);
    else if (edge < 2) cs.p0.set(9, (Math.random() - 0.5) * 8, z);
    else if (edge < 3) cs.p0.set((Math.random() - 0.5) * 12, 7, z);
    else cs.p0.set((Math.random() - 0.5) * 12, -7, z);
    cs.p2.set(-cs.p0.x * (0.5 + Math.random() * 0.5), -cs.p0.y * (0.5 + Math.random() * 0.5), z);
    cs.p1.set(
      (cs.p0.x + cs.p2.x) * 0.5 + (Math.random() - 0.5) * 6,
      (cs.p0.y + cs.p2.y) * 0.5 + (Math.random() - 0.5) * 4,
      z
    );
    for (let i = 0; i < COMET_TAIL_VERTS; i++) {
      cs.posHistory[i].copy(cs.p0);
    }
    for (let i = 0; i < COMET_TRAIL_COUNT; i++) {
      cometTrailOpacities[i] = 0;
    }
    cometHeadPoints.visible = true;
    cometTailMat.opacity = 1;
  }

  const flareState = {
    active: false,
    timer: 15 + Math.random() * 15,
    elapsed: 0,
    duration: 0,
    seed: 0,
  };

  // ─── Mouse ─────────────────────────────────────────────────────────
  const mouse = new THREE.Vector2(0, 0);
  const targetMouse = new THREE.Vector2(0, 0);

  if (!isMobile) {
    window.addEventListener('mousemove', onMouseMove);
  }

  function onMouseMove(e) {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  // ─── Helpers ───────────────────────────────────────────────────────
  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // ─── Animation Loop ────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let animId = null;

  function animate() {
    if (destroyed) return;
    animId = requestAnimationFrame(animate);
    if (paused) return;

    const rawT = clock.getElapsedTime();
    const t = prefersReducedMotion ? rawT * 0.2 : rawT;
    const dt = clock.getDelta() || 0.016;

    mouse.lerp(targetMouse, 0.04);

    // Scroll-driven atom positioning
    const heroH = window.innerHeight;
    const scrollFraction = Math.min(scrollOffset / heroH, 2.0);

    // Auto-rotation
    atomGroup.rotation.y = t * 0.08 + mouse.x * 0.15;
    atomGroup.rotation.x = 0;

    // ── Scroll-driven atom: shrink + fade in place ──
    const shrink = smoothstep(0.15, 0.75, scrollFraction);
    const easedShrink = shrink * shrink; // power2.in
    atomGroup.scale.setScalar(1.0 - 0.85 * easedShrink);
    atomGroup.position.y = ATOM_BASE_Y + scrollFraction * 0.3; // gentle drift up

    // Gradual gas cloud fade
    const gasFade = 1.0 - smoothstep(0.40, 0.80, scrollFraction);
    const dustFade = 1.0 - smoothstep(0.45, 0.85, scrollFraction);
    const pastHero = scrollFraction >= 0.9;

    galaxyMat.uniforms.uFade.value = gasFade;
    nebulaMat.uniforms.uFade.value = gasFade;
    cosmicDust.mat.uniforms.uFade.value = dustFade;

    galaxyQuad.visible = gasFade > 0.001;
    nebulaQuad.visible = gasFade > 0.001;
    pulsePlane.visible = scrollFraction < 0.8;

    // Hide meteors + comet when scrolled past
    for (const m of meteors) m.line.visible = !pastHero;
    cometTailLine.visible = !pastHero;
    cometTrailPoints.visible = !pastHero;
    cometHeadPoints.visible = !pastHero || cometState.active;

    // Bloom fade
    bloomPass.strength = scrollFraction > 0.2
      ? BASE_BLOOM * (1.0 - smoothstep(0.2, 0.70, scrollFraction))
      : BASE_BLOOM;

    // Chromatic aberration → passthrough when past hero
    chromaticPass.uniforms.uIntensity.value = scrollFraction >= 0.8 ? 0 : 0.003;

    // Reduce pixel ratio when deeply scrolled
    const targetPR = scrollFraction > 0.9 ? 1 : Math.min(devicePixelRatio, maxPixelRatio);
    if (renderer.getPixelRatio() !== targetPR) renderer.setPixelRatio(targetPR);

    // Atom opacity fade (overlaps shrink, finishes just before about section)
    const atomFade = 1.0 - smoothstep(0.40, 0.75, scrollFraction);
    const atomVisible = atomFade > 0.001;

    // Frame skip when past hero — render at ~30fps
    frameCount++;
    if (pastHero && frameCount % 2 !== 0) return;


    if (atomVisible) {
      // Nucleus breathing
      const breathe = 1.0 + 0.05 * Math.sin(t * 0.67 * Math.PI * 2);
      atomGroup.children[0].scale.setScalar(breathe);
      atomGroup.children[1].scale.setScalar(breathe);

      // Shader times
      energyMat.uniforms.uTime.value = t % 1000.0;
      pulseMat.uniforms.uTime.value = t % 1000.0;
      pulseMat.uniforms.uFade.value = atomFade;

      // Drive atom fade uniforms
      energyMat.uniforms.uFade.value = atomFade;
      sparkMat.uniforms.uFade.value = atomFade;
      outerGlow.material.opacity = 0.04 * atomFade;
      for (const rm of ringMaterials) rm.uniforms.uFade.value = atomFade;
      for (const group of orbitParticleGroups) group.points.material.opacity = 0.9 * atomFade;

      atomGroup.updateMatrixWorld();
      pulsePlane.position.setFromMatrixPosition(atomGroup.matrixWorld);
      pulsePlane.quaternion.copy(camera.quaternion);

      for (let i = 0; i < ringMaterials.length; i++) {
        ringMaterials[i].uniforms.uTime.value = t % 1000.0;
      }

      // Orbit particles
      for (const group of orbitParticleGroups) {
        const posAttr = group.points.geometry.attributes.position;
        for (let i = 0; i < group.phases.length; i++) {
          const param = (group.phases[i] + t * group.speed) % 1;
          const pt = group.curve.getPointAt(param);
          posAttr.setXYZ(i, pt.x, pt.y, pt.z);
        }
        posAttr.needsUpdate = true;
      }

      // Spark particles
      const sparkPosAttr = sparkPoints.geometry.attributes.position;
      const sparkColAttr = sparkPoints.geometry.attributes.color;
      const sparkSizeAttr = sparkPoints.geometry.attributes.aSize;
      const sparkOpacityAttr = sparkPoints.geometry.attributes.aOpacity;
      for (let i = 0; i < sparkLifetimes.length; i++) {
        sparkLifetimes[i] += 0.016;

        if (sparkLifetimes[i] >= sparkMaxLifetimes[i]) {
          sparkLifetimes[i] = 0;
          sparkMaxLifetimes[i] = 0.8 + Math.random() * 1.7;
          sparkPositions[i * 3] = 0;
          sparkPositions[i * 3 + 1] = 0;
          sparkPositions[i * 3 + 2] = 0;
          sparkSizes[i] = 0.012 + Math.random() * 0.016;

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = 0.2 + Math.random() * 0.6;
          sparkVelocities[i].set(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed
          );
        }

        const vel = sparkVelocities[i];
        sparkPositions[i * 3]     += vel.x * 0.016;
        sparkPositions[i * 3 + 1] += vel.y * 0.016;
        sparkPositions[i * 3 + 2] += vel.z * 0.016;

        const lifeRatio = 1.0 - (sparkLifetimes[i] / sparkMaxLifetimes[i]);
        const fade = lifeRatio * lifeRatio * lifeRatio;
        const brightness = (0.8 + Math.random() * 0.4) * fade;
        sparkColors[i * 3]     = sc.r * brightness;
        sparkColors[i * 3 + 1] = sc.g * brightness;
        sparkColors[i * 3 + 2] = sc.b * brightness;
        sparkOpacityAttr.array[i] = fade;
      }
      sparkPosAttr.needsUpdate = true;
      sparkColAttr.needsUpdate = true;
      sparkSizeAttr.needsUpdate = true;
      sparkOpacityAttr.needsUpdate = true;
    }

    // Star layers with scroll parallax
    const scrollParallaxY = -(scrollOffset / heroH);
    const parallaxRates = [0.03, 0.06, 0.12]; // bg, mid, feature
    for (let li = 0; li < starLayers.length; li++) {
      const layer = starLayers[li];
      layer.mat.uniforms.uTime.value = t % 1000.0;
      const depth = (li + 1) / starLayers.length;
      layer.points.position.x = mouse.x * 0.012 * depth;
      layer.points.position.y = mouse.y * 0.012 * depth + scrollParallaxY * parallaxRates[li];
    }

    bgGalaxies.mat.uniforms.uTime.value = t % 1000.0;
    bgGalaxies.points.position.x = mouse.x * 0.03;
    bgGalaxies.points.position.y = mouse.y * 0.03 + scrollParallaxY * 0.08;

    cosmicDust.mat.uniforms.uTime.value = t % 1000.0;
    cosmicDust.points.position.x = mouse.x * 0.08;
    cosmicDust.points.position.y = mouse.y * 0.08 + scrollParallaxY * 0.12;

    // Flare state machine
    const fs = flareState;
    if (!fs.active) {
      fs.timer -= dt;
      if (fs.timer <= 0) {
        fs.active = true;
        fs.elapsed = 0;
        fs.duration = 1.5 + Math.random() * 2.0;
        fs.seed = Math.random() * 1000;
      }
    }
    if (fs.active) {
      fs.elapsed += dt;
      const progress = fs.elapsed / fs.duration;
      if (progress >= 1.0) {
        fs.active = false;
        fs.timer = 10 + Math.random() * 20;
        const featureMat = starLayers[2].mat;
        if (featureMat.uniforms.uFlareIntensity) {
          featureMat.uniforms.uFlareIntensity.value = 0;
        }
      } else {
        let intensity;
        if (progress < 0.2) {
          intensity = progress / 0.2;
        } else {
          intensity = Math.exp(-(progress - 0.2) * 3.0);
        }
        const featureMat = starLayers[2].mat;
        if (featureMat.uniforms.uFlareIntensity) {
          featureMat.uniforms.uFlareIntensity.value = intensity;
          featureMat.uniforms.uFlareSeed.value = fs.seed;
        }
      }
    }

    // Galaxy + nebula with scroll parallax (skip when fully faded)
    if (gasFade > 0.001) {
      galaxyMat.uniforms.uTime.value = t % 10000.0;
      galaxyQuad.position.x = mouse.x * 0.15;
      galaxyQuad.position.y = mouse.y * 0.15 + scrollParallaxY * 0.08;

      nebulaMat.uniforms.uTime.value = t % 10000.0;
      nebulaQuad.position.x = mouse.x * 0.12;
      nebulaQuad.position.y = mouse.y * 0.12 + scrollParallaxY * 0.08;
    }

    // Shooting stars (skip physics when hidden)
    if (pastHero) { /* meteors hidden, skip */ } else
    for (const m of meteors) {
      if (m.idle) {
        m.timer -= 0.016;
        if (m.timer <= 0) fireMeteor(m);
      } else {
        m.elapsed += 0.016;
        const progress = m.elapsed / m.duration;
        if (progress >= 1.0) {
          resetMeteor(m);
        } else {
          const headX = m.startPos.x + m.velocity.x * m.elapsed;
          const headY = m.startPos.y + m.velocity.y * m.elapsed;
          const tailLen = 0.06;
          const tailX = headX - m.velocity.x * tailLen;
          const tailY = headY - m.velocity.y * tailLen;
          m.positions[0] = tailX; m.positions[1] = tailY; m.positions[2] = m.startPos.z;
          m.positions[3] = headX; m.positions[4] = headY; m.positions[5] = m.startPos.z;
          m.geo.attributes.position.needsUpdate = true;
          const fadeIn = Math.min(progress * 5.0, 1.0);
          const fadeOut = 1.0 - Math.max((progress - 0.7) / 0.3, 0.0);
          m.mat.opacity = fadeIn * fadeOut * 0.8;
        }
      }
    }

    // Comet (skip when past hero)
    const cs = cometState;
    if (!pastHero) {
      if (!cs.active) {
        cs.timer -= dt;
        if (cs.timer <= 0) {
          fireComet(cs);
        }
      }
    }
    if (cs.active) {
      cs.elapsed += dt;
      const progress = cs.elapsed / cs.duration;
      if (progress >= 1.0) {
        cs.active = false;
        cs.timer = 40 + Math.random() * 40;
        cometHeadPoints.visible = false;
        cometTailMat.opacity = 0;
        for (let i = 0; i < COMET_TRAIL_COUNT; i++) {
          cometTrailOpacities[i] = 0;
        }
        cometTrailGeo.attributes.aOpacity.needsUpdate = true;
      } else {
        const it = progress;
        const omt = 1.0 - it;
        const headX = omt * omt * cs.p0.x + 2 * omt * it * cs.p1.x + it * it * cs.p2.x;
        const headY = omt * omt * cs.p0.y + 2 * omt * it * cs.p1.y + it * it * cs.p2.y;
        const headZ = cs.p0.z;

        cometHeadPos[0] = headX;
        cometHeadPos[1] = headY;
        cometHeadPos[2] = headZ;
        cometHeadGeo.attributes.position.needsUpdate = true;

        for (let i = COMET_TAIL_VERTS - 1; i > 0; i--) {
          cs.posHistory[i].copy(cs.posHistory[i - 1]);
        }
        cs.posHistory[0].set(headX, headY, headZ);

        const fadeIn = Math.min(progress * 4.0, 1.0);
        const fadeOut = 1.0 - Math.max((progress - 0.7) / 0.3, 0.0);
        const cometAlpha = fadeIn * fadeOut;
        cometTailMat.opacity = cometAlpha;

        for (let i = 0; i < COMET_TAIL_VERTS; i++) {
          const p = cs.posHistory[i];
          cometTailPositions[i * 3]     = p.x;
          cometTailPositions[i * 3 + 1] = p.y;
          cometTailPositions[i * 3 + 2] = p.z;
          const tailFade = 1.0 - (i / COMET_TAIL_VERTS);
          const bf = tailFade * tailFade * cometAlpha;
          const headMix = tailFade * tailFade;
          cometTailColors[i * 3]     = (1.0 * headMix + mc.r * (1 - headMix)) * bf;
          cometTailColors[i * 3 + 1] = (0.98 * headMix + mc.g * (1 - headMix)) * bf;
          cometTailColors[i * 3 + 2] = (0.9 * headMix + mc.b * (1 - headMix)) * bf;
        }
        cometTailGeo.attributes.position.needsUpdate = true;
        cometTailGeo.attributes.color.needsUpdate = true;

        const ti = cs.trailIndex % COMET_TRAIL_COUNT;
        cometTrailPositions[ti * 3]     = headX + (Math.random() - 0.5) * 0.15;
        cometTrailPositions[ti * 3 + 1] = headY + (Math.random() - 0.5) * 0.15;
        cometTrailPositions[ti * 3 + 2] = headZ;
        cometTrailSizes[ti] = 0.02 + Math.random() * 0.03;
        cometTrailOpacities[ti] = 0.6 * cometAlpha;
        cometTrailColors[ti * 3]     = mc.r * 0.8;
        cometTrailColors[ti * 3 + 1] = mc.g * 0.8;
        cometTrailColors[ti * 3 + 2] = mc.b * 0.8;
        cs.trailIndex++;

        for (let i = 0; i < COMET_TRAIL_COUNT; i++) {
          cometTrailOpacities[i] *= 0.95;
        }
        cometTrailGeo.attributes.position.needsUpdate = true;
        cometTrailGeo.attributes.aSize.needsUpdate = true;
        cometTrailGeo.attributes.aOpacity.needsUpdate = true;
        cometTrailGeo.attributes.color.needsUpdate = true;
      }
    }

    composer.render();
  }

  animate();

  // ─── IntersectionObserver: fully pause rAF when hero offscreen ──────
  const heroSection = document.getElementById('hero');
  if (heroSection) {
    const heroObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const offscreen = entry.intersectionRatio === 0;
        if (offscreen && !heroPaused) {
          heroPaused = true;
          if (animId) { cancelAnimationFrame(animId); animId = null; }
          clock.stop();
        } else if (!offscreen && heroPaused) {
          heroPaused = false;
          clock.start();
          clock.getDelta(); // clear accumulated delta
          animId = requestAnimationFrame(animate);
        }
      }
    }, { threshold: [0] });
    heroObserver.observe(heroSection);
  }

  // ─── Resize via ResizeObserver ──────────────────────────────────────
  const ro = new ResizeObserver(() => {
    if (destroyed) return;
    const w = width();
    const h = height();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });
  ro.observe(container);

  // ─── Control API ───────────────────────────────────────────────────
  return {
    setScrollProgress(sy) {
      scrollOffset = sy;
    },
    pause() {
      paused = true;
      clock.stop();
    },
    resume() {
      paused = false;
      clock.start();
    },
    isHeroPaused() { return heroPaused; },
    destroy() {
      destroyed = true;
      if (animId) cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      composer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}

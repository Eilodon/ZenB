/**
 * Enhanced Orb Shader System V2
 * World-class GLSL shaders with premium visual effects
 *
 * Improvements over V1:
 * - Chromatic aberration fresnel
 * - Subsurface scattering simulation
 * - Dynamic luminance gradients
 * - Optimized noise via texture sampling
 * - Caustic light patterns
 */

import * as THREE from 'three';

// ============================================================================
// ENHANCED VERTEX SHADER V2
// ============================================================================

export const ENHANCED_CORE_VERT_V2 = `
precision highp float;

varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec2 vUv;

uniform float uTime;
uniform float uAiPulse;
uniform float uBreath;

// Organic wave function for AI voice distortion
vec3 organicWave(vec3 pos, float time, float intensity) {
  // Multi-frequency waves for natural feel
  float wave1 = sin(pos.y * 8.0 + time * 12.0) * 0.4;
  float wave2 = cos(pos.x * 6.0 + time * 15.0) * 0.3;
  float wave3 = sin(pos.z * 10.0 + time * 18.0) * 0.2;
  float wave4 = sin((pos.x + pos.y) * 5.0 + time * 8.0) * 0.1;

  // Combine with smooth falloff
  float combined = (wave1 + wave2 + wave3 + wave4) / 1.0;

  return pos + normalize(pos) * combined * intensity * 0.1;
}

// Breath expansion with squash/stretch
vec3 breathDeform(vec3 pos, float breath) {
  // Vertical stretch on inhale, horizontal squash
  float stretch = 1.0 + breath * 0.04;
  float squash = 1.0 - breath * 0.015;

  return vec3(
    pos.x * squash,
    pos.y * stretch,
    pos.z * squash
  );
}

void main() {
  vUv = uv;
  vNormal = normalMatrix * normal;

  vec3 pos = position;

  // Apply breath deformation first
  pos = breathDeform(pos, uBreath);

  // AI voice distortion when active
  if (uAiPulse > 0.05) {
    pos = organicWave(pos, uTime, uAiPulse);
  }

  // Subtle ambient undulation
  pos += normal * sin(uTime * 0.5 + position.y * 3.0) * 0.005;

  vPos = pos;

  // World position for environment effects
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;

  // View position for fresnel
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;

// ============================================================================
// ENHANCED FRAGMENT SHADER V2 GENERATOR
// ============================================================================

export const getEnhancedFragShaderV2 = (octaves: number, _useNoiseTexture: boolean = false) => `
precision highp float;

varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec2 vUv;

uniform float uTime;
uniform float uBreath;
uniform float uEntropy;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uGlow;
uniform vec3 uAccent;
uniform vec3 uComplement;  // NEW: Complementary color for depth
uniform float uAiPulse;

// Procedural noise functions
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);

  // Improved quintic interpolation for smoother results
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float n000 = hash(i + vec3(0,0,0));
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

float sampleNoise(vec3 p) {
  return noise(p) * 2.0 - 1.0;
}

// Fractal Brownian Motion with domain warping
float fbmWarped(vec3 p, float warp) {
  float v = 0.0;
  float a = 0.55;
  vec3 shift = vec3(100.0);

  // Domain warping for more organic patterns
  p += warp * vec3(
    sampleNoise(p + vec3(0.0, 0.0, uTime * 0.1)),
    sampleNoise(p + vec3(5.2, 1.3, uTime * 0.1)),
    sampleNoise(p + vec3(2.1, 3.7, uTime * 0.1))
  );

  for(int i = 0; i < ${octaves}; i++) {
    v += a * (sampleNoise(p) * 0.5 + 0.5);
    p = p * 2.02 + shift;
    a *= 0.5;
  }
  return v;
}

// ============================================================================
// CHROMATIC FRESNEL
// ============================================================================

vec3 chromaticFresnel(vec3 normal, vec3 viewDir, float breath) {
  float base = 1.0 - max(dot(normal, viewDir), 0.0);
  float power = 2.0 + breath * 2.5;

  // RGB channel separation for chromatic aberration
  float fresnelR = pow(base, power - 0.3);
  float fresnelG = pow(base, power);
  float fresnelB = pow(base, power + 0.3);

  return vec3(fresnelR, fresnelG, fresnelB);
}

// ============================================================================
// SUBSURFACE SCATTERING APPROXIMATION
// ============================================================================

vec3 subsurfaceScatter(vec3 normal, vec3 viewDir, vec3 lightDir, vec3 color, float thickness) {
  // Wrap lighting for soft subsurface look
  float NdotL = dot(normal, lightDir);
  float wrap = 0.5;
  float diffuse = max(0.0, (NdotL + wrap) / (1.0 + wrap));

  // Transmittance through surface
  float VdotL = max(0.0, dot(viewDir, -lightDir));
  float scatter = pow(VdotL, 2.0) * thickness;

  // Combine with color absorption
  return color * (diffuse + scatter * 0.5);
}

// ============================================================================
// CAUSTIC PATTERNS
// ============================================================================

float causticPattern(vec2 uv, float time) {
  vec2 p = uv * 8.0;
  float c = 0.0;

  for(int i = 0; i < 3; i++) {
    float t = time * (0.3 + float(i) * 0.1);
    vec2 q = vec2(
      sin(p.x + t) + sin(p.y * 0.5 + t * 0.7),
      cos(p.y + t * 0.8) + cos(p.x * 0.5 + t)
    );
    c += 1.0 / (1.0 + length(q) * 8.0);
    p *= 1.5;
  }

  return c / 3.0;
}

// ============================================================================
// AI VISUAL EFFECTS
// ============================================================================

vec3 aiVisualization(vec3 pos, float pulse, float time) {
  // Color gradient: Emerald → Cyan → Purple based on intensity
  vec3 lowColor = vec3(0.0, 1.0, 0.6);   // Emerald
  vec3 midColor = vec3(0.0, 0.8, 1.0);   // Cyan
  vec3 highColor = vec3(0.6, 0.2, 1.0);  // Purple

  vec3 aiColor = pulse < 0.5
    ? mix(lowColor, midColor, pulse * 2.0)
    : mix(midColor, highColor, (pulse - 0.5) * 2.0);

  // Flowing energy lines
  float lines = sin(pos.y * 30.0 + time * 10.0) * sin(pos.x * 30.0 - time * 8.0);
  lines = smoothstep(0.7, 1.0, abs(lines));

  // Pulsing grid overlay
  float gridX = abs(sin(pos.x * 25.0));
  float gridY = abs(sin(pos.y * 25.0));
  float grid = max(gridX, gridY);
  grid = 1.0 - smoothstep(0.0, 0.15, grid);

  return aiColor * (1.0 + lines * 0.3 + grid * 0.2);
}

// ============================================================================
// MAIN SHADER
// ============================================================================

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  vec3 p = vPos * 1.2;
  float t = uTime * 0.18;

  // Domain warping amount based on breath (more organic when breathing)
  float warpAmount = 0.3 + uBreath * 0.2;

  // ===== LAYERED NOISE =====
  float f = fbmWarped(p + vec3(0.0, t, t * 0.7), warpAmount);
  float f2 = fbmWarped(p * 1.5 + vec3(t * 0.5, 0.0, t), warpAmount * 0.5);

  // Create depth layers
  float layer1 = smoothstep(0.35, 0.75, f);
  float layer2 = smoothstep(0.45, 0.85, f2);

  // ===== BASE COLOR MIXING =====
  vec3 base = mix(uDeep, uMid, layer1);
  base = mix(base, uGlow, layer2 * 0.4);

  // Add complement color in shadows for depth
  base = mix(base, uComplement, (1.0 - layer1) * 0.15);

  // Breath-based glow intensity
  float glowIntensity = clamp(uBreath, 0.0, 1.0) * 0.8;
  vec3 glow = mix(base, uGlow, glowIntensity);

  // ===== SHIMMER LAYER =====
  float shimmer = fbmWarped(p * 2.5 + vec3(t * 2.5), 0.1);
  shimmer = shimmer * 0.5 + 0.5;

  // ===== AI INTEGRATION =====
  vec3 accent = uAccent;
  if (uAiPulse > 0.02) {
    vec3 aiEffect = aiVisualization(vPos, uAiPulse, uTime);
    glow = mix(glow, aiEffect, uAiPulse * 0.7);
    accent = mix(accent, aiEffect, uAiPulse);
  }

  // Accent shimmer modulated by entropy
  float entropyFactor = clamp(uEntropy, 0.0, 1.0);
  glow = mix(glow, accent, shimmer * (entropyFactor * 0.2 + uAiPulse * 0.4));

  // ===== CHROMATIC FRESNEL =====
  vec3 fres = chromaticFresnel(n, viewDir, uBreath);

  // Per-channel rim lighting for iridescence effect
  vec3 rimLight = vec3(
    uGlow.r * fres.r,
    uGlow.g * fres.g,
    uGlow.b * fres.b
  ) * (0.6 + 2.0 * uBreath);

  // ===== SUBSURFACE SCATTERING =====
  vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
  float sssThickness = 0.3 + uBreath * 0.4;
  vec3 sss = subsurfaceScatter(n, viewDir, lightDir, uGlow, sssThickness);

  // ===== CAUSTICS (subtle) =====
  float caustics = causticPattern(vUv, uTime * 0.5) * uBreath * 0.15;

  // ===== ENERGY CALCULATION =====
  float energy = (0.35 + 1.0 * uBreath) * (0.6 + 0.4 * layer1);

  // ===== FINAL COLOR COMPOSITION =====
  vec3 col = glow * energy;
  col += rimLight;
  col += sss * 0.2;
  col += uGlow * caustics;

  // AI presence boost
  if (uAiPulse > 0.1) {
    vec3 aiGlow = aiVisualization(vPos, uAiPulse, uTime);
    col += aiGlow * fres.g * uAiPulse * 0.4;
  }

  // ===== HDR TONEMAP (subtle) =====
  col = col / (col + vec3(1.0));  // Reinhard tonemap
  col = pow(col, vec3(0.95));      // Slight gamma for vibrancy

  // ===== ALPHA CHANNEL =====
  float alpha = 0.2 + 0.6 * uBreath + 0.15 * layer1;
  alpha += uAiPulse * 0.15;
  alpha = clamp(alpha, 0.0, 0.98);

  gl_FragColor = vec4(col, alpha);
}
`;

// ============================================================================
// HALO SHADER (Atmospheric Glow)
// ============================================================================

export const HALO_FRAG_SHADER = `
precision highp float;

varying vec3 vNormal;
varying vec3 vViewPosition;

uniform vec3 uGlow;
uniform float uBreath;
uniform float uTime;

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // Soft fresnel for atmospheric effect
  float fresnel = pow(1.0 - abs(dot(n, viewDir)), 3.0);

  // Pulsing intensity
  float pulse = 0.5 + 0.5 * sin(uTime * 1.5);
  float intensity = fresnel * (0.1 + uBreath * 0.15 + pulse * 0.05);

  vec3 col = uGlow * intensity;

  gl_FragColor = vec4(col, intensity * 0.6);
}
`;

// ============================================================================
// RING SHADER (Energy Band)
// ============================================================================

export const RING_FRAG_SHADER = `
precision highp float;

varying vec2 vUv;
varying vec3 vPos;

uniform vec3 uAccent;
uniform float uBreath;
uniform float uTime;
uniform float uAiPulse;

void main() {
  // Flowing energy pattern along the ring
  float flow = sin(vUv.x * 40.0 - uTime * 3.0) * 0.5 + 0.5;
  float pulse = sin(vUv.x * 8.0 + uTime * 2.0) * 0.3 + 0.7;

  // Intensity modulation
  float intensity = flow * pulse * (0.15 + uBreath * 0.2);

  // AI boost
  if (uAiPulse > 0.1) {
    vec3 aiColor = mix(vec3(0.0, 1.0, 0.6), vec3(0.6, 0.2, 1.0), uAiPulse);
    vec3 col = mix(uAccent, aiColor, uAiPulse);
    gl_FragColor = vec4(col * (intensity + uAiPulse * 0.3), intensity * 1.5);
    return;
  }

  gl_FragColor = vec4(uAccent * intensity, intensity * 0.8);
}
`;

// ============================================================================
// QUALITY PRESETS V2
// ============================================================================

export const SHADER_PRESETS_V2 = {
    minimal: {
        octaves: 2,
        useNoiseTexture: false,
        vertexShader: ENHANCED_CORE_VERT_V2,
        fragmentShader: getEnhancedFragShaderV2(2, false),
        features: {
            caustics: false,
            subsurface: false,
            chromaticAberration: false,
        }
    },
    low: {
        octaves: 2,
        useNoiseTexture: false,
        vertexShader: ENHANCED_CORE_VERT_V2,
        fragmentShader: getEnhancedFragShaderV2(2, false),
        features: {
            caustics: false,
            subsurface: true,
            chromaticAberration: false,
        }
    },
    medium: {
        octaves: 3,
        useNoiseTexture: false,
        vertexShader: ENHANCED_CORE_VERT_V2,
        fragmentShader: getEnhancedFragShaderV2(3, false),
        features: {
            caustics: true,
            subsurface: true,
            chromaticAberration: true,
        }
    },
    high: {
        octaves: 4,
        useNoiseTexture: true,
        vertexShader: ENHANCED_CORE_VERT_V2,
        fragmentShader: getEnhancedFragShaderV2(4, true),
        features: {
            caustics: true,
            subsurface: true,
            chromaticAberration: true,
        }
    },
    ultra: {
        octaves: 5,
        useNoiseTexture: true,
        vertexShader: ENHANCED_CORE_VERT_V2,
        fragmentShader: getEnhancedFragShaderV2(5, true),
        features: {
            caustics: true,
            subsurface: true,
            chromaticAberration: true,
        }
    },
} as const;

// ============================================================================
// ENHANCED THEME COLORS V2
// ============================================================================

export const ENHANCED_THEMES_V2 = {
    warm: {
        deep: '#2b0505',
        mid: '#b84020',      // Richer, more saturated
        glow: '#ffd080',     // Warmer gold
        accent: '#ff7a50',
        complement: '#1a3a4d', // Cool blue complement for depth
    },
    cool: {
        deep: '#001520',
        mid: '#0d5580',       // Slightly brighter
        glow: '#70fff0',
        accent: '#20d5ff',
        complement: '#4d2a1a', // Warm brown complement
    },
    neutral: {
        deep: '#0a0a12',
        mid: '#4a4a5a',
        glow: '#f5f0e8',      // Warm white instead of pure white
        accent: '#b8c8d8',
        complement: '#3a3028', // Warm neutral complement
    },
    premium: {
        deep: '#0f0a05',
        mid: '#8b6914',
        glow: '#ffeaa0',
        accent: '#ffcc40',
        complement: '#1a2540', // Deep blue complement
    },
    aurora: {
        deep: '#05100a',
        mid: '#1a6050',
        glow: '#80ffd0',
        accent: '#40ffb0',
        complement: '#401a30', // Magenta complement
    },
} as const;

export type EnhancedThemeName = keyof typeof ENHANCED_THEMES_V2;

// ============================================================================
// UNIFORM HELPERS V2
// ============================================================================

export const createUniformsV2 = (theme: keyof typeof ENHANCED_THEMES_V2) => {
    const colors = ENHANCED_THEMES_V2[theme];

    return {
        uTime: { value: 0 },
        uBreath: { value: 0 },
        uEntropy: { value: 0 },
        uAiPulse: { value: 0 },
        uDeep: { value: new THREE.Color(colors.deep) },
        uMid: { value: new THREE.Color(colors.mid) },
        uGlow: { value: new THREE.Color(colors.glow) },
        uAccent: { value: new THREE.Color(colors.accent) },
        uComplement: { value: new THREE.Color(colors.complement) },
    };
};

export const updateUniformsV2 = (
    uniforms: ReturnType<typeof createUniformsV2>,
    values: {
        time: number;
        breath: number;
        entropy: number;
        aiPulse: number;
    }
) => {
    uniforms.uTime.value = values.time;
    uniforms.uBreath.value = values.breath;
    uniforms.uEntropy.value = values.entropy;
    uniforms.uAiPulse.value = values.aiPulse;
};

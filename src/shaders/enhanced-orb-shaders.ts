/**
 * Enhanced Orb Shader System
 * Improved GLSL shaders with better fresnel, dynamic rim lighting, and AI effects
 *
 * Usage: Import and use in OrbBreathVizZenSciFi.tsx
 * These shaders provide enhanced visual quality while maintaining performance
 */

// ============================================================================
// ENHANCED VERTEX SHADER
// ============================================================================

/**
 * Vertex shader with improved AI distortion and normal calculation
 */
export const ENHANCED_CORE_VERT = `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPosition;
uniform float uTime;
uniform float uAiPulse;
uniform float uBreath;

void main() {
  vNormal = normalMatrix * normal;

  // Geometric Distortion when AI speaks (The "Voice" effect)
  vec3 pos = position;
  if (uAiPulse > 0.1) {
      // Multi-frequency wave distortion for more organic AI presence
      float wave1 = sin(pos.y * 10.0 + uTime * 20.0);
      float wave2 = cos(pos.x * 10.0 + uTime * 15.0);
      float wave3 = sin(pos.z * 8.0 + uTime * 18.0);

      float distortion = (wave1 + wave2 + wave3) / 3.0;
      pos += normal * distortion * uAiPulse * 0.08;
  }

  // Subtle breath expansion in vertex shader (pre-scaling)
  pos += normal * uBreath * 0.02;

  vPos = pos;

  // View position for advanced lighting
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vViewPosition = -mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
`;

// ============================================================================
// ENHANCED FRAGMENT SHADER GENERATOR
// ============================================================================

/**
 * Generate enhanced fragment shader with adaptive octaves
 * Improvements:
 * - Dynamic fresnel with breath-responsive power
 * - Enhanced rim lighting
 * - Better AI color integration
 * - Improved depth perception
 */
export const getEnhancedFragShader = (octaves: number) => `
precision highp float;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vViewPosition;
uniform float uTime;
uniform float uBreath;
uniform float uEntropy;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uGlow;
uniform vec3 uAccent;
uniform float uAiPulse;

// ============================================================================
// NOISE FUNCTIONS (Optimized)
// ============================================================================

float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f*f*(3.0-2.0*f); // Smoothstep

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

// Fractal Brownian Motion with adaptive octaves
float fbm(vec3 p){
  float v = 0.0;
  float a = 0.55;
  for(int i=0; i<${octaves}; i++){
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

// ============================================================================
// ENHANCED FRESNEL
// ============================================================================

// Dynamic fresnel that responds to breath intensity
float dynamicFresnel(vec3 normal, vec3 viewDir, float breathIntensity) {
  float fresnel = 1.0 - abs(dot(normal, viewDir));

  // Power varies with breath (2.0 → 3.5)
  float power = 2.0 + breathIntensity * 1.5;

  return pow(fresnel, power);
}

// ============================================================================
// MAIN SHADER
// ============================================================================

void main(){
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  vec3 p = vPos * 1.2;
  float t = uTime * 0.22;

  // ===== BASE NOISE LAYER =====
  float f = fbm(p + vec3(0.0, t, t*0.7));
  float fil = smoothstep(0.45, 0.85, f);

  // Base color mixing
  vec3 base = mix(uDeep, uMid, fil);
  vec3 glow = mix(base, uGlow, clamp(uBreath, 0.0, 1.0) * 0.75);

  // ===== SHIMMER LAYER =====
  float shimmer = fbm(p * 2.2 + vec3(t*2.0)) * 0.5 + 0.5;

  // ===== AI COLOR INTEGRATION =====
  // Emerald → Purple gradient based on AI pulse intensity
  vec3 aiColor = mix(
    vec3(0.0, 1.0, 0.6),  // Emerald (low intensity)
    vec3(0.6, 0.2, 1.0),  // Purple (high intensity)
    smoothstep(0.4, 1.0, uAiPulse)
  );

  vec3 accent = mix(uAccent, aiColor, uAiPulse);

  // Blend AI color into glow
  glow = mix(glow, aiColor, uAiPulse * 0.6);

  // ===== AI GRID PATTERN =====
  if (uAiPulse > 0.05) {
    float grid = abs(sin(vPos.x * 20.0)) + abs(sin(vPos.y * 20.0));
    glow += aiColor * (1.0 - smoothstep(0.0, 0.1, grid)) * uAiPulse * 0.5;
  }

  // ===== ACCENT SHIMMER =====
  glow = mix(
    glow,
    accent,
    shimmer * (clamp(uEntropy, 0.0, 1.0) * 0.18 + uAiPulse * 0.4)
  );

  // ===== ENHANCED FRESNEL & RIM LIGHT =====
  float fres = dynamicFresnel(n, viewDir, uBreath);

  // Rim light intensity scales with breath
  vec3 rimLight = uGlow * fres * (0.5 + 1.5 * uBreath);

  // Energy calculation (breath-dependent)
  float energy = (0.35 + 0.95 * uBreath) * (0.65 + 0.35 * fil);

  // ===== FINAL COLOR COMPOSITION =====
  vec3 col = glow * energy + rimLight;

  // Add extra glow during AI activity
  if (uAiPulse > 0.1) {
    col += aiColor * fres * uAiPulse * 0.3;
  }

  // ===== ALPHA CHANNEL =====
  float alpha = 0.25 + 0.55 * uBreath + 0.15 * fil;

  // Slightly increase alpha during AI activity for more presence
  alpha += uAiPulse * 0.1;

  gl_FragColor = vec4(col, alpha);
}
`;

// ============================================================================
// SHADER PRESETS
// ============================================================================

/**
 * Shader configuration presets for different quality tiers
 */
export const SHADER_PRESETS = {
  low: {
    octaves: 2,
    vertexShader: ENHANCED_CORE_VERT,
    fragmentShader: getEnhancedFragShader(2),
  },
  medium: {
    octaves: 3,
    vertexShader: ENHANCED_CORE_VERT,
    fragmentShader: getEnhancedFragShader(3),
  },
  high: {
    octaves: 4,
    vertexShader: ENHANCED_CORE_VERT,
    fragmentShader: getEnhancedFragShader(4),
  },
  ultra: {
    octaves: 5,
    vertexShader: ENHANCED_CORE_VERT,
    fragmentShader: getEnhancedFragShader(5),
  },
} as const;

// ============================================================================
// SHADER UTILITIES
// ============================================================================

/**
 * Get shader preset based on device capabilities
 */
export function getShaderPreset(
  quality: 'auto' | 'low' | 'medium' | 'high'
): typeof SHADER_PRESETS.low {
  if (quality === 'low') return SHADER_PRESETS.low;
  if (quality === 'high') return SHADER_PRESETS.high;
  if (quality === 'medium') return SHADER_PRESETS.medium;

  // Auto-detect based on device
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const isMobile = /iPhone|iPad|Android/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  );

  if (cores < 4 || isMobile) return SHADER_PRESETS.low;
  if (cores >= 8) return SHADER_PRESETS.high;
  return SHADER_PRESETS.medium;
}

/**
 * Shader uniform helpers
 */
export const SHADER_UNIFORMS = {
  /**
   * Create initial uniform values
   */
  create: (colors: { deep: any; mid: any; glow: any; accent: any }) => ({
    uTime: { value: 0 },
    uBreath: { value: 0 },
    uEntropy: { value: 0 },
    uDeep: { value: colors.deep.clone() },
    uMid: { value: colors.mid.clone() },
    uGlow: { value: colors.glow.clone() },
    uAccent: { value: colors.accent.clone() },
    uAiPulse: { value: 0 },
  }),

  /**
   * Update uniforms in animation loop
   */
  update: (
    uniforms: any,
    time: number,
    breath: number,
    entropy: number,
    aiPulse: number,
    colors: { deep: any; mid: any; glow: any; accent: any }
  ) => {
    uniforms.uTime.value = time;
    uniforms.uBreath.value = breath;
    uniforms.uEntropy.value = entropy;
    uniforms.uAiPulse.value = aiPulse;
    uniforms.uDeep.value.copy(colors.deep);
    uniforms.uMid.value.copy(colors.mid);
    uniforms.uGlow.value.copy(colors.glow);
    uniforms.uAccent.value.copy(colors.accent);
  },
};

// ============================================================================
// INTEGRATION NOTES
// ============================================================================

/**
 * To use these enhanced shaders in OrbBreathVizZenSciFi.tsx:
 *
 * 1. Import the shader functions:
 *    import { getEnhancedFragShader, ENHANCED_CORE_VERT, getShaderPreset } from '../shaders/enhanced-orb-shaders';
 *
 * 2. Replace the existing vertex shader constant with ENHANCED_CORE_VERT
 *
 * 3. Update the fragment shader memo:
 *    const fragShader = useMemo(() => getEnhancedFragShader(tier.octaves), [tier.octaves]);
 *
 * 4. Use the shader in the shaderMaterial:
 *    <shaderMaterial
 *      ref={coreMat}
 *      vertexShader={ENHANCED_CORE_VERT}
 *      fragmentShader={fragShader}
 *      ...
 *    />
 *
 * Expected improvements:
 * - More responsive fresnel effect that scales with breath
 * - Enhanced rim lighting for better depth perception
 * - Smoother AI color transitions
 * - Better visual separation between breath phases
 * - More organic AI "voice" distortion effect
 */

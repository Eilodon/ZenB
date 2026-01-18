
import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import { useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { BreathPhase, ColorTheme, QualityTier } from '../types';
import { AIConnectionStatus } from '../services/RustKernelBridge';
import { setSpatialBreathParams } from '../services/audio';
import { ENHANCED_CORE_VERT_V2, getEnhancedFragShaderV2, ENHANCED_THEMES_V2 } from '../shaders/enhanced-orb-shaders-v2';
import { calculateBreathScale, calculateMaterialProperties } from '../utils/breathing-curves';

type Props = {
  phase: BreathPhase;
  theme: ColorTheme;
  quality: QualityTier;
  reduceMotion: boolean;
  isActive: boolean;
  progressRef: React.MutableRefObject<number>;
  entropyRef?: React.MutableRefObject<number>;
  aiStatus?: AIConnectionStatus;
};
// ENHANCED THEMES V2 - with complement colors for depth
const THEMES: Record<ColorTheme, { deep: THREE.Color; mid: THREE.Color; glow: THREE.Color; accent: THREE.Color; complement: THREE.Color }> = {
  warm: {
    deep: new THREE.Color(ENHANCED_THEMES_V2.warm.deep),
    mid: new THREE.Color(ENHANCED_THEMES_V2.warm.mid),
    glow: new THREE.Color(ENHANCED_THEMES_V2.warm.glow),
    accent: new THREE.Color(ENHANCED_THEMES_V2.warm.accent),
    complement: new THREE.Color(ENHANCED_THEMES_V2.warm.complement),
  },
  cool: {
    deep: new THREE.Color(ENHANCED_THEMES_V2.cool.deep),
    mid: new THREE.Color(ENHANCED_THEMES_V2.cool.mid),
    glow: new THREE.Color(ENHANCED_THEMES_V2.cool.glow),
    accent: new THREE.Color(ENHANCED_THEMES_V2.cool.accent),
    complement: new THREE.Color(ENHANCED_THEMES_V2.cool.complement),
  },
  neutral: {
    deep: new THREE.Color(ENHANCED_THEMES_V2.neutral.deep),
    mid: new THREE.Color(ENHANCED_THEMES_V2.neutral.mid),
    glow: new THREE.Color(ENHANCED_THEMES_V2.neutral.glow),
    accent: new THREE.Color(ENHANCED_THEMES_V2.neutral.accent),
    complement: new THREE.Color(ENHANCED_THEMES_V2.neutral.complement),
  },
};

function resolveTier(q: QualityTier) {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
  const auto = q === 'auto';
  // If cores < 4, it's very low end. < 8 is mid. >= 8 is high/desktop.
  const isLow = q === 'low' || (auto && cores < 4);
  const isHigh = q === 'high' || (auto && cores >= 8);

  // octaves: Complexity of FBM noise. 4 is standard, 2 for low end.
  if (isLow) return { dpr: Math.min(dpr, 1.0), seg: 24, halo: false, ring: false, octaves: 2 };
  if (isHigh) return { dpr: Math.min(dpr, 2), seg: 64, halo: true, ring: true, octaves: 4 };
  return { dpr: Math.min(dpr, 1.5), seg: 40, halo: true, ring: false, octaves: 3 };
}



function ZenOrb(props: Props) {
  const { phase, theme, quality, reduceMotion, isActive, progressRef, entropyRef, aiStatus } = props;
  const tier = useMemo(() => resolveTier(quality), [quality]);
  const colors = useMemo(() => THEMES[theme] ?? THEMES.neutral, [theme]);
  const { gl } = useThree(); // Access WebGL Context

  const group = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);  // [PHASE 3] Secondary motion
  const ringRef = useRef<THREE.Mesh>(null);  // [PHASE 3] Secondary motion
  const shellMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreMat = useRef<THREE.ShaderMaterial>(null);

  const breathRef = useRef(0);
  const entropySmoothRef = useRef(0);
  const aiPulseRef = useRef(0);
  const prevScaleRef = useRef(1.35);  // [PHASE 3] Track previous scale for lag calculation

  // [SMOOTH MOTION] Spring physics tuned for butter-smooth animation (no overshoot)
  const [materialSpring, materialApi] = useSpring(() => ({
    scale: 1.35,
    roughness: 0.55,
    transmission: 0.45,
    clearcoat: 0.35,
    clearcoatRoughness: 0.5,
    thickness: 0.3,
    attenuationDistance: 1.8,
    config: {
      mass: 1.0,       // Lighter mass for faster response
      tension: 120,    // Lower tension for smoother motion
      friction: 40,    // Higher friction to prevent oscillation
      clamp: true,     // NO overshoot - essential for smooth feel
    },
  }));

  // [NEW] WebGL Context Robustness
  useEffect(() => {
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("⚠️ WebGL Context Lost");
      // Three.js usually handles auto-restore if we preventDefault,
      // but we might need to reset some shader state if it comes back weird.
    };
    const handleContextRestored = () => {
      console.log("✅ WebGL Context Restored");
      if (coreMat.current) coreMat.current.needsUpdate = true;
    };

    gl.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', handleContextLost);
      gl.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    const motion = reduceMotion ? 0.45 : 1.0;
    const p = THREE.MathUtils.clamp(progressRef.current, 0, 1);

    let targetBreath = 0;
    if (isActive) {
      // [PHASE 3] Use eased breath curves with anticipation/follow-through
      if (phase === 'inhale') targetBreath = p * p; // ease-in
      else if (phase === 'holdIn') targetBreath = 1;
      else if (phase === 'exhale') targetBreath = 1 - (1 - (1 - p) * (1 - p)); // ease-out
      else targetBreath = 0;
    } else {
      targetBreath = (Math.sin(time * 0.7) * 0.5 + 0.5) * 0.35;
    }

    // [NEW] Sync Spatial Audio
    setSpatialBreathParams(breathRef.current);

    // AI Pulse Logic
    let targetAi = 0;
    if (aiStatus === 'speaking') targetAi = 0.9 + Math.sin(time * 15) * 0.2; // Rapid flutter + Voice
    else if (aiStatus === 'thinking') targetAi = 0.4 + Math.sin(time * 3) * 0.1; // Deep throb
    else if (aiStatus === 'connected') targetAi = 0.15; // Subtle presence

    aiPulseRef.current = THREE.MathUtils.lerp(aiPulseRef.current, targetAi, delta * 4.0);

    const targetEntropy = entropyRef?.current ?? 0;
    breathRef.current = THREE.MathUtils.lerp(breathRef.current, targetBreath, 1 - Math.pow(0.001, delta * 3.2));
    entropySmoothRef.current = THREE.MathUtils.lerp(entropySmoothRef.current, targetEntropy, 1 - Math.pow(0.001, delta * 2.0));

    const breath = breathRef.current;
    const entropy = THREE.MathUtils.clamp(entropySmoothRef.current, 0, 1);

    // [SMOOTH MOTION] Use smooth easing without overshoot for butter-smooth feel
    const baseScale = 1.35;
    const scaleRange = 0.12; // 1.35 to 1.47 (about 9% expansion)
    const animatedScale = baseScale + (breath * scaleRange);

    // [PHASE 3] Use calculateMaterialProperties for dynamic glass effects
    const matProps = calculateMaterialProperties(breath, aiPulseRef.current);

    materialApi.start({
      scale: animatedScale,
      roughness: matProps.roughness,
      transmission: matProps.transmission,
      clearcoat: matProps.clearcoat,
      clearcoatRoughness: matProps.clearcoatRoughness,
      thickness: matProps.thickness,
      attenuationDistance: THREE.MathUtils.lerp(1.8, 0.9, breath),
      immediate: false, // Use spring physics
    });

    // Apply spring values to group scale
    const currentScale = materialSpring.scale.get();
    if (group.current) {
      group.current.scale.setScalar(currentScale);
      group.current.rotation.y += delta * 0.18 * motion;
      group.current.rotation.x = Math.sin(time * 0.15) * 0.08 * motion;
    }

    // [PHASE 3] Secondary motion for halo (lags behind with larger scale)
    if (haloRef.current) {
      const haloScale = prevScaleRef.current + (currentScale - prevScaleRef.current) * 0.15; // 85% lag
      haloRef.current.scale.setScalar(haloScale * 1.02); // Slightly larger amplification
    }

    // [PHASE 3] Secondary motion for ring (lags more, different rotation)
    if (ringRef.current) {
      const ringScale = prevScaleRef.current + (currentScale - prevScaleRef.current) * 0.1; // 90% lag
      ringRef.current.scale.setScalar(ringScale);
      ringRef.current.rotation.z += delta * 0.08 * motion; // Independent slow rotation
    }

    // Update previous scale for next frame
    prevScaleRef.current = currentScale;

    // Apply spring values to material
    if (shellMat.current) {
      shellMat.current.roughness = materialSpring.roughness.get();
      shellMat.current.clearcoat = materialSpring.clearcoat.get();
      shellMat.current.clearcoatRoughness = materialSpring.clearcoatRoughness.get();
      shellMat.current.transmission = materialSpring.transmission.get();
      shellMat.current.ior = 1.3;
      shellMat.current.thickness = materialSpring.thickness.get();
      shellMat.current.attenuationColor.copy(colors.deep);
      shellMat.current.attenuationDistance = materialSpring.attenuationDistance.get();

      // Slight tint change for AI - "The Ghost" is Emerald
      if (aiPulseRef.current > 0.1) {
        shellMat.current.attenuationColor.lerp(new THREE.Color('#00ff88'), aiPulseRef.current * 0.4);
      }
    }

    if (coreMat.current) {
      coreMat.current.uniforms.uTime.value = time;
      coreMat.current.uniforms.uBreath.value = breath;
      coreMat.current.uniforms.uEntropy.value = entropy;
      coreMat.current.uniforms.uDeep.value.copy(colors.deep);
      coreMat.current.uniforms.uMid.value.copy(colors.mid);
      coreMat.current.uniforms.uGlow.value.copy(colors.glow);
      coreMat.current.uniforms.uAccent.value.copy(colors.accent);
      coreMat.current.uniforms.uComplement.value.copy(colors.complement);
      coreMat.current.uniforms.uAiPulse.value = aiPulseRef.current;
    }
  });

  // [ENHANCED V2] Use enhanced v2 fragment shader for premium visual quality
  const fragShader = useMemo(() => getEnhancedFragShaderV2(tier.octaves), [tier.octaves]);

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1.0, tier.seg, tier.seg]} />
        <meshPhysicalMaterial
          ref={shellMat}
          color={colors.mid}
          metalness={0.0}
          roughness={0.35}
          transmission={0.8}
          thickness={0.5}
          ior={1.3}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
          envMapIntensity={1.1}
          transparent
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.72, Math.max(18, Math.floor(tier.seg * 0.8)), Math.max(18, Math.floor(tier.seg * 0.8))]} />
        <shaderMaterial
          ref={coreMat}
          vertexShader={ENHANCED_CORE_VERT_V2}
          fragmentShader={fragShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uBreath: { value: 0 },
            uEntropy: { value: 0 },
            uDeep: { value: colors.deep.clone() },
            uMid: { value: colors.mid.clone() },
            uGlow: { value: colors.glow.clone() },
            uAccent: { value: colors.accent.clone() },
            uComplement: { value: colors.complement.clone() },
            uAiPulse: { value: 0 },
          }}
        />
      </mesh>

      {tier.halo && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[1.08, Math.max(18, Math.floor(tier.seg * 0.5)), Math.max(18, Math.floor(tier.seg * 0.5))]} />
          <meshBasicMaterial
            color={colors.glow}
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {tier.ring && (
        <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0, 0]}>
          <torusGeometry args={[1.15, 0.015, 10, 120]} />
          <meshBasicMaterial
            color={colors.accent}
            transparent
            opacity={0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

export default function OrbBreathVizZenSciFi(props: Props) {
  const tier = useMemo(() => resolveTier(props.quality), [props.quality]);
  const shouldUsePostFX = props.quality === 'high' || props.quality === 'medium' || (props.quality === 'auto' && tier.seg >= 40);

  return (
    <Canvas
      dpr={tier.dpr}
      camera={{ position: [0, 0, 4.8], fov: 45 }}
      gl={{ antialias: tier.dpr > 1.1, alpha: true, powerPreference: 'high-performance' }}
    >
      {tier.seg >= 44 && <Environment preset="city" />}
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 3, 4]} intensity={1.2} />
      <ZenOrb {...props} />

      {/* [P2.3 UPGRADE] Post-processing effects (quality-based) */}
      {shouldUsePostFX && (
        <EffectComposer multisampling={4}>
          {/* Bloom for glow */}
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.9}
            radius={0.6}
          />

          {/* Depth of Field (subtle focus effect) */}
          <DepthOfField
            focusDistance={0.01}
            focalLength={0.05}
            bokehScale={1.5}
          />

          {/* Vignette for cinematic edge darkening */}
          <Vignette
            offset={0.35}
            darkness={0.6}
            eskil={false}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}

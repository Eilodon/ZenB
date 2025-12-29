import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BreathPhase, ColorTheme, QualityTier } from '../types';

type Props = {
  phase: BreathPhase;
  theme: ColorTheme;
  quality: QualityTier;
  reduceMotion: boolean;
  progressRef: React.MutableRefObject<number>;
};

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;

void main() {
  // Create a subtle breathing glow pattern
  float glow = 0.5 + 0.5 * sin(uTime * 0.9 + vUv.x * 6.2831);
  float a = 0.15 + uIntensity * 0.85; 
  // Center glow brightness
  vec3 col = uColor * (0.65 + glow * 0.35);
  gl_FragColor = vec4(col, a);
}
`;

function pickThemeColor(theme: ColorTheme): THREE.Color {
  if (theme === 'warm') return new THREE.Color(1.0, 0.7, 0.45); // Amber/Orange
  if (theme === 'cool') return new THREE.Color(0.5, 0.8, 1.0); // Light Blue
  return new THREE.Color(0.85, 0.85, 0.9); // Neutral White/Grey
}

function resolveQuality(quality: QualityTier): { dpr: number; subdivisions: number } {
  const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
  
  if (quality === 'low') return { dpr: Math.min(baseDpr, 1.25), subdivisions: 16 };
  if (quality === 'medium') return { dpr: Math.min(baseDpr, 1.5), subdivisions: 24 };
  if (quality === 'high') return { dpr: Math.min(baseDpr, 2.0), subdivisions: 32 };
  
  // Auto heuristic
  const cores = (navigator as any)?.hardwareConcurrency ?? 4;
  if (cores <= 4) return { dpr: Math.min(baseDpr, 1.25), subdivisions: 16 };
  if (cores <= 8) return { dpr: Math.min(baseDpr, 1.5), subdivisions: 24 };
  return { dpr: Math.min(baseDpr, 2.0), subdivisions: 32 };
}

function BreathingOrb({ phase, theme, reduceMotion, progressRef, subdivisions }: Props & { subdivisions: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const baseColor = useMemo(() => pickThemeColor(theme), [theme]);

  // Logic to calculate target scale based on phase
  const getTargetScale = (p: number) => {
    if (phase === 'inhale') return 1.0 + p * 0.6; // 1.0 -> 1.6
    if (phase === 'exhale') return 1.6 - p * 0.6; // 1.6 -> 1.0
    if (phase === 'holdIn') return 1.6 + Math.sin(p * Math.PI) * 0.05; // Gentle pulse at max
    if (phase === 'holdOut') return 1.0; // Steady at min
    return 1.0;
  };

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    // Direct read from ref (No React re-render)
    const p = progressRef.current;
    const target = getTargetScale(p);
    
    // Smooth Lerp for scale
    tempScale.set(target, target, target);
    mesh.scale.lerp(tempScale, Math.min(1, delta * 3));

    // Update Uniforms
    mat.uniforms.uTime.value += delta;
    
    // Calculate intensity based on phase for shader glow
    let intensity = 0.08;
    if (phase === 'inhale') intensity = 0.08 + p * 0.18;
    else if (phase === 'exhale') intensity = 0.26 - p * 0.18;
    else if (phase === 'holdIn') intensity = 0.26;
    
    mat.uniforms.uIntensity.value = THREE.MathUtils.lerp(
      mat.uniforms.uIntensity.value,
      intensity,
      Math.min(1, delta * 2)
    );
    
    mat.uniforms.uColor.value = baseColor;

    // Rotation
    if (!reduceMotion) {
      mesh.rotation.y += delta * 0.12;
      mesh.rotation.x += delta * 0.04;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5, subdivisions]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uTime: { value: 0 },
          uIntensity: { value: 0.12 },
          uColor: { value: baseColor },
        }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default function OrbBreathViz(props: Props) {
  const { dpr, subdivisions } = useMemo(() => resolveQuality(props.quality), [props.quality]);
  
  return (
    <Canvas 
      dpr={dpr} 
      camera={{ position: [0, 0, 5], fov: 45 }} 
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.8} />
      <BreathingOrb {...props} subdivisions={subdivisions} />
    </Canvas>
  );
}
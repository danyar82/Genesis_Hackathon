"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ShellFrame } from "./_internals/ShellFrame";
import { initialValues, type ParameterSpec, type ParamValues } from "./_internals/types";

export type Particle = {
  x: number;
  y: number;
  z: number;
  color?: string;
};

export type ParticleUpdateContext = {
  dt: number;
  t: number;
  params: ParamValues;
};

export type ParticleUpdateFn = (
  particles: Particle[],
  context: ParticleUpdateContext,
) => Particle[] | void;

type Props = {
  particles: Particle[];
  updateFn?: ParticleUpdateFn;
  parameters?: ParameterSpec[];
  pointSize?: number;
  background?: string;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
};

function ParticleCloud({
  seed,
  updateFn,
  paramsRef,
  pointSize,
}: {
  seed: Particle[];
  updateFn?: ParticleUpdateFn;
  paramsRef: React.MutableRefObject<ParamValues>;
  pointSize: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const workingRef = useRef<Particle[]>(seed.map((p) => ({ ...p })));

  const { positions, colors } = useMemo(() => {
    const n = seed.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const p = seed[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      tmp.set(p.color ?? "#a78bfa");
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    workingRef.current = seed.map((p) => ({ ...p }));
    return { positions, colors };
  }, [seed]);

  useFrame((_, delta) => {
    if (!updateFn || !pointsRef.current) return;
    const working = workingRef.current;
    const t = performance.now() / 1000;
    try {
      const next = updateFn(working, { dt: delta, t, params: paramsRef.current });
      const source = Array.isArray(next) ? next : working;
      const attr = pointsRef.current.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const limit = Math.min(source.length, arr.length / 3);
      for (let i = 0; i < limit; i++) {
        const p = source[i];
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      attr.needsUpdate = true;
      if (Array.isArray(next)) workingRef.current = next;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[ThreeJsParticleShell] updateFn threw:", err);
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={colors.length / 3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function ThreeJsParticleShell({
  particles,
  updateFn,
  parameters,
  pointSize = 0.06,
  background = "#050509",
  title = "Particle System",
  subtitle,
  loading = false,
  className,
}: Props) {
  const [values, setValues] = useState<ParamValues>(() =>
    initialValues(parameters),
  );
  const paramsRef = useRef<ParamValues>(values);
  paramsRef.current = values;

  const handleChange = useCallback(
    (v: ParamValues) => setValues(v),
    [],
  );

  const defaultSubtitle =
    subtitle ?? `${particles.length.toLocaleString()} particles · drag to orbit`;

  return (
    <ShellFrame
      title={title}
      subtitle={defaultSubtitle}
      parameters={parameters}
      values={values}
      onChange={handleChange}
      loading={loading}
      loadingLabel="Initializing particle system…"
      className={className}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 55 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background }}
      >
        <color attach="background" args={[background]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[10, 10, 10]} intensity={0.6} />
        <ParticleCloud
          seed={particles}
          updateFn={updateFn}
          paramsRef={paramsRef}
          pointSize={pointSize}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={0.6}
          makeDefault
        />
      </Canvas>
    </ShellFrame>
  );
}

export default ThreeJsParticleShell;

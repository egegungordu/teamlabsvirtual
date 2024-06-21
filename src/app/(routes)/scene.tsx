"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  FirstPersonControls,
  MeshReflectorMaterial,
  PointerLockControls,
  Reflector,
  Stats,
} from "@react-three/drei";
import { Vignette, EffectComposer, Bloom } from "@react-three/postprocessing";
import { IcosahedronGeometry, Points, PointsMaterial } from "three";
import CustomShaderMaterial from "three-custom-shader-material";
import { Perf } from "r3f-perf";

const shader = {
  vertex: /* glsl */ `
    uniform float uTime;
    varying float vVisibility;
    varying vec3 vViewNormal;
    varying vec3 vPosition;

    void main() {
      vec3 n = sin(position + uTime);
      
			vec3 _viewNormal = normalMatrix * normal;
      vViewNormal = _viewNormal;
			vec4 _mvPosition = modelViewMatrix * vec4(position, 1.);

    	float visibility = step(-0.1, dot(-normalize(_mvPosition.xyz), normalize(_viewNormal)));
      vVisibility = visibility;
      vPosition = position;

      //csm_Position = position + (normal * n * 0.5);
      //csm_PointSize += ((1. - visibility) * 0.05);
    }
    `,
  fragment: /* glsl */ `
    varying float vVisibility;
    varying vec3 vViewNormal;
    varying vec3 vPosition;

    void main() {

      vec2 uv = vec2(gl_PointCoord.x, 1. - gl_PointCoord.y);
      vec2 cUV = 2. * uv - 1.;
      float a = .15 / length(cUV);
      float alpha = 1.;
      if(a < 0.15) alpha = 0.;

      // csm_DiffuseColor = vec4(vViewNormal, (vVisibility + 0.01) * alpha);

      // color it based on gl_PointCoord, normalize by 120 in each direction
      vec3 color = vec3(vPosition.x / 120., vPosition.y / 120., vPosition.z / 120.);
      csm_DiffuseColor = vec4(color, 1.);
    }


    `,
};

function Thing() {
  const matRef = useRef<PointsMaterial | null>(null);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    // @ts-ignore
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  const points = useMemo(() => {
    return new Float32Array(
      Array.from({ length: 120 * 120 * 120 }, (_, i) => [
        (i % 120) + Math.random() * 0.2,
        (Math.floor(i / 120) % 120) + Math.random() * 0.2,
        Math.floor(i / 120 / 120) + Math.random() * 0.2,
      ]).flat(),
    );
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: {
        value: 0,
      },
    }),
    [],
  );

  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length / 3}
            array={points}
            itemSize={3}
          />
        </bufferGeometry>
        {/*<pointsMaterial color="white" size={0.02} />*/}
        <CustomShaderMaterial
          ref={matRef}
          baseMaterial={PointsMaterial}
          size={0.02}
          vertexShader={shader.vertex}
          fragmentShader={shader.fragment}
          uniforms={uniforms}
          transparent
        />
      </points>
    </group>
  );
}

export default function Scene() {
  // cube matrix
  // 120 x 120 x 120 = 1_728_000

  return (
    <Canvas onClick={(e) => e.currentTarget.requestPointerLock()}>
      <Stats />
      <Perf position="bottom-right" />
      <ambientLight intensity={0.1} />
      <directionalLight color="red" position={[0, 0, 5]} />
      {/*<PointerLockControls />*/}
      <FirstPersonControls lookSpeed={0.1} movementSpeed={10} />
      <Thing />

      <ambientLight intensity={0.2} />

      <mesh position={[61, 61, 120]} rotation={[Math.PI, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <MeshReflectorMaterial
          mirror={0.8}
          blur={[1024, 1024]}
          resolution={2048}
          mixBlur={1}
          mixStrength={80}
          roughness={0.5}
          depthScale={0.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#ffffff"
          metalness={0.7}
        />
      </mesh>

      <mesh position={[60, 0, 60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <MeshReflectorMaterial
          mirror={0.8}
          blur={[1024, 1024]}
          resolution={2048}
          mixBlur={1}
          mixStrength={80}
          roughness={0.5}
          depthScale={0.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#ffffff"
          metalness={0.7}
        />
      </mesh>

      <EffectComposer>
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </Canvas>
  );
}

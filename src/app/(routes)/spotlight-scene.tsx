"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  FirstPersonControls,
} from "@react-three/drei";
import { Vignette, EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
  Vector3Tuple,
} from "three";
import { Perf } from "r3f-perf";

const spotlightShader = {
  vertex: /* glsl */ `
    varying float vAlpha;

    uniform vec3 uCameraPosition;
    uniform vec3 uBeamRoot;
    uniform float uFalloffDistance;

    void main() {
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;

      vec3 beamDirection = -normalize(modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
      vec3 toCamera = normalize(uCameraPosition - modelPosition.xyz);
      vec3 toCameraProjectedToBeamDirectionPlane = normalize(toCamera - dot(toCamera, beamDirection) * beamDirection);
      vec3 normalWorld = normalize(modelMatrix * vec4(normal, 0.0)).xyz;

      float fresnel = pow(1.0 + dot(toCameraProjectedToBeamDirectionPlane, normalWorld), 6.0) / 120.0;
      float beamShine = pow(1.0 + dot(beamDirection, toCamera), 4.0) / 20.0;
      float distance = length(modelPosition.xyz - uBeamRoot);
      float falloff = max(1.0 - distance / uFalloffDistance, 0.0);

      vAlpha = (fresnel + beamShine * fresnel) * falloff;

      gl_Position = projectedPosition;
    }
    `,
  fragment: /* glsl */ `
    varying float vAlpha;

    uniform vec3 uColor;

    void main() {
      float alpha = vAlpha;
      gl_FragColor = vec4(uColor, alpha);
    }
    `,
};

const SPOTLIGHT_LENGTH = 200;

function Spotlights() {
  const meshRef = useRef<Mesh | null>(null);
  const groupRef = useRef<Group | null>(null);

  const spotlights = useMemo(() => {
    const center = [0, 0, -100];
    const gap = 20;
    const xCount = 10;
    const yCount = 10;
    const zCount = 10;

    const behindWallSizeX = (xCount - 1) * gap;
    const behindWallSizeY = (yCount - 1) * gap;
    const sideWallSizeZ = (zCount - 1) * gap;
    const sideWallSizeY = behindWallSizeY;

    const spotlights = [];

    // back wall
    for (let i = 0; i < xCount; i++) {
      for (let j = 0; j < yCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2 + i * gap,
          center[1] - behindWallSizeY / 2 + j * gap,
          center[2] - sideWallSizeZ / 2,
        ] as Vector3Tuple;
        const rotation = [
          /* Math.PI / 2, */
          Math.PI / 2 * (i / xCount),
          0,
          0,
        ] as Vector3Tuple;
        const shader = new ShaderMaterial({
          blending: AdditiveBlending,
          vertexShader: spotlightShader.vertex,
          fragmentShader: spotlightShader.fragment,
          uniforms: {
            uColor: {
              value: new Color(0xffffff),
            },
            uTime: {
              value: 0,
            },
            uCameraPosition: {
              value: new Vector3(),
            },
            uBeamRoot: {
              value: new Vector3(...position),
            },
            uFalloffDistance: {
              value: SPOTLIGHT_LENGTH,
            },
          },
          transparent: true,
          depthTest: false,
        });
        spotlights.push({
          position,
          rotation,
          material: shader,
        });
      }
    }

    // left wall
    for (let i = 0; i < yCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2,
          center[1] - sideWallSizeY / 2 + j * gap,
          center[2] - sideWallSizeZ / 2 + i * gap,
        ] as Vector3Tuple;
        const rotation = [
          0,
          0,
          /* -Math.PI / 2, */
          -Math.PI / 2 * (i / xCount),
        ] as Vector3Tuple;
        const shader = new ShaderMaterial({
          blending: AdditiveBlending,
          vertexShader: spotlightShader.vertex,
          fragmentShader: spotlightShader.fragment,
          uniforms: {
            uColor: {
              value: new Color(0xffffff),
            },
            uTime: {
              value: 0,
            },
            uCameraPosition: {
              value: new Vector3(),
            },
            uBeamRoot: {
              value: new Vector3(...position),
            },
            uFalloffDistance: {
              value: SPOTLIGHT_LENGTH,
            },
          },
          transparent: true,
          depthTest: false,
        });
        spotlights.push({
          position,
          rotation,
          material: shader,
        });
      }
    }

    // right wall
    for (let i = 0; i < yCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] + behindWallSizeX / 2,
          center[1] - sideWallSizeY / 2 + j * gap,
          center[2] - sideWallSizeZ / 2 + i * gap,
        ] as Vector3Tuple;
        const rotation = [
          0,
          0,
          /* Math.PI / 2, */
          Math.PI / 2 * (i / xCount),
        ] as Vector3Tuple;
        const shader = new ShaderMaterial({
          blending: AdditiveBlending,
          vertexShader: spotlightShader.vertex,
          fragmentShader: spotlightShader.fragment,
          uniforms: {
            uColor: {
              value: new Color(0xffffff),
            },
            uTime: {
              value: 0,
            },
            uCameraPosition: {
              value: new Vector3(),
            },
            uBeamRoot: {
              value: new Vector3(...position),
            },
            uFalloffDistance: {
              value: SPOTLIGHT_LENGTH,
            },
          },
          transparent: true,
          depthTest: false,
        });
        spotlights.push({
          position,
          rotation,
          material: shader,
        });
      }
    }

    // top wall
    for (let i = 0; i < xCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2 + i * gap,
          center[1] + behindWallSizeY / 2,
          center[2] - sideWallSizeZ / 2 + j * gap,
        ] as Vector3Tuple;
        const rotation = [
          Math.PI,
          0,
          0,
        ] as Vector3Tuple;
        const shader = new ShaderMaterial({
          blending: AdditiveBlending,
          vertexShader: spotlightShader.vertex,
          fragmentShader: spotlightShader.fragment,
          uniforms: {
            uColor: {
              value: new Color(0xffffff),
            },
            uTime: {
              value: 0,
            },
            uCameraPosition: {
              value: new Vector3(),
            },
            uBeamRoot: {
              value: new Vector3(...position),
            },
            uFalloffDistance: {
              value: SPOTLIGHT_LENGTH,
            },
          },
          transparent: true,
          depthTest: false,
        });
        spotlights.push({
          position,
          rotation,
          material: shader,
        });
      }
    }

    // bottom wall
    for (let i = 0; i < xCount; i++) {
      for (let j = 0; j < yCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2 + i * gap,
          center[1] - sideWallSizeY / 2,
          center[2] - sideWallSizeZ / 2 + j * gap,
        ] as Vector3Tuple;
        const rotation = [
          0,
          0,
          0,
        ] as Vector3Tuple;
        const shader = new ShaderMaterial({
          blending: AdditiveBlending,
          vertexShader: spotlightShader.vertex,
          fragmentShader: spotlightShader.fragment,
          uniforms: {
            uColor: {
              value: new Color(0xffffff),
            },
            uTime: {
              value: 0,
            },
            uCameraPosition: {
              value: new Vector3(),
            },
            uBeamRoot: {
              value: new Vector3(...position),
            },
            uFalloffDistance: {
              value: SPOTLIGHT_LENGTH,
            },
          },
          transparent: true,
          depthTest: false,
        });
        spotlights.push({
          position,
          rotation,
          material: shader,
        });
      }
    }
    return spotlights;
  }, []);

  useFrame(({ clock, camera }) => {
    if (!groupRef.current) return;

    groupRef.current.children.forEach((child) => {
      if (child instanceof Mesh) {
        child.material.uniforms.uTime.value = clock.elapsedTime;
        child.material.uniforms.uCameraPosition.value = camera.position;
        /* child.rotation.x += (Math.random() * 2 - 1) * 0.001; */
      }
    });
  });

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child) => {
      if (child instanceof Mesh) {
        child.geometry.translate(0, SPOTLIGHT_LENGTH / 2, 0);
        /* child.material = child.userData.material; */
        child.material.uniforms.uColor.value = new Color(
          Math.random(),
          Math.random(),
          Math.random(),
        );
      }
    });
  }, [meshRef]);

  return (
    <group ref={groupRef}>
      {spotlights.map((spotlight, index) => (
        <mesh
          key={index}
          position={spotlight.position}
          rotation={spotlight.rotation}
        >
          <cylinderGeometry args={[3, 0.5, SPOTLIGHT_LENGTH]} />
          <shaderMaterial {...spotlight.material} />
        </mesh>
      ))}
    </group>
  );
}

export default function Scene() {
  return (
    <Canvas onClick={(e) => e.currentTarget.requestPointerLock()}>
      <Perf position="bottom-right" />
      <FirstPersonControls lookSpeed={0.1} movementSpeed={10} />
      <Spotlights />
      <EffectComposer>
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </Canvas>
  );
}

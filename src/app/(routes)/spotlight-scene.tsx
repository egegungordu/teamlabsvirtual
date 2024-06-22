"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { Vignette, EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector2Like,
  Vector2Tuple,
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
    uniform float uBeamSizeMultiplier;

    void main() {
      float distanceToBeamRoot = position.y;
      vec3 sizeOffset = distanceToBeamRoot > 0.0 ? normal * uBeamSizeMultiplier : vec3(0.0);

      vec4 modelPosition = modelMatrix * vec4(position + sizeOffset, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;

      vec3 beamDirection = -normalize(modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
      vec3 toCamera = normalize(uCameraPosition - modelPosition.xyz);
      vec3 toCameraProjectedToBeamDirectionPlane = normalize(toCamera - dot(toCamera, beamDirection) * beamDirection);
      vec3 normalWorld = normalize(modelMatrix * vec4(normal, 0.0)).xyz;

      float fresnel = pow(1.0 + dot(toCameraProjectedToBeamDirectionPlane, normalWorld), 6.0) / 120.0;
      float beamShine = pow(1.0 + dot(beamDirection, toCamera), 4.0) / 20.0;
      float falloff = max(1.0 - distanceToBeamRoot / uFalloffDistance, 0.0);

      vAlpha = (fresnel + beamShine * fresnel) * falloff / 4.0;

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

interface Circle {
  center: Vector2Like;
  radius: number;
}

function calculateTangentDegree(
  position: Vector2Tuple,
  direction: Vector2Tuple,
  circle: Circle,
): number | null {
  const [px, py] = position;
  const {
    center: { x: cx, y: cy },
    radius: r,
  } = circle;

  // Calculate vector from circle center to position
  const dx = px - cx;
  const dy = py - cy;

  // Calculate distance from position to circle center
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Check if position is inside or on the circle
  if (dist <= r) {
    return null;
  }

  // Calculate angle between position-to-center line and tangent line
  const tangentAngle = Math.acos(r / dist);

  // Calculate angle of position-to-center line
  const centerAngle = Math.atan2(dy, dx);

  // Calculate angle of left tangent line
  const leftTangentAngle = centerAngle + tangentAngle;

  // Calculate the angle of the current direction vector
  const directionAngle = Math.atan2(direction[0], direction[1]);

  // Calculate the difference between the left tangent angle and the current direction
  let angleDifference = leftTangentAngle - directionAngle;

  // Normalize the angle difference to be between -π and π
  angleDifference = ((angleDifference + Math.PI) % (2 * Math.PI)) - Math.PI;

  // Convert the angle difference to degrees
  /* return (angleDifference * 180) / Math.PI; */

  // convert to radians
  return angleDifference;
}

const SPOTLIGHT_LENGTH = 300;

function Spotlights() {
  const meshRef = useRef<Mesh | null>(null);
  const groupRef = useRef<Group | null>(null);

  const spotlights = useMemo(() => {
    const spotlights = [];
    const center = [0, 0, 0];
    const spotlightsInRing = 64;
    const ringGap = 12;
    const ringRadius = SPOTLIGHT_LENGTH / 1.2;
    const ringCount = 16;
    for (let i = 0; i < spotlightsInRing; i++) {
      for (let j = 0; j < ringCount; j++) {
        const position = [
          center[0] + Math.sin(i * Math.PI * 2 / spotlightsInRing) * ringRadius,
          center[1] + Math.cos(i * Math.PI * 2 / spotlightsInRing) * ringRadius,
          center[2] - (ringGap * ringCount) / 2 + j * ringGap,
        ] as Vector3Tuple;
        // should look at the center
        const rotation = [
          0,
          0,
          Math.PI - Math.PI * (i / spotlightsInRing) * 2,
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
            uBeamSizeMultiplier: {
              value: 1,
            },
          },
          transparent: true,
          depthTest: false,
        });
        spotlights.push({
          i,
          j,
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

        const dir = new Vector3(0, 1, 0);
        dir.applyEuler(child.userData.initialRotation);

        const targetDegree = calculateTangentDegree(
          [child.position.x, child.position.y],
          [dir.x, dir.y],
          {
            center: {
              x: Math.sin(clock.elapsedTime / 2 + child.userData.j * 0.2) * 50,
              y: Math.cos(clock.elapsedTime / 2 + child.userData.i * 0.2) * 50,
            },
            radius:
              125 - Math.sin(clock.elapsedTime / 2 + child.userData.j * 0.4) * 85,
          },
        );
        if (targetDegree !== null) {
          child.rotation.z = targetDegree;
          child.material.uniforms.uColor.value.setHSL(
            Math.sin(clock.elapsedTime * 0.5 + child.userData.j * 0.15) * 0.5 +
              0.5,
            0.5,
            0.5,
          );
          child.material.uniforms.uBeamSizeMultiplier.value = 7;
        } else {
          child.material.uniforms.uColor.value = new Color(0x000);
        }
      }
    });
  });

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child) => {
      if (child instanceof Mesh) {
        child.geometry.translate(0, SPOTLIGHT_LENGTH / 2, 0);
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
          userData={{
            initialRotation: spotlight.rotation,
            i: spotlight.i,
            j: spotlight.j,
          }}
          key={index}
          position={spotlight.position}
          rotation={spotlight.rotation}
        >
          <cylinderGeometry args={[3, 2, SPOTLIGHT_LENGTH, 16, 1, true]} />
          <shaderMaterial {...spotlight.material} />
        </mesh>
      ))}
    </group>
  );
}

export default function SpotlightScene({ showPerf = true }: { showPerf?: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0, 920], fov: 35, far: 3000 }}>
      {showPerf && <Perf position="bottom-right" style={{marginBottom: 32}} />}
      <OrbitControls autoRotate autoRotateSpeed={1}/>
      <Spotlights />
      <EffectComposer>
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </Canvas>
  );
}

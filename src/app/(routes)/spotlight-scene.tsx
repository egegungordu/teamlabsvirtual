"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { FirstPersonControls, OrbitControls } from "@react-three/drei";
import { Vignette, EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  ShaderMaterial,
  Vector2,
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
      vec3 sizeOffset = distanceToBeamRoot > 0.0 ? normal * 2.0 : vec3(0.0);

      vec4 modelPosition = modelMatrix * vec4(position + sizeOffset, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;

      vec3 beamDirection = -normalize(modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
      vec3 toCamera = normalize(uCameraPosition - modelPosition.xyz);
      vec3 toCameraProjectedToBeamDirectionPlane = normalize(toCamera - dot(toCamera, beamDirection) * beamDirection);
      vec3 normalWorld = normalize(modelMatrix * vec4(normal, 0.0)).xyz;

      float fresnel = pow(1.0 + dot(toCameraProjectedToBeamDirectionPlane, normalWorld), 6.0) / 120.0;
      float beamShine = pow(1.0 + dot(beamDirection, toCamera), 4.0) / 20.0;
      /* float distance = length(modelPosition.xyz - uBeamRoot); */
      float falloff = max(1.0 - distanceToBeamRoot / uFalloffDistance, 0.0);

      vAlpha = (fresnel + beamShine * fresnel) * falloff / 3.0;

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

const SPOTLIGHT_LENGTH = 100;

function Spotlights() {
  const meshRef = useRef<Mesh | null>(null);
  const groupRef = useRef<Group | null>(null);

  const spotlights = useMemo(() => {
    const center = [0, 0, 0];
    const gap = 15;
    const xCount = 10;
    const yCount = 10;
    const zCount = 26;

    const behindWallSizeX = (xCount - 1) * gap;
    const behindWallSizeY = (yCount - 1) * gap;
    const sideWallSizeZ = (zCount - 1) * gap;
    const sideWallSizeY = behindWallSizeY;

    const spotlights = [];

    /* // back wall */
    /* for (let i = 0; i < xCount; i++) { */
    /*   for (let j = 0; j < yCount; j++) { */
    /*     const position = [ */
    /*       center[0] - behindWallSizeX / 2 + i * gap, */
    /*       center[1] - behindWallSizeY / 2 + j * gap, */
    /*       center[2] - sideWallSizeZ / 2, */
    /*     ] as Vector3Tuple; */
    /*     const rotation = [ */
    /*       /* Math.PI / 2, */
    /*       Math.PI / 2 * (i / xCount), */
    /*       0, */
    /*       0, */
    /*     ] as Vector3Tuple; */
    /*     const shader = new ShaderMaterial({ */
    /*       blending: AdditiveBlending, */
    /*       vertexShader: spotlightShader.vertex, */
    /*       fragmentShader: spotlightShader.fragment, */
    /*       uniforms: { */
    /*         uColor: { */
    /*           value: new Color(0xffffff), */
    /*         }, */
    /*         uTime: { */
    /*           value: 0, */
    /*         }, */
    /*         uCameraPosition: { */
    /*           value: new Vector3(), */
    /*         }, */
    /*         uBeamRoot: { */
    /*           value: new Vector3(...position), */
    /*         }, */
    /*         uFalloffDistance: { */
    /*           value: SPOTLIGHT_LENGTH, */
    /*         }, */
    /*       }, */
    /*       transparent: true, */
    /*       depthTest: false, */
    /*     }); */
    /*     spotlights.push({ */
    /*       position, */
    /*       rotation, */
    /*       material: shader, */
    /*     }); */
    /*   } */
    /* } */
    /**/
    // left wall
    for (let i = 0; i < yCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2,
          center[1] - sideWallSizeY / 2 + i * gap,
          center[2] - sideWallSizeZ / 2 + j * gap,
        ] as Vector3Tuple;
        const rotation = [0, 0, -Math.PI / 2] as Vector3Tuple;
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

    // right wall
    for (let i = 0; i < yCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] + behindWallSizeX / 2,
          center[1] - sideWallSizeY / 2 + i * gap,
          center[2] - sideWallSizeZ / 2 + j * gap,
        ] as Vector3Tuple;
        const rotation = [0, 0, Math.PI / 2] as Vector3Tuple;
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

    // top wall
    for (let i = 0; i < xCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2 + i * gap,
          center[1] + behindWallSizeY / 2,
          center[2] - sideWallSizeZ / 2 + j * gap,
        ] as Vector3Tuple;
        const rotation = [0, 0, 0] as Vector3Tuple;
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

    // bottom wall
    for (let i = 0; i < xCount; i++) {
      for (let j = 0; j < zCount; j++) {
        const position = [
          center[0] - behindWallSizeX / 2 + i * gap,
          center[1] - sideWallSizeY / 2,
          center[2] - sideWallSizeZ / 2 + j * gap,
        ] as Vector3Tuple;
        const rotation = [0, 0, 0] as Vector3Tuple;
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
              x: Math.sin(clock.elapsedTime + child.userData.j * 0.4) * 10,
              y: Math.cos(clock.elapsedTime + child.userData.i * 0.4) * 10,
            },
            radius:
              45 - Math.sin(clock.elapsedTime + child.userData.j * 0.4) * 15,
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
        /* child.geometry.computeVertexNormals(true); */
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
          userData={{
            initialRotation: spotlight.rotation,
            i: spotlight.i,
            j: spotlight.j,
          }}
          key={index}
          position={spotlight.position}
          rotation={spotlight.rotation}
        >
          <cylinderGeometry args={[3, 0.5, SPOTLIGHT_LENGTH, 16, 1, true]} />
          <shaderMaterial {...spotlight.material} />
        </mesh>
      ))}
    </group>
  );
}

function Walls() {
  return (
    <group>
      <mesh
        renderOrder={9999999}
        position={[-50, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color={0xff00ff} transparent={false} />
      </mesh>
    </group>
  );
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 320], fov: 35 }}>
      <Perf position="bottom-right" />
      <OrbitControls />
      <Spotlights />
      {/* <Walls /> */}
      <EffectComposer>
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} height={300} />
      </EffectComposer>
    </Canvas>
  );
}

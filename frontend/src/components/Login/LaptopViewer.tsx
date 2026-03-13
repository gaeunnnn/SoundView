// 3D 노트북 GLB 모델을 스크롤 기반으로 Y축 회전시키는 컴포넌트
// 의존성: @react-three/fiber, @react-three/drei, three (package.json에 이미 포함)
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const MODEL_URL = "/models/laptop.glb";

/**
 * 화면 오버레이 평면 위치·크기 조정값.
 * 모델 스케일에 따라 아래 값을 수정하세요.
 *
 *   SCREEN_POS   : [x, y, z] — 화면 중앙 좌표 (local 공간, Y=Math.PI 그룹 기준)
 *   SCREEN_ROT_X : 화면 상하 기울기 (라디안, 양수 = 뒤로 기울어짐)
 *   SCREEN_SIZE  : [너비, 높이]
 *
 * 위치 조정 팁: Z값이 음수일수록 카메라 쪽으로 나옴 (그룹 Y=π 때문에 Z 부호 반전)
 */
// SCENE_X_TILT: 노트북 모델 전체 X축 기울기 (라디안)
//   음수 = 모델을 앞으로 세움 (50° = -0.873)
const SCENE_X_TILT = -(20 * Math.PI) / 180;

// SCREEN_ROT_X = -SCENE_X_TILT: 이미지가 inner group 기울기를 상쇄해 세계 기준 수직 유지
const SCREEN_POS: [number, number, number] = [0, 0.2, 0.05];
const SCREEN_ROT_X = -SCENE_X_TILT; // 수직 유지
const SCREEN_SIZE: [number, number] = [1.55, 0.97];

// 모듈 로드 시 GLB 즉시 프리페치 (사용자가 페이지를 보기 전에 다운로드 시작)
useGLTF.preload(MODEL_URL);

// ─── 화면 오버레이 평면 ───────────────────────────────────────────────────────

type ScreenPlaneProps = {
  texturePath?: string;
};

function ScreenPlane({ texturePath }: ScreenPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;

    let mat: THREE.MeshBasicMaterial;

    if (texturePath) {
      const texture = new THREE.TextureLoader().load(texturePath);
      texture.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    } else {
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x06090f),
        side: THREE.DoubleSide,
      });
    }

    meshRef.current.material = mat;

    return () => {
      mat.dispose();
    };
  }, [texturePath]);

  return (
    // rotation.y = Math.PI: 그룹이 Y=π 회전하므로 평면을 뒤집어 카메라 정면을 향하게 함
    <mesh
      ref={meshRef}
      position={SCREEN_POS}
      rotation={[SCREEN_ROT_X, Math.PI, 0]}
    >
      <planeGeometry args={SCREEN_SIZE} />
      <meshBasicMaterial color={0x06090f} />
    </mesh>
  );
}

// ─── 내부 3D 모델 컴포넌트 ───────────────────────────────────────────────────

type LaptopModelProps = {
  rotationYRad: number;
  screenTexturePath?: string;
};

function LaptopModel({ rotationYRad, screenTexturePath }: LaptopModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  // 공유 캐시를 오염시키지 않도록 씬을 깊은 복사
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // 모델 바운딩 박스 로그 (위치 조정 참고용)
  useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    console.log("[LaptopViewer] 모델 크기:", size);
    console.log("[LaptopViewer] 모델 중심:", center);
  }, [clonedScene]);

  // 회전값을 ref에 보관 (useFrame 클로저 stale 방지)
  const rotYRef = useRef(rotationYRad);
  useEffect(() => {
    rotYRef.current = rotationYRad;
  }, [rotationYRad]);

  useFrame(() => {
    if (groupRef.current !== null) {
      groupRef.current.rotation.y = rotYRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      {/* inner group: 모델 전체를 SCENE_X_TILT만큼 기울임 */}
      <group rotation={[SCENE_X_TILT, 0, 0]}>
        <primitive object={clonedScene} />
        {/* SCREEN_ROT_X = -SCENE_X_TILT 이므로 이미지는 세계 기준 수직을 유지 */}
        <ScreenPlane texturePath={screenTexturePath} />
      </group>
    </group>
  );
}

// ─── Suspense 폴백 ────────────────────────────────────────────────────────────

function LoadingPlaceholder() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current !== null) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.6, 0.08, 1.1]} />
      <meshStandardMaterial color="#1c2535" />
    </mesh>
  );
}

// ─── 공개 컴포넌트 ─────────────────────────────────────────────────────────────

export type LaptopViewerProps = {
  rotationDeg: number;
  screenTexturePath?: string;
};

export default function LaptopViewer({
  rotationDeg,
  screenTexturePath,
}: LaptopViewerProps) {
  // 도 → 라디안 변환, CSS rotateY 방향과 맞추기 위해 부호 반전
  const rotationYRad = useMemo(
    () => -(rotationDeg * Math.PI) / 180 + Math.PI,
    [rotationDeg],
  );

  return (
    <div className="w-full" style={{ aspectRatio: "4 / 3.5" }}>
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ position: [0, 0.5, 3.5], fov: 50, near: 0.1, far: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-3, 3, 2]} intensity={0.4} />
        <directionalLight position={[0, 2, -5]} intensity={0.25} />

        <Suspense fallback={<LoadingPlaceholder />}>
          <LaptopModel
            rotationYRad={rotationYRad}
            screenTexturePath={screenTexturePath}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

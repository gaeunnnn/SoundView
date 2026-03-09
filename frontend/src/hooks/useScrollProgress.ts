// 휠과 터치 입력으로 가상 스크롤 진행률과 노트북 회전 상태를 계산하는 커스텀 훅 파일
import { useEffect, useMemo, useRef, useState } from "react";

type ScrollAnimationState = {
  scrollProgress: number;
  rotationDeg: number;
  isAfterActive: boolean;
};

const MAX_ROTATION_DEG = 360;
const AFTER_ACTIVE_DEG = 270;
const WHEEL_SENSITIVITY = 0.0012;
const TOUCH_SENSITIVITY = 0.0025;

export default function useScrollProgress(): ScrollAnimationState {
  const [scrollProgress, setScrollProgress] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const updateProgress = (delta: number) => {
      setScrollProgress((prev) => {
        const next = prev + delta;
        return Math.max(0, Math.min(next, 1));
      });
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateProgress(event.deltaY * WHEEL_SENSITIVITY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartYRef.current === null) return;

      const currentY = event.touches[0]?.clientY ?? 0;
      const deltaY = touchStartYRef.current - currentY;

      updateProgress(deltaY * TOUCH_SENSITIVITY);
      touchStartYRef.current = currentY;
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const rotationDeg = useMemo(() => {
    return scrollProgress * MAX_ROTATION_DEG;
  }, [scrollProgress]);

  const isAfterActive = rotationDeg >= AFTER_ACTIVE_DEG;

  return {
    scrollProgress,
    rotationDeg,
    isAfterActive,
  };
}
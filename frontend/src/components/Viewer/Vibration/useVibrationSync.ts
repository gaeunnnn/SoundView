import { useMemo } from 'react';
import type { VibrationFrame } from '../../../types/vibration';

/**
 * 영상 재생 시간(currentTime)에 가장 가까운 진동 프레임을 이진 탐색으로 찾는 훅
 */
export const useVibrationSync = (frames: VibrationFrame[], currentTime: number) => {
  return useMemo(() => {
    if (!frames || frames.length === 0) return null;

    let left = 0;
    let right = frames.length - 1;
    let closestIndex = 0;

    // 이진 탐색으로 가장 가까운 timeline 찾기
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      if (Math.abs(frames[mid].timeline - currentTime) < 
          Math.abs(frames[closestIndex].timeline - currentTime)) {
        closestIndex = mid;
      }

      if (frames[mid].timeline < currentTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return frames[closestIndex];
  }, [frames, currentTime]);
};

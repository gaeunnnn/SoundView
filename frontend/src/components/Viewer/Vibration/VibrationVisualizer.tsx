import React, { useEffect, useRef } from 'react';
import type { VibrationFrame } from '../../../types/vibration';

interface VibrationVisualizerProps {
  frames: VibrationFrame[];
  currentTime: number;
  isPlaying: boolean;
  channel: 'L' | 'R';
  width: number;
  height: number;
}

/**
 * 점선 기준점과 텍스트 레이아웃이 최적화된 실시간 진동 스펙트럼
 */
export const VibrationVisualizer: React.FC<VibrationVisualizerProps> = ({
  frames,
  currentTime,
  isPlaying,
  channel,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTimeRef = useRef(currentTime);
  const lastUpdateRef = useRef(performance.now());

  useEffect(() => {
    lastTimeRef.current = currentTime;
    lastUpdateRef.current = performance.now();
  }, [currentTime]);

  useEffect(() => {
    if (!canvasRef.current || !frames.length) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      if (!ctx || !canvasRef.current) return;

      const now = performance.now();
      const dt = isPlaying ? (now - lastUpdateRef.current) / 1000 : 0;
      const smoothTime = lastTimeRef.current + dt;

      ctx.clearRect(0, 0, width, height);
      
      // 1. 배경 미세 가이드
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // 2. 현재 시점 레이아웃 개선
      const centerX = width / 2;
      
      // [텍스트 우선 출력]
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('현재 시점', centerX, 15);

      // [점선 기준선] - 텍스트 아래인 y=22 지점부터 시작
      ctx.save(); // 스타일 격리를 위해 save/restore 사용
      ctx.beginPath();
      ctx.setLineDash([4, 4]); // 4px 실선, 4px 공백
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(centerX, 22); // 글자 아래에서 시작
      ctx.lineTo(centerX, height);
      ctx.stroke();
      ctx.restore();

      // 3. 파형 렌더링
      const timeWindow = 4; 
      const startTime = smoothTime - timeWindow / 2;
      const endTime = smoothTime + timeWindow / 2;
      const visibleFrames = frames.filter(f => f.timeline >= startTime - 0.2 && f.timeline <= endTime + 0.2);

      const color = channel === 'L' ? '#00FBFF' : '#FF00FF';
      const getValue = channel === 'L' ? (f: VibrationFrame) => f.dBL : (f: VibrationFrame) => f.dBR;

      if (visibleFrames.length > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();

        visibleFrames.forEach((f, i) => {
          const x = ((f.timeline - startTime) / timeWindow) * width;
          const val = getValue(f);
          const y = height - ((val / 255) * (height - 35) + 10); // 하단 여백 확보
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, channel === 'L' ? 'rgba(0, 251, 255, 0.15)' : 'rgba(255, 0, 255, 0.15)');
        fillGradient.addColorStop(1, 'transparent');
        ctx.lineTo(((visibleFrames[visibleFrames.length - 1].timeline - startTime) / timeWindow) * width, height);
        ctx.lineTo(((visibleFrames[0].timeline - startTime) / timeWindow) * width, height);
        ctx.fillStyle = fillGradient;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [frames, channel, width, height, isPlaying]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', width: '100%', height: '100%' }} />
  );
};

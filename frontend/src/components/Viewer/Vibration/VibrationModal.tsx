import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Activity, Info } from 'lucide-react';
import { VibrationVisualizer } from './VibrationVisualizer';
import type { VibrationFrame } from '../../../types/vibration';

interface VibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  frames: VibrationFrame[];
  currentTime: number;
  isPlaying: boolean;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

/**
 * 실시간 저음/고음 주파수(Hz) 스펙트럼 모달
 */
export const VibrationModal: React.FC<VibrationModalProps> = ({
  isOpen,
  onClose,
  frames,
  currentTime,
  isPlaying,
}) => {
  const [rect, setRect] = useState({
    x: 30,
    y: 30,
    width: 520,
    height: 300,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDirection>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const initialRect = useRef(rect);
  const initialMouse = useRef({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - rect.x, y: e.clientY - rect.y };
    e.stopPropagation();
  };

  const handleResizeStart = (e: React.MouseEvent, dir: ResizeDirection) => {
    setResizeDir(dir);
    initialRect.current = rect;
    initialMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setRect(prev => ({ ...prev, x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }));
      return;
    }
    if (resizeDir) {
      const dx = e.clientX - initialMouse.current.x;
      const dy = e.clientY - initialMouse.current.y;
      const minW = 440;
      const minH = 250;
      let { x, y, width, height } = initialRect.current;
      if (resizeDir.includes('e')) width = Math.max(minW, width + dx);
      if (resizeDir.includes('s')) height = Math.max(minH, height + dy);
      if (resizeDir.includes('w')) { const nextW = Math.max(minW, width - dx); if (nextW !== minW) { x += dx; width = nextW; } }
      if (resizeDir.includes('n')) { const nextH = Math.max(minH, height - dy); if (nextH !== minH) { y += dy; height = nextH; } }
      setRect({ x, y, width, height });
    }
  }, [isDragging, resizeDir]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); setResizeDir(null); }, []);

  useEffect(() => {
    if (isDragging || resizeDir) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, resizeDir, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  const handleStyle = "absolute z-[110] transition-colors hover:bg-[#00FBFF]/10";

  return (
    <div className="fixed z-[100] pointer-events-none" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
      <div className="w-full h-full bg-[#0F172A]/60 border border-white/20 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col select-none backdrop-blur-md">
        
        <div className={`${handleStyle} top-0 left-0 w-full h-[4px] cursor-n-resize`} onMouseDown={(e) => handleResizeStart(e, 'n')} />
        <div className={`${handleStyle} bottom-0 left-0 w-full h-[4px] cursor-s-resize`} onMouseDown={(e) => handleResizeStart(e, 's')} />
        <div className={`${handleStyle} top-0 left-0 h-full w-[4px] cursor-w-resize`} onMouseDown={(e) => handleResizeStart(e, 'w')} />
        <div className={`${handleStyle} top-0 right-0 h-full w-[4px] cursor-e-resize`} onMouseDown={(e) => handleResizeStart(e, 'e')} />
        
        <div onMouseDown={handleDragStart} className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/10 cursor-move hover:bg-white/20 transition-colors shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="text-[#00FBFF]" size={16} />
            <h3 className="text-white font-bold text-sm tracking-tight">실시간 진동 스펙트럼 (Hz)</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1"><X size={20} /></button>
        </div>

        <div className="flex-1 p-3 grid grid-cols-2 gap-3 min-h-0">
          <div className="flex flex-col gap-1.5 min-h-0">
            <span className="text-[#00FBFF] text-xs font-black px-1 uppercase tracking-wider">저음역 (Low)</span>
            <div className="flex-1 bg-black/40 rounded-xl border border-[#00FBFF]/20 overflow-hidden shadow-inner">
              <VibrationVisualizer 
                frames={frames} 
                currentTime={currentTime} 
                isPlaying={isPlaying} 
                channel="L" 
                width={rect.width / 2 - 20} 
                height={rect.height - 100} 
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-h-0">
            <span className="text-[#FF00FF] text-xs font-black px-1 uppercase tracking-wider">고음역 (High)</span>
            <div className="flex-1 bg-black/40 rounded-xl border border-[#FF00FF]/20 overflow-hidden shadow-inner">
              <VibrationVisualizer 
                frames={frames} 
                currentTime={currentTime} 
                isPlaying={isPlaying} 
                channel="R" 
                width={rect.width / 2 - 20} 
                height={rect.height - 100} 
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-white/5 flex items-center justify-between border-t border-white/5 shrink-0">
          <div className="flex gap-4 items-center">
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-[#00FBFF]" />
               <span className="text-white/60 text-[11px] font-medium text-nowrap">저음역 (Hz)</span>
             </div>
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-[#FF00FF]" />
               <span className="text-white/60 text-[11px] font-medium text-nowrap">고음역 (Hz)</span>
             </div>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-[10px]">
            <Info size={10} />
            <span>단위 기준: 0 ~ 300Hz</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useRef, useState, useEffect } from 'react';

export interface Viewport {
  zoom: number;
  offset: { x: number; y: number };
}

/**
 * Manages zoom + pan state with ref-backed event handler to avoid stale closures.
 * Returns state for rendering + containerRef to attach to the canvas div.
 */
export function useViewport(imgDims: { w: number; h: number }, currentId: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [initialSized, setInitialSized] = useState(false);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Reset fit when image changes
  useEffect(() => { setInitialSized(false); }, [currentId]);

  // Fit image to container
  useEffect(() => {
    if (!containerRef.current || imgDims.w === 0 || initialSized) return;
    const applyFit = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) return;
      const padding = 60;
      const fitZoom = Math.min(
        (rect.width - padding) / imgDims.w,
        (rect.height - padding) / imgDims.h
      );
      const ox = (rect.width - imgDims.w * fitZoom) / 2;
      const oy = (rect.height - imgDims.h * fitZoom) / 2;
      zoomRef.current = fitZoom;
      offsetRef.current = { x: ox, y: oy };
      setZoom(fitZoom);
      setOffset({ x: ox, y: oy });
      setInitialSized(true);
    };
    applyFit();
    const t = setTimeout(applyFit, 300);
    return () => clearTimeout(t);
  }, [imgDims.w, imgDims.h, currentId, initialSized]);

  // Wheel zoom — point under cursor stays fixed
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const pz = zoomRef.current;
      const po = offsetRef.current;
      const nz = Math.max(0.01, Math.min(pz * factor, 50));
      const no = {
        x: mx - (mx - po.x) * (nz / pz),
        y: my - (my - po.y) * (nz / pz),
      };
      zoomRef.current = nz;
      offsetRef.current = no;
      setZoom(nz);
      setOffset(no);
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, []);

  const resetView = () => {
    if (!containerRef.current || imgDims.w === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 60;
    const fitZoom = Math.min(
      (rect.width - padding) / imgDims.w,
      (rect.height - padding) / imgDims.h
    );
    const ox = (rect.width - imgDims.w * fitZoom) / 2;
    const oy = (rect.height - imgDims.h * fitZoom) / 2;
    zoomRef.current = fitZoom;
    offsetRef.current = { x: ox, y: oy };
    setZoom(fitZoom);
    setOffset({ x: ox, y: oy });
  };

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - offsetRef.current.x) / zoomRef.current,
    y: (sy - offsetRef.current.y) / zoomRef.current,
  });

  return { containerRef, zoom, offset, resetView, screenToWorld };
}

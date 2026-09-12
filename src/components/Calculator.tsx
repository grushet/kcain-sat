"use client";

import { useRef, useState } from "react";
import { Calculator as CalcIcon, GripHorizontal, Minus, X } from "lucide-react";
import { motion } from "framer-motion";

interface CalculatorProps {
  /** Overrides the floating button's fixed position, e.g. to clear other bottom-anchored UI. */
  positionClassName?: string;
  /** Changing this value clears the calculator's work (e.g. pass the current question index). */
  resetKey?: string | number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 460;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;
const MARGIN = 16;
const HEADER_HEIGHT = 24;

export function Calculator({ positionClassName = "bottom-6 right-6", resetKey }: CalculatorProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const resizeRef = useRef<{ pointerId: number; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  const handleOpen = () => {
    setOpen(true);
    setBox((prev) => {
      if (prev) return prev;
      const left = Math.max(MARGIN, window.innerWidth - DEFAULT_WIDTH - 24);
      const top = Math.min(80, Math.max(MARGIN, window.innerHeight - DEFAULT_HEIGHT - MARGIN));
      return { left, top, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    });
  };

  const handleDragPointerDown = (e: React.PointerEvent) => {
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startLeft: box.left, startTop: box.top };
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setBox((prev) => {
      if (!prev) return prev;
      const maxLeft = Math.max(MARGIN, window.innerWidth - prev.width - MARGIN);
      const maxTop = Math.max(MARGIN, window.innerHeight - prev.height - MARGIN);
      const left = Math.min(maxLeft, Math.max(MARGIN, drag.startLeft + (e.clientX - drag.startX)));
      const top = Math.min(maxTop, Math.max(MARGIN, drag.startTop + (e.clientY - drag.startY)));
      return { ...prev, left, top };
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    dragRef.current = null;
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    if (!box) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startWidth: box.width, startHeight: box.height };
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    setBox((prev) => {
      if (!prev) return prev;
      const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - prev.left - MARGIN);
      const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - prev.top - MARGIN);
      const width = Math.min(maxWidth, Math.max(MIN_WIDTH, resize.startWidth + (e.clientX - resize.startX)));
      const height = Math.min(maxHeight, Math.max(MIN_HEIGHT, resize.startHeight + (e.clientY - resize.startY)));
      return { ...prev, width, height };
    });
  };

  const endResize = (e: React.PointerEvent) => {
    resizeRef.current = null;
  };

  return (
    <>
      <motion.button
        onClick={handleOpen}
        className={`fixed ${positionClassName} z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-sat-primary to-sat-crimson dark:from-sky-500 dark:to-sky-600 text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Open Calculator"
      >
        <CalcIcon className="w-7 h-7" />
      </motion.button>

      {box && (
        <motion.div
          animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.96 }}
          transition={{ type: "spring", damping: 25 }}
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: minimized ? HEADER_HEIGHT : box.height,
            visibility: open ? "visible" : "hidden",
            pointerEvents: open ? "auto" : "none",
          }}
          className="fixed z-50 rounded-2xl shadow-2xl border border-sat-gray-200 dark:border-sat-gray-700"
        >
          <div className="absolute inset-0 rounded-2xl overflow-hidden bg-white dark:bg-sat-gray-800 flex flex-col">
            <div
              onPointerDown={handleDragPointerDown}
              onPointerMove={handleDragPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ touchAction: "none" }}
              className="relative flex items-center justify-center h-6 shrink-0 cursor-move select-none bg-sat-gray-100 dark:bg-sat-gray-700/60 border-b border-sat-gray-200 dark:border-sat-gray-700"
            >
              <GripHorizontal className="w-4 h-4 text-sat-gray-400 dark:text-sat-gray-500" />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setMinimized((m) => !m)}
                  className="p-1 rounded-md hover:bg-sat-gray-200 dark:hover:bg-sat-gray-600 transition-colors text-sat-gray-500 dark:text-sat-gray-300"
                  title={minimized ? "Restore calculator" : "Minimize (keeps your work)"}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-sat-gray-200 dark:hover:bg-sat-gray-600 transition-colors text-sat-gray-500 dark:text-sat-gray-300"
                  title="Close (your work is kept until the next question)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                key={resetKey}
                src="https://www.desmos.com/calculator"
                className="w-full h-full border-0"
                title="Desmos Calculator"
              />
            </div>
          </div>
          {!minimized && (
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              style={{ touchAction: "none" }}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-sat-gray-400 dark:border-sat-gray-500 rounded-br-sm" />
            </div>
          )}
        </motion.div>
      )}
    </>
  );
}

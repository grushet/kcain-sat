"use client";

import { useRef, useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { motion, useDragControls } from "framer-motion";

interface CalculatorProps {
  /** Overrides the floating button's fixed position, e.g. to clear other bottom-anchored UI. */
  positionClassName?: string;
  /** Changing this value clears the calculator's work (e.g. pass the current question index). */
  resetKey?: string | number;
}

export function Calculator({ positionClassName = "bottom-6 right-6", resetKey }: CalculatorProps) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <motion.button
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        className={`fixed ${positionClassName} z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-sat-primary to-sat-crimson dark:from-sky-500 dark:to-sky-600 text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Open Calculator"
      >
        <CalcIcon className="w-7 h-7" />
      </motion.button>

      {/* Drag boundary so the panel can't be dragged off-screen */}
      <div ref={constraintsRef} className="fixed inset-4 z-40 pointer-events-none" />

      {everOpened && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragConstraints={constraintsRef}
          style={{
            visibility: open ? "visible" : "hidden",
            pointerEvents: open ? "auto" : "none",
          }}
          className="fixed top-20 right-4 sm:right-6 z-50 w-[360px] max-w-[92vw] h-[460px] max-h-[70vh] min-w-[280px] min-h-[320px] resize overflow-hidden bg-white dark:bg-sat-gray-800 rounded-2xl shadow-2xl border border-sat-gray-200 dark:border-sat-gray-700 flex flex-col"
        >
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex items-center justify-between px-3 py-2 border-b border-sat-gray-200 dark:border-sat-gray-700 bg-gradient-to-r from-sat-primary/10 to-sat-crimson/10 dark:from-sky-500/10 dark:to-sky-600/10 cursor-move select-none shrink-0"
          >
            <h3 className="font-display font-bold text-sm dark:text-white">Desmos Calculator</h3>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-sat-gray-200 dark:hover:bg-sat-gray-700 transition-colors dark:text-white"
              title="Close (your work is kept until the next question)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              key={resetKey}
              src="https://www.desmos.com/calculator"
              className="w-full h-full border-0"
              title="Desmos Calculator"
            />
          </div>
        </motion.div>
      )}
    </>
  );
}

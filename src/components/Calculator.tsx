"use client";

import { useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CalculatorProps {
  /** Overrides the floating button's fixed position, e.g. to clear other bottom-anchored UI. */
  positionClassName?: string;
}

export function Calculator({ positionClassName = "bottom-6 right-6" }: CalculatorProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className={`fixed ${positionClassName} z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-sat-primary to-sat-crimson dark:from-sky-500 dark:to-sky-600 text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Open Calculator"
      >
        <CalcIcon className="w-7 h-7" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 md:p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            >
              <motion.div
                className="w-full h-full md:h-[80vh] md:max-w-4xl max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-4rem)] z-50 bg-white dark:bg-sat-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-sat-gray-200 dark:border-sat-gray-700 bg-gradient-to-r from-sat-primary/10 to-sat-crimson/10 dark:from-sky-500/10 dark:to-sky-600/10 shrink-0">
                  <h3 className="font-display font-bold text-lg dark:text-white">Desmos Graphing Calculator</h3>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-xl hover:bg-sat-gray-200 dark:hover:bg-sat-gray-700 transition-colors dark:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <iframe
                    src="https://www.desmos.com/calculator"
                    className="w-full flex-1 min-h-0 border-0"
                    title="Desmos Calculator"
                  />
                </div>
                <p className="text-xs text-sat-gray-500 dark:text-sky-300 p-2 text-center bg-sat-gray-50 dark:bg-sat-gray-700/50 shrink-0">
                  Use this calculator during practice. The SAT allows a calculator on the Math section.
                </p>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { BookMarked, GripHorizontal, Minus, X } from "lucide-react";
import { motion } from "framer-motion";

interface ReferenceSheetProps {
  /** Overrides the floating button's fixed position, e.g. to clear other bottom-anchored UI. */
  positionClassName?: string;
}

interface Box {
  left: number;
  top: number;
}

const WIDTH = 300;
const HEIGHT = 480;
const MARGIN = 16;
const HEADER_HEIGHT = 24;

/**
 * A fraction rendered as a stacked numerator/denominator, the way the SAT's own
 * reference sheet draws them. Plain HTML/CSS rather than MathML: this content
 * is app-authored, not Collegeboard's, so there is no reason to inherit the
 * <mfenced> class of Chrome MathML-Core bugs the question renderer had to work
 * around (see prepareHtml in api/full-test/route.ts).
 */
function Frac({ n, d }: { n: string; d: string }) {
  return (
    <span className="inline-flex flex-col items-center mx-0.5 align-middle leading-none">
      <span className="px-0.5 border-b border-current">{n}</span>
      <span className="px-0.5">{d}</span>
    </span>
  );
}

/** One formula row: a label on the left, the formula on the right. */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1 text-sm font-medium text-sat-gray-800 dark:text-sat-gray-200 py-1">
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sat-gray-500 dark:text-sat-gray-400 mb-1.5">
        {title}
      </p>
      {children}
    </div>
  );
}

/** The formulas panel content, reused by both the floating panel and any future static embed. */
export function ReferenceSheetContent() {
  return (
    <div className="text-center">
      <Section title="Circle">
        <Row>
          A = <Frac n="π" d="1" />
          r<sup>2</sup>
        </Row>
        <Row>C = 2πr</Row>
      </Section>

      <Section title="Rectangle">
        <Row>A = lw</Row>
      </Section>

      <Section title="Triangle">
        <Row>
          A = <Frac n="1" d="2" />
          bh
        </Row>
        <Row>
          a<sup>2</sup> + b<sup>2</sup> = c<sup>2</sup>
        </Row>
      </Section>

      <Section title="Special Right Triangles">
        <Row>30-60-90: x, x√3, 2x</Row>
        <Row>45-45-90: x, x, x√2</Row>
      </Section>

      <Section title="Volume">
        <Row>Rectangular solid: V = lwh</Row>
        <Row>Cylinder: V = πr²h</Row>
        <Row>
          Sphere: V = <Frac n="4" d="3" />
          πr<sup>3</sup>
        </Row>
        <Row>
          Cone: V = <Frac n="1" d="3" />
          πr<sup>2</sup>h
        </Row>
        <Row>
          Pyramid: V = <Frac n="1" d="3" />
          lwh
        </Row>
      </Section>

      <Section title="Facts">
        <p className="text-xs text-sat-gray-600 dark:text-sat-gray-400 leading-relaxed">
          The number of degrees of arc in a circle is 360.
          <br />
          The number of radians of arc in a circle is 2π.
          <br />
          The sum of the measures in degrees of the angles of a triangle is 180.
        </p>
      </Section>
    </div>
  );
}

/**
 * The Reference Sheet, Bluebook's built-in formula sheet that "appears on all
 * tests with math questions." Modeled as a lighter version of the Calculator's
 * floating panel (drag only, fixed size — the content is short enough not to
 * need resizing).
 */
export function ReferenceSheet({ positionClassName = "bottom-6 left-6" }: ReferenceSheetProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const handleOpen = () => {
    setOpen(true);
    setBox((prev) => {
      if (prev) return prev;
      const left = Math.max(MARGIN, 24);
      const top = Math.min(80, Math.max(MARGIN, window.innerHeight - HEIGHT - MARGIN));
      return { left, top };
    });
  };

  const handleDragPointerDown = (e: React.PointerEvent) => {
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: box.left,
      startTop: box.top,
    };
  };

  const handleDragPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setBox(() => {
      const maxLeft = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN);
      const maxTop = Math.max(MARGIN, window.innerHeight - HEIGHT - MARGIN);
      const left = Math.min(maxLeft, Math.max(MARGIN, drag.startLeft + (e.clientX - drag.startX)));
      const top = Math.min(maxTop, Math.max(MARGIN, drag.startTop + (e.clientY - drag.startY)));
      return { left, top };
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <>
      <motion.button
        onClick={handleOpen}
        className={`fixed ${positionClassName} z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-sky-700 dark:from-sat-azure dark:to-blue-700 text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Open Reference Sheet"
      >
        <BookMarked className="w-6 h-6" />
      </motion.button>

      {box && (
        <motion.div
          animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.96 }}
          transition={{ type: "spring", damping: 25 }}
          style={{
            left: box.left,
            top: box.top,
            width: WIDTH,
            height: minimized ? HEADER_HEIGHT : HEIGHT,
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
                  title={minimized ? "Restore reference sheet" : "Minimize"}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-sat-gray-200 dark:hover:bg-sat-gray-600 transition-colors text-sat-gray-500 dark:text-sat-gray-300"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              <ReferenceSheetContent />
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}

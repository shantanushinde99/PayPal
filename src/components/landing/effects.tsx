"use client";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useScroll, useSpring } from "motion/react";

// Thin reading-progress bar pinned to the top of the page.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />;
}

// Dark hero: drifting aurora, faint grid, and a soft light that follows the cursor.
// Wraps the hero so it receives pointer moves from everything inside it.
export function HeroShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  const light = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    light.current?.style.setProperty("--hx", `${e.clientX - r.left}px`);
    light.current?.style.setProperty("--hy", `${e.clientY - r.top}px`);
  };
  return (
    <section onPointerMove={move} className={`relative isolate overflow-hidden bg-night text-white ${className}`}>
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora absolute -left-40 -top-40 size-[38rem] rounded-full bg-sky-500/25 blur-3xl" />
        <div className="aurora absolute -right-32 top-20 size-[32rem] rounded-full bg-violet-500/20 blur-3xl [animation-delay:-6s]" />
        <div className="aurora absolute bottom-[-16rem] left-1/3 size-[30rem] rounded-full bg-emerald-400/15 blur-3xl [animation-delay:-11s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div ref={light} className="absolute inset-0 bg-[radial-gradient(500px_circle_at_var(--hx,60%)_var(--hy,30%),rgba(56,189,248,0.12),transparent_60%)]" />
      </div>
      {children}
    </section>
  );
}

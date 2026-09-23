"use client";
import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { composeTiles, type GameState } from "@/lib/game";
import type { IndicesData } from "@/lib/indicesClient";

type Gesture = {
  sourceId: number;
  pointerId: number;
  x: number;
  y: number;
  active: boolean;
  node: HTMLElement;
  ghost: HTMLElement | null;
  target: HTMLElement | null;
};
export function useDragCombine(
  state: GameState,
  data: IndicesData,
  onDrop: (sourceId: number, targetId: number) => void,
  beforeDrag: () => void,
) {
  const gesture = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);
  const latest = useRef({ state, onDrop, beforeDrag });
  useEffect(() => {
    latest.current = { state, onDrop, beforeDrag };
  }, [state, onDrop, beforeDrag]);
  const cancel = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    if (g.active) suppressUntil.current = performance.now() + 400;
    gesture.current = null;
    g.ghost?.remove();
    g.node.classList.remove("drag-source");
    g.target?.classList.remove("drop-valid", "drop-invalid");
    if (g.node.hasPointerCapture(g.pointerId))
      g.node.releasePointerCapture(g.pointerId);
  }, []);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== event.pointerId) return;
      if (!g.active && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 8)
        return;
      if (!g.active) {
        latest.current.beforeDrag();
        g.active = true;
        g.node.setPointerCapture(g.pointerId);
        const rect = g.node.getBoundingClientRect();
        g.ghost = g.node.cloneNode(true) as HTMLElement;
        for (const el of [
          g.ghost,
          ...g.ghost.querySelectorAll<HTMLElement>("*"),
        ]) {
          for (const attr of [
            "id",
            "data-tile-id",
            "data-select-id",
            "data-drag-id",
          ])
            el.removeAttribute(attr);
        }
        g.ghost.classList.add("drag-ghost");
        g.ghost.setAttribute("aria-hidden", "true");
        g.ghost.inert = true;
        Object.assign(g.ghost.style, {
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        document.body.appendChild(g.ghost);
        g.node.classList.add("drag-source");
      }
      event.preventDefault();
      if (g.ghost)
        Object.assign(g.ghost.style, {
          left: `${event.clientX - 35}px`,
          top: `${event.clientY - 40}px`,
        });
      const target =
        document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-drag-id]") ?? null;
      g.target?.classList.remove("drop-valid", "drop-invalid");
      g.target =
        target && Number(target.dataset.dragId) !== g.sourceId ? target : null;
      if (g.target) {
        const s = latest.current.state;
        const ids = [
          ...new Set([
            ...(s.selected.includes(g.sourceId) ? s.selected : [g.sourceId]),
            Number(g.target.dataset.dragId),
          ]),
        ];
        const chars = ids.map(
          (id) => s.tray.find((t) => t.id === id)?.char ?? "",
        );
        g.target.classList.add(
          composeTiles(data, chars).length ? "drop-valid" : "drop-invalid",
        );
      }
    };
    const up = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      const target = g.active ? g.target : null;
      const id = g.sourceId;
      cancel();
      if (target) latest.current.onDrop(id, Number(target.dataset.dragId));
    };
    const abort = (e: PointerEvent) => {
      if (e.pointerId === gesture.current?.pointerId) cancel();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    const hide = () => {
      if (document.hidden) cancel();
    };
    const freshPress = () => {
      suppressUntil.current = 0;
    };
    window.addEventListener("pointerdown", freshPress);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", abort);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hide);
    return () => {
      cancel();
      window.removeEventListener("pointerdown", freshPress);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", abort);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [cancel, data]);
  useEffect(() => {
    if (state.phase !== "playing") cancel();
  }, [state.phase, cancel]);
  return {
    cancel,
    pointerDown: (event: ReactPointerEvent<HTMLElement>, sourceId: number) => {
      if (state.phase !== "playing" || !event.isPrimary || event.button !== 0)
        return;
      const target = event.target as HTMLElement;
      if (target.closest(".tile-selector")) return;
      if (event.pointerType === "touch" && !target.closest(".drag-grip"))
        return;
      cancel();
      suppressUntil.current = 0;
      gesture.current = {
        sourceId,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        active: false,
        node: event.currentTarget,
        ghost: null,
        target: null,
      };
    },
    suppressClick: () => performance.now() < suppressUntil.current,
  };
}

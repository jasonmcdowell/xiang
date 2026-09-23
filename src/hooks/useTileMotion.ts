"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Tile } from "@/lib/game";

type Snapshot = { rect: DOMRect; copy: HTMLElement; element: HTMLElement };
const DURATION = 460;

/** Decorative FLIP motion: rules commit synchronously, visuals follow afterward. */
export function useTileMotion(board: Tile[], tray: Tile[]) {
  const previous = useRef<Map<string, Snapshot> | null>(null);
  const running = useRef(new Set<Animation>());
  const ghosts = useRef(new Set<HTMLElement>());
  const cancel = useCallback(() => {
    for (const animation of running.current) animation.cancel();
    running.current.clear();
    for (const ghost of ghosts.current) ghost.remove();
    ghosts.current.clear();
    previous.current = null;
  }, []);
  const measure = useCallback(
    () =>
      new Map(
        Array.from(
          document.querySelectorAll<HTMLElement>("[data-tile-id]"),
        ).map((element) => [
          element.dataset.tileId!,
          {
            rect: element.getBoundingClientRect(),
            copy: element.cloneNode(true) as HTMLElement,
            element,
          },
        ]),
      ),
    [],
  );
  const capture = useCallback(() => {
    cancel();
    previous.current = measure();
  }, [cancel, measure]);

  useLayoutEffect(() => {
    const before = previous.current;
    const after = measure();
    previous.current = after;
    if (!before || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const removed = [...before]
      .filter(([id]) => !after.has(id))
      .map(([, s]) => s);
    const added = [...after]
      .filter(([id]) => !before.has(id))
      .map(([, s]) => s);
    const play = (
      element: HTMLElement,
      frames: Keyframe[],
      duration = DURATION,
      done?: () => void,
    ) => {
      const animation = element.animate(frames, {
        duration,
        easing: "cubic-bezier(.22,.75,.25,1)",
      });
      running.current.add(animation);
      animation.onfinish = () => {
        running.current.delete(animation);
        done?.();
      };
    };
    const fly = (
      snapshot: Snapshot,
      from: DOMRect,
      to: DOMRect,
      merging: boolean,
    ) => {
      const ghost = snapshot.copy.cloneNode(true) as HTMLElement;
      ghost.classList.add("tile-motion-ghost");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      for (const el of [ghost, ...ghost.querySelectorAll<HTMLElement>("*")]) {
        el.removeAttribute("data-tile-id");
        el.removeAttribute("data-select-id");
        el.removeAttribute("id");
      }
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        margin: "0",
      });
      document.body.appendChild(ghost);
      ghosts.current.add(ghost);
      const dx = from.left + from.width / 2 - to.left - to.width / 2;
      const dy = from.top + from.height / 2 - to.top - to.height / 2;
      play(
        ghost,
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${merging ? 1 : 0.65})`,
            opacity: 1,
          },
          {
            transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 24}px) scale(.95)`,
            opacity: 1,
            offset: 0.5,
          },
          { transform: "translate(0, 0) scale(1)", opacity: merging ? 0 : 1 },
        ],
        DURATION,
        () => {
          ghost.remove();
          ghosts.current.delete(ghost);
        },
      );
    };
    // A split has one source and several children; a composition has several sources and one result.
    if (removed.length === 1 && added.length >= 2) {
      for (const target of added) {
        fly(target, removed[0].rect, target.rect, false);
        play(target.element, [
          { opacity: 0 },
          { opacity: 0, offset: 0.9 },
          { opacity: 1 },
        ]);
      }
    } else if (removed.length >= 2 && added.length === 1) {
      for (const source of removed)
        fly(source, source.rect, added[0].rect, true);
      play(added[0].element, [
        { opacity: 0, transform: "scale(.85)" },
        { opacity: 0, transform: "scale(.85)", offset: 0.6 },
        { opacity: 1, transform: "scale(1)" },
      ]);
    }
    for (const [id, current] of after) {
      const old = before.get(id);
      if (!old) continue;
      const dx = old.rect.left - current.rect.left,
        dy = old.rect.top - current.rect.top;
      if (Math.abs(dx) + Math.abs(dy) > 1)
        play(
          current.element,
          [
            { transform: `translate(${dx}px,${dy}px)` },
            { transform: "translate(0,0)" },
          ],
          320,
        );
    }
  }, [board, tray, measure]);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("scroll", cancel, true);
    window.addEventListener("resize", cancel);
    reduced.addEventListener("change", cancel);
    return () => {
      cancel();
      window.removeEventListener("scroll", cancel, true);
      window.removeEventListener("resize", cancel);
      reduced.removeEventListener("change", cancel);
    };
  }, [cancel]);
  return { capture, cancel };
}

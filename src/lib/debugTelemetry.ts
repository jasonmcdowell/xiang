export type DebugEvent = {
  ts: number;
  type: "dragStart" | "dragMove" | "dragOver" | "dragEnd" | "dragCancel";
  activeId: number | null;
  overId: number | null;
  dx: number | null;
  dy: number | null;
  direction: string;
  composeCandidateId: number | null;
  composeBestRatio: number;
  composeThreshold: number;
  passEdgeTargetId: number | null;
  passEdgeMargin: number;
  passEdgeDistance: number | null;
  passEdgePassed: boolean;
  insertIndex: number | null;
  pendingReorder: string | null;
  decision: string;
};

export type RingBuffer<T> = {
  push: (item: T) => void;
  list: () => T[];
  listLast: (count: number) => T[];
};

export function createRingBuffer<T>(limit: number): RingBuffer<T> {
  const buffer: T[] = [];

  return {
    push(item) {
      if (buffer.length >= limit) {
        buffer.shift();
      }
      buffer.push(item);
    },
    list() {
      return buffer.slice();
    },
    listLast(count) {
      if (count <= 0) {
        return [];
      }
      return buffer.slice(-count);
    },
  };
}

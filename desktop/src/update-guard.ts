/**
 * Whether the app may restart for an update right now.
 *
 * Restarting with unsaved editor content loses work, and Nested's saves are
 * explicit, so an update waits for a clean state. Kept Electron-free so the
 * rule is testable.
 */

export type DirtyGuard = {
  setDirty(value: boolean): void;
  isDirty(): boolean;
  canRestart(): boolean;
};

export function createDirtyGuard(): DirtyGuard {
  let dirty = false;
  return {
    setDirty(value: boolean) {
      dirty = value === true;
    },
    isDirty: () => dirty,
    canRestart: () => !dirty,
  };
}

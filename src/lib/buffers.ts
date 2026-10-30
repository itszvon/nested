/**
 * In-memory buffers, per tab.
 *
 * A buffer exists so switching files does not lose edits, and so Save Project
 * can gather every dirty file in a project without reading them from the
 * database first. Nothing here is persisted; a reload is covered by drafts.
 */

export type Buffer = {
  text: string;
  baseRevision: number;
  projectId: string | null;
};

const buffers = new Map<string, Buffer>();

export function getBuffer(fileId: string) {
  return buffers.get(fileId);
}

export function setBuffer(fileId: string, buffer: Buffer) {
  buffers.set(fileId, buffer);
}

export function deleteBuffer(fileId: string) {
  buffers.delete(fileId);
}

export function listBuffers() {
  return [...buffers.entries()];
}

export function buffersInProject(projectId: string | null) {
  return listBuffers().filter(([, buffer]) => buffer.projectId === projectId);
}

export function clearBuffers() {
  buffers.clear();
}

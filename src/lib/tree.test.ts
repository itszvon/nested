import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkspace, flattenWorkspace, type FileRow, type FolderRow } from "./tree.ts";

function folder(id: string, name: string, parentId: string | null, sort = 0): FolderRow {
  return { id, name, parent_id: parentId, sort_order: sort };
}

function file(
  id: string,
  name: string,
  folderId: string | null,
  sort = 0,
): FileRow {
  return {
    id,
    name,
    folder_id: folderId,
    project_id: folderId,
    kind: "markdown",
    language: null,
    revision: 1,
    byte_size: 10,
    sort_order: sort,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const folders: FolderRow[] = [
  folder("p", "project", null),
  folder("f", "folder", "p"),
  folder("z", "zeta", null, 1),
];

const files: FileRow[] = [
  file("loose", "loose.md", null),
  file("a", "a.md", "p"),
  file("b", "b.md", "f"),
];

test("buildWorkspace nests folders and files", () => {
  const workspace = buildWorkspace(folders, files);

  assert.equal(workspace.projects.length, 2);
  assert.equal(workspace.projects[0].name, "project");
  assert.equal(workspace.projects[1].name, "zeta");

  const project = workspace.index.get("p");
  assert.ok(project);
  assert.deepEqual(
    project.children.map((child) => child.name),
    ["folder", "a.md"],
  );

  const nested = workspace.index.get("f");
  assert.ok(nested);
  assert.deepEqual(
    nested.children.map((child) => child.name),
    ["b.md"],
  );
});

test("loose files stay above projects", () => {
  const workspace = buildWorkspace(folders, files);
  assert.deepEqual(
    workspace.looseFiles.map((node) => node.name),
    ["loose.md"],
  );
});

test("flatten hides collapsed children and shows expanded ones", () => {
  const workspace = buildWorkspace(folders, files);

  const collapsed = flattenWorkspace(workspace, new Set(), true);
  assert.deepEqual(
    collapsed.map((row) => row.node.name),
    ["loose.md", "project", "zeta"],
  );

  const expanded = flattenWorkspace(workspace, new Set(["p"]), true);
  assert.deepEqual(
    expanded.map((row) => `${row.depth}:${row.node.name}`),
    ["0:loose.md", "0:project", "1:folder", "1:a.md", "0:zeta"],
  );
});

test("flatten can hide root files", () => {
  const workspace = buildWorkspace(folders, files);
  const rows = flattenWorkspace(workspace, new Set(), false);
  assert.ok(!rows.some((row) => row.node.name === "loose.md"));
});

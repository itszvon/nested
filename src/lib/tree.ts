/**
 * Tree shape and assembly.
 *
 * The database returns flat rows; the client assembles them once. Keeping this
 * pure makes it testable and keeps the component free of data logic.
 */

export type FileKind = "markdown" | "code";

export type FolderRow = {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
};

export type FileRow = {
  id: string;
  folder_id: string | null;
  name: string;
  kind: FileKind;
  language: string | null;
  revision: number;
  byte_size: number;
  updated_at: string;
};

export type TreeNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  parentId: string | null;
  kind?: FileKind;
  language?: string | null;
  revision?: number;
  byteSize?: number;
  updatedAt?: string;
  children: TreeNode[];
};

export type Workspace = {
  /** Top-level folders, each of which is a project. */
  projects: TreeNode[];
  /** Files that live above every project. */
  looseFiles: TreeNode[];
  /** id -> node, for lookups without walking the tree. */
  index: Map<string, TreeNode>;
};

function bySortOrder(a: { sort_order: number; name: string }, b: { sort_order: number; name: string }) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export function buildWorkspace(folders: FolderRow[], files: FileRow[]): Workspace {
  const index = new Map<string, TreeNode>();
  const foldersByParent = new Map<string | null, FolderRow[]>();
  const filesByFolder = new Map<string | null, FileRow[]>();

  for (const folder of folders) {
    const key = folder.parent_id;
    const list = foldersByParent.get(key) ?? [];
    list.push(folder);
    foldersByParent.set(key, list);
  }

  for (const file of files) {
    const key = file.folder_id;
    const list = filesByFolder.get(key) ?? [];
    list.push(file);
    filesByFolder.set(key, list);
  }

  function buildFolder(row: FolderRow): TreeNode {
    const node: TreeNode = {
      id: row.id,
      name: row.name,
      type: "folder",
      parentId: row.parent_id,
      children: [],
      // Folders come before files inside a folder, then both alphabetical
      // within their own group. Matches how people read a directory.
    };
    index.set(row.id, node);

    const childFolders = (foldersByParent.get(row.id) ?? []).sort(bySortOrder);
    const childFiles = (filesByFolder.get(row.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
    );

    for (const child of childFolders) node.children.push(buildFolder(child));
    for (const child of childFiles) node.children.push(buildFile(child));

    return node;
  }

  function buildFile(row: FileRow): TreeNode {
    const node: TreeNode = {
      id: row.id,
      name: row.name,
      type: "file",
      parentId: row.folder_id,
      kind: row.kind,
      language: row.language,
      revision: row.revision,
      byteSize: row.byte_size,
      updatedAt: row.updated_at,
      children: [],
    };
    index.set(row.id, node);
    return node;
  }

  const projects = (foldersByParent.get(null) ?? []).sort(bySortOrder).map(buildFolder);
  const looseFiles = (filesByFolder.get(null) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
    .map(buildFile);

  return { projects, looseFiles, index };
}

export type TreeRow = {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
};

/**
 * Turns the tree into the flat list of visible rows the keyboard handler and
 * the renderer both walk.
 */
export function flattenWorkspace(
  workspace: Workspace,
  expanded: Set<string>,
  showRootFiles: boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];

  function push(node: TreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    rows.push({ node, depth, expanded: isExpanded, hasChildren });
    if (node.type === "folder" && isExpanded) {
      for (const child of node.children) push(child, depth + 1);
    }
  }

  if (showRootFiles) {
    for (const file of workspace.looseFiles) push(file, 0);
  }
  for (const project of workspace.projects) push(project, 0);

  return rows;
}

/**
 * Seeds a small demo tree into the first profile, so the sidebar and the
 * layout can be looked at before the create UI exists in phase 4.
 *
 * Idempotent: refuses to run if the account already has folders.
 * Delete these by hand, or run with --clean to remove them.
 *
 *   PGPASSWORD=<db password> node scripts/seed-demo.mjs [--clean]
 */

import pg from "pg";

const client = new pg.Client({
  host: "db.purcbbalpuovesdndlik.supabase.co",
  port: 5432,
  user: "postgres",
  password: process.env.PGPASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

const PROJECTS = [
  {
    name: "work",
    children: [
      {
        name: "api",
        children: [],
        files: [
          { name: "routes.py", kind: "code", language: "python", content: "from fastapi import APIRouter\n\nrouter = APIRouter()\n\n@router.get('/health')\ndef health():\n    return {'ok': True}\n" },
          { name: "client.js", kind: "code", language: "javascript", content: "export async function getHealth() {\n  const response = await fetch('/health');\n  return response.json();\n}\n" },
        ],
      },
      {
        name: "notes",
        children: [],
        files: [
          { name: "todo.md", kind: "markdown", language: null, content: "Ship the tree\n\n- [x] schema\n- [ ] editor\n- [ ] versions\n" },
        ],
      },
    ],
    files: [],
  },
  {
    name: "reading",
    children: [],
    files: [{ name: "2026.md", kind: "markdown", language: null, content: "A list of things worth rereading.\n" }],
  },
  {
    name: "scratch",
    children: [],
    files: [
      { name: "algo.cpp", kind: "code", language: "cpp", content: "#include <vector>\n\nint sum(const std::vector<int>& xs) {\n  int total = 0;\n  for (int x : xs) total += x;\n  return total;\n}\n" },
      { name: "style.css", kind: "code", language: "css", content: ":root {\n  --gap: 8px;\n}\n" },
    ],
  },
];

const LOOSE_FILES = [
  { name: "inbox.md", kind: "markdown", language: null, content: "Things that have no project yet.\n" },
];

async function insertFiles(owner, folderId, files) {
  for (const file of files) {
    await client.query(
      `insert into public.files (owner_id, folder_id, name, kind, language, content)
       values ($1, $2, $3, $4, $5, $6)`,
      [owner, folderId, file.name, file.kind, file.language, file.content],
    );
  }
}

async function main() {
  await client.connect();
  const clean = process.argv.includes("--clean");

  const owner = (
    await client.query("select id from public.profiles order by created_at limit 1")
  ).rows[0]?.id;

  if (!owner) {
    console.log("No profile found. Sign in to the app once, then re-run.");
    await client.end();
    return;
  }

  if (clean) {
    await client.query("delete from public.folders where owner_id = $1", [owner]);
    await client.query("delete from public.files where owner_id = $1 and folder_id is null", [owner]);
    console.log("Demo data removed.");
    await client.end();
    return;
  }

  const existing = await client.query(
    "select count(*)::int as n from public.folders where owner_id = $1",
    [owner],
  );
  if (existing.rows[0].n > 0) {
    console.log("Account already has folders; nothing seeded.");
    await client.end();
    return;
  }

  for (const project of PROJECTS) {
    const projectId = (
      await client.query(
        "insert into public.folders (owner_id, parent_id, name) values ($1, null, $2) returning id",
        [owner, project.name],
      )
    ).rows[0].id;

    await insertFiles(owner, projectId, project.files);

    for (const child of project.children) {
      const childId = (
        await client.query(
          "insert into public.folders (owner_id, parent_id, name) values ($1, $2, $3) returning id",
          [owner, projectId, child.name],
        )
      ).rows[0].id;
      await insertFiles(owner, childId, child.files);
    }
  }

  await insertFiles(owner, null, LOOSE_FILES);

  const counts = await client.query(
    "select (select count(*) from public.folders where owner_id = $1) as folders, (select count(*) from public.files where owner_id = $1) as files",
    [owner],
  );
  console.log(
    `Seeded ${counts.rows[0].folders} folders and ${counts.rows[0].files} files.`,
  );

  await client.end();
}

main().catch(async (error) => {
  console.error("seed failed:", error.message);
  await client.end().catch(() => {});
  process.exit(1);
});

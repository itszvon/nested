/**
 * Schema verification harness.
 *
 * Connects to the linked Supabase database as postgres, then runs each block as
 * a specific user so RLS and triggers behave exactly as they do for the app.
 * Fixtures are committed and removed at the end (deleting the auth users
 * cascades through everything).
 *
 *   PGPASSWORD=<db password> node scripts/db-check.mjs
 */

import pg from "pg";

const ref = "purcbbalpuovesdndlik";
const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: process.env.PGPASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

let pass = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}

/** Runs fn as userId in a committed transaction. */
async function asUser(userId, fn) {
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  try {
    await fn();
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

/** Asserts a statement fails without aborting the surrounding transaction. */
async function expectError(name, sql, params, matcher) {
  await client.query("savepoint expect_sp");
  try {
    await client.query(sql, params);
    ok(name, false, "no error raised");
  } catch (error) {
    ok(name, matcher.test(error.message), error.message.split("\n")[0]);
  }
  await client.query("rollback to savepoint expect_sp");
}

const one = async (sql, params) => (await client.query(sql, params)).rows[0];

async function main() {
  await client.connect();

  // A crashed run can leave these behind. The delete cascades.
  await client.query("delete from auth.users where email like 'check-%@example.com'");

  console.log("\nprofiles");
  const users = await client.query(
    `insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, aud, role)
     values (gen_random_uuid(), 'check-a@example.com', now(), now(), now(), 'authenticated', 'authenticated'),
            (gen_random_uuid(), 'check-b@example.com', now(), now(), now(), 'authenticated', 'authenticated')
     returning id, email`,
  );
  const A = users.rows[0].id;
  const B = users.rows[1].id;

  const prof = await client.query(
    "select username, storage_bytes, email from public.profiles where id = any($1::uuid[]) order by email",
    [[A, B]],
  );
  ok("auth trigger created both profiles", prof.rowCount === 2);
  ok(
    "usernames match the allowed pattern",
    prof.rows.every((r) => /^[a-z0-9_]{3,32}$/.test(r.username)),
    prof.rows.map((r) => r.username).join(", "),
  );
  ok("usernames are unique", new Set(prof.rows.map((r) => r.username)).size === 2);

  // ---------------------------------------------------------- fixtures
  let project, alpha, beta, gamma, file;

  await asUser(A, async () => {
    project = (
      await one("insert into public.folders (owner_id, name) values ($1,'Project') returning id", [A])
    ).id;
    alpha = (
      await one(
        "insert into public.folders (owner_id, parent_id, name) values ($1,$2,'Alpha') returning id",
        [A, project],
      )
    ).id;
    beta = (
      await one(
        "insert into public.folders (owner_id, parent_id, name) values ($1,$2,'Beta') returning id",
        [A, alpha],
      )
    ).id;
    gamma = (
      await one(
        "insert into public.folders (owner_id, parent_id, name) values ($1,$2,'Gamma') returning id",
        [A, beta],
      )
    ).id;
    file = (
      await one(
        `insert into public.files (owner_id, folder_id, name, kind, language, content)
         values ($1,$2,'main.py','code','python','print(1)')
         returning id, project_id, byte_size`,
        [A, gamma],
      )
    ).id;
  });

  const derived = await one("select project_id from public.files where id = $1", [file]);
  ok("project_id resolves through four levels of nesting", derived.project_id === project);

  console.log("\nRLS isolation");
  await asUser(A, async () => {
    const n = await one("select count(*)::int as n from public.folders");
    ok("owner sees their own tree", n.n === 4);
  });

  await asUser(B, async () => {
    const f = await one("select count(*)::int as n from public.folders");
    const g = await one("select count(*)::int as n from public.files");
    ok("other user sees zero folders", f.n === 0);
    ok("other user sees zero files", g.n === 0);
    await expectError(
      "cannot insert a folder owned by someone else",
      "insert into public.folders (owner_id, name) values ($1,'Sneaky')",
      [A],
      /row-level security/i,
    );
    await expectError(
      "cannot save another user's file",
      "select public.save_file($1,'x',1)",
      [file],
      /file_not_found/,
    );
  });

  console.log("\nfolder rules");
  await asUser(A, async () => {
    await expectError(
      "duplicate sibling name rejected",
      "insert into public.folders (owner_id, parent_id, name) values ($1,$2,'alpha')",
      [A, project],
      /duplicate key|unique/i,
    );
    await expectError(
      "folder cannot become its own ancestor",
      "update public.folders set parent_id = $1 where id = $2",
      [gamma, alpha],
      /folder_cycle/,
    );
    await expectError(
      "project root cannot be nested",
      "update public.folders set parent_id = $1 where id = $2",
      [beta, project],
      /project_root_cannot_be_nested/,
    );
  });

  console.log("\nfile rules");
  await asUser(A, async () => {
    await expectError(
      "code file without a language rejected",
      "insert into public.files (owner_id, folder_id, name, kind) values ($1,$2,'x.js','code')",
      [A, gamma],
      /language_required/,
    );
    await expectError(
      "markdown file with a language rejected",
      "insert into public.files (owner_id, folder_id, name, kind, language) values ($1,$2,'x.md','markdown','python')",
      [A, gamma],
      /language_not_allowed/,
    );
    await expectError(
      "file over 2 MB rejected",
      "select public.save_file($1,$2,1)",
      [file, "x".repeat(2097153)],
      /file_too_large/,
    );
  });

  console.log("\nsaving and versions");
  await asUser(A, async () => {
    const saved = await one("select * from public.save_file($1,$2,$3)", [file, "print(2)", 1]);
    ok("save_file bumps the revision", saved.revision === 2);
    ok("save_file writes a version", Boolean(saved.version_id));

    await expectError(
      "stale revision refused",
      "select public.save_file($1,$2,$3)",
      [file, "print(3)", 1],
      /revision_conflict/,
    );

    const third = await one("select * from public.save_file($1,$2,$3)", [file, "print(3)", 2]);
    ok("third save appends another version", Boolean(third.version_id));

    const again = await one("select * from public.save_file($1,$2,$3)", [file, "print(3)", 3]);
    ok("identical content does not duplicate a version", again.version_id === null);

    const v = await one(
      "select id from public.versions where file_id = $1 order by created_at limit 1",
      [file],
    );
    const restored = await one("select public.restore_version($1) as content", [v.id]);
    ok("restore returns the old content", restored.content === "print(2)", String(restored.content));

    const beforeAuto = await one(
      "select count(*)::int as n from public.versions where file_id = $1 and source = 'auto'",
      [file],
    );
    ok("restore adds no auto version when content matches the latest save", beforeAuto.n === 0);

    const stillSaved = await one("select content, revision from public.files where id = $1", [file]);
    ok(
      "restore does not write the file",
      stillSaved.content === "print(3)" && stillSaved.revision === 4,
      `${stillSaved.content} rev ${stillSaved.revision}`,
    );
  });

  console.log("\nrestore safety net");
  // Drift outside the save path is not reachable through the app, but the
  // auto version exists so a restore can always be undone. Simulate drift.
  await client.query("update public.files set content = 'drifted' where id = $1", [file]);
  await asUser(A, async () => {
    const v = await one(
      "select id from public.versions where file_id = $1 order by created_at limit 1",
      [file],
    );
    await client.query("select public.restore_version($1)", [v.id]);
    const auto = await one(
      "select content from public.versions where file_id = $1 and source = 'auto' order by created_at desc limit 1",
      [file],
    );
    ok("restore snapshots drifted content before overwriting", auto?.content === "drifted");
  });

  console.log("\ntrash and restore");
  let trashFile;
  await asUser(A, async () => {
    trashFile = (
      await one(
        `insert into public.files (owner_id, folder_id, name, kind, content)
         values ($1,$2,'note.md','markdown','hello') returning id`,
        [A, beta],
      )
    ).id;
    await client.query("select public.save_file($1,$2,1)", [trashFile, "hello world"]);

    await client.query("select public.trash_node('folder', $1)", [alpha]);
    const hidden = await one(
      "select count(*)::int as n from public.files where id = $1 and deleted_at is null",
      [trashFile],
    );
    ok("trashing a folder hides its files", hidden.n === 0);

    const still = await one("select count(*)::int as n from public.files where id = $1", [trashFile]);
    ok("trashed rows are retained, not deleted", still.n === 1);

    await client.query("select public.restore_node('folder', $1)", [alpha]);
    const back = await one(
      "select deleted_at, project_id from public.files where id = $1",
      [trashFile],
    );
    ok("restore clears the flag", back.deleted_at === null);
    ok("restore recomputes project_id", back.project_id === project);

    const versions = await one(
      "select count(*)::int as n from public.versions where file_id = $1",
      [trashFile],
    );
    ok("versions survive the round trip", versions.n >= 1);
  });

  console.log("\nstorage accounting");
  const actual = await one(
    `select coalesce(sum(byte_size),0)::bigint as total from (
       select byte_size from public.files where owner_id = $1
       union all
       select byte_size from public.versions where owner_id = $1
     ) t`,
    [A],
  );
  const recorded = await one("select storage_bytes from public.profiles where id = $1", [A]);
  ok(
    "profiles.storage_bytes matches the real sum",
    Number(actual.total) === Number(recorded.storage_bytes),
    `sum=${actual.total} recorded=${recorded.storage_bytes}`,
  );

  console.log("\nanonymous access");
  await client.query("begin");
  await client.query("set local role anon");
  let anonBlocked = false;
  try {
    await client.query("select count(*) from public.files");
  } catch (error) {
    anonBlocked = /permission denied|row-level security/i.test(error.message);
  }
  await client.query("rollback");
  ok("anon cannot read files", anonBlocked);

  await client.query("delete from auth.users where email like 'check-%@example.com'");
  await client.end();

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("failed: " + failures.join(" | "));
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error("\nharness error:", error.message.split("\n")[0]);
  await client.end().catch(() => {});
  process.exit(1);
});

/* Self-contained API smoke test against a running dev server. */
const BASE = process.env.API_URL || "http://localhost:4000/api";
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

const email = `drivea_${Date.now()}@example.com`;
let token = "";

async function call(method, path, body, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  return { status: res.status, data };
}

/* 1. Auth */
let r = await call("POST", "/auth/register", {
  name: "Test",
  email,
  password: "secret123",
});
ok("register 201", r.status === 201, `got ${r.status}`);
token = r.data?.token;
ok("register returns token", !!token);
const userId = r.data?.user?.id;
ok(
  "register returns user id + storage_limit",
  !!userId && r.data.user.storage_limit === 1073741824,
);

r = await call("POST", "/auth/login", { email, password: "secret123" });
ok("login 200 + token", r.status === 200 && !!r.data?.token);

r = await call("POST", "/auth/login", { email, password: "WRONG" });
ok("login wrong password 401", r.status === 401);

r = await call("GET", "/auth/me");
ok("me returns user", r.status === 200 && r.data?.user?.email === email);

/* 2. Folders */
r = await call("POST", "/folders", { name: "Docs" });
ok("create folder 201", r.status === 201);
const rootFolder = r.data?.folder;

r = await call("POST", "/folders", { name: "Sub", parent_id: rootFolder.id });
ok("create subfolder", r.status === 201);
const subFolder = r.data?.folder;
ok("subfolder parent_id set", subFolder?.parent_id === rootFolder.id);

r = await call("GET", `/folders/${subFolder.id}`);
ok(
  "subfolder breadcrumbs",
  r.status === 200 && r.data?.breadcrumbs?.[0]?.name === "Docs",
);

r = await call("GET", "/folders");
ok("list folders", r.status === 200 && r.data?.folders?.length === 2);

r = await call("GET", "/folders?parent_id=" + rootFolder.id);
ok(
  "list folders scoped to parent",
  r.status === 200 && r.data?.folders?.length === 1,
);

/* 3. Files */
const form = new FormData();
form.append(
  "files",
  new Blob(["hello drivea"], { type: "text/plain" }),
  "hello.txt",
);
form.append(
  "files",
  new Blob([JSON.stringify({ a: 1 })], { type: "application/json" }),
  "data.json",
);
form.append("folder_id", subFolder.id);
r = await call("POST", "/files/upload", form);
ok(
  "upload 2 files 201",
  r.status === 201 && r.data?.files?.length === 2,
  `got ${r.status}`,
);

r = await call("GET", `/files?folder_id=${subFolder.id}`);
ok("files listed in subfolder", r.data?.files?.length === 2);

r = await call("GET", "/files?search=data");
ok(
  "search finds data.json",
  r.data?.files?.length === 1 && r.data.files[0].name === "data.json",
);

const file = r.data.files[0];

r = await call("PATCH", `/files/${file.id}/rename`, { name: "renamed.json" });
ok("rename file", r.data?.file?.name === "renamed.json");

r = await call("PATCH", `/files/${file.id}/move`, { target_folder: "null" });
ok("move file to root", r.status === 200);

r = await call("GET", "/files");
ok(
  "root listing has renamed.json",
  r.data?.files?.some((f) => f.name === "renamed.json"),
);

r = await call("GET", `/files/${file.id}/preview`);
ok("preview returns url", r.status === 200 && !!r.data?.url);

r = await call("GET", `/files/${file.id}/download`);
ok("download returns content", r.status === 200);

/* storage accounting */
r = await call("GET", "/auth/me");
const usedAfterUpload = r.data?.user?.storage_used;
ok(
  "storage_used > 0 after upload",
  usedAfterUpload > 0,
  `got ${usedAfterUpload}`,
);

/* 4. Shares */
r = await call("POST", "/shares", {
  resource_id: file.id,
  resource_type: "file",
});
ok("create share 201", r.status === 201);
const share = r.data?.share;

const prevToken = token;
token = ""; // public access
r = await call("GET", `/shares/access/${share.token}`);
ok(
  "public access w/o auth",
  r.status === 200 && r.data?.file?.name === "renamed.json",
);
ok("public access returns owner name", r.data?.owner?.name === "Test");

r = await call("GET", "/shares/access/bogus-token");
ok("bogus token 404", r.status === 404);
token = prevToken;

r = await call("GET", "/shares");
ok(
  "my shares listed with resource",
  r.data?.share_links?.length === 1 && !!r.data.share_links[0].resource?.name,
);

/* 5. Trash */
r = await call("DELETE", `/files/${file.id}`);
ok("trash file", r.status === 200);

r = await call("GET", "/trash");
ok("trash contains file", r.data?.files?.length === 1);

r = await call("POST", `/files/${file.id}/restore`);
ok("restore file", r.data?.file?.is_trashed === false);

/* folder trash cascade: root folder contains subfolder + its 1 file (hello.txt) */
r = await call("DELETE", `/folders/${rootFolder.id}`);
ok("trash root folder", r.status === 200);

r = await call("GET", "/trash");
ok(
  "folder trash cascades (2 folders + 1 file)",
  r.data?.folders?.length === 2 && r.data?.files?.length === 1,
  `folders=${r.data?.folders?.length} files=${r.data?.files?.length}`,
);

r = await call("POST", `/folders/${rootFolder.id}/restore`);
ok("restore root folder", r.status === 200);

r = await call("GET", "/folders?parent_id=" + rootFolder.id);
ok("subfolder restored with parent", r.data?.folders?.length === 1);

/* 6. Empty trash + accounting */
r = await call("DELETE", `/files/${file.id}`); // trash renamed.json again
await call("POST", "/trash/empty");
r = await call("GET", "/trash");
ok(
  "trash emptied",
  r.data?.files?.length === 0 && r.data?.folders?.length === 0,
);

r = await call("GET", "/auth/me");
ok(
  "storage_used recalculated to only remaining file",
  r.data?.user?.storage_used === usedAfterUpload - file.size,
  `used=${r.data?.user?.storage_used} expected=${usedAfterUpload - file.size}`,
);

/* 7. folder permanent delete */
r = await call("DELETE", `/folders/${rootFolder.id}`); // trash again
await call("DELETE", `/folders/${rootFolder.id}/permanent`);
r = await call("GET", "/folders");
ok(
  "permanent folder delete removes descendants",
  r.data?.folders?.length === 0,
);

/* 8. logout-ish guard */
r = await call("GET", "/files", null, {
  headers: { Authorization: "Bearer nonsense" },
});
ok("bad token rejected", r.status === 401);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import seeds from "../../seed.json";
import type { Draft } from "../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, {status, headers:{"Cache-Control":"no-store"}});
let database: DatabaseSync | undefined;
function db() {
  if (database) return database;
  const path = resolve(/* turbopackIgnore: true */ process.env.REBUTTAL_DB ?? "data/drafts.sqlite");
  mkdirSync(dirname(path), {recursive:true});
  const connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS versions(document_id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(document_id, revision));`);
  for (const seed of seeds) connection.prepare("INSERT OR IGNORE INTO documents VALUES(?,?,?)").run(seed.id, JSON.stringify(seed), seed.revision);
  database = connection;
  return connection;
}
// Local single-user service. Check both reads and writes against DNS rebinding,
// and reject browser writes from other origins. No cloud account is required.
function allowed(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
  const origin = request.headers.get("origin");
  return !origin || origin === `${url.protocol}//${host}`;
}
export async function GET(request: Request) {
  if (!allowed(request)) return json({error:"请从本机工作台访问"},403);
  try {
    const id = new URL(request.url).searchParams.get("history");
    if (id) {
      const seed = seeds.find(d=>d.id===id);
      if (!seed) return json({error:"未找到回复"},404);
      const rows = db().prepare("SELECT data FROM versions WHERE document_id=? ORDER BY revision DESC").all(id) as {data:string}[];
      return json({versions:[...rows.map(r=>JSON.parse(r.data)),seed]});
    }
    const rows = db().prepare("SELECT data FROM documents").all() as {data:string}[];
    const saved = new Map(rows.map(r=>{const d=JSON.parse(r.data) as Draft;return [d.id,d];}));
    return json({documents:seeds.map(s=>saved.get(s.id)??s)});
  } catch {
    return json({error:"无法读取本地数据库，请检查服务日志和文件权限"},503);
  }
}
export async function PUT(request: Request) {
  if (!allowed(request)) return json({error:"请求来源不匹配"},403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({error:"需要 JSON 内容"},415);
  const raw = await request.text();
  if (raw.length>300000) return json({error:"内容过长"},413);
  let input;
  try {input=JSON.parse(raw);} catch {return json({error:"无效 JSON"},400);}
  const d=input?.document as Draft | undefined;
  if (!d || !seeds.some(s=>s.id===d.id) || typeof d.zh!=="string" || typeof d.en!=="string" ||
      typeof d.note!=="string" || typeof d.aligned!=="boolean" || !["empty","draft","ready"].includes(d.stage) ||
      !Number.isInteger(input.baseRevision) || input.baseRevision<0 || d.zh.length>100000 || d.en.length>100000 ||
      d.note.length>10000 || typeof input.label!=="string" || input.label.length>150 ||
      (d.titleZh!==undefined&&(typeof d.titleZh!=="string"||d.titleZh.length>1000)) ||
      (d.titleEn!==undefined&&(typeof d.titleEn!=="string"||d.titleEn.length>1000))) return json({error:"内容格式不正确"},400);
  if (d.stage==="ready"&&(!d.zh.trim()||!d.en.trim()||!d.aligned)) return json({error:"定稿需要完整中英文及双语核对"},400);
  const connection=db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const row=connection.prepare("SELECT data,revision FROM documents WHERE id=?").get(d.id) as {data:string;revision:number};
    if (row.revision!==input.baseRevision) {
      connection.exec("ROLLBACK");
      return json({error:"另一窗口已保存更新。请先导出当前内容，再重新载入，避免覆盖。"},409);
    }
    const current=JSON.parse(row.data) as Draft;
    const next:Draft={id:d.id,zh:d.zh,en:d.en,note:d.note,titleZh:d.titleZh??current.titleZh??"",
      titleEn:d.titleEn??current.titleEn??"",stage:d.stage,aligned:d.aligned,revision:row.revision+1,
      updatedAt:new Date().toISOString(),versionLabel:input.label.trim()||"修改回复"};
    const data=JSON.stringify(next);
    connection.prepare("UPDATE documents SET data=?,revision=? WHERE id=?").run(data,next.revision,d.id);
    connection.prepare("INSERT INTO versions VALUES(?,?,?)").run(d.id,next.revision,data);
    connection.exec("COMMIT");
    return json({document:next});
  } catch {
    connection.exec("ROLLBACK");
    return json({error:"保存失败，当前编辑仍在页面中"},503);
  }
}

// 动态工作计划（ProjectSeed）持久化查询层
import { getDb } from "./connection";
import { projectSeed, type ProjectSeedRow } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import type { ProjectSeed } from "@/types";
// 注意：后端运行时 dist/ 没有 src/seed.json，打包时必须把默认种子内联或用 fs 读构建产物内的文件
// 这里用 createRequire 直接读 src/seed.json（esbuild --bundle 会在 banner 注入 createRequire）
import { createRequire } from "module";
import { fileURLToPath } from "url";
const __require = createRequire(fileURLToPath(import.meta.url));
let _defaultSeed: ProjectSeed | null = null;

function loadDefaultSeed(): ProjectSeed {
  if (_defaultSeed) return _defaultSeed;
  try {
    _defaultSeed = __require("../../src/seed.json") as ProjectSeed;
  } catch {
    try {
      // 备选：dist 同级目录（可能已经被复制到 dist 下）
      _defaultSeed = __require("../seed.json") as ProjectSeed;
    } catch {
      throw new Error("找不到默认 seed.json，请确保构建时包含该文件或已经导入过一次工作计划表");
    }
  }
  return _defaultSeed as ProjectSeed;
}

/** 取当前生效的 ProjectSeed：DB 存了就用 DB，否则 fallback 到 src/seed.json */
export async function getActiveSeed(): Promise<ProjectSeed> {
  const db = getDb();
  const rows = await db.select().from(projectSeed).orderBy(desc(projectSeed.id)).limit(1);
  if (rows.length && rows[0].data) {
    try {
      const parsed = JSON.parse(rows[0].data) as ProjectSeed;
      if (parsed && Array.isArray(parsed.sections) && parsed.name) return parsed;
    } catch { /* ignore */ }
  }
  return loadDefaultSeed();
}

/** 保存/更新 ProjectSeed 到 DB（UPSERT 单例模式，永远只保留最新一条） */
export async function saveActiveSeed(seed: ProjectSeed, updatedBy?: number): Promise<ProjectSeedRow> {
  const db = getDb();
  const data = JSON.stringify(seed);
  const exists = await db.select({ id: projectSeed.id }).from(projectSeed).orderBy(desc(projectSeed.id)).limit(1);
  if (exists.length) {
    await db
      .update(projectSeed)
      .set({ data, updatedBy, updatedAt: new Date() })
      .where(eq(projectSeed.id, exists[0].id));
    const row = await db.select().from(projectSeed).where(eq(projectSeed.id, exists[0].id)).limit(1);
    return row[0];
  }
  const [{ id }] = await db.insert(projectSeed).values({ data, updatedBy }).$returningId();
  const row = await db.select().from(projectSeed).where(eq(projectSeed.id, id)).limit(1);
  return row[0];
}

/** 清空 DB 存的 ProjectSeed（fallback 到 src/seed.json 默认版本） */
export async function resetDefaultSeed() {
  const db = getDb();
  await db.delete(projectSeed);
}

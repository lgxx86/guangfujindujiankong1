// 初始化系统管理员账号（新增文件）
// 用法：npx tsx db/seed-users.ts
// 通过环境变量自定义初始账号：ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_NAME
import "dotenv/config";
import { getDb } from "../api/queries/connection";
import { users } from "./schema";
import { hashPassword } from "../api/local/auth";
import { setMemberRole } from "../api/queries/progress";
import { eq } from "drizzle-orm";

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "Dmk@2026admin";
  const name = process.env.ADMIN_NAME ?? "系统管理员";

  const db = getDb();
  const exists = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (exists) {
    console.log(`账号 ${username} 已存在，跳过创建（如需重置密码请使用系统内管理员功能）`);
    process.exit(0);
  }

  const [{ id }] = await db.insert(users).values({
    unionId: `local:${username}`,
    username,
    passwordHash: hashPassword(password),
    name,
    role: "admin",
  }).$returningId();

  // 管理员同时登记为项目业主
  await setMemberRole(id, "owner");

  console.log(`✓ 管理员账号创建成功`);
  console.log(`  用户名：${username}`);
  console.log(`  初始密码：${password}`);
  console.log(`  请登录后立即修改密码！`);
  process.exit(0);
}

main().catch((e) => {
  console.error("初始化失败：", e);
  process.exit(1);
});

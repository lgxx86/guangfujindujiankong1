import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  mediumtext,
  timestamp,
  int,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** 项目成员角色：业主 / 监理 / 施工方 */
export const projectMembers = mysqlTable("project_members", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .unique(),
  projectRole: mysqlEnum("projectRole", ["owner", "supervisor", "contractor"])
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;

/** 进度填报单：施工方提交 → 监理/业主审核；业主/监理提交直接生效 */
export const progressReports = mysqlTable("progress_reports", {
  id: serial("id").primaryKey(),
  taskId: varchar("taskId", { length: 16 }).notNull(),
  progress: int("progress").notNull(),
  actualStart: varchar("actualStart", { length: 10 }),
  actualEnd: varchar("actualEnd", { length: 10 }),
  note: text("note"),
  photo: mediumtext("photo"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  reporterId: bigint("reporterId", { mode: "number", unsigned: true }).notNull(),
  reviewerId: bigint("reviewerId", { mode: "number", unsigned: true }),
  reviewNote: varchar("reviewNote", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});

export type ProgressReport = typeof progressReports.$inferSelect;

/** 预警闭环记录 */
export const alertClosures = mysqlTable("alert_closures", {
  id: serial("id").primaryKey(),
  alertKey: varchar("alertKey", { length: 255 }).notNull().unique(),
  closedBy: bigint("closedBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertClosure = typeof alertClosures.$inferSelect;

/** 动态工作计划表（admin 导入新计划表时存这里；空则回退到 src/seed.json 内置版本） */
export const projectSeed = mysqlTable("project_seed", {
  id: serial("id").primaryKey(),
  data: text("data").notNull(), // 存 ProjectSeed JSON 字符串
  updatedBy: bigint("updatedBy", { mode: "number", unsigned: true }),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ProjectSeedRow = typeof projectSeed.$inferSelect;
//
// Example:
// export const posts = mysqlTable("posts", {
//   id: serial("id").primaryKey(),
//   title: varchar("title", { length: 255 }).notNull(),
//   content: text("content"),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
// });
//
// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()

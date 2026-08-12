// 进度填报 / 成员角色 / 预警闭环 数据访问层
import { getDb } from "./connection";
import {
  progressReports,
  projectMembers,
  alertClosures,
  users,
  type ProjectMember,
} from "@db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";

export type ProjectRole = ProjectMember["projectRole"];

/** 获取用户项目角色；应用创建者(admin)首次访问自动登记为业主 */
export async function getMyRole(userId: number, isAdmin: boolean): Promise<ProjectRole | null> {
  const db = getDb();
  const m = await db.query.projectMembers.findFirst({
    where: eq(projectMembers.userId, userId),
  });
  if (m) return m.projectRole;
  if (isAdmin) {
    await db
      .insert(projectMembers)
      .values({ userId, projectRole: "owner" })
      .onDuplicateKeyUpdate({ set: { projectRole: "owner" } });
    return "owner";
  }
  return null;
}

export async function setMemberRole(userId: number, role: ProjectRole) {
  await getDb()
    .insert(projectMembers)
    .values({ userId, projectRole: role })
    .onDuplicateKeyUpdate({ set: { projectRole: role } });
}

export async function listMembers() {
  const db = getDb();
  const all = await db.select().from(users).orderBy(asc(users.createdAt));
  const members = await db.select().from(projectMembers);
  const roleMap = new Map(members.map((m) => [m.userId, m.projectRole]));
  return all.map((u) => ({
    id: u.id,
    name: u.name ?? "未命名用户",
    email: u.email,
    avatar: u.avatar,
    isAdmin: u.role === "admin",
    projectRole: roleMap.get(u.id) ?? null,
    lastSignInAt: u.lastSignInAt,
  }));
}

/** 各任务当前生效状态 = 该任务最新一条已审核通过的填报（排除 photo 大字段，按需加载） */
export async function approvedStates() {
  const db = getDb();
  const rows = await db
    .select({
      id: progressReports.id,
      taskId: progressReports.taskId,
      progress: progressReports.progress,
      actualStart: progressReports.actualStart,
      actualEnd: progressReports.actualEnd,
      note: progressReports.note,
      createdAt: progressReports.createdAt,
    })
    .from(progressReports)
    .where(eq(progressReports.status, "approved"))
    .orderBy(desc(progressReports.id)); // DESC：自增 id 越大越新，首条即为最新
  const map: Record<string, (typeof rows)[number]> = {};
  for (const r of rows) {
    if (!map[r.taskId]) map[r.taskId] = r; // 只保留第一条（最新），避免旧记录覆盖
  }
  return map;
}

/** 按填报 ID 查询单条照片（仅在查看任务详情时调用） */
export async function getPhotoByReportId(reportId: number): Promise<string | null> {
  const db = getDb();
  const row = await db
    .select({ photo: progressReports.photo })
    .from(progressReports)
    .where(eq(progressReports.id, reportId))
    .limit(1);
  return row.at(0)?.photo ?? null;
}

/** 待审核填报（含填报人姓名） */
export async function pendingReports() {
  const db = getDb();
  const rows = await db
    .select()
    .from(progressReports)
    .where(eq(progressReports.status, "pending"))
    .orderBy(desc(progressReports.createdAt));
  const reporterIds = [...new Set(rows.map((r) => r.reporterId))];
  const us = reporterIds.length
    ? await db.select().from(users).where(inArray(users.id, reporterIds))
    : [];
  const nameMap = new Map(us.map((u) => [u.id, u.name ?? "未知"]));
  return rows.map((r) => ({ ...r, reporterName: nameMap.get(r.reporterId) ?? "未知" }));
}

export async function myReports(userId: number) {
  return getDb()
    .select()
    .from(progressReports)
    .where(eq(progressReports.reporterId, userId))
    .orderBy(desc(progressReports.createdAt));
}

export async function createReport(data: {
  taskId: string;
  progress: number;
  actualStart: string | null;
  actualEnd: string | null;
  note: string;
  photo: string | null;
  reporterId: number;
  autoApprove: boolean;
}) {
  const db = getDb();
  const [{ id }] = await db
    .insert(progressReports)
    .values({
      taskId: data.taskId,
      progress: data.progress,
      actualStart: data.actualStart,
      actualEnd: data.actualEnd,
      note: data.note,
      photo: data.photo,
      reporterId: data.reporterId,
      status: data.autoApprove ? "approved" : "pending",
      reviewerId: data.autoApprove ? data.reporterId : null,
      reviewedAt: data.autoApprove ? new Date() : null,
    })
    .$returningId();
  return id;
}

/** 检查指定 taskId 是否已有待审核填报 */
export async function hasPendingReport(taskId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ id: progressReports.id })
    .from(progressReports)
    .where(eq(progressReports.taskId, taskId))
    .limit(1);
  return row.length > 0;
}

export async function reviewReport(
  reportId: number,
  reviewerId: number,
  approve: boolean,
  reviewNote: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  // 校验填报是否存在且仍为待审核状态，防止重复审核
  const row = await db
    .select({ status: progressReports.status })
    .from(progressReports)
    .where(eq(progressReports.id, reportId))
    .limit(1);
  if (!row.length) return { ok: false, message: "填报记录不存在" };
  if (row[0].status !== "pending")
    return { ok: false, message: "该填报已审核，请勿重复操作" };

  await db
    .update(progressReports)
    .set({
      status: approve ? "approved" : "rejected",
      reviewerId,
      reviewNote,
      reviewedAt: new Date(),
    })
    .where(eq(progressReports.id, reportId));
  return { ok: true };
}

/** 填报日志（最近200条已审核记录 + 填报人姓名） */
export async function reportLogs() {
  const db = getDb();
  const rows = await db
    .select()
    .from(progressReports)
    .orderBy(desc(progressReports.createdAt))
    .limit(200);
  const reporterIds = [...new Set(rows.map((r) => r.reporterId))];
  const us = reporterIds.length
    ? await db.select().from(users).where(inArray(users.id, reporterIds))
    : [];
  const nameMap = new Map(us.map((u) => [u.id, u.name ?? "未知"]));
  return rows.map((r) => ({ ...r, reporterName: nameMap.get(r.reporterId) ?? "未知" }));
}

export async function listClosures() {
  const rows = await getDb().select().from(alertClosures);
  return rows.map((r) => r.alertKey);
}

export async function closeAlert(alertKey: string, userId: number) {
  await getDb()
    .insert(alertClosures)
    .values({ alertKey, closedBy: userId })
    .onDuplicateKeyUpdate({ set: { closedBy: userId } });
}

export async function reopenAlert(alertKey: string) {
  await getDb().delete(alertClosures).where(eq(alertClosures.alertKey, alertKey));
}

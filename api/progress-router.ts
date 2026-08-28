// 进度填报 / 审核 / 预警闭环 tRPC 路由
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  getMyRole,
  createReport,
  approvedStates,
  getPhotoByReportId,
  pendingReports,
  reviewReport,
  hasPendingReport,
  expirePendingBefore,
  reportLogs,
  myReports,
  listClosures,
  closeAlert,
  reopenAlert,
  type ProjectRole,
} from "./queries/progress";

async function requireRole(ctx: { user: { id: number; role: string } }, allow: ProjectRole[]) {
  const role = await getMyRole(ctx.user.id, ctx.user.role === "admin");
  if (!role || !allow.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "当前角色无权执行此操作" });
  }
  return role;
}

export const progressRouter = createRouter({
  /** 当前生效的各任务状态（已审核通过的最新填报，不含照片大字段） */
  states: authedQuery.query(async () => {
    const map = await approvedStates();
    const out: Record<
      string,
      {
        progress: number;
        actualStart: string | null;
        actualEnd: string | null;
        note: string | null;
        photo: string | null;
        updatedAt: Date;
        reportId: number;
      }
    > = {};
    for (const [taskId, r] of Object.entries(map)) {
      out[taskId] = {
        progress: r.progress,
        actualStart: r.actualStart,
        actualEnd: r.actualEnd,
        note: r.note,
        photo: null, // 照片改为按需加载，见 getPhoto 端点
        updatedAt: r.createdAt,
        reportId: r.id,
      };
    }
    return out;
  }),

  /** 按填报 ID 加载现场照片（任务详情弹窗打开时调用） */
  getPhoto: authedQuery
    .input(z.object({ reportId: z.number() }))
    .query(async ({ input }) => {
      return { photo: await getPhotoByReportId(input.reportId) };
    }),

  /** 待审核填报列表（监理/业主） */
  pending: authedQuery.query(async ({ ctx }) => {
    await requireRole(ctx, ["owner", "supervisor"]);
    return pendingReports();
  }),

  /** 待审核数量（所有登录用户可见角标） */
  pendingCount: authedQuery.query(async ({ ctx }) => {
    const role = await getMyRole(ctx.user.id, ctx.user.role === "admin");
    if (role !== "owner" && role !== "supervisor") return 0;
    return (await pendingReports()).length;
  }),

  /** 提交进度填报：施工方→待审核；业主/监理→直接生效 */
  submit: authedQuery
    .input(
      z.object({
        taskId: z.string().min(1),
        progress: z.number().int().min(0).max(100),
        actualStart: z.string().nullable(),
        actualEnd: z.string().nullable(),
        note: z.string().max(2000),
        photo: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await requireRole(ctx, ["owner", "supervisor", "contractor"]);
      const autoApprove = role === "owner" || role === "supervisor";
      // 施工方提交时：
      // 1) 允许同一填报人覆盖自己之前「未审核的 pending」（例如 50% 未审核就更新到 60% 的场景）
      //    → 用 hasPendingReport(..., excludeReporterId = 当前用户)只排除自己的旧 pending
      // 2) 但如果有别的施工单位同事的 pending 仍在审核 → 拒绝，避免同一任务多人同时填报混乱
      // 3) 之前已审核通过/驳回的记录（approved/rejected）一律放行 → 支持无限次二次填报
      if (!autoApprove) {
        const hasPending = await hasPendingReport(input.taskId, ctx.user.id);
        if (hasPending) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "该任务已有其他同事的待审核填报，请等待审核完成后再提交",
          });
        }
        // 同一填报人之前有未审核 pending → 标记为「被新填报覆盖(rejected)」，保证审核列表始终只有最新一条
        await expirePendingBefore(input.taskId, ctx.user.id);
      }
      const id = await createReport({
        ...input,
        reporterId: ctx.user.id,
        autoApprove,
      });
      return { id, status: autoApprove ? ("approved" as const) : ("pending" as const) };
    }),

  /** 审核填报（监理/业主） */
  review: authedQuery
    .input(
      z.object({
        reportId: z.number(),
        approve: z.boolean(),
        reviewNote: z.string().max(500).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["owner", "supervisor"]);
      const result = await reviewReport(input.reportId, ctx.user.id, input.approve, input.reviewNote);
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.message ?? "审核失败" });
      }
      return { ok: true };
    }),

  /** 填报日志（含审核记录） */
  logs: authedQuery.query(async () => reportLogs()),

  /** 我提交的填报（施工方查看审核进度） */
  mine: authedQuery.query(({ ctx }) => myReports(ctx.user.id)),

  /** 预警闭环列表 */
  closures: authedQuery.query(() => listClosures()),

  /** 闭环预警（监理/业主） */
  closeAlert: authedQuery
    .input(z.object({ alertKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["owner", "supervisor"]);
      await closeAlert(input.alertKey, ctx.user.id);
      return { ok: true };
    }),

  reopenAlert: authedQuery
    .input(z.object({ alertKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["owner", "supervisor"]);
      await reopenAlert(input.alertKey);
      return { ok: true };
    }),
});

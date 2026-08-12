// 项目成员与角色管理 tRPC 路由
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getMyRole, listMembers, setMemberRole } from "./queries/progress";

export const memberRouter = createRouter({
  /** 我的项目角色（未分配则为 null，只读） */
  myRole: authedQuery.query(async ({ ctx }) => {
    const role = await getMyRole(ctx.user.id, ctx.user.role === "admin");
    return { role };
  }),

  /** 成员列表（仅业主） */
  list: authedQuery.query(async ({ ctx }) => {
    const role = await getMyRole(ctx.user.id, ctx.user.role === "admin");
    if (role !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "仅业主可查看成员列表" });
    }
    return listMembers();
  }),

  /** 分配/调整成员角色（仅业主） */
  setRole: authedQuery
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["owner", "supervisor", "contractor"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await getMyRole(ctx.user.id, ctx.user.role === "admin");
      if (role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅业主可分配角色" });
      }
      await setMemberRole(input.userId, input.role);
      return { ok: true };
    }),
});

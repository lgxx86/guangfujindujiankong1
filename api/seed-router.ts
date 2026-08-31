// 工作计划表（seed）动态管理路由：获取当前 / admin 导入 xlsx / 重置默认
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getActiveSeed, saveActiveSeed, resetDefaultSeed } from "./queries/seed";
import { parseWorkPlanXlsx, summarizeSeed } from "./lib/seed-import";

/** base64 dataURL → ArrayBuffer。支持「data:application/vnd.openxml...;base64,xxx」或纯 base64 两种 */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = Buffer.from(clean, "base64").toString("binary");
  const len = bin.length;
  const buf = new ArrayBuffer(len);
  const view = new Uint8Array(buf);
  for (let i = 0; i < len; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

export const seedRouter = createRouter({
  /** 所有登录用户：取当前生效的工作计划（DB 动态 or 默认 seed.json） */
  get: authedQuery.query(async () => {
    const seed = await getActiveSeed();
    return { seed, summary: summarizeSeed(seed) };
  }),

  /** admin：解析 xlsx base64 → 预览摘要（不保存，用于前端弹窗预览确认） */
  preview: authedQuery
    .input(z.object({ base64: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可导入" });
      const buf = base64ToArrayBuffer(input.base64);
      const seed = parseWorkPlanXlsx(buf);
      return { seed, summary: summarizeSeed(seed) };
    }),

  /** admin：导入并保存 xlsx → 返回新 seed 摘要，前端刷新后立即生效 */
  import: authedQuery
    .input(z.object({ base64: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可导入" });
      const buf = base64ToArrayBuffer(input.base64);
      const seed = parseWorkPlanXlsx(buf);
      await saveActiveSeed(seed, ctx.user.id);
      return { summary: summarizeSeed(seed) };
    }),

  /** admin：重置为 src/seed.json 默认版本 */
  reset: authedQuery.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await resetDefaultSeed();
    const seed = await getActiveSeed();
    return { summary: summarizeSeed(seed) };
  }),
});

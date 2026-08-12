// 自有服务器部署版：本地认证路由（登录 / 改密 / 账号管理）
import { z } from "zod";
import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery, adminQuery } from "../middleware";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "../lib/cookies";
import { signSessionToken } from "../kimi/session";
import { hashPassword, verifyPassword } from "./auth";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { setMemberRole } from "../queries/progress";

const LOCAL_PREFIX = "local:";

// ===== 登录频率限制（内存级，单实例部署足够） =====
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 分钟窗口
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

/** 定期清理过期条目，防止内存泄漏 */
const _cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts) {
    if (v.resetAt < now) loginAttempts.delete(k);
  }
}, 60 * 1000);
_unrefTimer(_cleanup);

/** Node 环境下取消 ref，浏览器 / 测试环境直接返回 */
function _unrefTimer(t: ReturnType<typeof setInterval>) {
  if (typeof (t as { unref?: () => void }).unref === "function") {
    (t as { unref: () => void }).unref();
  }
}

function getLoginKey(username: string, headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  return `${username.toLowerCase()}:${ip}`;
}

function checkLoginRate(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) return { allowed: true, retryAfterSec: 0 };
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

function setSessionCookie(resHeaders: Headers, reqHeaders: Headers, token: string) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const localAuthRouter = createRouter({
  /** 账号密码登录 */
  login: publicQuery
    .input(z.object({
      username: z.string().min(1, "请输入用户名"),
      password: z.string().min(1, "请输入密码"),
    }))
    .mutation(async ({ ctx, input }) => {
      // 频率限制：同一用户名 + IP，15 分钟内最多 5 次失败
      const loginKey = getLoginKey(input.username, ctx.req.headers);
      const rate = checkLoginRate(loginKey);
      if (!rate.allowed) {
        const mins = Math.ceil(rate.retryAfterSec / 60);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `登录尝试次数过多，请 ${mins} 分钟后再试`,
        });
      }

      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.username, input.username),
      });
      if (!user || !verifyPassword(input.password, user.passwordHash)) {
        recordFailedLogin(loginKey);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
      }
      // 登录成功，清除失败记录
      clearLoginAttempts(loginKey);
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
      const token = await signSessionToken({ unionId: user.unionId, clientId: "local" });
      setSessionCookie(ctx.resHeaders, ctx.req.headers, token);
      return { id: user.id, name: user.name, username: user.username };
    }),

  /** 修改自己的密码 */
  changePassword: authedQuery
    .input(z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(8, "新密码至少8位"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      if (!user || !verifyPassword(input.oldPassword, user.passwordHash)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "原密码错误" });
      }
      await db.update(users)
        .set({ passwordHash: hashPassword(input.newPassword) })
        .where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  /** 创建账号并分配项目角色（仅系统管理员） */
  createUser: adminQuery
    .input(z.object({
      username: z.string().min(3, "用户名至少3位").max(64)
        .regex(/^[a-zA-Z0-9_]+$/, "用户名仅限字母、数字、下划线"),
      password: z.string().min(8, "密码至少8位"),
      name: z.string().min(1, "请填写姓名"),
      projectRole: z.enum(["owner", "supervisor", "contractor"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const exists = await db.query.users.findFirst({
        where: eq(users.username, input.username),
      });
      if (exists) {
        throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
      }
      const [{ id }] = await db.insert(users).values({
        unionId: `${LOCAL_PREFIX}${input.username}`,
        username: input.username,
        passwordHash: hashPassword(input.password),
        name: input.name,
        role: "user",
      }).$returningId();
      await setMemberRole(id, input.projectRole);
      return { id };
    }),

  /** 重置任意账号密码（仅系统管理员） */
  resetPassword: adminQuery
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(8, "新密码至少8位"),
    }))
    .mutation(async ({ input }) => {
      await getDb().update(users)
        .set({ passwordHash: hashPassword(input.newPassword) })
        .where(eq(users.id, input.userId));
      return { ok: true };
    }),
});

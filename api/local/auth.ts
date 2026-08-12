// 自有服务器部署版：本地账号密码认证（新增文件，不改动 api/kimi 原有模块）
import crypto from "node:crypto";
import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { verifySessionToken } from "../kimi/session";
import { findUserByUnionId } from "../queries/users";

/** scrypt 加盐哈希，存储格式 salt:hash（十六进制） */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, "hex");
  return candidate.length === actual.length && crypto.timingSafeEqual(candidate, actual);
}

/** 从请求 Cookie 中解析会话并返回用户（未登录返回 undefined） */
export async function authenticateLocalRequest(headers: Headers) {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return undefined;
  const token = cookie.parse(cookieHeader)[Session.cookieName];
  if (!token) return undefined;
  const payload = await verifySessionToken(token);
  if (!payload) return undefined;
  return findUserByUnionId(payload.unionId);
}

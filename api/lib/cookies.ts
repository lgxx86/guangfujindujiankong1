import type { CookieOptions } from "hono/utils/cookie";

function isHttps(headers: Headers): boolean {
  // Nginx 反向代理时通过 X-Forwarded-Proto 判断原始协议
  return (headers.get("x-forwarded-proto") ?? "") === "https";
}

export function getSessionCookieOptions(headers: Headers): CookieOptions {
  // 前后端同源部署，SameSite=Lax 即可；
  // secure 仅在 HTTPS 下开启，保证 HTTP（IP直连/内网）也能正常登录
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: isHttps(headers),
  };
}

import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`[env] 环境变量 ${name} 未设置，开发环境可继续但生产部署前必须配置`);
  }
  return value ?? "";
}

export const env = {
  appId: process.env.APP_ID ?? "local",
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // 自有服务器部署版：不使用 Kimi OAuth，以下变量无需配置
  kimiAuthUrl: process.env.KIMI_AUTH_URL ?? "",
  kimiOpenUrl: process.env.KIMI_OPEN_URL ?? "",
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
};

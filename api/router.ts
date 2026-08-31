import { authRouter } from "./auth-router";
import { progressRouter } from "./progress-router";
import { memberRouter } from "./member-router";
import { seedRouter } from "./seed-router";
import { localAuthRouter } from "./local/router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  localAuth: localAuthRouter,
  progress: progressRouter,
  member: memberRouter,
  seed: seedRouter,
});

export type AppRouter = typeof appRouter;

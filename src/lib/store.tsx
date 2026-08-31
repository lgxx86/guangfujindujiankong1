// 项目状态管理：数据库协同版（tRPC + MySQL）
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ProjectSeed, ProjectState, TaskActual, ProgressLog } from '@/types';
import seedJson from '@/seed.json';
import { trpc } from '@/providers/trpc';
import { useAuth } from '@/hooks/useAuth';

/** 全局 seed：DB 动态优先（admin 导入后实时生效），fallback 到打包时内联的 seed.json */
const FALLBACK_SEED = seedJson as ProjectSeed;
export { FALLBACK_SEED };

export type ProjectRole = 'owner' | 'supervisor' | 'contractor' | null;

export const ROLE_LABEL: Record<string, string> = {
  owner: '业主方',
  supervisor: '监理方',
  contractor: '施工方',
};

interface Store {
  seed: ProjectSeed;
  state: ProjectState;
  role: ProjectRole;
  userName: string;
  logout: () => void;
  loading: boolean;
  /** 待审核填报涉及的 taskId 集合（用于任务行/弹窗提示） */
  pendingTaskIds: Set<string>;
  updateTask: (taskId: string, patch: Partial<TaskActual>, logNote?: string) => void;
  closeAlert: (key: string) => void;
  reopenAlert: (key: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  // 动态工作计划（admin 导入后立即生效）：登录后才查询，未登录用默认 fallback
  const seedQ = trpc.seed.get.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 30, // 30 秒内不重复请求
  });
  const seed: ProjectSeed = seedQ.data?.seed ?? FALLBACK_SEED;

  const statesQ = trpc.progress.states.useQuery(undefined, { enabled: !!user });
  const logsQ = trpc.progress.logs.useQuery(undefined, { enabled: !!user });
  const closuresQ = trpc.progress.closures.useQuery(undefined, { enabled: !!user });
  const roleQ = trpc.member.myRole.useQuery(undefined, { enabled: !!user });
  // 监理/业主看全部待审核；施工方看自己的待审核
  const pendingQ = trpc.progress.pending.useQuery(undefined, {
    enabled: !!user && (roleQ.data?.role === 'owner' || roleQ.data?.role === 'supervisor'),
    retry: false,
  });
  const mineQ = trpc.progress.mine.useQuery(undefined, {
    enabled: !!user && roleQ.data?.role === 'contractor',
  });

  const invalidateAll = () => {
    utils.progress.states.invalidate();
    utils.progress.logs.invalidate();
    utils.progress.pending.invalidate();
    utils.progress.pendingCount.invalidate();
    utils.progress.mine.invalidate();
    utils.progress.closures.invalidate();
  };

  const submitM = trpc.progress.submit.useMutation({ onSuccess: invalidateAll });
  const closeM = trpc.progress.closeAlert.useMutation({
    onSuccess: () => utils.progress.closures.invalidate(),
  });
  const reopenM = trpc.progress.reopenAlert.useMutation({
    onSuccess: () => utils.progress.closures.invalidate(),
  });

  const role: ProjectRole = roleQ.data?.role ?? null;

  const store = useMemo<Store>(() => {
    // 服务器生效状态 → TaskActual 结构
    const actuals: Record<string, TaskActual> = {};
    for (const [taskId, r] of Object.entries(statesQ.data ?? {})) {
      actuals[taskId] = {
        progress: r.progress,
        actualStart: r.actualStart,
        actualEnd: r.actualEnd,
        note: r.note ?? '',
        photo: null, // 照片改为按需加载，见 TaskDialog 中 getPhoto 查询
        reportId: r.reportId,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      };
    }
    const logs: ProgressLog[] = (logsQ.data ?? [])
      .filter(l => l.status === 'approved')
      .map(l => ({
        at: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
        taskId: l.taskId,
        progress: l.progress,
        note: `${l.reporterName}${l.note ? '：' + l.note : ''}`,
      }));

    const pendingTaskIds = new Set<string>();
    if (role === 'owner' || role === 'supervisor') {
      for (const r of pendingQ.data ?? []) pendingTaskIds.add(r.taskId);
    } else {
      for (const r of mineQ.data ?? []) if (r.status === 'pending') pendingTaskIds.add(r.taskId);
    }

    return {
      seed,
      state: { actuals, logs, closedAlerts: closuresQ.data ?? [] },
      role,
      userName: user?.name ?? '',
      logout,
      loading: seedQ.isLoading || statesQ.isLoading || roleQ.isLoading || seedQ.isFetching,
      pendingTaskIds,
      updateTask(taskId, patch, _logNote) {
        const cur = actuals[taskId];
        submitM.mutate({
          taskId,
          progress: patch.progress ?? cur?.progress ?? 0,
          actualStart: patch.actualStart !== undefined ? patch.actualStart : cur?.actualStart ?? null,
          actualEnd: patch.actualEnd !== undefined ? patch.actualEnd : cur?.actualEnd ?? null,
          note: patch.note ?? cur?.note ?? '',
          photo: patch.photo !== undefined ? patch.photo : cur?.photo ?? null,
        });
      },
      closeAlert(key) { closeM.mutate({ alertKey: key }); },
      reopenAlert(key) { reopenM.mutate({ alertKey: key }); },
    };
  }, [
    seed,
    statesQ.data,
    logsQ.data,
    closuresQ.data,
    pendingQ.data,
    mineQ.data,
    role,
    user,
    seedQ.isLoading,
    seedQ.isFetching,
  ]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used within StoreProvider');
  return s;
}

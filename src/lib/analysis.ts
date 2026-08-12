// 日期与进度分析核心逻辑
import type { Task, Section, TaskActual, TaskStatus, AlertItem, ProjectSeed } from '@/types';

export const DAY = 86400000;

export function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function fmt(d: Date | null): string {
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtCN(d: Date | null): string {
  if (!d) return '—';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function diffDays(a: Date, b: Date): number {
  // b - a 的天数
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 全部任务扁平化 */
export function allTasks(seed: ProjectSeed): { task: Task; section: string }[] {
  const out: { task: Task; section: string }[] = [];
  for (const s of seed.sections) for (const t of s.tasks) out.push({ task: t, section: s.name });
  return out;
}

/** 预计完成时间：已完工用实际完工日；未完工按当前进度推算 */
export function expectedEnd(task: Task, act: TaskActual | undefined, now: Date): Date | null {
  if (act?.actualEnd) return toDate(act.actualEnd);
  const pe = toDate(task.planEnd);
  if (!pe) return null;
  const progress = act?.progress ?? 0;
  if (progress >= 100) return act?.actualEnd ? toDate(act.actualEnd) : pe;
  const dur = task.duration ?? Math.max(1, diffDays(toDate(task.planStart)!, pe) + 1);
  const remaining = Math.ceil(dur * (1 - progress / 100));
  const est = addDays(now, Math.max(0, remaining - 1));
  // 已开始的任务，预计完工不可能早于原计划剩余工期推出的日期太多，这里取推算值与计划值较大者更保守？取推算值即可
  return est > pe && progress === 0 && !act?.actualStart ? pe : est;
}

/** 延期天数（>0 表示延期） */
export function delayDays(task: Task, act: TaskActual | undefined, now: Date): number {
  const pe = toDate(task.planEnd);
  if (!pe) return 0;
  if (act?.actualEnd) {
    return Math.max(0, diffDays(pe, toDate(act.actualEnd)!));
  }
  if ((act?.progress ?? 0) >= 100) return 0;
  // 未完工：到期即算延期，同时考虑进度推算
  if (now > pe) return diffDays(pe, now);
  return 0;
}

export function taskStatus(task: Task, act: TaskActual | undefined, now: Date): TaskStatus {
  const pe = toDate(task.planEnd);
  const progress = act?.progress ?? 0;
  if (act?.actualEnd || progress >= 100) {
    const ae = act?.actualEnd ? toDate(act.actualEnd) : null;
    if (ae && pe && ae > pe) return 'done-late';
    return 'done';
  }
  const started = !!act?.actualStart || progress > 0;
  if (!started) {
    // 计划完成日已过仍无填报：按延期对待（业主需核实填报）
    if (pe && now > pe) return 'delayed';
    return 'not-started';
  }
  if (pe && now > pe) return 'delayed';
  return 'on-track';
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  'not-started': '未开始',
  'on-track': '进行中',
  'delayed': '已延期',
  'done': '已完成',
  'done-late': '延期完成',
};

/** 下游任务（被依赖方）映射 */
export function downstreamMap(seed: ProjectSeed): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const s of seed.sections)
    for (const t of s.tasks)
      for (const d of t.deps) {
        if (!m.has(d)) m.set(d, []);
        m.get(d)!.push(t.id);
      }
  return m;
}

/** 某任务延期的传导影响：返回受影响的下游任务ID集合（含是否波及并网里程碑） */
export function propagation(seed: ProjectSeed, taskId: string): { affected: string[]; hitsGrid: boolean } {
  const down = downstreamMap(seed);
  const gridTask = allTasks(seed).find(x => x.task.name === '满足并网发电条件');
  const visited = new Set<string>();
  const queue = [taskId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nxt of down.get(cur) ?? []) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  visited.delete(taskId);
  return { affected: [...visited], hitsGrid: gridTask ? visited.has(gridTask.task.id) : false };
}

/** 生成预警清单 */
export function buildAlerts(seed: ProjectSeed, actuals: Record<string, TaskActual>, closed: string[], now: Date): AlertItem[] {
  const items: AlertItem[] = [];
  for (const { task, section } of allTasks(seed)) {
    const act = actuals[task.id];
    const status = taskStatus(task, act, now);
    const ps = toDate(task.planStart);
    const pe = toDate(task.planEnd);
    const dd = delayDays(task, act, now);
    const prop = propagation(seed, task.id);

    // 红色：到期未完
    if (pe && now > pe && status !== 'done' && status !== 'done-late') {
      items.push({
        key: `${task.id}:overdue:${task.planEnd}`,
        level: 'red',
        taskId: task.id, taskName: task.name, section, milestone: task.milestone,
        reason: `计划 ${fmtCN(pe)} 完成，现已超期 ${dd} 天仍未完工`,
        delayDays: dd, planEnd: task.planEnd,
        impactGrid: prop.hitsGrid,
        closed: closed.includes(`${task.id}:overdue:${task.planEnd}`),
      });
    } else if (status === 'done-late') {
      items.push({
        key: `${task.id}:late-done:${task.planEnd}`,
        level: 'yellow',
        taskId: task.id, taskName: task.name, section, milestone: task.milestone,
        reason: `延期 ${dd} 天完成，请关注下游工序`,
        delayDays: dd, planEnd: task.planEnd,
        impactGrid: prop.hitsGrid,
        closed: closed.includes(`${task.id}:late-done:${task.planEnd}`),
      });
    } else if (pe && status !== 'done' && diffDays(now, pe) <= 3 && diffDays(now, pe) >= 0) {
      // 黄色：临期3天内未完
      items.push({
        key: `${task.id}:due-soon:${task.planEnd}`,
        level: 'yellow',
        taskId: task.id, taskName: task.name, section, milestone: task.milestone,
        reason: `距计划完成仅剩 ${diffDays(now, pe)} 天，当前进度 ${act?.progress ?? 0}%`,
        delayDays: 0, planEnd: task.planEnd,
        impactGrid: prop.hitsGrid,
        closed: closed.includes(`${task.id}:due-soon:${task.planEnd}`),
      });
    }
    // 黄色：应开工未开工
    if (ps && now > ps && status === 'not-started' && (!pe || now <= pe)) {
      items.push({
        key: `${task.id}:not-started:${task.planStart}`,
        level: 'yellow',
        taskId: task.id, taskName: task.name, section, milestone: task.milestone,
        reason: `计划 ${fmtCN(ps)} 开工，至今未填报开工`,
        delayDays: 0, planEnd: task.planEnd,
        impactGrid: prop.hitsGrid,
        closed: closed.includes(`${task.id}:not-started:${task.planStart}`),
      });
    }
  }
  // 里程碑预警置顶
  return items.sort((a, b) =>
    (a.level === b.level ? (b.milestone ? 1 : 0) - (a.milestone ? 1 : 0) : a.level === 'red' ? -1 : 1));
}

/** 项目整体进度：按计划工期加权的实际进度；计划进度按今天应完成量 */
export function overallProgress(seed: ProjectSeed, actuals: Record<string, TaskActual>, now: Date) {
  let totalW = 0, actualW = 0, planW = 0;
  for (const { task } of allTasks(seed)) {
    const ps = toDate(task.planStart), pe = toDate(task.planEnd);
    if (!ps || !pe) continue;
    const w = task.duration ?? Math.max(1, diffDays(ps, pe) + 1);
    totalW += w;
    const act = actuals[task.id];
    let p = act?.progress ?? 0;
    if (act?.actualEnd) p = 100;
    actualW += w * p / 100;
    // 计划进度
    let plan = 0;
    if (now >= pe) plan = 100;
    else if (now > ps) plan = Math.min(100, (diffDays(ps, now) + 1) / (diffDays(ps, pe) + 1) * 100);
    planW += w * plan / 100;
  }
  return {
    actual: totalW ? Math.round(actualW / totalW * 1000) / 10 : 0,
    plan: totalW ? Math.round(planW / totalW * 1000) / 10 : 0,
  };
}

export function sectionProgress(section: Section, actuals: Record<string, TaskActual>): number {
  let totalW = 0, w = 0;
  for (const t of section.tasks) {
    const weight = t.duration ?? 1;
    totalW += weight;
    const act = actuals[t.id];
    let p = act?.progress ?? 0;
    if (act?.actualEnd) p = 100;
    w += weight * p / 100;
  }
  return totalW ? Math.round(w / totalW * 100) : 0;
}

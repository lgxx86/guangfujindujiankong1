// 甘特图：计划 vs 实际对比、今日线、里程碑、关键线路、延期传导高亮
import { useMemo, useState } from 'react';
import type { Task } from '@/types';
import { useStore, seed } from '@/lib/store';
import { allTasks, taskStatus, propagation, downstreamMap, today, toDate, diffDays, delayDays } from '@/lib/analysis';

const DAY_W = 15;      // 每天像素
const ROW_H = 34;      // 行高
const LABEL_W = 230;   // 左侧名称列宽

// 从项目数据动态计算甘特图日期范围（左右各留 15 天余量）
const _projectDates = allTasks(seed)
  .flatMap(({ task }) => [toDate(task.planStart), toDate(task.planEnd)])
  .filter((d): d is Date => d !== null);
const RANGE_START = (() => {
  if (!_projectDates.length) return new Date(new Date().getFullYear(), 0, 1);
  const d = new Date(Math.min(..._projectDates.map(x => x.getTime())));
  d.setDate(d.getDate() - 15);
  return d;
})();
const RANGE_END = (() => {
  if (!_projectDates.length) return new Date(new Date().getFullYear(), 11, 31);
  const d = new Date(Math.max(..._projectDates.map(x => x.getTime())));
  d.setDate(d.getDate() + 15);
  return d;
})();

function xOf(d: Date): number {
  return diffDays(RANGE_START, d) * DAY_W;
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

export default function Gantt({ onEdit }: { onEdit: (task: Task, section: string) => void }) {
  const { state } = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCritical, setShowCritical] = useState(true);
  const now = today();

  const totalDays = diffDays(RANGE_START, RANGE_END) + 1;
  const width = totalDays * DAY_W;
  const todayX = xOf(now);

  // 关键线路：从并网里程碑反向追溯
  const critical = useMemo(() => {
    const set = new Set<string>();
    const grid = allTasks(seed).find(x => x.task.name === '满足并网发电条件');
    if (!grid) return set;
    const map = new Map(allTasks(seed).map(x => [x.task.id, x.task]));
    const walk = (id: string) => {
      if (set.has(id)) return;
      set.add(id);
      for (const d of map.get(id)?.deps ?? []) walk(d);
    };
    walk(grid.task.id);
    return set;
  }, []);

  const affected = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(propagation(seed, selected).affected);
  }, [selected]);

  const down = useMemo(() => downstreamMap(seed), []);

  // 月份刻度
  const monthTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    const d = new Date(RANGE_START);
    while (d <= RANGE_END) {
      ticks.push({ x: xOf(d), label: `${MONTHS[d.getMonth()]}` });
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  }, []);

  const rowFor = (task: Task) => {
    const act = state.actuals[task.id];
    const status = taskStatus(task, act, now);
    const ps = toDate(task.planStart), pe = toDate(task.planEnd);
    const progress = act?.actualEnd ? 100 : (act?.progress ?? 0);
    const dd = delayDays(task, act, now);
    return { act, status, ps, pe, progress, dd };
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} />
          <span className="text-amber-700 font-medium">显示关键线路（影响并网的工序链）</span>
        </label>
        <span className="flex items-center gap-1"><i className="inline-block w-6 h-2.5 bg-slate-300 rounded" />计划</span>
        <span className="flex items-center gap-1"><i className="inline-block w-6 h-2.5 bg-green-500 rounded" />实际(正常)</span>
        <span className="flex items-center gap-1"><i className="inline-block w-6 h-2.5 bg-red-500 rounded" />延期</span>
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rotate-45 bg-amber-500" />里程碑</span>
        <span className="flex items-center gap-1"><i className="inline-block w-0.5 h-3.5 bg-red-600" />今日</span>
        {selected && (
          <button className="text-blue-600 underline" onClick={() => setSelected(null)}>取消传导高亮</button>
        )}
      </div>

      <div className="border rounded-lg overflow-auto max-h-[65vh] bg-white">
        <div style={{ width: LABEL_W + width, minWidth: '100%' }}>
          {/* 表头：月份 */}
          <div className="flex sticky top-0 z-20 bg-slate-100 border-b">
            <div className="sticky left-0 z-30 bg-slate-100 border-r text-xs font-medium flex items-center px-2" style={{ width: LABEL_W, height: 28 }}>
              施工任务（点击任务查看延期传导）
            </div>
            <div className="relative" style={{ width, height: 28 }}>
              {monthTicks.map(t => (
                <span key={t.x} className="absolute text-xs text-slate-600 border-l pl-1" style={{ left: t.x, height: 28, lineHeight: '28px' }}>{t.label}</span>
              ))}
            </div>
          </div>

          {seed.sections.map(sec => (
            <div key={sec.name}>
              {/* 部位标题行 */}
              <div className="flex bg-blue-50 border-b">
                <div className="sticky left-0 z-10 bg-blue-50 border-r px-2 text-xs font-bold text-blue-800 flex items-center" style={{ width: LABEL_W, height: 26 }}>
                  {sec.name}
                </div>
                <div style={{ width, height: 26 }} />
              </div>
              {sec.tasks.map(task => {
                const { status, ps, pe, progress, dd } = rowFor(task);
                const isSel = selected === task.id;
                const isAff = affected.has(task.id);
                const isCrit = showCritical && critical.has(task.id);
                const planX = ps ? xOf(ps) : 0;
                const planW = ps && pe ? Math.max(DAY_W, (diffDays(ps, pe) + 1) * DAY_W) : DAY_W;
                return (
                  <div key={task.id}
                    className={`flex border-b cursor-pointer group ${isSel ? 'bg-blue-100/70' : isAff ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelected(isSel ? null : task.id)}
                    onDoubleClick={() => onEdit(task, sec.name)}
                  >
                    <div className="sticky left-0 z-10 bg-inherit border-r px-2 flex items-center gap-1 text-xs" style={{ width: LABEL_W, height: ROW_H }}>
                      {task.milestone && <i className="w-2.5 h-2.5 rotate-45 bg-amber-500 shrink-0" />}
                      <span className={`truncate ${isCrit ? 'font-semibold text-amber-800' : ''}`} title={task.name}>{task.name}</span>
                      <button className="ml-auto opacity-0 group-hover:opacity-100 text-blue-600 shrink-0"
                        onClick={e => { e.stopPropagation(); onEdit(task, sec.name); }}>填报</button>
                    </div>
                    <div className="relative" style={{ width, height: ROW_H }}>
                      {/* 今日线 */}
                      {todayX >= 0 && todayX <= width && (
                        <i className="absolute top-0 bottom-0 w-px bg-red-400/60" style={{ left: todayX }} />
                      )}
                      {/* 周网格 */}
                      {[...Array(Math.floor(totalDays / 7))].map((_, i) => (
                        <i key={i} className="absolute top-0 bottom-0 w-px bg-slate-100" style={{ left: (i + 1) * 7 * DAY_W }} />
                      ))}
                      {ps && pe && (
                        <>
                          {/* 计划条 */}
                          <div className={`absolute rounded-sm ${isCrit ? 'bg-amber-200 border border-amber-400' : 'bg-slate-300/80'}`}
                            style={{ left: planX, width: planW, top: 6, height: 10 }}
                            title={`计划 ${task.planStart} ~ ${task.planEnd}`} />
                          {/* 实际条 */}
                          {progress > 0 && (
                            <div className={`absolute rounded-sm ${
                              status === 'delayed' || status === 'done-late' ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ left: planX, width: Math.max(4, planW * progress / 100), top: 19, height: 10 }}
                              title={`实际进度 ${progress}%`} />
                          )}
                          {/* 延期拖尾 */}
                          {(status === 'delayed') && dd > 0 && todayX > planX + planW && (
                            <div className="absolute bg-red-300/70 rounded-r-sm border-r-2 border-red-500"
                              style={{ left: planX + planW, width: Math.min(todayX - planX - planW, width), top: 6, height: 10 }}
                              title={`已超期 ${dd} 天`} />
                          )}
                          {isAff && (
                            <div className="absolute inset-x-0 border-y-2 border-orange-400/70 pointer-events-none" style={{ top: 2, bottom: 2 }} />
                          )}
                        </>
                      )}
                      {task.milestone && ps && (
                        <i className="absolute w-3 h-3 rotate-45 bg-amber-500 border border-white shadow"
                          style={{ left: planX - 5, top: ROW_H / 2 - 6 }} />
                      )}
                      {/* 依赖小箭头提示 */}
                      {down.get(task.id)?.length ? (
                        <span className="absolute text-[9px] text-slate-400" style={{ left: planX + planW + 2, top: 9 }}>→{down.get(task.id)!.length}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">提示：单击任务行高亮其延期的下游传导链；双击或点「填报」录入实际进度。橙色底纹行 = 选中任务延期将波及的任务。</p>
    </div>
  );
}

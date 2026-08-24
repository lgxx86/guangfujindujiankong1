// 甘特图：计划 vs 实际对比、今日线、里程碑、关键线路、延期传导高亮
import { useMemo, useState } from 'react';
import type { Task } from '@/types';
import { useStore, seed } from '@/lib/store';
import { allTasks, taskStatus, propagation, downstreamMap, today, toDate, diffDays, delayDays } from '@/lib/analysis';
import { Info } from 'lucide-react';

const DAY_W = 15;      // 每天像素
const ROW_H = 36;      // 行高
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
    const ticks: { x: number; label: string; year?: number }[] = [];
    const d = new Date(RANGE_START);
    let lastYear = -1;
    while (d <= RANGE_END) {
      const y = d.getFullYear();
      ticks.push({ x: xOf(d), label: `${MONTHS[d.getMonth()]}`, year: y !== lastYear ? y : undefined });
      lastYear = y;
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

  const legends = [
    { cls: 'bg-gradient-to-r from-slate-300 to-slate-400', label: '计划' },
    { cls: 'bg-gradient-to-r from-emerald-400 to-emerald-500', label: '实际(正常)' },
    { cls: 'bg-gradient-to-r from-red-400 to-red-500', label: '延期' },
    { cls: 'bg-amber-500 rotate-45 w-3 h-3', label: '里程碑', diamond: true },
    { cls: 'bg-red-500 w-0.5 h-3.5', label: '今日', bar: true },
  ];

  return (
    <div className="space-y-3">
      {/* 工具栏 + 图例 */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
        <label className="flex items-center gap-1.5 cursor-pointer select-none group">
          <span className="relative w-4 h-4">
            <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} className="peer sr-only" />
            <span className="absolute inset-0 rounded border border-slate-300 peer-checked:bg-brand-gradient peer-checked:border-brand-mid transition-colors" />
            <svg className="absolute inset-0 w-4 h-4 text-white opacity-0 peer-checked:opacity-100" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-amber-700 font-medium group-hover:text-amber-800">显示关键线路（影响并网的工序链）</span>
        </label>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex flex-wrap items-center gap-3">
          {legends.map((lg, i) => (
            <span key={i} className="flex items-center gap-1">
              {lg.diamond ? (
                <i className={`inline-block w-3 h-3 rotate-45 ${lg.cls.split(' ')[0]}`} />
              ) : lg.bar ? (
                <i className={`inline-block w-0.5 h-3.5 bg-red-500`} />
              ) : (
                <i className={`inline-block w-6 h-2.5 rounded ${lg.cls}`} />
              )}
              <span className="text-slate-600">{lg.label}</span>
            </span>
          ))}
        </div>
        {selected && (
          <button className="ml-auto text-brand-mid hover:text-brand-bright underline underline-offset-2 transition-colors" onClick={() => setSelected(null)}>
            取消传导高亮
          </button>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-auto max-h-[65vh] bg-white shadow-sm scrollbar-slim">
        <div style={{ width: LABEL_W + width, minWidth: '100%' }}>
          {/* 表头：月份 */}
          <div className="flex sticky top-0 z-20 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <div className="sticky left-0 z-30 bg-slate-100 border-r border-slate-200 text-xs font-semibold text-slate-700 flex items-center px-3" style={{ width: LABEL_W, height: 32 }}>
              施工任务
              <span className="text-slate-400 font-normal ml-1">（点击查看延期传导）</span>
            </div>
            <div className="relative" style={{ width, height: 32 }}>
              {monthTicks.map((t, i) => (
                <span key={i} className="absolute text-[11px] text-slate-600 border-l border-slate-200 pl-1.5 font-medium" style={{ left: t.x, height: 32, lineHeight: '32px' }}>
                  {t.year && <span className="text-brand-mid mr-1">{t.year}</span>}{t.label}
                </span>
              ))}
            </div>
          </div>

          {seed.sections.map(sec => (
            <div key={sec.name}>
              {/* 部位标题行 */}
              <div className="flex bg-brand-mid/5 border-b border-slate-200">
                <div className="sticky left-0 z-10 bg-brand-mid/5 border-r border-slate-200 px-3 text-xs font-bold text-brand-mid flex items-center" style={{ width: LABEL_W, height: 28 }}>
                  <span className="w-1 h-3 rounded bg-brand-mid mr-2" />
                  {sec.name}
                </div>
                <div style={{ width, height: 28 }} />
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
                    className={`flex border-b border-slate-100 cursor-pointer group transition-colors ${
                      isSel ? 'bg-brand-bright/10' : isAff ? 'bg-orange-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelected(isSel ? null : task.id)}
                    onDoubleClick={() => onEdit(task, sec.name)}
                  >
                    <div className="sticky left-0 z-10 bg-inherit border-r border-slate-200 px-3 flex items-center gap-1.5 text-xs" style={{ width: LABEL_W, height: ROW_H }}>
                      {task.milestone && <i className="w-2.5 h-2.5 rotate-45 bg-brand-glow shrink-0" />}
                      <span className={`truncate ${isCrit ? 'font-semibold text-amber-800' : ''}`} title={task.name}>{task.name}</span>
                      <button className="ml-auto opacity-0 group-hover:opacity-100 text-brand-mid hover:text-brand-bright text-[11px] px-1.5 py-0.5 rounded bg-brand-bright/10 hover:bg-brand-bright/20 transition-all shrink-0"
                        onClick={e => { e.stopPropagation(); onEdit(task, sec.name); }}>填报</button>
                    </div>
                    <div className="relative" style={{ width, height: ROW_H }}>
                      {/* 今日线 */}
                      {todayX >= 0 && todayX <= width && (
                        <>
                          <i className="absolute top-0 bottom-0 w-px bg-red-500/70" style={{ left: todayX }} />
                          <i className="absolute w-2 h-2 rounded-full bg-red-500 ring-2 ring-white shadow" style={{ left: todayX - 4, top: -4 }} />
                        </>
                      )}
                      {/* 周网格 */}
                      {[...Array(Math.floor(totalDays / 7))].map((_, i) => (
                        <i key={i} className="absolute top-0 bottom-0 w-px bg-slate-100" style={{ left: (i + 1) * 7 * DAY_W }} />
                      ))}
                      {ps && pe && (
                        <>
                          {/* 计划条 */}
                          <div className={`absolute rounded-sm ${isCrit ? 'bg-amber-200 border border-amber-400' : 'bg-gradient-to-r from-slate-300 to-slate-400/80'}`}
                            style={{ left: planX, width: planW, top: 7, height: 10 }}
                            title={`计划 ${task.planStart} ~ ${task.planEnd}`} />
                          {/* 实际条 */}
                          {progress > 0 && (
                            <div className={`absolute rounded-sm ${
                              status === 'delayed' || status === 'done-late'
                                ? 'bg-gradient-to-r from-red-400 to-red-500'
                                : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                              style={{ left: planX, width: Math.max(4, planW * progress / 100), top: 20, height: 10 }}
                              title={`实际进度 ${progress}%`} />
                          )}
                          {/* 延期拖尾 */}
                          {(status === 'delayed') && dd > 0 && todayX > planX + planW && (
                            <div className="absolute bg-red-300/70 rounded-r-sm border-r-2 border-red-500 border-dashed"
                              style={{ left: planX + planW, width: Math.min(todayX - planX - planW, width), top: 7, height: 10 }}
                              title={`已超期 ${dd} 天`} />
                          )}
                          {isAff && (
                            <div className="absolute inset-x-0 border-y-2 border-orange-400/70 pointer-events-none" style={{ top: 2, bottom: 2 }} />
                          )}
                        </>
                      )}
                      {task.milestone && ps && (
                        <i className="absolute w-3.5 h-3.5 rotate-45 bg-brand-glow border-2 border-white shadow-md"
                          style={{ left: planX - 6, top: ROW_H / 2 - 7 }} />
                      )}
                      {/* 依赖小箭头提示 */}
                      {down.get(task.id)?.length ? (
                        <span className="absolute text-[9px] text-slate-400 font-medium" style={{ left: planX + planW + 4, top: 10 }}>→{down.get(task.id)!.length}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-mid" />
        <p>提示：单击任务行高亮其延期的下游传导链；双击或点「填报」录入实际进度。橙色底纹行 = 选中任务延期将波及的任务。</p>
      </div>
    </div>
  );
}

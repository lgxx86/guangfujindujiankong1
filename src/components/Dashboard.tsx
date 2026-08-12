// 进度总览驾驶舱
import { useMemo } from 'react';
import { useStore, seed } from '@/lib/store';
import { allTasks, taskStatus, overallProgress, buildAlerts, today, toDate, diffDays, fmtCN, sectionProgress } from '@/lib/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, CircleDashed, Flag, Zap } from 'lucide-react';

export default function Dashboard({ onGoAlerts }: { onGoAlerts: () => void }) {
  const { state } = useStore();
  const now = today();

  const stats = useMemo(() => {
    const tasks = allTasks(seed);
    const c = { done: 0, onTrack: 0, delayed: 0, notStarted: 0, doneLate: 0 };
    for (const { task } of tasks) {
      const s = taskStatus(task, state.actuals[task.id], now);
      if (s === 'done') c.done++;
      else if (s === 'done-late') c.doneLate++;
      else if (s === 'on-track') c.onTrack++;
      else if (s === 'delayed') c.delayed++;
      else c.notStarted++;
    }
    return c;
  }, [state.actuals]);

  const ov = overallProgress(seed, state.actuals, now);
  const alerts = buildAlerts(seed, state.actuals, state.closedAlerts, now);
  const openAlerts = alerts.filter(a => !a.closed);
  const redCount = openAlerts.filter(a => a.level === 'red').length;
  const gridDate = toDate(seed.gridDate)!;
  const daysToGrid = diffDays(now, gridDate);

  const milestones = useMemo(() =>
    allTasks(seed).filter(x => x.task.milestone).map(x => ({
      ...x, status: taskStatus(x.task, state.actuals[x.task.id], now),
    })), [state.actuals]);

  const deviation = ov.plan - ov.actual;

  return (
    <div className="space-y-4">
      {/* 顶部横幅 */}
      <Card className="bg-gradient-to-r from-blue-700 to-blue-900 text-white border-0">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{seed.name}</h2>
              <p className="text-blue-200 text-sm mt-1">
                总工期 {seed.totalDays} 天（{fmtCN(toDate(seed.planStart))} ～ {fmtCN(toDate(seed.planEnd))}）· 目标：{seed.goal}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <Zap className="w-5 h-5 text-amber-300" />
                <span className="text-3xl font-bold">{daysToGrid >= 0 ? daysToGrid : 0}</span>
                <span className="text-blue-200">天后并网</span>
              </div>
              <p className="text-blue-200 text-xs mt-1">并网节点 {seed.gridDate}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-xs text-blue-200 mb-1">
                <span>实际总进度</span><span>{ov.actual}%</span>
              </div>
              <Progress value={ov.actual} className="h-3 bg-blue-950" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-blue-200 mb-1">
                <span>计划应完成</span><span>{ov.plan}%</span>
              </div>
              <Progress value={ov.plan} className="h-3 bg-blue-950" />
            </div>
          </div>
          <p className={`text-sm mt-2 ${deviation > 3 ? 'text-amber-300' : 'text-blue-200'}`}>
            {deviation > 3
              ? `⚠ 实际进度落后计划 ${deviation.toFixed(1)}%，请重点关注预警任务`
              : deviation < -3 ? `实际进度超前计划 ${(-deviation).toFixed(1)}%，进展良好` : '实际进度与计划基本同步'}
          </p>
        </CardContent>
      </Card>

      {/* 指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '已完成', value: stats.done, icon: CheckCircle2, color: 'text-green-600' },
          { label: '进行中', value: stats.onTrack, icon: Clock, color: 'text-blue-600' },
          { label: '已延期', value: stats.delayed, icon: AlertTriangle, color: 'text-red-600' },
          { label: '未开始', value: stats.notStarted, icon: CircleDashed, color: 'text-slate-400' },
          { label: '延期完成', value: stats.doneLate, icon: Flag, color: 'text-amber-600' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="py-3 flex items-center gap-3">
              <k.icon className={`w-7 h-7 ${k.color}`} />
              <div>
                <div className="text-2xl font-bold">{k.value}</div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 里程碑时间轴 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">关键里程碑</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {milestones.map(({ task, section, status }) => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  status === 'done' ? 'bg-green-500' : status === 'done-late' ? 'bg-amber-500'
                  : status === 'delayed' ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className="flex-1 truncate font-medium">{task.name}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{section.split('、')[0]}</span>
                <span className="text-xs">{fmtCN(toDate(task.planStart))}{task.planStart !== task.planEnd ? `~${fmtCN(toDate(task.planEnd))}` : ''}</span>
                <Badge variant={status === 'delayed' ? 'destructive' : 'outline'} className="text-xs">
                  {status === 'done' ? '✓' : status === 'done-late' ? '迟✓' : status === 'delayed' ? '延期' : status === 'on-track' ? '进行' : '待办'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 预警摘要 */}
        <Card className={redCount > 0 ? 'border-red-300' : ''}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              预警看板
              {redCount > 0 && <Badge variant="destructive">{redCount} 红</Badge>}
              {openAlerts.length - redCount > 0 && <Badge className="bg-amber-500">{openAlerts.length - redCount} 黄</Badge>}
            </CardTitle>
            <button onClick={onGoAlerts} className="text-xs text-blue-600 hover:underline">查看全部 →</button>
          </CardHeader>
          <CardContent className="space-y-2">
            {openAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">✓ 当前无未处理预警，工程按计划推进</p>
            )}
            {openAlerts.slice(0, 6).map(a => (
              <div key={a.key} className={`text-sm rounded p-2 border-l-4 ${a.level === 'red' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-400'}`}>
                <span className="font-medium">{a.taskName}</span>
                <span className="text-xs text-muted-foreground ml-1">（{a.section.split('、')[0]}）</span>
                <p className={`text-xs mt-0.5 ${a.level === 'red' ? 'text-red-700' : 'text-amber-700'}`}>
                  {a.reason}{a.impactGrid && <b className="text-red-600"> · 波及并网</b>}
                </p>
              </div>
            ))}
            {openAlerts.length > 6 && <p className="text-xs text-muted-foreground text-center">另有 {openAlerts.length - 6} 条…</p>}
          </CardContent>
        </Card>
      </div>

      {/* 各部位进度 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">各施工部位进度</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {seed.sections.map(s => {
              const p = sectionProgress(s, state.actuals);
              return (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="w-40 truncate text-xs" title={s.name}>{s.name}</span>
                  <Progress value={p} className="h-2 flex-1" />
                  <span className="w-10 text-right text-xs font-medium">{p}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

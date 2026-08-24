// 进度总览驾驶舱
import { useMemo } from 'react';
import { useStore, seed } from '@/lib/store';
import { allTasks, taskStatus, overallProgress, buildAlerts, today, toDate, diffDays, fmtCN, sectionProgress } from '@/lib/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, AlertTriangle, CircleDashed, Flag, Zap, Activity,
  TrendingUp, TrendingDown, Minus, ChevronRight, Target,
} from 'lucide-react';

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
  const yellowCount = openAlerts.length - redCount;
  const gridDate = toDate(seed.gridDate)!;
  const daysToGrid = diffDays(now, gridDate);

  const milestones = useMemo(() =>
    allTasks(seed).filter(x => x.task.milestone).map(x => ({
      ...x, status: taskStatus(x.task, state.actuals[x.task.id], now),
    })), [state.actuals]);

  const deviation = ov.plan - ov.actual;
  const deviationTone = deviation > 3 ? 'bad' : deviation < -3 ? 'good' : 'sync';

  const statCards = [
    { label: '已完成', value: stats.done, icon: CheckCircle2, tone: 'emerald', gradient: 'from-emerald-500 to-emerald-600' },
    { label: '进行中', value: stats.onTrack, icon: Clock, tone: 'sky', gradient: 'from-sky-500 to-sky-600' },
    { label: '已延期', value: stats.delayed, icon: AlertTriangle, tone: 'red', gradient: 'from-red-500 to-red-600' },
    { label: '未开始', value: stats.notStarted, icon: CircleDashed, tone: 'slate', gradient: 'from-slate-400 to-slate-500' },
    { label: '延期完成', value: stats.doneLate, icon: Flag, tone: 'amber', gradient: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="space-y-4">
      {/* 顶部横幅：驾驶舱 */}
      <Card className="relative overflow-hidden border-0 bg-brand-radial text-white shadow-xl shadow-brand-deep/20">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-glow/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-brand-bright/20 blur-3xl pointer-events-none" />
        <CardContent className="relative py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-white/60 mb-2">
                <Activity className="w-3 h-3" />项目驾驶舱
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{seed.name}</h2>
              <p className="text-white/70 text-sm mt-1.5">
                总工期 <span className="font-semibold text-white">{seed.totalDays}</span> 天 ·
                {fmtCN(toDate(seed.planStart))} ～ {fmtCN(toDate(seed.planEnd))} · 目标：{seed.goal}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-white/60 mb-0.5">距并网节点</div>
              <div className="flex items-center gap-2 justify-end">
                <div className="w-11 h-11 rounded-xl bg-brand-glow/20 ring-1 ring-brand-glow/30 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-brand-glow" />
                </div>
                <span className="text-5xl font-black tabular-nums leading-none">{daysToGrid >= 0 ? daysToGrid : 0}</span>
                <span className="text-white/70 text-sm">天后并网</span>
              </div>
              <p className="text-white/60 text-xs mt-1 tabular-nums">并网节点 {seed.gridDate}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-lg p-3">
              <div className="flex justify-between text-xs text-white/80 mb-1.5">
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />实际总进度</span>
                <span className="font-semibold text-white tabular-nums">{ov.actual}%</span>
              </div>
              <Progress value={ov.actual} className="h-3 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-brand-bright [&>div]:to-emerald-400" />
            </div>
            <div className="glass rounded-lg p-3">
              <div className="flex justify-between text-xs text-white/80 mb-1.5">
                <span className="flex items-center gap-1"><Target className="w-3 h-3" />计划应完成</span>
                <span className="font-semibold text-white tabular-nums">{ov.plan}%</span>
              </div>
              <Progress value={ov.plan} className="h-3 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-white/60 [&>div]:to-white" />
            </div>
          </div>

          <div className={`mt-3 inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 ${
            deviationTone === 'bad' ? 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30'
            : deviationTone === 'good' ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30'
            : 'bg-white/10 text-white/80 ring-1 ring-white/15'
          }`}>
            {deviationTone === 'bad' ? <TrendingDown className="w-4 h-4" />
             : deviationTone === 'good' ? <TrendingUp className="w-4 h-4" />
             : <Minus className="w-4 h-4" />}
            {deviationTone === 'bad'
              ? `实际进度落后计划 ${deviation.toFixed(1)}%，请重点关注预警任务`
              : deviationTone === 'good' ? `实际进度超前计划 ${(-deviation).toFixed(1)}%，进展良好` : '实际进度与计划基本同步'}
          </div>
        </CardContent>
      </Card>

      {/* 指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((k, i) => (
          <Card key={k.label} className={`lift-card border-slate-200/70 shadow-sm animate-fade-up delay-${i + 1}`}>
            <CardContent className="py-3.5 px-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow-md shrink-0`}>
                  <k.icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold tabular-nums leading-tight">{k.value}</div>
                  <div className="text-[11px] text-muted-foreground">{k.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 里程碑时间轴 */}
        <Card className="border-slate-200/70 shadow-sm animate-fade-up">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="w-4 h-4 text-brand-glow" />关键里程碑
            </CardTitle>
            <Badge variant="secondary" className="text-[11px]">{milestones.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {milestones.map(({ task, section, status }) => {
              const tone = status === 'done' ? 'bg-emerald-500' : status === 'done-late' ? 'bg-amber-500'
                : status === 'delayed' ? 'bg-red-500 animate-pulse' : 'bg-slate-300';
              return (
                <div key={task.id} className="flex items-center gap-3 text-sm group">
                  <span className={`relative w-2.5 h-2.5 rounded-full shrink-0 ${tone}`}>
                    {status === 'delayed' && <span className="absolute inset-0 rounded-full bg-red-400/50 animate-ping" />}
                  </span>
                  <span className="flex-1 truncate font-medium group-hover:text-brand-mid transition-colors">{task.name}</span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline truncate max-w-28" title={section}>{section.split('、')[0]}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{fmtCN(toDate(task.planStart))}{task.planStart !== task.planEnd ? `~${fmtCN(toDate(task.planEnd))}` : ''}</span>
                  <Badge variant={status === 'delayed' ? 'destructive' : 'outline'} className="text-[11px] h-5">
                    {status === 'done' ? '✓' : status === 'done-late' ? '迟✓' : status === 'delayed' ? '延期' : status === 'on-track' ? '进行' : '待办'}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 预警看板 */}
        <Card className={`border shadow-sm animate-fade-up delay-2 ${redCount > 0 ? 'border-red-200' : 'border-slate-200/70'}`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${redCount > 0 ? 'text-red-500' : 'text-amber-400'}`} />预警看板
              {redCount > 0 && <Badge variant="destructive" className="text-[11px] h-5">{redCount} 红</Badge>}
              {yellowCount > 0 && <Badge className="bg-amber-500 text-[11px] h-5">{yellowCount} 黄</Badge>}
            </CardTitle>
            <button onClick={onGoAlerts} className="text-xs text-brand-mid hover:text-brand-bright flex items-center gap-0.5 group transition-colors">
              查看全部 <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </CardHeader>
          <CardContent className="space-y-2">
            {openAlerts.length === 0 && (
              <div className="py-8 text-center">
                <div className="inline-flex w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm text-muted-foreground">当前无未处理预警，工程按计划推进</p>
              </div>
            )}
            {openAlerts.slice(0, 6).map(a => (
              <div key={a.key} className={`text-sm rounded-lg p-2.5 border-l-4 ${
                a.level === 'red' ? 'bg-gradient-to-r from-red-50 to-red-50/30 border-red-500'
                : 'bg-gradient-to-r from-amber-50 to-amber-50/30 border-amber-400'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{a.taskName}</span>
                  <span className="text-[11px] text-muted-foreground">（{a.section.split('、')[0]}）</span>
                  {a.impactGrid && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">波及并网</Badge>}
                </div>
                <p className={`text-xs mt-1 ${a.level === 'red' ? 'text-red-700' : 'text-amber-700'}`}>
                  {a.reason}
                </p>
              </div>
            ))}
            {openAlerts.length > 6 && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">另有 {openAlerts.length - 6} 条…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 各部位进度 */}
      <Card className="border-slate-200/70 shadow-sm animate-fade-up">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-mid" />各施工部位进度
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">共 {seed.sections.length} 个部位</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            {seed.sections.map(s => {
              const p = sectionProgress(s, state.actuals);
              const tone = p >= 80 ? 'from-emerald-400 to-emerald-500' : p >= 40 ? 'from-brand-bright to-brand-mid' : 'from-amber-400 to-amber-500';
              return (
                <div key={s.name} className="flex items-center gap-2.5 text-sm group">
                  <span className="w-40 truncate text-xs group-hover:text-brand-mid transition-colors" title={s.name}>{s.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all duration-700`} style={{ width: `${p}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold tabular-nums">{p}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

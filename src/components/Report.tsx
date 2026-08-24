// 周进度报告自动生成
import { useEffect, useMemo, useState } from 'react';
import { useStore, seed } from '@/lib/store';
import { allTasks, taskStatus, overallProgress, buildAlerts, today, toDate, addDays, fmtCN, diffDays } from '@/lib/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCopy, Download, RotateCcw, FileText, Calendar } from 'lucide-react';

export default function Report() {
  const { state } = useStore();
  const now = today();
  const weekAgo = addDays(now, -7);
  const nextWeek = addDays(now, 7);
  const [copied, setCopied] = useState(false);
  const [editedReport, setEditedReport] = useState('');
  const [isEdited, setIsEdited] = useState(false);

  const report = useMemo(() => {
    const tasks = allTasks(seed);
    const ov = overallProgress(seed, state.actuals, now);
    const alerts = buildAlerts(seed, state.actuals, state.closedAlerts, now).filter(a => !a.closed);

    const doneThisWeek = tasks.filter(({ task }) => {
      const ae = toDate(state.actuals[task.id]?.actualEnd);
      return ae && ae >= weekAgo && ae <= now;
    });
    const activeThisWeek = tasks.filter(({ task }) => {
      const act = state.actuals[task.id];
      if (!act || act.actualEnd) return false;
      const us = act.updatedAt ? new Date(act.updatedAt) : null;
      return (act.progress > 0 || act.actualStart) && us && us >= weekAgo;
    });
    const delayed = tasks.filter(({ task }) => taskStatus(task, state.actuals[task.id], now) === 'delayed');
    const nextPlan = tasks.filter(({ task }) => {
      const ps = toDate(task.planStart), pe = toDate(task.planEnd);
      if (!ps || !pe) return false;
      const st = taskStatus(task, state.actuals[task.id], now);
      if (st === 'done' || st === 'done-late') return false;
      return ps <= nextWeek && pe >= now;
    });

    const L: string[] = [];
    L.push(`大密扣升压站工程进度周报`);
    L.push(`报告日期：${now.toLocaleDateString('zh-CN')}`);
    L.push(``);
    L.push(`一、总体进展`);
    L.push(`项目总进度：实际 ${ov.actual}%，计划应完成 ${ov.plan}%${ov.actual >= ov.plan ? '，进度满足计划要求' : `，落后计划 ${(ov.plan - ov.actual).toFixed(1)}%`}。`);
    L.push(`距11月20日并网节点剩余 ${Math.max(0, diffDays(now, toDate(seed.gridDate)!))} 天。`);
    L.push(``);
    L.push(`二、本周完成工作（${doneThisWeek.length}项）`);
    if (doneThisWeek.length === 0) L.push(`无`);
    doneThisWeek.forEach(({ task, section }) => L.push(`· ${task.name}（${section.split('、')[0]}）`));
    L.push(``);
    L.push(`三、本周推进中工作（${activeThisWeek.length}项）`);
    if (activeThisWeek.length === 0) L.push(`无`);
    activeThisWeek.forEach(({ task, section }) => {
      const p = state.actuals[task.id]?.progress ?? 0;
      L.push(`· ${task.name}（${section.split('、')[0]}）—— 完成${p}%`);
    });
    L.push(``);
    L.push(`四、存在问题与预警（${alerts.length}条）`);
    if (alerts.length === 0) L.push(`本周无预警，工程按计划推进。`);
    alerts.forEach(a => L.push(`·【${a.level === 'red' ? '红' : '黄'}】${a.taskName}：${a.reason}${a.impactGrid ? '（波及并网节点）' : ''}`));
    if (delayed.length > 0) {
      L.push(``);
      L.push(`五、赶工要求`);
      L.push(`请施工单位针对上述延期任务制定赶工措施，增加资源投入，确保后续工序及并网节点不受影响。`);
    }
    L.push(``);
    L.push(`${delayed.length > 0 ? '六' : '五'}、下周工作计划（${nextPlan.length}项）`);
    nextPlan.forEach(({ task, section }) => {
      L.push(`· ${task.name}（${section.split('、')[0]}）：${fmtCN(toDate(task.planStart))}~${fmtCN(toDate(task.planEnd))}`);
    });
    return L.join('\n');
  }, [state.actuals, state.closedAlerts]);

  useEffect(() => {
    if (!isEdited) {
      setEditedReport(report);
    }
  }, [report, isEdited]);

  const copy = () => {
    navigator.clipboard.writeText(editedReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setCopied(false);
    });
  };
  const download = () => {
    const blob = new Blob([editedReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `大密扣升压站进度周报_${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-slate-200 shadow-sm animate-fade-up">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          周进度报告
          <span className="text-[11px] font-normal text-muted-foreground">（自动生成，可编辑）</span>
        </CardTitle>
        <div className="flex gap-2">
          {isEdited && (
            <Button size="sm" variant="ghost" className="hover:text-brand-mid" onClick={() => { setEditedReport(report); setIsEdited(false); }}>
              <RotateCcw className="w-4 h-4 mr-1" />恢复自动生成
            </Button>
          )}
          <Button size="sm" variant="outline" className="hover:border-brand-mid hover:text-brand-mid" onClick={copy}>
            <ClipboardCopy className="w-4 h-4 mr-1" />{copied ? '已复制' : '复制'}
          </Button>
          <Button size="sm" className="bg-brand-gradient shadow-md shadow-brand-mid/30" onClick={download}>
            <Download className="w-4 h-4 mr-1" />下载
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-mid" />
          报告日期 <b className="text-foreground tabular-nums">{now.toLocaleDateString('zh-CN')}</b> · 数据周期：本周（{weekAgo.toLocaleDateString('zh-CN')} ~ {now.toLocaleDateString('zh-CN')}）
        </div>
        <Textarea
          value={editedReport}
          onChange={e => { setEditedReport(e.target.value); setIsEdited(true); }}
          rows={28}
          className="font-mono text-sm whitespace-pre bg-slate-50/50 leading-relaxed resize-none focus-visible:bg-white border-slate-200"
        />
      </CardContent>
    </Card>
  );
}

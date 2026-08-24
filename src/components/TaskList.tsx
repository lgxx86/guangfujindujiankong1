// 任务清单：筛选 + 填报入口
import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '@/types';
import { useStore, seed } from '@/lib/store';
import { allTasks, taskStatus, STATUS_LABEL, today, toDate, fmtCN, delayDays } from '@/lib/analysis';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PenLine, Search, Filter, Layers } from 'lucide-react';

const statusColor: Record<TaskStatus, string> = {
  'not-started': 'bg-slate-100 text-slate-600',
  'on-track': 'bg-sky-100 text-sky-700',
  'delayed': 'bg-red-100 text-red-700',
  'done': 'bg-emerald-100 text-emerald-700',
  'done-late': 'bg-amber-100 text-amber-700',
};

const statusDot: Record<TaskStatus, string> = {
  'not-started': 'bg-slate-400',
  'on-track': 'bg-sky-500',
  'delayed': 'bg-red-500',
  'done': 'bg-emerald-500',
  'done-late': 'bg-amber-500',
};

export default function TaskList({ onEdit }: { onEdit: (task: Task, section: string) => void }) {
  const { state, role, pendingTaskIds } = useStore();
  const [secFilter, setSecFilter] = useState('all');
  const [stFilter, setStFilter] = useState('all');
  const [kw, setKw] = useState('');
  const now = today();

  const rows = useMemo(() => {
    return allTasks(seed).filter(({ task, section }) => {
      if (secFilter !== 'all' && section !== secFilter) return false;
      const st = taskStatus(task, state.actuals[task.id], now);
      if (stFilter !== 'all' && st !== stFilter) return false;
      if (kw && !task.name.includes(kw)) return false;
      return true;
    });
  }, [secFilter, stFilter, kw, state.actuals]);

  return (
    <div className="space-y-3">
      {/* 筛选条 */}
      <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter className="w-3.5 h-3.5" />筛选
        </div>
        <Select value={secFilter} onValueChange={setSecFilter}>
          <SelectTrigger className="w-52 h-9 bg-slate-50/80"><Layers className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="全部部位" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部施工部位</SelectItem>
            {seed.sections.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stFilter} onValueChange={setStFilter}>
          <SelectTrigger className="w-36 h-9 bg-slate-50/80"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="not-started">未开始</SelectItem>
            <SelectItem value="on-track">进行中</SelectItem>
            <SelectItem value="delayed">已延期</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
            <SelectItem value="done-late">延期完成</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="h-9 pl-9 bg-slate-50/80" placeholder="搜索任务名称…" value={kw} onChange={e => setKw(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground self-center ml-auto px-2 py-1 rounded-md bg-slate-50">共 <b className="text-brand-mid tabular-nums">{rows.length}</b> 项</span>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-auto max-h-[62vh] bg-white shadow-sm scrollbar-slim">
        <Table>
          <TableHeader className="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 z-10 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">状态</TableHead>
              <TableHead>施工任务</TableHead>
              <TableHead className="hidden md:table-cell">所属部位</TableHead>
              <TableHead className="whitespace-nowrap">计划开始</TableHead>
              <TableHead className="whitespace-nowrap">计划完成</TableHead>
              <TableHead className="w-14">工期</TableHead>
              <TableHead className="w-28">实际进度</TableHead>
              <TableHead className="hidden lg:table-cell">实际完成</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ task, section }) => {
              const act = state.actuals[task.id];
              const st = taskStatus(task, act, now);
              const dd = delayDays(task, act, now);
              const progress = act?.actualEnd ? 100 : (act?.progress ?? 0);
              return (
                <TableRow key={task.id} className={`group transition-colors ${st === 'delayed' ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50'}`}>
                  <TableCell>
                    <Badge className={`${statusColor[st]} border-0 text-xs whitespace-nowrap h-5`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot[st]} mr-1`} />
                      {STATUS_LABEL[st]}
                    </Badge>
                    {dd > 0 && st !== 'done' && <div className="text-[10px] text-red-600 mt-0.5 font-medium">超{dd}天</div>}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {task.milestone && <i className="w-2 h-2 rotate-45 bg-brand-glow shrink-0" />}
                      {task.name}
                    </span>
                    {task.remark && <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{task.remark}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-40 truncate" title={section}>{section}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap tabular-nums">{fmtCN(toDate(task.planStart))}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap tabular-nums">{fmtCN(toDate(task.planEnd))}</TableCell>
                  <TableCell className="text-xs tabular-nums">{task.duration ?? '—'}天</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden min-w-10">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          st === 'delayed' || st === 'done-late' ? 'bg-gradient-to-r from-red-400 to-red-500'
                          : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                          style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs w-9 tabular-nums font-medium">{progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs tabular-nums">{act?.actualEnd ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs hover:border-brand-mid hover:text-brand-mid hover:bg-brand-bright/5 transition-colors" onClick={() => onEdit(task, section)}>
                        <PenLine className="w-3 h-3 mr-1" />{role ? '填报' : '查看'}
                      </Button>
                      {pendingTaskIds.has(task.id) && <Badge className="bg-brand-bright text-white text-[10px] h-4 px-1.5">待审</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">无符合条件的任务</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

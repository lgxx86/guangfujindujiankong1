// 任务清单：筛选 + 填报入口
import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '@/types';
import { useStore } from '@/lib/store';
import { allTasks, taskStatus, STATUS_LABEL, today, toDate, fmtCN, delayDays } from '@/lib/analysis';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PenLine } from 'lucide-react';

const statusColor: Record<TaskStatus, string> = {
  'not-started': 'bg-slate-100 text-slate-600',
  'on-track': 'bg-blue-100 text-blue-700',
  'delayed': 'bg-red-100 text-red-700',
  'done': 'bg-green-100 text-green-700',
  'done-late': 'bg-amber-100 text-amber-700',
};

export default function TaskList({ onEdit }: { onEdit: (task: Task, section: string) => void }) {
  const { seed, state, role, pendingTaskIds } = useStore();
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
  }, [seed, secFilter, stFilter, kw, state.actuals]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={secFilter} onValueChange={setSecFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="全部部位" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部施工部位</SelectItem>
            {seed.sections.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stFilter} onValueChange={setStFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="not-started">未开始</SelectItem>
            <SelectItem value="on-track">进行中</SelectItem>
            <SelectItem value="delayed">已延期</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
            <SelectItem value="done-late">延期完成</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-48" placeholder="搜索任务名称…" value={kw} onChange={e => setKw(e.target.value)} />
        <span className="text-xs text-muted-foreground self-center ml-auto">共 {rows.length} 项</span>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[62vh]">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10">
            <TableRow>
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
                <TableRow key={task.id} className={st === 'delayed' ? 'bg-red-50/60' : ''}>
                  <TableCell>
                    <Badge className={`${statusColor[st]} border-0 text-xs whitespace-nowrap`}>{STATUS_LABEL[st]}</Badge>
                    {dd > 0 && st !== 'done' && <div className="text-xs text-red-600 mt-0.5">超{dd}天</div>}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1">
                      {task.milestone && <i className="w-2 h-2 rotate-45 bg-amber-500 shrink-0" />}
                      {task.name}
                    </span>
                    {task.remark && <div className="text-xs text-muted-foreground font-normal mt-0.5">{task.remark}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-40 truncate">{section}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtCN(toDate(task.planStart))}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtCN(toDate(task.planEnd))}</TableCell>
                  <TableCell className="text-xs">{task.duration ?? '—'}天</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 flex-1 bg-slate-200 rounded overflow-hidden min-w-10">
                        <div className={`h-full ${st === 'delayed' || st === 'done-late' ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs w-8">{progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{act?.actualEnd ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => onEdit(task, section)}>
                        <PenLine className="w-3 h-3 mr-1" />{role ? '填报' : '查看'}
                      </Button>
                      {pendingTaskIds.has(task.id) && <Badge className="bg-blue-600 text-xs">待审</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

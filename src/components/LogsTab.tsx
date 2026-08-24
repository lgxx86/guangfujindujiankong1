// 填报记录：全部填报及审核状态留痕
import { trpc } from '@/providers/trpc';
import { seed, useStore } from '@/lib/store';
import { allTasks } from '@/lib/analysis';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Inbox } from 'lucide-react';

const taskMap = new Map(allTasks(seed).map(x => [x.task.id, x]));

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending: { label: '待审核', cls: 'bg-brand-bright/10 text-brand-mid', dot: 'bg-brand-bright animate-pulse' },
  approved: { label: '已生效', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  rejected: { label: '已退回', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function LogsTab() {
  const { role } = useStore();
  const logsQ = trpc.progress.logs.useQuery();
  const mineQ = trpc.progress.mine.useQuery(undefined, { enabled: role === 'contractor' });

  const rows = role === 'contractor' ? (mineQ.data ?? []) : (logsQ.data ?? []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-md">
          <History className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold leading-tight">
            {role === 'contractor' ? '我的填报记录' : '全部填报记录'}
            <span className="ml-2 tabular-nums text-brand-mid">{rows.length}</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">所有填报及审核状态留痕</p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-auto max-h-[62vh] bg-white shadow-sm scrollbar-slim">
        <Table>
          <TableHeader className="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 z-10 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead>施工任务</TableHead>
              <TableHead className="w-20">进度</TableHead>
              <TableHead className="hidden md:table-cell">说明</TableHead>
              <TableHead className="hidden md:table-cell w-28">填报人</TableHead>
              <TableHead className="w-36">填报时间</TableHead>
              <TableHead className="w-24">审核状态</TableHead>
              <TableHead className="hidden lg:table-cell">审核意见</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => {
              const t = taskMap.get(r.taskId);
              const st = STATUS[r.status] ?? STATUS.pending;
              return (
                <TableRow key={r.id} className="transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium">
                    {t?.task.name ?? r.taskId}
                    <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{t?.section.split('、')[0]}</div>
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{r.progress}%</TableCell>
                  <TableCell className="hidden md:table-cell text-xs max-w-56 truncate" title={r.note ?? ''}>{r.note || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{'reporterName' in r ? (r as { reporterName?: string }).reporterName : '我'}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.createdAt instanceof Date ? r.createdAt.toLocaleString('zh-CN') : String(r.createdAt)}</TableCell>
                  <TableCell>
                    <Badge className={`${st.cls} border-0 text-[11px] h-5`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-48 truncate" title={r.reviewNote ?? ''}>{r.reviewNote || '—'}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12">
                <div className="inline-flex w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-2">
                  <Inbox className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-muted-foreground">暂无填报记录</p>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

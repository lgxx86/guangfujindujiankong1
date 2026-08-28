// 填报记录：全部填报及审核状态留痕
import { trpc } from '@/providers/trpc';
import { seed, useStore } from '@/lib/store';
import { allTasks } from '@/lib/analysis';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const taskMap = new Map(allTasks(seed).map(x => [x.task.id, x]));

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-blue-100 text-blue-700' },
  approved: { label: '已生效', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '已退回', cls: 'bg-red-100 text-red-700' },
};

export default function LogsTab() {
  const { role } = useStore();
  const logsQ = trpc.progress.logs.useQuery();
  const mineQ = trpc.progress.mine.useQuery(undefined, { enabled: role === 'contractor' });

  const rows = role === 'contractor' ? (mineQ.data ?? []) : (logsQ.data ?? []);

  return (
    <div className="space-y-3">
      <h3 className="font-bold">{role === 'contractor' ? '我的填报记录' : '全部填报记录'}（{rows.length}）</h3>
      <div className="border rounded-lg overflow-auto max-h-[62vh]">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10">
            <TableRow>
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
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {t?.task.name ?? r.taskId}
                    <div className="text-xs text-muted-foreground font-normal">{t?.section.split('、')[0]}</div>
                  </TableCell>
                  <TableCell>{r.progress}%</TableCell>
                  <TableCell className="hidden md:table-cell text-xs max-w-56 truncate" title={r.note ?? ''}>{r.note || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{'reporterName' in r ? (r as { reporterName?: string }).reporterName : '我'}</TableCell>
                  <TableCell className="text-xs">{r.createdAt instanceof Date ? r.createdAt.toLocaleString('zh-CN') : String(r.createdAt)}</TableCell>
                  <TableCell><Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-48 truncate" title={r.reviewNote ?? ''}>{r.reviewNote || '—'}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无填报记录</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

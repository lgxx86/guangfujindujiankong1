// 审核中心：监理/业主审核施工方填报
import { useState, useMemo } from 'react';
import { trpc } from '@/providers/trpc';
import { ROLE_LABEL, useStore } from '@/lib/store';
import { allTasks } from '@/lib/analysis';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, ClipboardCheck, User } from 'lucide-react';

export default function ReviewCenter() {
  const utils = trpc.useUtils();
  const { seed, role } = useStore();
  const pendingQ = trpc.progress.pending.useQuery();
  const reviewM = trpc.progress.review.useMutation({
    onSuccess: () => {
      utils.progress.pending.invalidate();
      utils.progress.pendingCount.invalidate();
      utils.progress.states.invalidate();
      utils.progress.logs.invalidate();
      utils.progress.mine.invalidate();
    },
  });
  const [notes, setNotes] = useState<Record<number, string>>({});

  const taskMap = useMemo(() => new Map(allTasks(seed).map(x => [x.task.id, x])), [seed]);

  if (role !== 'owner' && role !== 'supervisor') {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">审核中心仅对业主方、监理方开放</CardContent></Card>;
  }

  const list = pendingQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold">待审核填报 {list.length} 条</h3>
        <span className="text-xs text-muted-foreground">审核通过后填报生效并计入工程进度</span>
      </div>

      {list.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">✓ 暂无待审核的进度填报</CardContent></Card>
      )}

      {list.map(r => {
        const t = taskMap.get(r.taskId);
        return (
          <Card key={r.id} className="border-l-4 border-l-blue-400">
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{t?.task.name ?? r.taskId}</span>
                <Badge variant="outline" className="text-xs">{t?.section.split('、')[0]}</Badge>
                <Badge className="bg-blue-600 text-xs">进度 {r.progress}%</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{r.reporterName}（施工方）</span>
                <span>{r.createdAt instanceof Date ? r.createdAt.toLocaleString('zh-CN') : String(r.createdAt)}</span>
                {r.actualStart && <span>实际开工：{r.actualStart}</span>}
                {r.actualEnd && <span>实际完工：{r.actualEnd}</span>}
              </div>
              {r.note && <p className="text-sm bg-slate-50 rounded p-2">说明：{r.note}</p>}
              {r.photo && <img src={r.photo} alt="现场照片" className="rounded max-h-36 border" />}
              <div className="flex items-center gap-2">
                <Textarea
                  placeholder="审核意见（选填）"
                  rows={1}
                  className="text-sm"
                  value={notes[r.id] ?? ''}
                  onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                />
                <Button size="sm" className="shrink-0 bg-green-600 hover:bg-green-700"
                  disabled={reviewM.isPending}
                  onClick={() => reviewM.mutate({ reportId: r.id, approve: true, reviewNote: notes[r.id] ?? '' })}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />通过
                </Button>
                <Button size="sm" variant="destructive" className="shrink-0"
                  disabled={reviewM.isPending}
                  onClick={() => reviewM.mutate({ reportId: r.id, approve: false, reviewNote: notes[r.id] ?? '填报内容与实际不符，请核实后重新填报' })}>
                  <XCircle className="w-4 h-4 mr-1" />退回
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-slate-50">
        <CardContent className="py-3 text-xs text-muted-foreground">
          协同流程：施工方填报 → {ROLE_LABEL.supervisor}/{ROLE_LABEL.owner}审核 → 通过后生效计入进度；被退回的填报不计入进度，施工方需重新填报。业主/监理填报直接生效。
        </CardContent>
      </Card>
    </div>
  );
}

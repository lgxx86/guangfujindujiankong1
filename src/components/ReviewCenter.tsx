// 审核中心：监理/业主审核施工方填报
import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { seed, ROLE_LABEL, useStore } from '@/lib/store';
import { allTasks } from '@/lib/analysis';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, ClipboardCheck, User, ShieldCheck, Clock, Calendar, Inbox, Info } from 'lucide-react';

const taskMap = new Map(allTasks(seed).map(x => [x.task.id, x]));

export default function ReviewCenter() {
  const utils = trpc.useUtils();
  const { role } = useStore();
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

  if (role !== 'owner' && role !== 'supervisor') {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-16 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-base font-medium text-foreground">权限不足</p>
          <p className="text-sm text-muted-foreground mt-1">审核中心仅对业主方、监理方开放</p>
        </CardContent>
      </Card>
    );
  }

  const list = pendingQ.data ?? [];

  return (
    <div className="space-y-3">
      {/* 标题区 */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-md">
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold leading-tight flex items-center gap-2">
            待审核填报 <span className="tabular-nums text-brand-mid">{list.length}</span> 条
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">审核通过后填报生效并计入工程进度</p>
        </div>
      </div>

      {list.length === 0 && (
        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="inline-flex w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
              <Inbox className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-base font-medium text-foreground">暂无待审核的进度填报</p>
            <p className="text-xs text-muted-foreground mt-1">所有施工方填报均已处理完毕</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2.5">
        {list.map((r, i) => {
          const t = taskMap.get(r.taskId);
          return (
            <Card key={r.id} className="border-l-4 border-l-brand-bright border-slate-200 lift-card animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <CardContent className="py-3.5 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{t?.task.name ?? r.taskId}</span>
                  <Badge variant="outline" className="text-[11px] h-5">{t?.section.split('、')[0]}</Badge>
                  <Badge className="bg-brand-gradient text-[11px] h-5">进度 {r.progress}%</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{r.reporterName}（施工方）</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{r.createdAt instanceof Date ? r.createdAt.toLocaleString('zh-CN') : String(r.createdAt)}</span>
                  {r.actualStart && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />实际开工：{r.actualStart}</span>}
                  {r.actualEnd && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />实际完工：{r.actualEnd}</span>}
                </div>
                {r.note && (
                  <p className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-muted-foreground">说明：</span>{r.note}
                  </p>
                )}
                {r.photo && <img src={r.photo} alt="现场照片" className="rounded-lg max-h-40 border border-slate-200 shadow-sm" />}
                <div className="flex items-center gap-2">
                  <Textarea
                    placeholder="审核意见（选填）"
                    rows={1}
                    className="text-sm bg-slate-50/80 resize-none focus-visible:bg-white"
                    value={notes[r.id] ?? ''}
                    onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                  />
                  <Button size="sm" className="shrink-0 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/30"
                    disabled={reviewM.isPending}
                    onClick={() => reviewM.mutate({ reportId: r.id, approve: true, reviewNote: notes[r.id] ?? '' })}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />通过
                  </Button>
                  <Button size="sm" variant="destructive" className="shrink-0 shadow-md shadow-red-500/30"
                    disabled={reviewM.isPending}
                    onClick={() => reviewM.mutate({ reportId: r.id, approve: false, reviewNote: notes[r.id] ?? '填报内容与实际不符，请核实后重新填报' })}>
                    <XCircle className="w-4 h-4 mr-1" />退回
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-mid" />
          <span>协同流程：施工方填报 → {ROLE_LABEL.supervisor}/{ROLE_LABEL.owner}审核 → 通过后生效计入进度；被退回的填报不计入进度，施工方需重新填报。业主/监理填报直接生效。</span>
        </CardContent>
      </Card>
    </div>
  );
}

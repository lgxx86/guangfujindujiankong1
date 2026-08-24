// 任务详情与进度填报对话框
import { useEffect, useState } from 'react';
import type { Task } from '@/types';
import { useStore, seed, ROLE_LABEL } from '@/lib/store';
import { trpc } from '@/providers/trpc';
import { taskStatus, STATUS_LABEL, propagation, allTasks, fmtCN, toDate, delayDays, today } from '@/lib/analysis';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, GitBranch, Camera, Trash2, Calendar, Clock, Flag, Save } from 'lucide-react';

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export default function TaskDialog({ task, section, open, onClose }: {
  task: Task | null; section: string; open: boolean; onClose: () => void;
}) {
  const { state, updateTask, role, pendingTaskIds } = useStore();
  const [progress, setProgress] = useState(0);
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);

  const reportId = task ? state.actuals[task.id]?.reportId : undefined;
  const photoQ = trpc.progress.getPhoto.useQuery(
    { reportId: reportId! },
    { enabled: open && !!reportId, staleTime: 0 },
  );

  useEffect(() => {
    if (task) {
      const act = state.actuals[task.id];
      setProgress(act?.progress ?? 0);
      setActualStart(act?.actualStart ?? '');
      setActualEnd(act?.actualEnd ?? '');
      setNote(act?.note ?? '');
      setPhoto(null);
      setPhotoDirty(false);
    }
  }, [task, state.actuals, open]);

  useEffect(() => {
    if (!photoDirty && photoQ.data) {
      setPhoto(photoQ.data.photo);
    }
  }, [photoQ.data, photoDirty]);

  if (!task) return null;
  const now = today();
  const act = state.actuals[task.id];
  const status = taskStatus(task, act, now);
  const dd = delayDays(task, act, now);
  const prop = propagation(seed, task.id);
  const taskMap = new Map(allTasks(seed).map(x => [x.task.id, x]));
  const predNames = task.deps.map(id => taskMap.get(id)?.task.name ?? id);
  const affectedNames = prop.affected.slice(0, 8).map(id => taskMap.get(id)?.task.name ?? id);

  const readOnly = !role;
  const hasPending = pendingTaskIds.has(task.id);

  const save = () => {
    updateTask(task.id, {
      progress,
      actualStart: actualStart || null,
      actualEnd: actualEnd || (progress >= 100 ? new Date().toISOString().slice(0, 10) : null),
      note, photo,
    }, note);
    if (role === 'contractor') {
      toast.success('填报已提交，待监理/业主审核后生效');
    } else {
      toast.success('已保存并生效');
    }
    onClose();
  };

  const STATUS_CLS: Record<string, string> = {
    'done': 'bg-emerald-500',
    'done-late': 'bg-amber-500',
    'on-track': 'bg-sky-500',
    'delayed': 'bg-red-500',
    'not-started': 'bg-slate-400',
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap text-lg">
            <span className="font-bold">{task.name}</span>
            {task.milestone && <Badge className="bg-brand-glow text-white border-0 h-5"><Flag className="w-3 h-3 mr-1" />里程碑</Badge>}
            <Badge variant={status === 'delayed' ? 'destructive' : status === 'done' ? 'default' : 'secondary'} className="border-0 h-5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_CLS[status] ?? 'bg-slate-400'} mr-1`} />
              {STATUS_LABEL[status]}
            </Badge>
            {hasPending && <Badge className="bg-brand-bright text-white border-0 h-5">有待审核填报</Badge>}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{section}</p>
        </DialogHeader>

        {/* 计划信息卡 */}
        <div className="grid grid-cols-3 gap-2 text-sm bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />计划开始</span>
            <span className="font-medium tabular-nums mt-0.5">{fmtCN(toDate(task.planStart))}</span>
          </div>
          <div className="flex flex-col border-x border-slate-200 px-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />工期</span>
            <span className="font-medium tabular-nums mt-0.5">{task.duration ?? '—'} 天</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Flag className="w-3 h-3" />计划完成</span>
            <span className="font-medium tabular-nums mt-0.5">{fmtCN(toDate(task.planEnd))}</span>
          </div>
        </div>

        {task.remark && (
          <p className="text-xs text-muted-foreground bg-amber-50/50 border border-amber-200/50 rounded-lg px-2.5 py-1.5">
            备注：{task.remark}
          </p>
        )}

        {dd > 0 && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-gradient-to-r from-red-50 to-red-50/30 border border-red-200 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span>已延期 <b className="tabular-nums">{dd}</b> 天</span>
              {prop.hitsGrid && <b className="text-red-700">（影响并网节点！）</b>}
            </div>
          </div>
        )}

        {(predNames.length > 0 || affectedNames.length > 0) && (
          <div className="text-xs space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
            <div className="flex items-center gap-1 text-muted-foreground font-medium"><GitBranch className="w-3 h-3" />工序衔接</div>
            {predNames.length > 0 && <p className="text-foreground"><span className="text-muted-foreground">前置工序：</span>{predNames.join('、')}</p>}
            {affectedNames.length > 0 && (
              <p className={prop.hitsGrid ? 'text-red-600' : 'text-foreground'}>
                <span className="text-muted-foreground">若本任务延期将影响：</span>{affectedNames.join('、')}{prop.affected.length > 8 ? ` 等${prop.affected.length}项` : ''}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 border-t border-slate-200 pt-3">
          {hasPending && (
            <p className="text-xs bg-brand-bright/10 text-brand-mid rounded-lg p-2 flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-bright mt-1 animate-pulse shrink-0" />
              本任务有一条填报正在审核中，审核通过后进度才会更新。
            </p>
          )}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-medium">完成进度</span>
              <span className="font-bold text-brand-mid tabular-nums text-base">{progress}%</span>
            </div>
            <Slider value={[progress]} onValueChange={v => setProgress(v[0])} max={100} step={5} disabled={readOnly} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">实际开始日期</label>
              <Input type="date" value={actualStart} onChange={e => setActualStart(e.target.value)} disabled={readOnly} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">实际完成日期</label>
              <Input type="date" value={actualEnd} onChange={e => setActualEnd(e.target.value)} disabled={readOnly} className="h-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">现场情况说明</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="如：受降雨影响暂停2天…" disabled={readOnly} className="bg-slate-50/50 resize-none focus-visible:bg-white" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Camera className="w-3.5 h-3.5" />现场照片（选填）</label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="file" accept="image/*" disabled={readOnly} onChange={async e => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhoto(await compressPhoto(f));
                  setPhotoDirty(true);
                }
              }} className="text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:bg-brand-bright/10 file:text-brand-mid hover:file:bg-brand-bright/20" />
              {photo && !readOnly && (
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-50" onClick={() => { setPhoto(null); setPhotoDirty(true); }}><Trash2 className="w-4 h-4" /></Button>
              )}
            </div>
            {photo && <img src={photo} alt="现场照片" className="mt-2 rounded-lg max-h-40 border border-slate-200 shadow-sm" />}
          </div>
          {readOnly ? (
            <p className="text-center text-sm text-muted-foreground bg-slate-100 rounded-lg p-2.5">
              您当前为只读用户，请联系业主分配项目角色后填报
            </p>
          ) : (
            <Button className="w-full h-10 bg-brand-gradient shadow-md shadow-brand-mid/30 hover:brightness-110 transition-all" onClick={save}>
              <Save className="w-4 h-4 mr-1.5" />
              {role === 'contractor' ? '提交填报（待监理/业主审核）' : `保存填报（${ROLE_LABEL[role ?? '']}直接生效）`}
            </Button>
          )}
          {act?.updatedAt && <p className="text-[11px] text-muted-foreground text-center tabular-nums">最近更新：{new Date(act.updatedAt).toLocaleString('zh-CN')}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

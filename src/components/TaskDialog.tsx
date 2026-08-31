// 任务详情与进度填报对话框
import { useEffect, useState } from 'react';
import type { Task } from '@/types';
import { useStore, ROLE_LABEL } from '@/lib/store';
import { trpc } from '@/providers/trpc';
import { taskStatus, STATUS_LABEL, propagation, allTasks, fmtCN, toDate, delayDays, today } from '@/lib/analysis';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, GitBranch, Camera, Trash2 } from 'lucide-react';

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
  const { seed, state, updateTask, role, pendingTaskIds } = useStore();
  const [progress, setProgress] = useState(0);
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoDirty, setPhotoDirty] = useState(false);

  // 获取当前任务的已审核填报 ID，用于按需加载照片
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

  // 照片按需加载：仅在用户未手动修改时同步服务器数据
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{task.name}</span>
            {task.milestone && <Badge className="bg-amber-500">里程碑</Badge>}
            <Badge variant={status === 'delayed' ? 'destructive' : status === 'done' ? 'default' : 'secondary'}>
              {STATUS_LABEL[status]}
            </Badge>
            {hasPending && <Badge className="bg-blue-600">有待审核填报</Badge>}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{section}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-sm bg-slate-50 rounded-lg p-3">
          <div><span className="text-muted-foreground">计划开始</span><br />{fmtCN(toDate(task.planStart))}</div>
          <div><span className="text-muted-foreground">工期</span><br />{task.duration ?? '—'} 天</div>
          <div><span className="text-muted-foreground">计划完成</span><br />{fmtCN(toDate(task.planEnd))}</div>
        </div>
        {task.remark && <p className="text-xs text-muted-foreground">备注：{task.remark}</p>}
        {dd > 0 && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded p-2">
            <AlertTriangle className="w-4 h-4" /> 已延期 {dd} 天
            {prop.hitsGrid && <b>（影响并网节点！）</b>}
          </div>
        )}

        {(predNames.length > 0 || affectedNames.length > 0) && (
          <div className="text-xs space-y-1 border rounded p-2">
            <div className="flex items-center gap-1 text-muted-foreground"><GitBranch className="w-3 h-3" />工序衔接</div>
            {predNames.length > 0 && <p>前置工序：{predNames.join('、')}</p>}
            {affectedNames.length > 0 && (
              <p className={prop.hitsGrid ? 'text-red-600' : ''}>
                若本任务延期将影响：{affectedNames.join('、')}{prop.affected.length > 8 ? ` 等${prop.affected.length}项` : ''}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 border-t pt-3">
          {hasPending && (
            <p className="text-xs bg-blue-50 text-blue-700 rounded p-2">
              本任务有一条填报正在审核中，审核通过后进度才会更新。
            </p>
          )}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">完成进度</span><span className="font-bold text-blue-600">{progress}%</span>
            </div>
            <Slider value={[progress]} onValueChange={v => setProgress(v[0])} max={100} step={5} disabled={readOnly} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">实际开始日期</label>
              <Input type="date" value={actualStart} onChange={e => setActualStart(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">实际完成日期</label>
              <Input type="date" value={actualEnd} onChange={e => setActualEnd(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">现场情况说明</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="如：受降雨影响暂停2天…" disabled={readOnly} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground flex items-center gap-1"><Camera className="w-4 h-4" />现场照片（选填）</label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="file" accept="image/*" disabled={readOnly} onChange={async e => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhoto(await compressPhoto(f));
                  setPhotoDirty(true);
                }
              }} className="text-xs" />
              {photo && !readOnly && (
                <Button variant="ghost" size="icon" onClick={() => { setPhoto(null); setPhotoDirty(true); }}><Trash2 className="w-4 h-4" /></Button>
              )}
            </div>
            {photo && <img src={photo} alt="现场照片" className="mt-2 rounded max-h-40 border" />}
          </div>
          {readOnly ? (
            <p className="text-center text-sm text-muted-foreground bg-slate-100 rounded p-2">
              您当前为只读用户，请联系业主分配项目角色后填报
            </p>
          ) : (
            <Button className="w-full" onClick={save}>
              {role === 'contractor' ? '提交填报（待监理/业主审核）' : `保存填报（${ROLE_LABEL[role ?? '']}直接生效）`}
            </Button>
          )}
          {act?.updatedAt && <p className="text-xs text-muted-foreground text-center">最近更新：{new Date(act.updatedAt).toLocaleString('zh-CN')}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

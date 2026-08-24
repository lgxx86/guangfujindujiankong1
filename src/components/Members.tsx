// 成员与角色管理（仅业主）—— 自有服务器部署版：含账号创建与密码重置
import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { useStore, ROLE_LABEL } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, UserPlus, KeyRound, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_GRADIENT: Record<string, string> = {
  owner: 'from-amber-400 to-amber-600',
  supervisor: 'from-sky-400 to-sky-600',
  contractor: 'from-emerald-400 to-emerald-600',
};

export default function Members() {
  const { role } = useStore();
  const utils = trpc.useUtils();
  const listQ = trpc.member.list.useQuery(undefined, { enabled: role === 'owner', retry: false });
  const setM = trpc.member.setRole.useMutation({
    onSuccess: () => {
      utils.member.list.invalidate();
      utils.member.myRole.invalidate();
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', password: '', projectRole: 'contractor' as 'owner' | 'supervisor' | 'contractor' });
  const createM = trpc.localAuth.createUser.useMutation({
    onSuccess: () => {
      toast.success('账号创建成功');
      setCreateOpen(false);
      setForm({ username: '', name: '', password: '', projectRole: 'contractor' });
      utils.member.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const resetM = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success('密码已重置');
      setResetTarget(null);
      setNewPwd('');
    },
    onError: e => toast.error(e.message),
  });

  if (role !== 'owner') {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="py-16 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-base font-medium text-foreground">权限不足</p>
          <p className="text-sm text-muted-foreground mt-1">成员管理仅对业主方开放</p>
        </CardContent>
      </Card>
    );
  }

  const list = listQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-md">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold leading-tight flex items-center gap-2">
            项目成员 <span className="tabular-nums text-brand-mid">{list.length}</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">在此创建登录账号并分配项目角色</p>
        </div>
        <Button size="sm" className="bg-brand-gradient shadow-md shadow-brand-mid/30" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" />创建账号
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0 divide-y divide-slate-100">
          {list.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3.5 flex-wrap hover:bg-slate-50 transition-colors">
              <Avatar className="w-10 h-10 ring-2 ring-white shadow-sm">
                {m.avatar && <AvatarImage src={m.avatar} />}
                <AvatarFallback className={`bg-gradient-to-br ${ROLE_GRADIENT[m.projectRole ?? ''] ?? 'from-slate-400 to-slate-500'} text-white text-sm font-medium`}>
                  {m.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{m.name}</span>
                  {m.isAdmin && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">系统管理员</Badge>}
                  {m.projectRole && (
                    <Badge className={`bg-gradient-to-r ${ROLE_GRADIENT[m.projectRole]} text-white text-[10px] h-4 px-1.5 border-0`}>
                      {ROLE_LABEL[m.projectRole]}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {m.lastSignInAt ? `最近登录 ${new Date(m.lastSignInAt).toLocaleDateString('zh-CN')}` : '尚未登录'}
                </div>
              </div>
              <Button size="icon" variant="ghost" title="重置密码" className="h-8 w-8 hover:text-brand-mid hover:bg-brand-bright/10"
                onClick={() => setResetTarget({ id: m.id, name: m.name })}>
                <KeyRound className="w-4 h-4" />
              </Button>
              <Select
                value={m.projectRole ?? 'none'}
                onValueChange={v => {
                  if (v !== 'none') setM.mutate({ userId: m.id, role: v as 'owner' | 'supervisor' | 'contractor' });
                }}
              >
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>未分配角色</SelectItem>
                  <SelectItem value="owner">{ROLE_LABEL.owner}</SelectItem>
                  <SelectItem value="supervisor">{ROLE_LABEL.supervisor}</SelectItem>
                  <SelectItem value="contractor">{ROLE_LABEL.contractor}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
          {list.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">暂无成员，请点击右上角「创建账号」</div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-brand-mid" />角色权限说明</p>
          <p><b className="text-amber-600">{ROLE_LABEL.owner}</b>：查看全部进度，填报直接生效，审核填报，预警闭环，创建账号与分配角色。</p>
          <p><b className="text-sky-600">{ROLE_LABEL.supervisor}</b>：查看全部进度，填报直接生效，审核施工方填报，预警闭环。</p>
          <p><b className="text-emerald-600">{ROLE_LABEL.contractor}</b>：查看全部进度，填报进度（需监理/业主审核后生效），查看自己填报的审核结果。</p>
          <p className="text-slate-500">未分配角色的登录用户：只读查看，不能填报。</p>
        </CardContent>
      </Card>

      {/* 创建账号对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
                <UserPlus className="w-3.5 h-3.5 text-white" />
              </div>
              创建登录账号
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">姓名</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：张三" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">用户名（登录用，字母/数字/下划线）</label>
              <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="如：zhangsan" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">初始密码（至少8位）</label>
              <Input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="建议包含字母+数字+符号" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">项目角色</label>
              <Select value={form.projectRole} onValueChange={v => setForm(p => ({ ...p, projectRole: v as typeof p.projectRole }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">{ROLE_LABEL.contractor}</SelectItem>
                  <SelectItem value="supervisor">{ROLE_LABEL.supervisor}</SelectItem>
                  <SelectItem value="owner">{ROLE_LABEL.owner}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={createM.isPending || !form.name || !form.username || form.password.length < 8}
              onClick={() => createM.mutate(form)} className="bg-brand-gradient">
              {createM.isPending ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={!!resetTarget} onOpenChange={v => !v && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-mid" />重置密码
            </DialogTitle>
            <p className="text-sm text-muted-foreground font-normal">为「{resetTarget?.name}」重置登录密码</p>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">新密码（至少8位）</label>
            <Input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="请输入新密码" className="h-10" type="password" />
            {newPwd.length > 0 && newPwd.length < 8 && (
              <p className="text-[11px] text-amber-600">密码长度不足 8 位</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>取消</Button>
            <Button disabled={resetM.isPending || newPwd.length < 8}
              onClick={() => resetTarget && resetM.mutate({ userId: resetTarget.id, newPassword: newPwd })}
              className="bg-brand-gradient">
              {resetM.isPending ? '重置中…' : '确认重置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

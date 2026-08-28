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
import { Users, UserPlus, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

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

  // 创建账号
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

  // 重置密码
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
    return <Card><CardContent className="py-10 text-center text-muted-foreground">成员管理仅对业主方开放</CardContent></Card>;
  }

  const list = listQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold">项目成员（{list.length}）</h3>
        <span className="text-xs text-muted-foreground">在此创建登录账号并分配项目角色</span>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" />创建账号
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {list.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 flex-wrap">
              <Avatar className="w-9 h-9">
                {m.avatar && <AvatarImage src={m.avatar} />}
                <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{m.name}</span>
                  {m.isAdmin && <Badge variant="secondary" className="text-xs">系统管理员</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.lastSignInAt ? `最近登录 ${new Date(m.lastSignInAt).toLocaleDateString('zh-CN')}` : '尚未登录'}
                </div>
              </div>
              <Button size="sm" variant="ghost" title="重置密码"
                onClick={() => setResetTarget({ id: m.id, name: m.name })}>
                <KeyRound className="w-4 h-4" />
              </Button>
              <Select
                value={m.projectRole ?? 'none'}
                onValueChange={v => {
                  if (v !== 'none') setM.mutate({ userId: m.id, role: v as 'owner' | 'supervisor' | 'contractor' });
                }}
              >
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
            <div className="p-8 text-center text-muted-foreground text-sm">暂无成员，请点击右上角「创建账号」</div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-50">
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
          <p><b>{ROLE_LABEL.owner}</b>：查看全部进度，填报直接生效，审核填报，预警闭环，创建账号与分配角色。</p>
          <p><b>{ROLE_LABEL.supervisor}</b>：查看全部进度，填报直接生效，审核施工方填报，预警闭环。</p>
          <p><b>{ROLE_LABEL.contractor}</b>：查看全部进度，填报进度（需监理/业主审核后生效），查看自己填报的审核结果。</p>
          <p>未分配角色的登录用户：只读查看，不能填报。</p>
        </CardContent>
      </Card>

      {/* 创建账号对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>创建登录账号</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">姓名</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：张三" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">用户名（登录用，字母/数字/下划线）</label>
              <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="如：zhangsan" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">初始密码（至少8位）</label>
              <Input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="建议包含字母+数字+符号" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">项目角色</label>
              <Select value={form.projectRole} onValueChange={v => setForm(p => ({ ...p, projectRole: v as typeof p.projectRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Button disabled={createM.isPending} onClick={() => createM.mutate(form)}>
              {createM.isPending ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={!!resetTarget} onOpenChange={v => !v && setResetTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>重置「{resetTarget?.name}」的密码</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm text-muted-foreground">新密码（至少8位）</label>
            <Input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="请输入新密码" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>取消</Button>
            <Button disabled={resetM.isPending || newPwd.length < 8}
              onClick={() => resetTarget && resetM.mutate({ userId: resetTarget.id, newPassword: newPwd })}>
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

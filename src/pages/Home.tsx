// 主页面：登录门禁 + 角色化标签导航 + 预警弹窗
import { useMemo, useState } from 'react';
import type { Task } from '@/types';
import { useStore, seed, ROLE_LABEL } from '@/lib/store';
import { buildAlerts, today } from '@/lib/analysis';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/providers/trpc';
import { LOGIN_PATH } from '@/const';
import Dashboard from '@/components/Dashboard';
import Gantt from '@/components/Gantt';
import TaskList from '@/components/TaskList';
import AlertsPanel from '@/components/AlertsPanel';
import Report from '@/components/Report';
import TaskDialog from '@/components/TaskDialog';
import ReviewCenter from '@/components/ReviewCenter';
import Members from '@/components/Members';
import LogsTab from '@/components/LogsTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { Gauge, GanttChart, ListChecks, BellRing, FileText, HardHat, LogOut, ClipboardCheck, Users, History, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const ROLE_CLS: Record<string, string> = {
  owner: 'bg-amber-500',
  supervisor: 'bg-blue-500',
  contractor: 'bg-green-600',
};

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: LOGIN_PATH,
  });
  const { state, role, userName, logout, loading } = useStore();
  const [tab, setTab] = useState(() => {
    const h = location.hash.replace('#', '');
    return ['dashboard', 'gantt', 'tasks', 'alerts', 'report', 'review', 'logs', 'members'].includes(h) ? h : 'dashboard';
  });
  const [editing, setEditing] = useState<{ task: Task; section: string } | null>(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  // 修改密码
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const changePwdM = trpc.localAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success('密码修改成功');
      setPwdOpen(false);
      setOldPwd(''); setNewPwd('');
    },
    onError: e => toast.error(e.message),
  });

  const pendingCountQ = trpc.progress.pendingCount.useQuery(undefined, {
    enabled: isAuthenticated && (role === 'owner' || role === 'supervisor'),
  });
  const pendingCount = pendingCountQ.data ?? 0;

  const alerts = useMemo(() => buildAlerts(seed, state.actuals, state.closedAlerts, today()), [state.actuals, state.closedAlerts]);
  const openAlerts = alerts.filter(a => !a.closed);
  const redAlerts = openAlerts.filter(a => a.level === 'red');

  if (authLoading || (isAuthenticated && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        正在加载项目数据…
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const onEdit = (task: Task, section: string) => setEditing({ task, section });
  const canReview = role === 'owner' || role === 'supervisor';

  return (
    <div className="min-h-screen bg-slate-100">
      <Toaster position="top-center" />
      {/* 顶栏 */}
      <header className="bg-blue-900 text-white sticky top-0 z-40 shadow">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <HardHat className="w-6 h-6 text-amber-400" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">大密扣升压站施工进度监控管理系统 <span className="text-xs font-normal text-blue-300">多人协同版</span></h1>
            <p className="text-xs text-blue-300">云南能源怒江产业发展有限公司 · 业主 / 监理 / 施工 三方协同管控平台</p>
          </div>
          {redAlerts.length > 0 && (
            <button onClick={() => setTab('alerts')} className="flex items-center gap-1 bg-red-600 hover:bg-red-500 rounded-full px-3 py-1 text-sm animate-pulse">
              <BellRing className="w-4 h-4" />{redAlerts.length}条红色预警
            </button>
          )}
          <Badge className={`${ROLE_CLS[role ?? ''] ?? 'bg-slate-500'} text-xs`}>
            {role ? ROLE_LABEL[role] : '只读用户'}
          </Badge>
          <span className="text-sm hidden sm:inline">{userName}</span>
          <Button size="sm" variant="ghost" className="text-blue-200 hover:text-white" onClick={() => setPwdOpen(true)} title="修改密码">
            <KeyRound className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-blue-200 hover:text-white" onClick={logout} title="退出登录">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="dashboard"><Gauge className="w-4 h-4 mr-1" />进度总览</TabsTrigger>
            <TabsTrigger value="gantt"><GanttChart className="w-4 h-4 mr-1" />甘特图监控</TabsTrigger>
            <TabsTrigger value="tasks"><ListChecks className="w-4 h-4 mr-1" />任务管理</TabsTrigger>
            <TabsTrigger value="alerts" className="relative">
              <BellRing className="w-4 h-4 mr-1" />预警管理
              {openAlerts.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">{openAlerts.length}</span>
              )}
            </TabsTrigger>
            {canReview && (
              <TabsTrigger value="review">
                <ClipboardCheck className="w-4 h-4 mr-1" />审核中心
                {pendingCount > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-[10px] rounded-full px-1.5">{pendingCount}</span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="logs"><History className="w-4 h-4 mr-1" />填报记录</TabsTrigger>
            <TabsTrigger value="report"><FileText className="w-4 h-4 mr-1" />周报生成</TabsTrigger>
            {role === 'owner' && (
              <TabsTrigger value="members"><Users className="w-4 h-4 mr-1" />成员管理</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard"><Dashboard onGoAlerts={() => setTab('alerts')} /></TabsContent>
          <TabsContent value="gantt"><Gantt onEdit={onEdit} /></TabsContent>
          <TabsContent value="tasks"><TaskList onEdit={onEdit} /></TabsContent>
          <TabsContent value="alerts"><AlertsPanel /></TabsContent>
          <TabsContent value="review"><ReviewCenter /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="report"><Report /></TabsContent>
          <TabsContent value="members"><Members /></TabsContent>
        </Tabs>

        <footer className="text-center text-xs text-muted-foreground mt-6">
          云南能源怒江产业发展有限公司·项目管理系统·版本 1.0.0
        </footer>
      </main>

      {/* 红色预警弹窗 */}
      <Dialog open={redAlerts.length > 0 && !popupDismissed} onOpenChange={v => !v && setPopupDismissed(true)}>
        <DialogContent className="max-w-md border-red-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <BellRing className="w-5 h-5" />存在 {redAlerts.length} 条红色预警（任务已超期）
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {redAlerts.slice(0, 8).map(a => (
              <div key={a.key} className="bg-red-50 border-l-4 border-red-500 rounded p-2 text-sm">
                <span className="font-medium">{a.taskName}</span>
                {a.impactGrid && <Badge variant="destructive" className="ml-1 text-xs">波及并网</Badge>}
                <p className="text-xs text-red-700 mt-0.5">{a.reason}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPopupDismissed(true)}>稍后处理</Button>
            <Button variant="destructive" onClick={() => { setPopupDismissed(true); setTab('alerts'); }}>立即查看预警</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>修改密码</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">原密码</label>
              <Input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">新密码（至少8位）</label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>取消</Button>
            <Button disabled={changePwdM.isPending || newPwd.length < 8}
              onClick={() => changePwdM.mutate({ oldPassword: oldPwd, newPassword: newPwd })}>
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务填报对话框 */}
      <TaskDialog task={editing?.task ?? null} section={editing?.section ?? ''}
        open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// 主页面：登录门禁 + 角色化标签导航 + 预警弹窗
import { useEffect, useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Gauge, GanttChart, ListChecks, BellRing, FileText, HardHat, LogOut,
  ClipboardCheck, Users, History, KeyRound, Zap, Activity, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';

const ROLE_CLS: Record<string, string> = {
  owner: 'from-amber-400 to-amber-600',
  supervisor: 'from-sky-400 to-sky-600',
  contractor: 'from-emerald-400 to-emerald-600',
};

type TabItem = {
  key: 'dashboard' | 'gantt' | 'tasks' | 'alerts' | 'review' | 'logs' | 'report' | 'members';
  label: string;
  icon: LucideIcon;
  roleOnly?: boolean;
  ownerOnly?: boolean;
};

const TABS: TabItem[] = [
  { key: 'dashboard', label: '进度总览', icon: Gauge },
  { key: 'gantt', label: '甘特图监控', icon: GanttChart },
  { key: 'tasks', label: '任务管理', icon: ListChecks },
  { key: 'alerts', label: '预警管理', icon: BellRing },
  { key: 'review', label: '审核中心', icon: ClipboardCheck, roleOnly: true },
  { key: 'logs', label: '填报记录', icon: History },
  { key: 'report', label: '周报生成', icon: FileText },
  { key: 'members', label: '成员管理', icon: Users, ownerOnly: true },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      <div className="h-16 bg-brand-gradient shadow-lg" />
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

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
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const clock = useClock();

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
    return <LoadingScreen />;
  }
  if (!isAuthenticated) return null;

  const onEdit = (task: Task, section: string) => setEditing({ task, section });
  const canReview = role === 'owner' || role === 'supervisor';
  const dateStr = clock.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = clock.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][clock.getDay()];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100">
      <Toaster position="top-center" />

      {/* 顶栏 */}
      <header className="bg-brand-radial text-white sticky top-0 z-40 shadow-lg shadow-brand-deep/20">
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3 relative">
          {/* 品牌徽标 */}
          <div className="relative w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5 text-brand-glow" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-glow ring-2 ring-[hsl(var(--brand-deep))]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate text-[15px] leading-tight">
              大密扣升压站施工进度监控管理系统
              <span className="ml-2 text-[10px] font-normal text-white/60 align-middle">多人协同版 · v2.0</span>
            </h1>
            <p className="text-[11px] text-white/60 truncate">云南能源怒江产业发展有限公司 · 业主 / 监理 / 施工 三方协同管控平台</p>
          </div>

          {/* 红色预警脉冲按钮 */}
          {redAlerts.length > 0 && (
            <button
              onClick={() => setTab('alerts')}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-400 rounded-full pl-2.5 pr-3 py-1 text-xs font-medium animate-pulse-ring shadow-lg shadow-red-500/40 transition-colors"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{redAlerts.length}</span>
              <span className="hidden sm:inline">红色预警</span>
            </button>
          )}

          {/* 角色徽章 */}
          <Badge className={`bg-gradient-to-r ${ROLE_CLS[role ?? ''] ?? 'from-slate-500 to-slate-600'} text-white text-[11px] font-medium border-0 shadow-sm`}>
            {role ? ROLE_LABEL[role] : '只读用户'}
          </Badge>

          {/* 用户名 + 时钟 */}
          <div className="hidden lg:flex flex-col items-end text-[11px] leading-tight">
            <span className="text-white/90 font-medium">{userName}</span>
            <span className="text-white/60 tabular-nums">{dateStr} {weekday} {timeStr}</span>
          </div>

          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9" onClick={() => setPwdOpen(true)} title="修改密码">
              <KeyRound className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9" onClick={logout} title="退出登录">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5 flex-wrap h-auto bg-white/80 backdrop-blur border border-slate-200 shadow-sm p-1.5 rounded-xl">
            {TABS.map(t => {
              if (t.roleOnly && !canReview) return null;
              if (t.ownerOnly && role !== 'owner') return null;
              const Icon = t.icon;
              const count = t.key === 'alerts' ? openAlerts.length : t.key === 'review' ? pendingCount : 0;
              return (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="relative data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg px-3.5 py-2 text-sm gap-1.5 transition-all"
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {count > 0 && (
                    <span className={`ml-0.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${
                      t.key === 'alerts' ? 'bg-red-500 text-white' : 'bg-brand-bright text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div key={tab} className="animate-fade-up">
            <TabsContent value="dashboard"><Dashboard onGoAlerts={() => setTab('alerts')} /></TabsContent>
            <TabsContent value="gantt"><Gantt onEdit={onEdit} /></TabsContent>
            <TabsContent value="tasks"><TaskList onEdit={onEdit} /></TabsContent>
            <TabsContent value="alerts"><AlertsPanel /></TabsContent>
            <TabsContent value="review"><ReviewCenter /></TabsContent>
            <TabsContent value="logs"><LogsTab /></TabsContent>
            <TabsContent value="report"><Report /></TabsContent>
            <TabsContent value="members"><Members /></TabsContent>
          </div>
        </Tabs>

        <footer className="text-center text-[11px] text-muted-foreground mt-8 py-3 border-t border-slate-200/70">
          <div className="flex items-center justify-center gap-1.5">
            <Zap className="w-3 h-3 text-brand-glow" />
            <span>云南能源怒江产业发展有限公司</span>
            <span className="text-slate-300">·</span>
            <span>项目管理系统</span>
            <span className="text-slate-300">·</span>
            <span className="tabular-nums">版本 2.0.0</span>
          </div>
        </footer>
      </main>

      {/* 红色预警弹窗 */}
      <Dialog open={redAlerts.length > 0 && !popupDismissed} onOpenChange={v => !v && setPopupDismissed(true)}>
        <DialogContent className="max-w-md border-red-200 bg-white">
          <button
            onClick={() => setPopupDismissed(true)}
            className="absolute right-3 top-3 w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-muted-foreground"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <BellRing className="w-4 h-4" />
                <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" />
              </span>
              存在 {redAlerts.length} 条红色预警
            </DialogTitle>
            <p className="text-sm text-muted-foreground font-normal">以下任务已超期，请优先处置</p>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-slim pr-1">
            {redAlerts.slice(0, 8).map(a => (
              <div key={a.key} className="bg-gradient-to-r from-red-50 to-red-50/30 border-l-4 border-red-500 rounded-r-md p-2.5 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{a.taskName}</span>
                  {a.impactGrid && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">波及并网</Badge>}
                </div>
                <p className="text-xs text-red-700 mt-0.5">{a.reason}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPopupDismissed(true)}>稍后处理</Button>
            <Button variant="destructive" className="bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/30" onClick={() => { setPopupDismissed(true); setTab('alerts'); }}>
              <Activity className="w-4 h-4 mr-1" />立即查看预警
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-mid" />修改密码
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">原密码</label>
              <Input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">新密码（至少8位）</label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="h-10" placeholder="建议字母+数字+符号" />
              {newPwd.length > 0 && newPwd.length < 8 && (
                <p className="text-[11px] text-amber-600">密码长度不足 8 位</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>取消</Button>
            <Button
              disabled={changePwdM.isPending || newPwd.length < 8 || !oldPwd}
              onClick={() => changePwdM.mutate({ oldPassword: oldPwd, newPassword: newPwd })}
              className="bg-brand-gradient"
            >
              {changePwdM.isPending ? '提交中…' : '确认修改'}
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

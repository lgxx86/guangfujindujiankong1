// 自有服务器部署版：账号密码登录页
import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat, Zap, User, Lock, Loader2, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const loginM = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginM.mutate({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand-radial flex items-center justify-center p-4">
      {/* 网格纹理 */}
      <div className="absolute inset-0 bg-grid opacity-60" />
      {/* 浮动光斑 */}
      <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-brand-bright/20 blur-3xl animate-float" />
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-brand-glow/20 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

      {/* 顶部品牌标 */}
      <div className="absolute top-6 left-6 flex items-center gap-2 text-white/90 text-sm animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
          <Zap className="w-4 h-4 text-brand-glow" />
        </div>
        <span className="font-medium tracking-wide">云南能源怒江产业发展有限公司</span>
      </div>
      <div className="absolute top-6 right-6 text-[11px] text-white/60 hidden sm:flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5" /> 安全连接 · v2.0
      </div>

      {/* 登录卡片 */}
      <div className="relative w-full max-w-md animate-pop-in">
        <div className="rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/40 overflow-hidden">
          {/* 顶部色带 */}
          <div className="h-1.5 bg-gradient-to-r from-brand-deep via-brand-mid to-brand-glow" />

          <div className="px-8 pt-8 pb-7">
            {/* 头标 */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg mb-3">
                <HardHat className="w-8 h-8 text-white" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-glow ring-2 ring-white flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                大密扣升压站
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                施工进度监控管理系统
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-bright/10 px-3 py-1 text-[11px] text-brand-mid font-medium ring-1 ring-brand-bright/20">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-bright animate-pulse" />
                业主 · 监理 · 施工 三方协同管控平台
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">用户名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoComplete="username"
                    className="pl-9 h-11 bg-slate-50/80 border-slate-200 focus-visible:bg-white focus-visible:border-brand-mid transition-colors"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    className="pl-9 pr-10 h-11 bg-slate-50/80 border-slate-200 focus-visible:bg-white focus-visible:border-brand-mid transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-brand-mid transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <Button
                className="w-full h-11 text-sm font-medium bg-brand-gradient shadow-lg shadow-brand-mid/30 hover:shadow-brand-mid/50 hover:brightness-110 transition-all"
                size="lg"
                type="submit"
                disabled={loginM.isPending}
              >
                {loginM.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />登录中…</>
                ) : (
                  <>登 录</>
                )}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center pt-1">
                账号由项目业主（系统管理员）创建分配，请联系管理员获取
              </p>
            </form>
          </div>
        </div>

        {/* 底部说明 */}
        <p className="text-center text-[11px] text-white/50 mt-4">
          © {new Date().getFullYear()} 大密扣升压站项目组 · 进度协同平台
        </p>
      </div>
    </div>
  );
}

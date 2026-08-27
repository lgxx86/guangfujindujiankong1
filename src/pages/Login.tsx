// 自有服务器部署版：账号密码登录页（全屏视频背景 + 左侧悬浮登录卡）
import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat, Zap, User, Lock, Loader2, ShieldCheck } from "lucide-react";

const VIDEO_URL =
  "https://www.cnyeig.com/masvod/public/2023/12/21/20231221_18c89fe797d_r1_1200k.mp4";

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
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* 顶部品牌标（浮在视频之上） */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-2 text-white/90 text-sm animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-black/30 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
          <Zap className="w-4 h-4 text-brand-glow" />
        </div>
        <span className="font-medium tracking-wide">云南能源怒江产业发展有限公司</span>
      </div>
      <div className="absolute top-6 right-6 z-30 text-[11px] text-white/70 hidden sm:flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5" /> 安全连接 · v2.4
      </div>

      {/* ========== 全屏视频背景 ========== */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      {/* ========== 融合遮罩层（柔边暗化 + 全局低对比压暗，卡片区自然过渡） ========== */}
      {/* 1. 全局淡压暗：视频不刺眼、肤色不过曝 */}
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />
      {/* 2. 右侧卡片区域柔边径向暗化：椭圆中心在 82%x/52%y，暗→半暗→透明的高级渐变过渡 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 72% 68% at 82% 52%, rgba(6,23,38,0.88) 0%, rgba(6,23,38,0.60) 36%, rgba(6,23,38,0.25) 58%, transparent 78%)",
        }}
      />
      {/* 3. 微网格纹理：低对比 20%，保留工业质感不眼花 */}
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

      {/* ========== 悬浮卡容器（大屏靠左距离右边 8-10%，小屏居中） ========== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center lg:justify-end p-6 sm:p-8 lg:pr-[8%] xl:pr-[10%] animate-pop-in">
        <div className="relative w-full max-w-md">
          {/* 卡片外围双层光晕：做"悬浮发光"的漂浮感 */}
          <div className="absolute -inset-3 rounded-[2rem] bg-brand-glow/15 blur-2xl animate-pulse-ring pointer-events-none" />
          <div className="absolute -inset-2 rounded-[1.75rem] bg-brand-bright/10 blur-xl pointer-events-none" />
          {/* 悬浮玻璃卡（更透、更糊、双层阴影+金边，漂浮在视频之上） */}
          <div className="relative rounded-2xl bg-white/75 backdrop-blur-2xl shadow-[0_30px_100px_-20px_rgba(0,0,0,0.7),0_0_80px_-12px_rgba(6,182,212,0.28)] ring-1 ring-white/60 outline outline-1 outline-brand-glow/30 outline-offset-2 overflow-hidden">
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
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-brand-mid transition-colors"
                      tabIndex={-1}
                    >
                      {showPwd ? "隐藏" : "显示"}
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
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      登录中…
                    </>
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
            <p className="text-center text-[11px] text-white/85 mt-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
              © {new Date().getFullYear()} 大密扣升压站项目组 · 进度协同平台
            </p>
          </div>
        </div>
    </div>
  );
}

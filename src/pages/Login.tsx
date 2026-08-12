// 自有服务器部署版：账号密码登录页
import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <HardHat className="w-10 h-10 mx-auto text-blue-700" />
          <CardTitle className="text-lg">大密扣升压站施工进度监控管理系统</CardTitle>
          <p className="text-xs text-muted-foreground">业主 / 监理 / 施工 三方协同管控平台</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">用户名</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名" autoComplete="username" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">密码</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码" autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" size="lg" type="submit" disabled={loginM.isPending}>
              {loginM.isPending ? "登录中…" : "登 录"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              账号由项目业主（系统管理员）创建分配，请联系管理员获取
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

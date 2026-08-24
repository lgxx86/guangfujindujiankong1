import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-brand-radial flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute -top-32 right-0 w-96 h-96 rounded-full bg-brand-glow/20 blur-3xl" />
      <div className="absolute -bottom-32 left-0 w-96 h-96 rounded-full bg-brand-bright/20 blur-3xl" />

      <div className="relative text-center text-white animate-pop-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass mb-6 animate-float">
          <Compass className="w-10 h-10 text-brand-glow" />
        </div>
        <h1 className="text-7xl font-black text-gradient-brand tracking-tight">404</h1>
        <p className="text-lg font-semibold mt-3">页面未找到</p>
        <p className="text-sm text-white/60 mt-2 max-w-sm mx-auto">
          您访问的页面不存在或已被移动，请返回系统主页继续工作。
        </p>
        <Button asChild className="mt-6 bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/20">
          <Link to="/"><Home className="w-4 h-4 mr-2" />返回主页</Link>
        </Button>
      </div>
    </div>
  );
}

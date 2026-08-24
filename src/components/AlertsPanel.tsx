// 预警管理：预警台账、闭环处理、导出微信通报
import { useMemo, useState } from 'react';
import { useStore, seed } from '@/lib/store';
import { buildAlerts, today } from '@/lib/analysis';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BellRing, CheckCheck, Share2, RotateCcw, ShieldCheck, Info } from 'lucide-react';

export default function AlertsPanel() {
  const { state, closeAlert, reopenAlert, role } = useStore();
  const canClose = role === 'owner' || role === 'supervisor';
  const [copied, setCopied] = useState(false);
  const now = today();

  const alerts = useMemo(() => buildAlerts(seed, state.actuals, state.closedAlerts, now), [state.actuals, state.closedAlerts]);
  const open = alerts.filter(a => !a.closed);
  const closed = alerts.filter(a => a.closed);
  const redCount = open.filter(a => a.level === 'red').length;
  const yellowCount = open.length - redCount;

  const exportText = () => {
    const dateStr = now.toLocaleDateString('zh-CN');
    const red = open.filter(a => a.level === 'red');
    const yellow = open.filter(a => a.level === 'yellow');
    let txt = `【大密扣升压站进度预警通报】${dateStr}\n`;
    txt += `未处理预警共${open.length}条（红色${red.length}条，黄色${yellow.length}条）\n`;
    if (red.length) {
      txt += `\n■ 红色预警（已延期）\n`;
      red.forEach((a, i) => {
        txt += `${i + 1}. ${a.taskName}（${a.section.split('、')[0]}）：${a.reason}${a.impactGrid ? '【波及并网节点】' : ''}\n`;
      });
    }
    if (yellow.length) {
      txt += `\n■ 黄色提醒（临期/未开工）\n`;
      yellow.forEach((a, i) => {
        txt += `${i + 1}. ${a.taskName}（${a.section.split('、')[0]}）：${a.reason}\n`;
      });
    }
    txt += `\n请施工单位对照整改，落实赶工措施，确保11月20日并网目标。`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${redCount > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
            <BellRing className={`w-5 h-5 ${redCount > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
            {redCount > 0 && <span className="absolute inset-0 rounded-xl bg-red-400/30 animate-ping" />}
          </div>
          <div>
            <h3 className="font-bold leading-tight flex items-center gap-2">
              未处理预警 <span className="tabular-nums">{open.length}</span> 条
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="destructive" className="text-[11px] h-5">{redCount} 红</Badge>
              <Badge className="bg-amber-500 text-[11px] h-5">{yellowCount} 黄</Badge>
              {open.length === 0 && <span className="text-[11px] text-emerald-600">· 工程按计划推进</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 hover:border-brand-mid hover:text-brand-mid transition-colors" onClick={exportText} disabled={open.length === 0}>
          <Share2 className="w-4 h-4 mr-1.5" />{copied ? '已复制，可粘贴到微信群' : '生成预警通报（复制转发微信）'}
        </Button>
      </div>

      {open.length === 0 && (
        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="inline-flex w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-base font-medium text-foreground">当前无未处理预警</p>
            <p className="text-xs text-muted-foreground mt-1">所有任务均在计划范围内推进</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2.5">
        {open.map((a, i) => (
          <Card
            key={a.key}
            className={`border-l-4 lift-card animate-fade-up ${
              a.level === 'red' ? 'border-l-red-500 bg-gradient-to-r from-red-50/60 to-transparent'
              : 'border-l-amber-400 bg-gradient-to-r from-amber-50/60 to-transparent'
            }`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <CardContent className="py-3.5 flex items-start gap-3">
              <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${a.level === 'red' ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle className={`w-4 h-4 ${a.level === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.taskName}</span>
                  {a.milestone && <Badge className="bg-brand-glow text-[10px] h-4 px-1.5">里程碑</Badge>}
                  {a.impactGrid && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">波及并网</Badge>}
                  <Badge variant={a.level === 'red' ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1.5">
                    {a.level === 'red' ? '红色预警' : '黄色提醒'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{a.section}</p>
                <p className="text-sm mt-1">{a.reason}</p>
              </div>
              {canClose && (
                <Button size="sm" variant="outline" className="shrink-0 h-8 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" onClick={() => closeAlert(a.key)}>
                  <CheckCheck className="w-4 h-4 mr-1" />闭环
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {closed.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mt-6 mb-2 flex items-center gap-1.5">
            <span className="w-1 h-4 rounded bg-slate-300" />
            已闭环（{closed.length}）
          </h4>
          <div className="space-y-1.5">
            {closed.map(a => (
              <div key={a.key} className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg px-3 py-2">
                <CheckCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="line-through flex-1 truncate">{a.taskName}：{a.reason}</span>
                {canClose && (
                  <button className="text-xs text-brand-mid hover:text-brand-bright shrink-0 flex items-center px-1.5 py-0.5 rounded hover:bg-brand-bright/10 transition-colors" onClick={() => reopenAlert(a.key)}>
                    <RotateCcw className="w-3 h-3 mr-0.5" />重新打开
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-brand-mid" />预警规则说明</p>
          <p className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5">🔴</span><span><b>红色预警</b>：超过计划完成日期仍未完工；里程碑任务延期属最高级别，优先处置。</span></p>
          <p className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">🟡</span><span><b>黄色提醒</b>：①距计划完成不足3天未完工；②计划开工日已过仍未填报开工；③任务延期完成（提示关注下游）。</span></p>
          <p className="flex items-start gap-1.5"><span className="mt-0.5">⚡</span><span>「波及并网」= 该任务延期将沿工序链传导至11月20日并网节点。</span></p>
        </CardContent>
      </Card>
    </div>
  );
}

// 预警管理：预警台账、闭环处理、导出微信通报
import { useMemo, useState } from 'react';
import { useStore, seed } from '@/lib/store';
import { buildAlerts, today } from '@/lib/analysis';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, BellRing, CheckCheck, Share2, RotateCcw } from 'lucide-react';

export default function AlertsPanel() {
  const { state, closeAlert, reopenAlert, role } = useStore();
  const canClose = role === 'owner' || role === 'supervisor';
  const [copied, setCopied] = useState(false);
  const now = today();

  const alerts = useMemo(() => buildAlerts(seed, state.actuals, state.closedAlerts, now), [state.actuals, state.closedAlerts]);
  const open = alerts.filter(a => !a.closed);
  const closed = alerts.filter(a => a.closed);

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-red-500" />
          <h3 className="font-bold">未处理预警 {open.length} 条</h3>
          <Badge variant="destructive">{open.filter(a => a.level === 'red').length} 红</Badge>
          <Badge className="bg-amber-500">{open.filter(a => a.level === 'yellow').length} 黄</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={exportText} disabled={open.length === 0}>
          <Share2 className="w-4 h-4 mr-1" />{copied ? '已复制，可粘贴到微信群' : '生成预警通报（复制转发微信）'}
        </Button>
      </div>

      {open.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">✓ 当前无未处理预警</CardContent></Card>
      )}

      <div className="space-y-2">
        {open.map(a => (
          <Card key={a.key} className={`border-l-4 ${a.level === 'red' ? 'border-l-red-500 bg-red-50/40' : 'border-l-amber-400 bg-amber-50/40'}`}>
            <CardContent className="py-3 flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${a.level === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.taskName}</span>
                  {a.milestone && <Badge className="bg-amber-500 text-xs">里程碑</Badge>}
                  {a.impactGrid && <Badge variant="destructive" className="text-xs">波及并网</Badge>}
                  <Badge variant={a.level === 'red' ? 'destructive' : 'secondary'} className="text-xs">
                    {a.level === 'red' ? '红色预警' : '黄色提醒'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{a.section}</p>
                <p className="text-sm mt-1">{a.reason}</p>
              </div>
              {canClose && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => closeAlert(a.key)}>
                  <CheckCheck className="w-4 h-4 mr-1" />闭环
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {closed.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mt-4 mb-2">已闭环（{closed.length}）</h4>
          <div className="space-y-1">
            {closed.map(a => (
              <div key={a.key} className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 rounded p-2">
                <CheckCheck className="w-4 h-4 text-green-500 shrink-0" />
                <span className="line-through flex-1 truncate">{a.taskName}：{a.reason}</span>
                {canClose && (
                  <button className="text-xs text-blue-500 hover:underline shrink-0 flex items-center" onClick={() => reopenAlert(a.key)}>
                    <RotateCcw className="w-3 h-3 mr-0.5" />重新打开
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="bg-slate-50">
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-slate-700">预警规则说明</p>
          <p>🔴 红色预警：超过计划完成日期仍未完工；里程碑任务延期属最高级别，优先处置。</p>
          <p>🟡 黄色提醒：①距计划完成不足3天未完工；②计划开工日已过仍未填报开工；③任务延期完成（提示关注下游）。</p>
          <p>「波及并网」= 该任务延期将沿工序链传导至11月20日并网节点。</p>
        </CardContent>
      </Card>
    </div>
  );
}

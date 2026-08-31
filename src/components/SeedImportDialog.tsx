// Admin 专属：工作计划表 xlsx 导入对话框
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, AlertTriangle, CheckCircle2, Loader2, RefreshCcw, FileSpreadsheet, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Step = "select" | "preview" | "result";

export default function SeedImportDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [base64, setBase64] = useState("");
  const [step, setStep] = useState<Step>("select");
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");

  const previewM = trpc.seed.preview.useMutation({
    onSuccess: d => { setSummary(d.summary); setStep("preview"); setError(""); },
    onError: e => { setError(e.message || "解析失败，请检查文件格式"); setStep("select"); },
  });
  const importM = trpc.seed.import.useMutation({
    async onSuccess(d) {
      setSummary(d.summary); setStep("result"); setError("");
      // 使全页面失效 seed/状态/日志，刷新后新工作计划生效
      await Promise.all([
        utils.seed.get.invalidate(),
        utils.progress.states.invalidate(),
        utils.progress.logs.invalidate(),
        utils.progress.pendingCount.invalidate(),
        utils.progress.pending.invalidate(),
      ]);
      toast.success("工作计划表导入成功，页面将刷新", {
        description: `${d.summary.name} · 共 ${d.summary.sections} 分部 / ${d.summary.totalTasks} 任务`,
        duration: 4000,
      });
      setTimeout(() => window.location.reload(), 2200);
    },
    onError: e => setError(e.message || "导入失败"),
  });
  const resetM = trpc.seed.reset.useMutation({
    async onSuccess(d) {
      setSummary(d.summary); setStep("result"); setError("");
      await utils.seed.get.invalidate();
      toast.success("已重置为系统默认工作计划表，页面刷新中…", { duration: 3000 });
      setTimeout(() => window.location.reload(), 1800);
    },
    onError: e => setError(e.message || "重置失败"),
  });

  useEffect(() => {
    if (!open) { setFileName(""); setBase64(""); setStep("select"); setSummary(null); setError(""); }
  }, [open]);

  const handlePick = (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || "");
      setBase64(b64);
      setError("");
      previewM.mutate({ base64: b64 });
    };
    reader.onerror = () => setError("文件读取失败");
    reader.readAsDataURL(f);
  };

  if (user?.role !== "admin") return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 animate-[fade-up_0.2s_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-[0_40px_140px_-30px_rgba(0,0,0,0.55)] ring-1 ring-slate-200 overflow-hidden animate-[pop-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-cyan-50 via-white to-amber-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-gradient text-white shadow-brand-glow/20 shadow-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-slate-900">导入工作计划表</Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500 mt-0.5">
                  Admin 专属：上传 .xlsx 格式的施工进度计划，全量替换当前任务清单。解析预览通过后再确认导入。
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto scrollbar-slim">
            {/* 步骤指示器 */}
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              {[
                ["select", "① 选择文件"],
                ["preview", "② 解析预览"],
                ["result", "③ 完成"],
              ].map(([key, label], i, arr) => (
                <div key={key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] transition-all
                    ${step === key ? "bg-brand-gradient text-white shadow-md" :
                      (arr.findIndex(x => x[0] === step) > i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}`}>
                    {arr.findIndex(x => x[0] === step) > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={step === key ? "text-slate-900" : ""}>{label}</span>
                  {i < arr.length - 1 && <div className="flex-1 h-0.5 mx-3 bg-slate-100 rounded" />}
                </div>
              ))}
            </div>

            {/* Step 1：选文件 */}
            {step === "select" && (
              <div
                className="relative rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-glow/50 bg-slate-50/60 hover:bg-white p-10 text-center cursor-pointer transition-all group"
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={e => handlePick(e.target.files?.[0] ?? null)}
                />
                <div className="mx-auto w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                  {previewM.isPending ? <Loader2 className="w-7 h-7 text-brand-glow animate-spin" />
                    : <Upload className="w-7 h-7 text-brand-glow" />}
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  {fileName ? fileName : "点击选择 .xlsx 文件，或拖放此处"}
                </p>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  格式要求：第 2 行表头固定为「序号｜标记｜工作名称｜工期(工日)｜前置工作｜计划开始｜计划完成」。工作名称前导空格用于识别层级。
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-medium ring-1 ring-cyan-100">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  当前格式：大密扣光伏发电项目EPC总承包项目施工进度计划.xlsx 已验证通过
                </div>
              </div>
            )}

            {/* Step 2：预览摘要 + 确认导入 */}
            {step === "preview" && summary && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-cyan-50 ring-1 ring-emerald-100">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" /> 解析成功，数据摘要预览：
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ["分部数", summary.sections],
                      ["任务总数", summary.totalTasks],
                      ["里程碑", summary.milestoneCount],
                      ["依赖边数", summary.dependencyEdges],
                    ].map(([k, v]) => (
                      <div key={k} className="px-3 py-2.5 rounded-xl bg-white ring-1 ring-emerald-100 shadow-sm">
                        <div className="text-[11px] text-slate-500">{k}</div>
                        <div className="mt-0.5 text-lg font-bold text-slate-900">{v as any}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                    <div>项目：<span className="font-medium">{summary.name}</span></div>
                    <div>计划范围：<span className="font-medium">{summary.planStart} → {summary.planEnd}</span>（总工期 {summary.totalDays} 天）</div>
                    <div>并网节点：<span className="font-medium text-amber-600">{summary.gridDate}</span></div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 ring-1 ring-amber-100">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <p className="font-semibold">⚠️ 导入确认后会立即替换系统中当前工作计划表（任务清单、甘特图、部位进度、预警闭环全部按新计划重新计算）。</p>
                    <p className="mt-1">原有进度填报不会被删除，但如果新计划中已不再包含的旧 TaskId，相关填报记录将无法关联显示。建议：先在服务器做一次数据库备份。</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3：结果 */}
            {step === "result" && summary && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 ring-1 ring-emerald-100 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200 animate-pop-in">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">
                    导入完成！页面即将自动刷新，新工作计划表 2 秒后生效
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{summary.name} · 并网日期 {summary.gridDate}</div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 ring-1 ring-rose-100 text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => resetM.mutate()}
              disabled={resetM.isPending || step === "result"}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 ring-1 ring-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
              重置为默认计划
            </button>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-white ring-1 ring-slate-200 transition-colors"
                >
                  取消
                </button>
              </Dialog.Close>
              {step === "preview" && summary && (
                <button
                  type="button"
                  onClick={() => importM.mutate({ base64 })}
                  disabled={importM.isPending}
                  className="px-5 py-2 rounded-lg bg-brand-gradient text-white text-xs font-semibold shadow-lg shadow-brand-glow/25 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {importM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {importM.isPending ? "正在导入…" : "确认导入并生效"}
                </button>
              )}
              {step === "result" && (
                <Dialog.Close asChild>
                  <button type="button" className="px-5 py-2 rounded-lg bg-brand-gradient text-white text-xs font-semibold shadow-lg shadow-brand-glow/25">
                    我知道了
                  </button>
                </Dialog.Close>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

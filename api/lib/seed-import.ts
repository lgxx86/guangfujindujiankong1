// 工作计划表 Excel → ProjectSeed 解析器（方案A导入后端核心）
import XLSX from "xlsx";
import type { ProjectSeed, Section, Task } from "@/types";

export interface RawRow {
  seq: number;
  flag: string;
  name: string;
  duration: number;
  planStart: string;
  planEnd: string;
  depsStr: string;
  level: number; // 前导空格数（层级）
}

/**
 * 解析后端接收的 ArrayBuffer（.xlsx）为标准 ProjectSeed。
 * 格式约定基于用户上传的「大密扣光伏发电项目EPC总承包项目施工进度计划.xlsx」
 * - 第 1 行：标题
 * - 第 2 行（表头）：序号 | 标记 | 工作名称 | 工期(工日) | 前置工作 | 计划开始 | 计划完成
 * - 工作名称前导空格层级：0=section(一级分部)，2/4/6 全部当 tasks
 * - 标记含 "!" → milestone；含 "*" → 备注「关键路径」
 * - 前置工作列引用「序号」整数，逗号分隔
 */
export function parseWorkPlanXlsx(buf: ArrayBuffer): ProjectSeed {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  if (rows.length < 3) throw new Error("Excel 内容不足（至少需要标题+表头+1 行数据）");
  // 表头固定在 index 1
  const dataRows: RawRow[] = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c: any) => String(c).trim() === "")) continue;
    const seqStr = String(r[0] ?? "").trim();
    if (!seqStr || !/^\d+$/.test(seqStr)) continue; // 必须整数序号（过滤合计行）
    const rawName = String(r[2] ?? "");
    let level = 0;
    while (level < rawName.length && rawName[level] === " ") level++;
    const durStr = String(r[3] ?? "").trim() || "0";
    dataRows.push({
      seq: parseInt(seqStr, 10),
      flag: String(r[1] ?? "").trim(),
      name: rawName.trim(),
      duration: parseInt(durStr, 10) || 0,
      planStart: String(r[5] ?? "").trim(),
      planEnd: String(r[6] ?? "").trim(),
      depsStr: String(r[4] ?? "").trim(),
      level,
    });
  }

  if (!dataRows.length) throw new Error("未解析到任何有效任务行");

  const seqToTaskId = new Map<number, string>();
  const taskIdOf = (seq: number) => "T" + String(seq).padStart(3, "0");
  // 先登记 seq → Txxx，保证前置依赖能映射
  dataRows.forEach(r => seqToTaskId.set(r.seq, taskIdOf(r.seq)));

  // sections 取 level=0 的行；任务按 seq 归属
  const sectionRows = dataRows.filter(r => r.level === 0);
  if (!sectionRows.length) throw new Error("Excel 中未找到一级分部（无缩进行）");

  const sections: Section[] = sectionRows.map((s, idx) => {
    const nextSec = sectionRows[idx + 1];
    const startSeq = s.seq + 1;
    const endSeq = nextSec ? nextSec.seq - 1 : dataRows[dataRows.length - 1].seq;
    const taskRows = dataRows
      .filter(r => r.seq >= startSeq && r.seq <= endSeq)
      .sort((a, b) => a.seq - b.seq);
    let localSeq = 0;
    const tasks: Task[] = taskRows.map(r => {
      localSeq += 1;
      const depsSeq = r.depsStr
        .split(/[,，、;；\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(p => parseInt(p, 10))
        .filter(n => !isNaN(n));
      const deps: string[] = [];
      for (const d of depsSeq) if (seqToTaskId.has(d)) deps.push(seqToTaskId.get(d)!);
      const milestone = r.flag.includes("!");
      const remark = r.flag.includes("*") ? "【关键路径】" : r.flag ? `[标记:${r.flag}]` : "";
      return {
        id: taskIdOf(r.seq),
        seq: localSeq,
        name: r.name,
        planStart: r.planStart || null,
        duration: r.duration,
        planEnd: r.planEnd || null,
        remark,
        milestone,
        deps,
      } as Task;
    });
    return { name: s.name, tasks };
  });

  // 元信息
  let planStart = "";
  let planEnd = "";
  dataRows.forEach(r => {
    if (r.planStart && (!planStart || r.planStart < planStart)) planStart = r.planStart;
    if (r.planEnd && (!planEnd || r.planEnd > planEnd)) planEnd = r.planEnd;
  });
  const totalDays = (() => {
    if (!planStart || !planEnd) return sections.reduce((a, s) => a + s.tasks.reduce((b, t) => Math.max(b, t.duration ?? 0), 0), 0);
    const d1 = new Date(planStart);
    const d2 = new Date(planEnd);
    return Math.max(1, Math.round((+d2 - +d1) / 86400000) + 1);
  })();

  // gridDate：里程碑中含「并网/带电/投运/倒送电/受电」关键词的最后一个结束日期
  let gridDate = "";
  const allTasks = sections.flatMap(s => s.tasks);
  const milestoneRows = dataRows.filter(r => r.flag.includes("!"));
  const grid = milestoneRows
    .filter(r => /并网|带电|投运|竣工|倒送电|受电/i.test(r.name))
    .sort((a, b) => (a.planEnd || "").localeCompare(b.planEnd || ""))
    .at(-1);
  if (grid && grid.planEnd) gridDate = grid.planEnd;
  if (!gridDate) {
    const lastMS = [...allTasks].filter(t => t.milestone && t.planEnd)
      .sort((a, b) => String(a.planEnd).localeCompare(String(b.planEnd))).at(-1);
    gridDate = lastMS?.planEnd ? String(lastMS.planEnd) : planEnd;
  }

  const seed: ProjectSeed = {
    name: String(rows[0]?.[0] ?? wsName).trim() || "工程项目施工进度计划",
    goal: grid?.name || "按期完成全部施工任务，确保并网发电",
    totalDays,
    planStart: planStart || sections[0].tasks[0]?.planStart || "",
    planEnd: planEnd || "",
    gridDate: gridDate || planEnd,
    sections,
  };

  // 简单数据校验
  if (!seed.sections.length) throw new Error("解析后分部为空，请检查 Excel 格式");
  const totalTasks = seed.sections.reduce((a, s) => a + s.tasks.length, 0);
  if (!totalTasks) throw new Error("解析后任务数为 0，请检查 Excel 格式");
  return seed;
}

/** 导入预览摘要（返回给前端展示） */
export function summarizeSeed(s: ProjectSeed) {
  const totalTasks = s.sections.reduce((a, sec) => a + sec.tasks.length, 0);
  const msCount = s.sections.reduce((a, sec) => a + sec.tasks.filter(t => t.milestone).length, 0);
  const depsCount = s.sections.reduce((a, sec) => a + sec.tasks.reduce((b, t) => b + (t.deps?.length || 0), 0), 0);
  return {
    name: s.name,
    planStart: s.planStart,
    planEnd: s.planEnd,
    gridDate: s.gridDate,
    totalDays: s.totalDays,
    sections: s.sections.length,
    totalTasks,
    milestoneCount: msCount,
    dependencyEdges: depsCount,
  };
}

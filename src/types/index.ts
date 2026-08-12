// 大密扣升压站施工进度监控系统 - 类型定义

export interface Task {
  id: string;
  seq: number | null;
  name: string;
  planStart: string | null; // YYYY-MM-DD
  duration: number | null;  // 天
  planEnd: string | null;
  remark: string;
  milestone: boolean;
  deps: string[];           // 前置任务ID
}

export interface Section {
  name: string;
  tasks: Task[];
}

export interface ProjectSeed {
  name: string;
  goal: string;
  totalDays: number;
  planStart: string;
  planEnd: string;
  gridDate: string; // 并网目标日期
  sections: Section[];
}

/** 业主填报的实际进展 */
export interface TaskActual {
  progress: number;            // 0-100
  actualStart: string | null;  // YYYY-MM-DD
  actualEnd: string | null;    // YYYY-MM-DD
  note: string;
  photo: string | null;        // dataURL（压缩后），按需加载
  updatedAt: string;           // ISO
  reportId?: number;           // 关联的已审核填报 ID，用于按需加载照片
}

export interface ProgressLog {
  at: string;        // ISO 时间
  taskId: string;
  progress: number;
  note: string;
}

export interface ProjectState {
  actuals: Record<string, TaskActual>;
  logs: ProgressLog[];
  /** 已闭环处理的预警 key 列表（key = 任务ID+预警类型+计划完成日） */
  closedAlerts: string[];
}

export type TaskStatus =
  | 'not-started'   // 未开始
  | 'on-track'      // 进行中·正常
  | 'delayed'       // 进行中·已延期
  | 'done'          // 按期完成
  | 'done-late';    // 延期完成

export type AlertLevel = 'red' | 'yellow';

export interface AlertItem {
  key: string;
  level: AlertLevel;
  taskId: string;
  taskName: string;
  section: string;
  milestone: boolean;
  reason: string;
  delayDays: number;
  planEnd: string | null;
  impactGrid: boolean;   // 是否传导影响并网节点
  closed: boolean;
}

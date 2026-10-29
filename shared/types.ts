export const categories = ["Pessoal", "Saúde", "Estudos", "Trabalho"] as const;
export type Category = (typeof categories)[number];
export type Frequency = "daily" | "weekly" | "once";
export type Status = "pending" | "done" | "missed";
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: Category;
  frequency: Frequency;
  startDate: string;
  archivedOn: string | null;
  routineId: string | null;
  routineRunId?: string;
  routineActivity?: ActivitySchedule;
  nextRevision?: GoalRevision;
  weekdayMask?: number;
  canDelete?: boolean;
}
export interface GoalRevision {
  id: string;
  goalId: string;
  revisionNumber: number;
  title: string;
  description: string;
  category: Category;
  frequency: Frequency;
  weekdayMask: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}
export interface Occurrence {
  id: string;
  goalId: string;
  revisionId: string;
  periodKind: "day" | "week";
  periodStart: string;
  periodEndExclusive: string;
  eligibleFrom: string;
  timezone: string;
  title: string;
  description: string;
  category: Category;
  frequency: Frequency;
  routineId: string | null;
  routineRunId?: string;
  routineActivity?: ActivitySchedule;
  disposition: "scheduled" | "rest" | "cancelled";
  status: Status;
  recordedAt: string | null;
}
export interface GoalInput {
  title: string;
  description: string;
  category: Category;
  frequency: Frequency;
  startDate: string;
  routineId?: string;
  weekdayMask?: number;
}
export interface GoalUpdate {
  title: string;
  description: string;
  category: Category;
  frequency?: "daily" | "weekly";
  weekdayMask?: number;
  effectiveFrom?: string;
}
export interface Entry {
  goalId: string;
  period: string;
  status: Exclude<Status, "pending">;
}
export interface Snapshot {
  goals: Goal[];
  entries: Entry[];
  schemaVersion?: 2 | 3 | 4;
  revisions?: GoalRevision[];
  occurrences?: Occurrence[];
  dayPlans?: DayPlan[];
  events?: OutcomeEvent[];
  routineRuns?: RoutineRun[];
  preferences?: Preferences;
  longTermGoals?: LongTermGoal[];
}
export const themes = ["violet", "ocean", "forest"] as const;
export type Theme = (typeof themes)[number];
export interface Preferences {
  theme: Theme;
  showEncouragement: boolean;
}
export interface LongTermGoalFields {
  title: string;
  description: string;
  category: Category;
  target: number;
  current: number;
  unit: string;
  dueOn: string | null;
}
export interface LongTermGoalInput extends LongTermGoalFields {
  operationKey: string;
}
export interface LongTermGoal extends LongTermGoalInput {
  id: string;
  createdOn: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
export interface ActivitySchedule {
  time: string | null;
  minutes: number | null;
  intensity: string;
}
export interface RoutineActivityInput extends ActivitySchedule {
  activityId: string;
  title: string;
  description: string;
  category: Category;
}
export interface RoutineRunInput {
  operationKey: string;
  templateId: string;
  templateVersion: number;
  startsOn: string;
  endsOn: string;
  activities: RoutineActivityInput[];
  allowRepeat: boolean;
}
export interface RoutineRun {
  id: string;
  operationKey: string;
  templateId: string;
  templateVersion: number;
  name: string;
  principle: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceCheckedOn: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  activities: (RoutineActivityInput & {
    goals: { id: string; date: string }[];
  })[];
}
export interface DayPlan {
  date: string;
  kind: "rest";
  note: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}
export interface OutcomeEvent {
  id: string;
  occurrenceId: string;
  previousStatus: Status;
  nextStatus: Status;
  changedAt: string;
  reason: "checklist" | "history_correction";
}
export interface StorageInfo {
  mode: "desktop" | "browser";
  path: string;
  schemaVersion?: number;
}
export interface SkyAPI {
  load(): Promise<Snapshot>;
  createGoal(input: GoalInput): Promise<Snapshot>;
  updateGoal(id: string, input: GoalUpdate): Promise<Snapshot>;
  archiveGoal(id: string): Promise<Snapshot>;
  deleteGoal(id: string): Promise<Snapshot>;
  setStatus(id: string, date: string, status: Status): Promise<Snapshot>;
  planRest(date: string, note: string): Promise<Snapshot>;
  removeRest(date: string): Promise<Snapshot>;
  addRoutine(id: string, date: string): Promise<Snapshot>;
  startRoutine(input: RoutineRunInput): Promise<Snapshot>;
  updatePreferences(input: Preferences): Promise<Snapshot>;
  createLongTermGoal(input: LongTermGoalInput): Promise<Snapshot>;
  updateLongTermGoal(id: string, input: LongTermGoalFields): Promise<Snapshot>;
  archiveLongTermGoal(id: string, archived: boolean): Promise<Snapshot>;
  exportBackup(): Promise<import("./backup").BackupExportResult | null>;
  importBackup(): Promise<import("./backup").BackupRestoreResult | null>;
  openDataFolder(): Promise<void>;
  storageInfo(): Promise<StorageInfo>;
  openExternal(url: string): Promise<void>;
}

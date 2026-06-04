import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Select, message } from "antd";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { listUsers } from "@/api/users";
import { listCourses } from "@/api/courses";
import { getCourseStatistics, getCourseTrends } from "@/api/statistics";
import type { User, Course, SessionTrendPoint } from "@/types";
import { useThemeStore } from "@/stores/themeStore";
import { BRAND_PRIMARY_RGB, surfaceColors } from "@/styles/theme";
import { getSemesterLabel } from "@/utils/formatters";

dayjs.extend(isoWeek);

type TrendPeriod = "daily" | "weekly" | "monthly";

// Local alias: dashboard colors come from the shared surface palette so the
// brand blue and surfaces stay in sync with the rest of the app.
type DashColors = ReturnType<typeof surfaceColors>;

// A student is "at risk" when their attendance for a course falls below this.
// Surfaced as a badge so admins can see which courses have students in danger
// of falling short.
const AT_RISK_THRESHOLD = 70;

// courseId → number of at-risk students, or undefined while loading / when the
// course's stats failed to load (renders "—").
type AtRiskMap = Record<number, number | undefined>;

// Collapse per-session trend points into buckets by day/week/month, summing
// present/late/absent. The raw data has one point per session, so multiple
// sessions on the same day (or week/month) get merged into a single bar.
function aggregateTrends(data: SessionTrendPoint[], period: TrendPeriod) {
  const bucketKey = (date: string) => {
    const d = dayjs(date);
    if (period === "weekly") return d.startOf("isoWeek").format("YYYY-MM-DD");
    if (period === "monthly") return d.format("YYYY-MM");
    return d.format("YYYY-MM-DD");
  };

  const buckets = new Map<string, { date: string; present: number; late: number; absent: number }>();
  for (const point of data) {
    const key = bucketKey(point.date);
    const existing = buckets.get(key);
    if (existing) {
      existing.present += point.present;
      existing.late += point.late;
      existing.absent += point.absent;
    } else {
      buckets.set(key, { date: key, present: point.present, late: point.late, absent: point.absent });
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  badge?: string;
  progress?: number;
  linkLabel?: string;
  onLinkClick?: () => void;
  loading?: boolean;
  c: DashColors;
}

function StatCard({ label, value, badge, progress, linkLabel, onLinkClick, loading, c }: StatCardProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.textMuted, fontSize: 13, marginBottom: 14 }}>
        <span>{label}</span>
        {badge && (
          <span
            style={{
              marginLeft: "auto",
              background: c.greenSoft,
              color: c.green,
              fontSize: 10.5,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: loading ? c.textFaint : c.text,
          lineHeight: 1,
          marginBottom: 14,
          letterSpacing: "-0.02em",
        }}
      >
        {loading ? "—" : value}
      </div>

      {progress !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textMuted }}>
            <span>{t("dashboard.progress")}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 6, background: c.surface3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: c.accent, borderRadius: 3, transition: "width 0.5s ease" }} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: c.textMuted }}>
          {linkLabel && (
            <span
              onClick={onLinkClick}
              style={{ cursor: "pointer", color: c.textMuted, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = c.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
            >
              {linkLabel} →
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Courses Table ─────────────────────────────────────────────────────────────
function CoursesTable({
  courses,
  loading,
  atRisk,
  c,
}: {
  courses: Course[];
  loading: boolean;
  atRisk: AtRiskMap;
  c: DashColors;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const colorPairs = [
    { bg: "#fde68a", color: "#b45309" },
    { bg: "#bbf7d0", color: "#166534" },
    { bg: "#fecaca", color: "#991b1b" },
    { bg: `rgba(${BRAND_PRIMARY_RGB},0.14)`, color: c.accent },
    { bg: "#fbcfe8", color: "#9d174d" },
    { bg: "#a7f3d0", color: "#065f46" },
    { bg: "#ddd6fe", color: "#5b21b6" },
    { bg: "#fed7aa", color: "#9a3412" },
    { bg: "#cffafe", color: "#155e75" },
  ];

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{t("nav.courses")}</span>
        <button
          onClick={() => navigate("/admin/courses")}
          style={{
            background: c.surface3,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
            color: c.textMuted,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {t("dashboard.viewAll")} →
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[t("dashboard.colCode"), t("dashboard.colCourseName"), t("dashboard.colSemester"), t("dashboard.colAtRisk"), ""].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "left",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: c.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${c.border}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
                        <div style={{ height: 14, background: c.surface3, borderRadius: 4, width: "70%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              : courses.map((course, i) => {
                  const pair = colorPairs[i % colorPairs.length];
                  const riskCount = atRisk[course.id];
                  const hasStat = riskCount !== undefined;
                  return (
                    <tr
                      key={course.id}
                      style={{ transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: c.text,
                          }}
                        >
                          {course.code}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13.5, color: c.text }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: pair.bg,
                              color: pair.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {course.code.slice(0, 2).toUpperCase()}
                          </div>
                          {course.name}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 13, color: c.textMuted }}>
                        {getSemesterLabel(course.semester, t)} · {course.academic_year}
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
                        {!hasStat ? (
                          <span style={{ fontSize: 12, color: c.textMuted }}>—</span>
                        ) : riskCount > 0 ? (
                          <span
                            title={t("dashboard.atRiskTooltip", { count: riskCount, threshold: AT_RISK_THRESHOLD })}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              background: c.orangeSoft,
                              color: c.orange,
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: 6,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: 11 }}>⚠</span>
                            {t("dashboard.atRiskCount", { count: riskCount })}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              background: c.greenSoft,
                              color: c.green,
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 6,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t("dashboard.allOnTrack")}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
                        <button
                          onClick={() => navigate("/admin/courses")}
                          style={{ background: "none", border: "none", cursor: "pointer", color: c.textMuted, padding: 4, borderRadius: 6, lineHeight: 0 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = c.accent)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
                        >
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const c = surfaceColors(isDark);

  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskMap>({});
  const [loading, setLoading] = useState(true);
  const [trendCourse, setTrendCourse] = useState<number | undefined>(undefined);
  const [trendData, setTrendData] = useState<SessionTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TrendPeriod>("daily");

  const chartData = useMemo(() => aggregateTrends(trendData, activeTab), [trendData, activeTab]);

  const fetchData = useCallback(async () => {
    try {
      const [u, co] = await Promise.all([listUsers(), listCourses()]);
      setUsers(u);
      setCourses(co);
      if (co.length > 0) setTrendCourse(co[0].id);

      // Fetch each course's stats in parallel and derive the at-risk count
      // from the response (no extra requests). A failed/empty course stays
      // absent from the map (renders "—"), so one bad course never blocks
      // the rest. Students with no records are excluded — their rate is
      // meaningless and would otherwise read as a false positive/negative.
      const entries = await Promise.all(
        co.map(async (course): Promise<[number, number | undefined]> => {
          try {
            const s = await getCourseStatistics(course.id);
            const count = s.students.filter(
              (st) => st.total_sessions > 0 && st.attendance_rate < AT_RISK_THRESHOLD,
            ).length;
            return [course.id, count];
          } catch {
            return [course.id, undefined];
          }
        }),
      );
      setAtRisk(Object.fromEntries(entries));
    } catch {
      message.error(t("dashboard.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (trendCourse) {
      setTrendLoading(true);
      getCourseTrends(trendCourse)
        .then(setTrendData)
        .catch(() => {})
        .finally(() => setTrendLoading(false));
    }
  }, [trendCourse]);

  const studentCount = users.filter((u) => u.role === "student").length;
  const professorCount = users.filter((u) => u.role === "professor").length;
  const activeCount = users.filter((u) => u.is_active).length;
  const activeProgress = users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0;

  const tabs = [
    { key: "daily", label: t("dashboard.daily") },
    { key: "weekly", label: t("dashboard.weekly") },
    { key: "monthly", label: t("dashboard.monthly") },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard
          label={t("dashboard.totalUsers")}
          value={users.length}
          progress={activeProgress}
          loading={loading}
          c={c}
        />
        <StatCard
          label={t("dashboard.students")}
          value={studentCount}
          linkLabel={t("dashboard.viewAll", "View All")}
          onLinkClick={() => navigate("/admin/users")}
          loading={loading}
          c={c}
        />
        <StatCard
          label={t("dashboard.professors")}
          value={professorCount}
          linkLabel={t("dashboard.viewCourses", "View Courses")}
          onLinkClick={() => navigate("/admin/courses")}
          loading={loading}
          c={c}
        />
        <StatCard
          label={t("dashboard.activeAccounts")}
          value={activeCount}
          linkLabel={t("dashboard.viewSchedule", "View Schedule")}
          onLinkClick={() => navigate("/admin/schedules")}
          loading={loading}
          c={c}
        />
      </div>

      {/* ── Mid Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>

        {/* Attendance Trends Chart */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{t("dashboard.attendanceTrends")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", background: c.surface3, borderRadius: 8, padding: 3, gap: 2 }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: "5px 14px",
                      fontSize: 12,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 0.15s",
                      background: activeTab === tab.key ? c.surface : "transparent",
                      color: activeTab === tab.key ? c.text : c.textMuted,
                      boxShadow: activeTab === tab.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Select
                value={trendCourse}
                onChange={setTrendCourse}
                size="small"
                style={{ width: 180 }}
                options={courses.map((co) => ({ value: co.id, label: `${co.code} — ${co.name}` }))}
                placeholder={t("dashboard.selectCourse", "Select course")}
              />
            </div>
          </div>

          {trendLoading ? (
            <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: c.textFaint }}>
              {t("common.loading")}
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  tick={{ fill: c.textFaint }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => dayjs(v).format(activeTab === "monthly" ? "MMM YYYY" : "MMM D")}
                />
                <YAxis fontSize={11} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: c.surface3 }}
                  labelFormatter={(v: string) => dayjs(v).format(activeTab === "monthly" ? "MMMM YYYY" : "MMM D, YYYY")}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="present" name={t("common.present")} fill={c.green} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="late" name={t("common.late")} fill={c.orange} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" name={t("common.absent")} fill={c.red} stackId="a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: c.textFaint }}>{t("dashboard.selectCourseForTrends")}</span>
            </div>
          )}
        </div>

        {/* Right: Users Breakdown */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{t("dashboard.userBreakdown")}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {[
              { label: t("dashboard.students"), count: studentCount, color: c.accent, soft: c.accentSoft, initials: "ST" },
              { label: t("dashboard.professors"), count: professorCount, color: c.blue, soft: c.surface3, initials: "PR" },
              { label: t("dashboard.admin"), count: users.filter((u) => u.role === "admin").length, color: c.orange, soft: c.orangeSoft, initials: "AD" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: item.soft,
                    color: item.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {item.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: c.text }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: c.textMuted }}>{item.count} {t("common.users")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 22,
                      color: c.text,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {loading ? "—" : item.count}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown bar */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${c.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 10, color: c.text }}>
              <span>{t("dashboard.distribution")}</span>
            </div>
            <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 10 }}>
              <div style={{ background: c.accent, width: users.length ? `${(studentCount / users.length) * 100}%` : "0%", transition: "width 0.5s" }} />
              <div style={{ background: c.blue, width: users.length ? `${(professorCount / users.length) * 100}%` : "0%", transition: "width 0.5s" }} />
              <div style={{ background: c.surface3, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: c.textMuted, flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.accent, marginRight: 5, verticalAlign: "middle" }} />{t("dashboard.students")}</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.blue, marginRight: 5, verticalAlign: "middle" }} />{t("dashboard.professors")}</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.surface3, border: `1px solid ${c.borderStrong}`, marginRight: 5, verticalAlign: "middle" }} />{t("dashboard.admin")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Courses Table ── */}
      <CoursesTable courses={courses} loading={loading} atRisk={atRisk} c={c} />

    </div>
  );
}

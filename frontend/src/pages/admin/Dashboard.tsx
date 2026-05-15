import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Select, message } from "antd";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { listUsers } from "@/api/users";
import { listCourses } from "@/api/courses";
import { getCourseTrends } from "@/api/statistics";
import type { User, Course, SessionTrendPoint } from "@/types";
import { useThemeStore } from "@/stores/themeStore";

function tv(isDark: boolean) {
  return {
    surface: isDark ? "#1f2937" : "#ffffff",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    borderStrong: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)",
    text: isDark ? "#e2e8f0" : "#1e293b",
    textMuted: isDark ? "#94a3b8" : "#64748b",
    textFaint: isDark ? "#64748b" : "#94a3b8",
    accent: "#3D5AFE",
    accentSoft: isDark ? "rgba(61,90,254,0.15)" : "#eef2ff",
    green: isDark ? "#34d399" : "#10b981",
    greenSoft: isDark ? "#064e3b" : "#d1fae5",
    orange: isDark ? "#fbbf24" : "#f59e0b",
    orangeSoft: isDark ? "rgba(251,191,36,0.15)" : "#fef3c7",
    blue: isDark ? "#60a5fa" : "#3b82f6",
    surface3: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
    hover: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc",
    chartBar: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
  };
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
  c: ReturnType<typeof tv>;
}

function StatCard({ label, value, badge, progress, linkLabel, onLinkClick, loading, c }: StatCardProps) {
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
          fontSize: 42,
          fontWeight: 800,
          color: loading ? c.textFaint : c.text,
          lineHeight: 1,
          marginBottom: 14,
          letterSpacing: "-0.03em",
        }}
      >
        {loading ? "—" : value}
      </div>

      {progress !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textMuted }}>
            <span>Progress</span>
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
function CoursesTable({ courses, loading, c }: { courses: Course[]; loading: boolean; c: ReturnType<typeof tv> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const colorPairs = [
    { bg: "#fde68a", color: "#b45309" },
    { bg: "#bbf7d0", color: "#166534" },
    { bg: "#fecaca", color: "#991b1b" },
    { bg: "#c7d2fe", color: "#3730a3" },
    { bg: "#fbcfe8", color: "#9d174d" },
    { bg: "#a7f3d0", color: "#065f46" },
    { bg: "#ddd6fe", color: "#5b21b6" },
    { bg: "#fed7aa", color: "#9a3412" },
    { bg: "#cffafe", color: "#155e75" },
  ];

  const fakeProgress = [60, 75, 85, 60, 75, 85, 70, 80, 65];

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
          {t("common.viewAll", "View All")} →
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Code", "Course Name", "Semester", "Progress", ""].map((h, i) => (
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
                  const prog = fakeProgress[i % fakeProgress.length];
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
                        {course.semester} · {course.academic_year}
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, maxWidth: 130, height: 6, background: c.surface3, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${prog}%`, background: c.accent, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: c.textMuted, minWidth: 32 }}>{prog}%</span>
                        </div>
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
  const c = tv(isDark);

  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendCourse, setTrendCourse] = useState<number | undefined>(undefined);
  const [trendData, setTrendData] = useState<SessionTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly">("daily");

  const fetchData = useCallback(async () => {
    try {
      const [u, co] = await Promise.all([listUsers(), listCourses()]);
      setUsers(u);
      setCourses(co);
      if (co.length > 0) setTrendCourse(co[0].id);
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

  const tabs = ["Daily", "Weekly", "Monthly"] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard
          label={t("dashboard.totalUsers")}
          value={users.length}
          badge="+ Active"
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
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase() as typeof activeTab)}
                    style={{
                      padding: "5px 14px",
                      fontSize: 12,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "all 0.15s",
                      background: activeTab === tab.toLowerCase() ? c.surface : "transparent",
                      color: activeTab === tab.toLowerCase() ? c.text : c.textMuted,
                      boxShadow: activeTab === tab.toLowerCase() ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {tab}
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
              Loading...
            </div>
          ) : trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tick={{ fill: c.textFaint }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: c.surface3 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="present" name={t("common.present")} fill={c.green} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="late" name={t("common.late")} fill={c.orange} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="absent" name={t("common.absent")} fill={isDark ? "#f87171" : "#ef4444"} stackId="a" radius={[6, 6, 0, 0]} />
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
            <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>User Breakdown</span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: c.textMuted,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: c.green,
                  boxShadow: `0 0 0 3px ${c.greenSoft}`,
                }}
              />
              {activeCount} Online
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {[
              { label: t("dashboard.students"), count: studentCount, color: c.accent, soft: c.accentSoft, initials: "ST" },
              { label: t("dashboard.professors"), count: professorCount, color: c.blue, soft: c.surface3, initials: "PR" },
              { label: "Admin", count: users.filter((u) => u.role === "admin").length, color: c.orange, soft: c.orangeSoft, initials: "AD" },
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
                  <div style={{ fontSize: 11.5, color: c.textMuted }}>{item.count} users</div>
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
              <span>Distribution</span>
            </div>
            <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 10 }}>
              <div style={{ background: c.accent, width: users.length ? `${(studentCount / users.length) * 100}%` : "0%", transition: "width 0.5s" }} />
              <div style={{ background: c.blue, width: users.length ? `${(professorCount / users.length) * 100}%` : "0%", transition: "width 0.5s" }} />
              <div style={{ background: c.surface3, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: c.textMuted, flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.accent, marginRight: 5, verticalAlign: "middle" }} />{t("dashboard.students")}</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.blue, marginRight: 5, verticalAlign: "middle" }} />{t("dashboard.professors")}</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: c.surface3, border: `1px solid ${c.borderStrong}`, marginRight: 5, verticalAlign: "middle" }} />Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Courses Table ── */}
      <CoursesTable courses={courses} loading={loading} c={c} />

    </div>
  );
}

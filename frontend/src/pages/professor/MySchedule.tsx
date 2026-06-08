import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, Space, Spin, Table, Tag, Typography, message } from "antd";
import type { Schedule } from "@/types";
import { getMySchedule } from "@/api/schedules";
import { getSemesterLabel } from "@/utils/formatters";
import { BRAND_PRIMARY } from "@/styles/theme";
import { useThemeStore } from "@/stores/themeStore";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_ORDER: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));
const LESSON_COLORS: Record<string, string> = { LECTURE: BRAND_PRIMARY, PRACTICE: "#10b981" };
const TRIMESTER_OPTIONS = ["TRIMESTER_1", "TRIMESTER_2", "TRIMESTER_3"];

function formatTime(t: string) { return t?.slice(0, 5) ?? ""; }

function WeekGrid({ schedules, isDark, t }: { schedules: Schedule[]; isDark: boolean; t: (k: string) => string }) {
  const byDay: Record<string, Schedule[]> = {};
  for (const d of DAYS) byDay[d] = [];
  for (const s of schedules) {
    (byDay[s.day_of_week] ??= []).push(s);
  }
  for (const d of DAYS) byDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time));

  const activeDays = DAYS.filter((d) => byDay[d].length > 0);

  if (activeDays.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
        {t("schedulesPage.noSchedules")}
      </div>
    );
  }

  const border = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const headerBg = isDark ? "#2b2b2b" : "#f8fafc";
  const dayLabels: Record<string, string> = {
    MONDAY: t("schedulesPage.monday"),
    TUESDAY: t("schedulesPage.tuesday"),
    WEDNESDAY: t("schedulesPage.wednesday"),
    THURSDAY: t("schedulesPage.thursday"),
    FRIDAY: t("schedulesPage.friday"),
    SATURDAY: t("schedulesPage.saturday"),
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${activeDays.length}, 1fr)`, gap: 12 }}>
      {activeDays.map((day) => (
        <div key={day}>
          <div style={{
            background: headerBg,
            border: `1px solid ${border}`,
            borderRadius: "6px 6px 0 0",
            padding: "8px 12px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: 13,
          }}>
            {dayLabels[day] ?? day}
          </div>
          <div style={{ border: `1px solid ${border}`, borderTop: "none", borderRadius: "0 0 6px 6px", padding: 8, minHeight: 80 }}>
            {byDay[day].map((s) => (
              <div
                key={s.id}
                style={{
                  border: `1px solid ${LESSON_COLORS[s.lesson_type] ?? BRAND_PRIMARY}`,
                  borderLeft: `3px solid ${LESSON_COLORS[s.lesson_type] ?? BRAND_PRIMARY}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  marginBottom: 8,
                  background: s.lesson_type === "LECTURE"
                    ? (isDark ? "rgba(61,90,254,0.08)" : "rgba(61,90,254,0.05)")
                    : (isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)"),
                }}
              >
                <Text strong style={{ fontSize: 12, color: LESSON_COLORS[s.lesson_type], display: "block" }}>
                  {formatTime(s.start_time)} – {formatTime(s.end_time)}
                </Text>
                <Text style={{ fontSize: 13, display: "block", fontWeight: 500 }} ellipsis>
                  {s.course_name ?? `#${s.course_id}`}
                </Text>
                {s.classroom_name && (
                  <Text type="secondary" style={{ fontSize: 11 }}>{s.classroom_name}</Text>
                )}
                <Space size={2} style={{ marginTop: 4, flexWrap: "wrap" }}>
                  <Tag color={s.lesson_type === "LECTURE" ? "blue" : "green"} style={{ margin: 0, fontSize: 11 }}>
                    {s.lesson_type}
                  </Tag>
                  {s.groups.map((g) => (
                    <Tag key={g.id} style={{ margin: 0, fontSize: 11 }}>{g.name}</Tag>
                  ))}
                </Space>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleTable({ schedules, t }: { schedules: Schedule[]; t: (k: string) => string }) {
  const sorted = [...schedules].sort(
    (a, b) => (DAY_ORDER[a.day_of_week] ?? 0) - (DAY_ORDER[b.day_of_week] ?? 0)
      || a.start_time.localeCompare(b.start_time)
  );

  const columns = [
    {
      title: t("schedulesPage.day"),
      dataIndex: "day_of_week",
      key: "day",
      width: 110,
      render: (d: string) => d.charAt(0) + d.slice(1).toLowerCase(),
    },
    {
      title: t("schedulesPage.time"),
      key: "time",
      width: 130,
      render: (_: unknown, r: Schedule) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    {
      title: t("schedulesPage.course"),
      key: "course",
      render: (_: unknown, r: Schedule) => r.course_name ?? `#${r.course_id}`,
    },
    {
      title: t("schedulesPage.classroom"),
      key: "classroom",
      width: 120,
      render: (_: unknown, r: Schedule) => r.classroom_name ?? "—",
    },
    {
      title: t("schedulesPage.type"),
      dataIndex: "lesson_type",
      key: "type",
      width: 90,
      render: (lt: string) => <Tag color={LESSON_COLORS[lt] ? "blue" : "green"}>{lt}</Tag>,
    },
    {
      title: t("schedulesPage.groups"),
      key: "groups",
      render: (_: unknown, r: Schedule) =>
        r.groups.length
          ? r.groups.map((g) => <Tag key={g.id}>{g.name}</Tag>)
          : "—",
    },
  ];

  return <Table dataSource={sorted} columns={columns} rowKey="id" pagination={false} />;
}

export default function MySchedule() {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.isDark);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [semester, setSemester] = useState<string | undefined>();
  const [view, setView] = useState<"week" | "table">("week");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMySchedule();
      setSchedules(data);
    } catch {
      message.error(t("schedulesPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = semester
    ? schedules.filter((s) => s.semester === semester)
    : schedules;

  const semesterOptions = TRIMESTER_OPTIONS.map((s) => ({
    value: s,
    label: getSemesterLabel(s, t),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("schedulesPage.myScheduleTitle")}
        extra={
          <>
            <Select
              value={semester}
              onChange={setSemester}
              allowClear
              placeholder={t("schedulesPage.allSemesters")}
              style={{ width: 160 }}
              options={semesterOptions}
            />
            <Select
              value={view}
              onChange={setView}
              style={{ width: 130 }}
              options={[
                { value: "week", label: t("schedulesPage.weekView") },
                { value: "table", label: t("schedulesPage.tableView") },
              ]}
            />
          </>
        }
      />

      <Panel flush={view === "table"}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : view === "week" ? (
          <WeekGrid schedules={filtered} isDark={isDark} t={t} />
        ) : (
          <ScheduleTable schedules={filtered} t={t} />
        )}
      </Panel>
    </div>
  );
}

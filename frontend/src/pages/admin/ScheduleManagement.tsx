import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert, Button, Form, Input, Modal, Popconfirm, Select,
  Space, Table, Tag, TimePicker, Typography, Upload, message,
} from "antd";
import {
  DeleteOutlined, EditOutlined, PlusOutlined, TableOutlined,
  CalendarOutlined, UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Classroom, Course, DayOfWeek, Group, Professor, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
import { listProfessors } from "@/api/professors";
import { listClassrooms } from "@/api/classrooms";
import { listGroups } from "@/api/groups";
import {
  createSchedule, deleteSchedule, importSchedulesCSV,
  listSchedules, updateSchedule,
} from "@/api/schedules";
import { getSemesterLabel } from "@/utils/formatters";
import { useThemeStore } from "@/stores/themeStore";
import { BRAND_PRIMARY } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

const DAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const TRIMESTER_OPTIONS = ["TRIMESTER_1", "TRIMESTER_2", "TRIMESTER_3"];
const DAY_ORDER: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]));
const LESSON_COLORS: Record<string, string> = { LECTURE: BRAND_PRIMARY, PRACTICE: "#10b981" };

function formatTime(t: string) { return t?.slice(0, 5) ?? ""; }

function getSlotHour(time: string): number {
  return parseInt(time.split(":")[0], 10);
}

function buildGrid(schedules: Schedule[]): Map<string, Schedule[]> {
  const grid = new Map<string, Schedule[]>();
  for (const s of schedules) {
    const hour = getSlotHour(s.start_time);
    const key = `${s.day_of_week}:${hour}`;
    const arr = grid.get(key) ?? [];
    arr.push(s);
    grid.set(key, arr);
  }
  return grid;
}

interface ScheduleCardProps {
  schedule: Schedule;
  onEdit: () => void;
  onDelete: () => void;
  isDark: boolean;
}

function ScheduleCard({ schedule: s, onEdit, onDelete, isDark }: ScheduleCardProps) {
  const color = LESSON_COLORS[s.lesson_type] ?? BRAND_PRIMARY;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: "5px 7px",
        marginBottom: 4,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text strong style={{ fontSize: 11, color }}>
          {formatTime(s.start_time)}–{formatTime(s.end_time)}
        </Text>
        <Space size={2}>
          <Button
            type="text"
            icon={<EditOutlined style={{ fontSize: 11 }} />}
            size="small"
            style={{ padding: "0 3px", height: 18 }}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          />
          <Popconfirm
            title="Delete schedule?"
            onConfirm={(e) => { e?.stopPropagation(); onDelete(); }}
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined style={{ fontSize: 11 }} />}
              size="small"
              style={{ padding: "0 3px", height: 18 }}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      </div>
      <Text ellipsis style={{ fontSize: 12, display: "block", fontWeight: 500 }}>
        {s.course_name ?? `#${s.course_id}`}
      </Text>
      {s.professor_name && (
        <Text type="secondary" style={{ fontSize: 11, display: "block" }} ellipsis>
          {s.professor_name}
        </Text>
      )}
      <Space size={2} style={{ marginTop: 2, flexWrap: "wrap" }}>
        <Tag color={s.lesson_type === "LECTURE" ? "blue" : "green"} style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
          {s.lesson_type}
        </Tag>
        {s.classroom_name && (
          <Tag style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
            {s.classroom_name}
          </Tag>
        )}
        {s.groups.slice(0, 2).map((g) => (
          <Tag key={g.id} color="default" style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
            {g.name}
          </Tag>
        ))}
        {s.groups.length > 2 && (
          <Tag style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
            +{s.groups.length - 2}
          </Tag>
        )}
      </Space>
    </div>
  );
}

interface WeekGridProps {
  schedules: Schedule[];
  onCellClick: (day: DayOfWeek, slot: string) => void;
  onEdit: (s: Schedule) => void;
  onDelete: (id: number) => void;
  isDark: boolean;
  t: (key: string) => string;
}

function WeekGrid({ schedules, onCellClick, onEdit, onDelete, isDark, t }: WeekGridProps) {
  const grid = buildGrid(schedules);
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const headerBg = isDark ? "#2b2b2b" : "#f8fafc";
  const timeBg = isDark ? "#1a1a1a" : "#f1f5f9";
  const cellHover = isDark ? "rgba(255,255,255,0.04)" : "#f8fafc";

  const dayLabels: Record<string, string> = {
    MONDAY: t("schedulesPage.monday"),
    TUESDAY: t("schedulesPage.tuesday"),
    WEDNESDAY: t("schedulesPage.wednesday"),
    THURSDAY: t("schedulesPage.thursday"),
    FRIDAY: t("schedulesPage.friday"),
    SATURDAY: t("schedulesPage.saturday"),
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{
              width: 58,
              background: headerBg,
              border: `1px solid ${border}`,
              padding: "8px 4px",
              fontSize: 12,
              color: isDark ? "#94a3b8" : "#64748b",
            }}>
              {t("schedulesPage.time")}
            </th>
            {DAYS.map((day) => (
              <th key={day} style={{
                background: headerBg,
                border: `1px solid ${border}`,
                padding: "8px",
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
              }}>
                {dayLabels[day] ?? day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot) => {
            const slotHour = getSlotHour(slot);
            return (
              <tr key={slot}>
                <td style={{
                  background: timeBg,
                  border: `1px solid ${border}`,
                  padding: "4px 6px",
                  textAlign: "right",
                  fontSize: 11,
                  color: isDark ? "#94a3b8" : "#64748b",
                  verticalAlign: "top",
                  whiteSpace: "nowrap",
                }}>
                  {slot}
                </td>
                {DAYS.map((day) => {
                  const key = `${day}:${slotHour}`;
                  const items = grid.get(key) ?? [];
                  return (
                    <td
                      key={day}
                      style={{
                        border: `1px solid ${border}`,
                        padding: 4,
                        verticalAlign: "top",
                        minWidth: 110,
                        minHeight: 70,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onClick={() => onCellClick(day, slot)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = cellHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {items.map((s) => (
                        <ScheduleCard
                          key={s.id}
                          schedule={s}
                          onEdit={() => onEdit(s)}
                          onDelete={() => onDelete(s.id)}
                          isDark={isDark}
                        />
                      ))}
                      {items.length === 0 ? (
                        <div style={{
                          height: 66,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0.25,
                        }}>
                          <PlusOutlined style={{ fontSize: 16, color: isDark ? "#94a3b8" : "#94a3b8" }} />
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 2px", opacity: 0.45 }}>
                          <PlusOutlined style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#64748b" }} />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ScheduleManagement() {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.isDark);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [loading, setLoading] = useState(false);
  const [filterSemester, setFilterSemester] = useState<string | undefined>();
  const [filterYear, setFilterYear] = useState<string | undefined>();
  const [filterCourseId, setFilterCourseId] = useState<number | undefined>();
  const [filterProfessorId, setFilterProfessorId] = useState<number | undefined>();
  const [filterClassroomId, setFilterClassroomId] = useState<number | undefined>();
  const [filterGroupId, setFilterGroupId] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form] = Form.useForm();

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, p, cl, g] = await Promise.all([
        listSchedules({
          semester: filterSemester,
          academic_year: filterYear,
          course_id: filterCourseId,
          professor_id: filterProfessorId,
          classroom_id: filterClassroomId,
          group_id: filterGroupId,
        }),
        listCourses(),
        listProfessors(),
        listClassrooms(true),
        listGroups({ active_only: true }),
      ]);
      setSchedules(s);
      setCourses(c);
      setProfessors(p);
      setClassrooms(cl);
      setGroups(g);
    } catch {
      message.error(t("schedulesPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filterClassroomId, filterCourseId, filterGroupId, filterProfessorId, filterSemester, filterYear, t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = (day?: DayOfWeek, slot?: string) => {
    setEditing(null);
    form.resetFields();
    if (day) form.setFieldValue("day_of_week", day);
    if (slot) form.setFieldValue("start_time", dayjs(slot, "HH:mm"));
    if (filterCourseId) form.setFieldValue("course_id", filterCourseId);
    if (filterProfessorId) form.setFieldValue("professor_id", filterProfessorId);
    if (filterClassroomId) form.setFieldValue("classroom_id", filterClassroomId);
    if (filterGroupId) form.setFieldValue("group_ids", [filterGroupId]);
    if (filterSemester) form.setFieldValue("semester", filterSemester);
    if (filterYear) form.setFieldValue("academic_year", filterYear);
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    form.setFieldsValue({
      course_id: s.course_id,
      professor_id: s.professor_id,
      classroom_id: s.classroom_id,
      day_of_week: s.day_of_week,
      start_time: dayjs(s.start_time, "HH:mm:ss"),
      lesson_type: s.lesson_type,
      semester: s.semester,
      academic_year: s.academic_year,
      group_ids: s.groups.map((g) => g.id),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        start_time: values.start_time.format("HH:mm:ss"),
      };
      if (editing) {
        await updateSchedule(editing.id, payload);
        message.success(t("schedulesPage.scheduleUpdated"));
      } else {
        await createSchedule(payload);
        message.success(t("schedulesPage.scheduleCreated"));
      }
      setModalOpen(false);
      fetchAll();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || t("common.operationFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      message.success(t("schedulesPage.scheduleDeleted"));
      fetchAll();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || t("schedulesPage.deleteFailed"));
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    setCsvResult(null);
    try {
      const result = await importSchedulesCSV(csvFile);
      setCsvResult(result);
      if (result.created > 0) fetchAll();
    } catch {
      message.error(t("schedulesPage.importFailed"));
    } finally {
      setCsvLoading(false);
    }
  };

  const semesterOptions = TRIMESTER_OPTIONS.map((s) => ({
    value: s,
    label: getSemesterLabel(s, t),
  }));
  const courseOptions = useMemo(
    () => courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
    [courses]
  );
  const professorOptions = useMemo(
    () => professors.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })),
    [professors]
  );
  const classroomOptions = useMemo(
    () => classrooms.map((c) => ({ value: c.id, label: c.name })),
    [classrooms]
  );
  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: g.name })),
    [groups]
  );
  const hasFocusedGridFilter = Boolean(filterGroupId || filterCourseId || filterProfessorId || filterClassroomId);
  const hasGridTermFilter = Boolean(filterSemester);

  const clearFilters = () => {
    setFilterSemester(undefined);
    setFilterYear(undefined);
    setFilterCourseId(undefined);
    setFilterProfessorId(undefined);
    setFilterClassroomId(undefined);
    setFilterGroupId(undefined);
  };

  const sortedSchedules = [...schedules].sort(
    (a, b) => (DAY_ORDER[a.day_of_week] ?? 0) - (DAY_ORDER[b.day_of_week] ?? 0)
      || a.start_time.localeCompare(b.start_time)
  );

  const tableColumns = [
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
      width: 120,
      render: (_: unknown, r: Schedule) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    {
      title: t("schedulesPage.course"),
      key: "course",
      render: (_: unknown, r: Schedule) => r.course_name ?? `#${r.course_id}`,
    },
    {
      title: t("schedulesPage.professor"),
      key: "professor",
      width: 160,
      render: (_: unknown, r: Schedule) => r.professor_name ?? "—",
    },
    {
      title: t("schedulesPage.classroom"),
      key: "classroom",
      width: 110,
      render: (_: unknown, r: Schedule) => r.classroom_name ?? "—",
    },
    {
      title: t("schedulesPage.groups"),
      key: "groups",
      width: 180,
      render: (_: unknown, r: Schedule) => (
        r.groups.length ? (
          <Space size={4} wrap>
            {r.groups.map((g) => <Tag key={g.id}>{g.name}</Tag>)}
          </Space>
        ) : "-"
      ),
    },
    {
      title: t("schedulesPage.type"),
      dataIndex: "lesson_type",
      key: "type",
      width: 90,
      render: (lt: string) => (
        <Tag color={lt === "LECTURE" ? "blue" : "green"}>{lt}</Tag>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 130,
      render: (_: unknown, r: Schedule) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>
            {t("common.edit")}
          </Button>
          <Popconfirm
            title={`${t("common.delete")}?`}
            onConfirm={() => handleDelete(r.id)}
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              {t("common.delete")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("schedulesPage.title")}
        extra={
          <>
            <Button icon={<UploadOutlined />} onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}>
              {t("schedulesPage.importCSV")}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
              {t("schedulesPage.addSchedule")}
            </Button>
          </>
        }
      />

      <Panel>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <Select
            value={filterGroupId}
            onChange={setFilterGroupId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("schedulesPage.filterGroup")}
            style={{ flex: "1 1 180px", minWidth: 180 }}
            options={groupOptions}
          />
          <Select
            value={filterCourseId}
            onChange={setFilterCourseId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("common.filterByCourse")}
            style={{ flex: "1 1 240px", minWidth: 220 }}
            options={courseOptions}
          />
          <Select
            value={filterProfessorId}
            onChange={setFilterProfessorId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("schedulesPage.filterProfessor")}
            style={{ flex: "1 1 190px", minWidth: 180 }}
            options={professorOptions}
          />
          <Select
            value={filterClassroomId}
            onChange={setFilterClassroomId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("schedulesPage.filterClassroom")}
            style={{ flex: "1 1 160px", minWidth: 150 }}
            options={classroomOptions}
          />
          <Select
            value={filterSemester}
            onChange={setFilterSemester}
            allowClear
            placeholder={t("schedulesPage.selectSemester")}
            style={{ flex: "0 1 160px", minWidth: 150 }}
            options={semesterOptions}
          />
          <Input
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value || undefined)}
            placeholder={t("schedulesPage.selectAcademicYear")}
            style={{ flex: "0 1 160px", minWidth: 150 }}
            allowClear
          />
          <Button type="text" onClick={clearFilters}>
            {t("groups.clearFilters")}
          </Button>
          <Space.Compact>
            <Button
              icon={<CalendarOutlined />}
              type={viewMode === "grid" ? "primary" : "default"}
              onClick={() => setViewMode("grid")}
            >
              {t("schedulesPage.gridView")}
            </Button>
            <Button
              icon={<TableOutlined />}
              type={viewMode === "table" ? "primary" : "default"}
              onClick={() => setViewMode("table")}
            >
              {t("schedulesPage.tableView")}
            </Button>
          </Space.Compact>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
            {t("common.loading")}
          </div>
        ) : viewMode === "grid" && !hasFocusedGridFilter ? (
          <Alert
            type="info"
            showIcon
            message={t("schedulesPage.focusGridTitle")}
            description={t("schedulesPage.focusGridDescription")}
          />
        ) : viewMode === "grid" && !hasGridTermFilter ? (
          <Alert
            type="warning"
            showIcon
            message={t("schedulesPage.termGridTitle")}
            description={t("schedulesPage.termGridDescription")}
          />
        ) : viewMode === "grid" ? (
          <WeekGrid
            schedules={schedules}
            onCellClick={openCreate}
            onEdit={openEdit}
            onDelete={handleDelete}
            isDark={isDark}
            t={t}
          />
        ) : (
          <Table
            dataSource={sortedSchedules}
            columns={tableColumns}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: (total) => `${total}` }}
            locale={{ emptyText: t("schedulesPage.noSchedules") }}
          />
        )}
      </Panel>

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? t("schedulesPage.editSchedule") : t("schedulesPage.addSchedule")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? t("common.save") : t("common.create")}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="course_id" label={t("schedulesPage.course")} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("schedulesPage.selectCourse")}
              options={courseOptions}
            />
          </Form.Item>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="day_of_week" label={t("schedulesPage.day")} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                placeholder={t("schedulesPage.selectDay")}
                options={DAYS.map((d) => ({
                  value: d,
                  label: t(`schedulesPage.${d.toLowerCase()}` as never) || d,
                }))}
              />
            </Form.Item>
            <Form.Item name="start_time" label={t("schedulesPage.startTime")} rules={[{ required: true }]} style={{ flex: 1 }}>
              <TimePicker format="HH:mm" minuteStep={5} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="lesson_type" label={t("schedulesPage.lessonType")} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                options={[
                  { value: "LECTURE", label: t("schedulesPage.lecture") },
                  { value: "PRACTICE", label: t("schedulesPage.practice") },
                ]}
              />
            </Form.Item>
            <Form.Item name="professor_id" label={t("schedulesPage.professor")} style={{ flex: 1 }}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder={t("schedulesPage.selectProfessor")}
                options={professorOptions}
              />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="classroom_id" label={t("schedulesPage.classroom")} style={{ flex: 1 }}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder={t("schedulesPage.selectClassroom")}
                options={classroomOptions}
              />
            </Form.Item>
            <Form.Item name="semester" label={t("schedulesPage.semester")} style={{ flex: 1 }}>
              <Select
                allowClear
                placeholder={t("schedulesPage.selectSemester")}
                options={semesterOptions}
              />
            </Form.Item>
          </div>

          <Form.Item name="academic_year" label={t("schedulesPage.academicYear")}>
            <Input placeholder="2025-2026" />
          </Form.Item>

          <Form.Item name="group_ids" label={t("schedulesPage.groups")}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder={t("schedulesPage.selectGroups")}
              options={groupOptions}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        title={t("schedulesPage.importTitle")}
        open={csvModalOpen}
        onCancel={() => setCsvModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCsvModalOpen(false)}>{t("common.close")}</Button>,
          <Button key="import" type="primary" loading={csvLoading} disabled={!csvFile} onClick={handleCsvImport}>
            {t("schedulesPage.importCSV")}
          </Button>,
        ]}
        width={500}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            {t("schedulesPage.csvRequired")}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t("schedulesPage.csvOptional")}
          </Text>
        </div>
        <Upload.Dragger
          accept=".csv"
          maxCount={1}
          beforeUpload={(file) => { setCsvFile(file); return false; }}
          onRemove={() => setCsvFile(null)}
          fileList={csvFile ? [{ uid: "1", name: csvFile.name, status: "done" }] : []}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">{t("usersPage.dragCSV")}</p>
        </Upload.Dragger>
        {csvResult && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type={csvResult.errors.length > 0 ? "warning" : "success"}
              message={`${t("usersPage.importComplete")}: ${csvResult.created} created, ${csvResult.skipped} skipped`}
              description={
                csvResult.errors.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                    {csvResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    {csvResult.errors.length > 10 && (
                      <li>{t("usersPage.andMore", { count: csvResult.errors.length - 10 })}</li>
                    )}
                  </ul>
                ) : undefined
              }
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

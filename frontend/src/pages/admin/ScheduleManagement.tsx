import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  Input,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Course, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
import { createSchedule, deleteSchedule, listSchedules, updateSchedule } from "@/api/schedules";
import { BRAND_PRIMARY } from "@/styles/theme";

const { Title } = Typography;

const DAY_ORDER: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const classTypeColors: Record<string, string> = {
  lecture: BRAND_PRIMARY,
  lab: "green",
  seminar: "purple",
};

function formatTime(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function ScheduleManagement() {
  const { t } = useTranslation();

  const DAY_OPTIONS = [
    { value: "monday", label: t("schedulesPage.monday") },
    { value: "tuesday", label: t("schedulesPage.tuesday") },
    { value: "wednesday", label: t("schedulesPage.wednesday") },
    { value: "thursday", label: t("schedulesPage.thursday") },
    { value: "friday", label: t("schedulesPage.friday") },
    { value: "saturday", label: t("schedulesPage.saturday") },
  ];

  const CLASS_TYPE_OPTIONS = [
    { value: "lecture", label: t("schedulesPage.lecture") },
    { value: "lab", label: t("schedulesPage.lab") },
    { value: "seminar", label: t("schedulesPage.seminar") },
  ];

  const dayLabelMap = Object.fromEntries(DAY_OPTIONS.map((d) => [d.value, d.label]));
  const classTypeLabelMap = Object.fromEntries(CLASS_TYPE_OPTIONS.map((ct) => [ct.value, ct.label]));

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [filterCourseId, setFilterCourseId] = useState<number | undefined>(undefined);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([listSchedules(filterCourseId), listCourses()]);
      setSchedules(s);
      setCourses(c);
    } catch {
      message.error(t("schedulesPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filterCourseId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    if (filterCourseId) form.setFieldValue("course_id", filterCourseId);
    setModalOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    form.setFieldsValue({
      course_id: s.course_id,
      day_of_week: s.day_of_week,
      start_time: dayjs(s.start_time, "HH:mm:ss"),
      end_time: dayjs(s.end_time, "HH:mm:ss"),
      room: s.room,
      class_type: s.class_type,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        start_time: values.start_time.format("HH:mm:ss"),
        end_time: values.end_time.format("HH:mm:ss"),
      };
      if (editing) {
        const { course_id: _ignored, ...updatePayload } = payload;
        await updateSchedule(editing.id, updatePayload);
        message.success(t("schedulesPage.scheduleUpdated"));
      } else {
        await createSchedule(payload);
        message.success(t("schedulesPage.scheduleCreated"));
      }
      setModalOpen(false);
      fetchData();
    } catch {
      message.error(t("common.operationFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      message.success(t("schedulesPage.scheduleDeleted"));
      fetchData();
    } catch {
      message.error(t("schedulesPage.deleteFailed"));
    }
  };

  const sorted = [...schedules].sort(
    (a, b) => (DAY_ORDER[a.day_of_week] ?? 0) - (DAY_ORDER[b.day_of_week] ?? 0) || a.start_time.localeCompare(b.start_time)
  );

  const columns = [
    {
      title: t("schedulesPage.course"),
      key: "course",
      render: (_: unknown, r: Schedule) => {
        const c = courseMap.get(r.course_id);
        return c ? `${c.code} — ${c.name}` : `#${r.course_id}`;
      },
    },
    {
      title: t("schedulesPage.day"),
      dataIndex: "day_of_week",
      key: "day_of_week",
      width: 120,
      render: (d: string) => dayLabelMap[d] ?? (d.charAt(0).toUpperCase() + d.slice(1)),
    },
    {
      title: t("schedulesPage.time"),
      key: "time",
      width: 140,
      render: (_: unknown, r: Schedule) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    { title: t("schedulesPage.room"), dataIndex: "room", key: "room", width: 100 },
    {
      title: t("schedulesPage.type"),
      dataIndex: "class_type",
      key: "class_type",
      width: 100,
      render: (ct: string) => <Tag color={classTypeColors[ct]}>{classTypeLabelMap[ct] ?? (ct.charAt(0).toUpperCase() + ct.slice(1))}</Tag>,
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 160,
      render: (_: unknown, r: Schedule) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>{t("common.edit")}</Button>
          <Popconfirm title={`${t("common.delete")}?`} onConfirm={() => handleDelete(r.id)} okButtonProps={{ danger: true }}>
            <Button type="link" danger icon={<DeleteOutlined />}>{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t("schedulesPage.title")}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("schedulesPage.addSchedule")}</Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          value={filterCourseId}
          onChange={setFilterCourseId}
          allowClear
          placeholder={t("common.filterByCourse")}
          style={{ width: 300 }}
          options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        />
      </Space>

      <Table dataSource={sorted} columns={columns} rowKey="id" loading={loading}
        pagination={{ pageSize: 15, showTotal: (total) => `${total} ${t("common.entries")}` }} />

      <Modal
        title={editing ? t("schedulesPage.editSchedule") : t("schedulesPage.addSchedule")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? t("common.save") : t("common.create")}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="course_id" label={t("schedulesPage.course")} rules={[{ required: true }]}>
            <Select
              placeholder={t("schedulesPage.selectCourse")}
              disabled={!!editing}
              showSearch
              optionFilterProp="label"
              options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            />
          </Form.Item>
          <Form.Item name="day_of_week" label={t("schedulesPage.day")} rules={[{ required: true }]}>
            <Select options={DAY_OPTIONS} placeholder={t("schedulesPage.selectDay")} />
          </Form.Item>
          <Space>
            <Form.Item name="start_time" label={t("schedulesPage.startTime")} rules={[{ required: true }]}>
              <TimePicker format="HH:mm" minuteStep={5} />
            </Form.Item>
            <Form.Item name="end_time" label={t("schedulesPage.endTime")} rules={[{ required: true }]}>
              <TimePicker format="HH:mm" minuteStep={5} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="room" label={t("schedulesPage.room")} rules={[{ required: true }]}>
              <Input placeholder="A-101" style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="class_type" label={t("schedulesPage.type")} rules={[{ required: true }]}>
              <Select options={CLASS_TYPE_OPTIONS} style={{ width: 140 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

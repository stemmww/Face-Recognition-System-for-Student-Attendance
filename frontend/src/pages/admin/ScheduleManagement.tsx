import { useCallback, useEffect, useState } from "react";
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

const { Title } = Typography;

const DAY_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
];

const DAY_ORDER: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const CLASS_TYPE_OPTIONS = [
  { value: "lecture", label: "Lecture" },
  { value: "lab", label: "Lab" },
  { value: "seminar", label: "Seminar" },
];

const classTypeColors: Record<string, string> = {
  lecture: "blue",
  lab: "green",
  seminar: "purple",
};

function formatTime(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function ScheduleManagement() {
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
      message.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filterCourseId]);

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
        const { course_id: _, ...updatePayload } = payload;
        await updateSchedule(editing.id, updatePayload);
        message.success("Schedule updated");
      } else {
        await createSchedule(payload);
        message.success("Schedule created");
      }
      setModalOpen(false);
      fetchData();
    } catch {
      message.error("Operation failed");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      message.success("Schedule deleted");
      fetchData();
    } catch {
      message.error("Failed to delete");
    }
  };

  const sorted = [...schedules].sort(
    (a, b) => (DAY_ORDER[a.day_of_week] ?? 0) - (DAY_ORDER[b.day_of_week] ?? 0) || a.start_time.localeCompare(b.start_time)
  );

  const columns = [
    {
      title: "Course",
      key: "course",
      render: (_: unknown, r: Schedule) => {
        const c = courseMap.get(r.course_id);
        return c ? `${c.code} — ${c.name}` : `#${r.course_id}`;
      },
    },
    {
      title: "Day",
      dataIndex: "day_of_week",
      key: "day_of_week",
      width: 120,
      render: (d: string) => d.charAt(0).toUpperCase() + d.slice(1),
    },
    {
      title: "Time",
      key: "time",
      width: 140,
      render: (_: unknown, r: Schedule) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`,
    },
    { title: "Room", dataIndex: "room", key: "room", width: 100 },
    {
      title: "Type",
      dataIndex: "class_type",
      key: "class_type",
      width: 100,
      render: (t: string) => <Tag color={classTypeColors[t]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_: unknown, r: Schedule) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.id)} okButtonProps={{ danger: true }}>
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Schedule Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Schedule</Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          value={filterCourseId}
          onChange={setFilterCourseId}
          allowClear
          placeholder="Filter by course"
          style={{ width: 300 }}
          options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        />
      </Space>

      <Table dataSource={sorted} columns={columns} rowKey="id" loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} entries` }} />

      <Modal
        title={editing ? "Edit Schedule" : "Add Schedule"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? "Save" : "Create"}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="course_id" label="Course" rules={[{ required: true }]}>
            <Select
              placeholder="Select course"
              disabled={!!editing}
              showSearch
              optionFilterProp="label"
              options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            />
          </Form.Item>
          <Form.Item name="day_of_week" label="Day" rules={[{ required: true }]}>
            <Select options={DAY_OPTIONS} placeholder="Select day" />
          </Form.Item>
          <Space>
            <Form.Item name="start_time" label="Start Time" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" minuteStep={5} />
            </Form.Item>
            <Form.Item name="end_time" label="End Time" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" minuteStep={5} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="room" label="Room" rules={[{ required: true }]}>
              <Input placeholder="A-101" style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="class_type" label="Type" rules={[{ required: true }]}>
              <Select options={CLASS_TYPE_OPTIONS} style={{ width: 140 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

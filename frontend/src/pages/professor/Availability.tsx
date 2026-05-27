import { useCallback, useEffect, useState } from "react";
import {
  Button, Form, Popconfirm, Select, Table, Tag, TimePicker, Typography, message,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { ProfessorAvailability } from "@/types";
import { addAvailabilitySlot, deleteAvailabilitySlot, getMyAvailability } from "@/api/availability";
import { BRAND_PRIMARY } from "@/styles/theme";

const { Title, Text } = Typography;

const DAY_OPTIONS = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
];

const DAY_ORDER: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

function formatTime(t: string) { return t?.slice(0, 5) ?? ""; }

export default function Availability() {
  const [slots, setSlots] = useState<ProfessorAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAvailability();
      setSlots(data);
    } catch {
      message.error("Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await addAvailabilitySlot({
        day_of_week: values.day_of_week,
        start_time: values.start_time.format("HH:mm:ss"),
        end_time: values.end_time.format("HH:mm:ss"),
      });
      message.success("Slot added");
      form.resetFields();
      fetchSlots();
    } catch {
      message.error("Failed to add slot");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAvailabilitySlot(id);
      message.success("Slot removed");
      fetchSlots();
    } catch {
      message.error("Failed to remove slot");
    }
  };

  const sorted = [...slots].sort(
    (a, b) => (DAY_ORDER[a.day_of_week] ?? 0) - (DAY_ORDER[b.day_of_week] ?? 0) || a.start_time.localeCompare(b.start_time)
  );

  const columns = [
    {
      title: "Day",
      dataIndex: "day_of_week",
      key: "day",
      width: 130,
      render: (d: string) => <Tag color={BRAND_PRIMARY}>{d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()}</Tag>,
    },
    {
      title: "From",
      key: "from",
      width: 90,
      render: (_: unknown, s: ProfessorAvailability) => formatTime(s.start_time),
    },
    {
      title: "To",
      key: "to",
      width: 90,
      render: (_: unknown, s: ProfessorAvailability) => formatTime(s.end_time),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_: unknown, s: ProfessorAvailability) => (
        <Popconfirm title="Remove this slot?" onConfirm={() => handleDelete(s.id)} okButtonProps={{ danger: true }}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Title level={4} style={{ marginBottom: 4 }}>My Availability</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
        Mark the time slots when you are available to teach. Admin will use this when building the schedule.
      </Text>

      {/* Add slot form */}
      <Form form={form} layout="inline" style={{ marginBottom: 20 }}>
        <Form.Item name="day_of_week" rules={[{ required: true }]}>
          <Select options={DAY_OPTIONS} placeholder="Day" style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="start_time" rules={[{ required: true }]}>
          <TimePicker format="HH:mm" minuteStep={30} placeholder="From" />
        </Form.Item>
        <Form.Item name="end_time" rules={[{ required: true }]}>
          <TimePicker format="HH:mm" minuteStep={30} placeholder="To" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add slot</Button>
        </Form.Item>
      </Form>

      <Table
        dataSource={sorted}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        style={{ maxWidth: 480 }}
      />
    </>
  );
}

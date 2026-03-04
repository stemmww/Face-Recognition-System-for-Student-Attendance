import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Appeal } from "@/types";
import { createAppeal, getMyAppeals } from "@/api/appeals";

const { Title } = Typography;
const { TextArea } = Input;

const statusColors: Record<string, string> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
};

export default function Appeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchAppeals = useCallback(async () => {
    try {
      setAppeals(await getMyAppeals());
    } catch {
      message.error("Failed to load appeals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createAppeal(values);
      message.success("Appeal submitted successfully");
      setModalOpen(false);
      form.resetFields();
      fetchAppeals();
    } catch {
      message.error("Failed to submit appeal");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 60,
    },
    {
      title: "Attendance Record",
      dataIndex: "attendance_id",
      width: 140,
      render: (id: number) => `Record #${id}`,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      ellipsis: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Tag>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "created_at",
      width: 160,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>My Appeals</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Appeal
        </Button>
      </div>

      <Table
        dataSource={appeals}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="No appeals submitted yet" /> }}
      />

      <Modal
        title="Submit Appeal"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="Submit"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="attendance_id"
            label="Attendance Record ID"
            rules={[{ required: true, message: "Enter the attendance record ID" }]}
            extra="You can find this ID from your Attendance History page"
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder="e.g. 42" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason for Appeal"
            rules={[
              { required: true, message: "Please explain your reason" },
              { min: 10, message: "Please provide at least 10 characters" },
            ]}
          >
            <TextArea rows={4} placeholder="Explain why you believe the attendance status was incorrect..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

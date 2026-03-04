import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Empty,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Appeal } from "@/types";
import { listAppeals, reviewAppeal } from "@/api/appeals";

const { Title } = Typography;

const statusColors: Record<string, string> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
};

export default function AppealsReview() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      setAppeals(await listAppeals(filter));
    } catch {
      message.error("Failed to load appeals");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    try {
      await reviewAppeal(id, status);
      message.success(`Appeal ${status}`);
      fetchAppeals();
    } catch {
      message.error("Failed to review appeal");
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 60,
    },
    {
      title: "Student",
      dataIndex: "student_id",
      width: 100,
      render: (id: number) => `Student #${id}`,
    },
    {
      title: "Record",
      dataIndex: "attendance_id",
      width: 100,
      render: (id: number) => `#${id}`,
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
    {
      title: "Actions",
      width: 160,
      render: (_: unknown, record: Appeal) => {
        if (record.status !== "pending") return <Tag>Reviewed</Tag>;
        return (
          <Space>
            <Popconfirm
              title="Approve this appeal?"
              description="The student's attendance will be updated to Present."
              onConfirm={() => handleReview(record.id, "approved")}
            >
              <Button type="primary" size="small" icon={<CheckOutlined />}>
                Approve
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Reject this appeal?"
              onConfirm={() => handleReview(record.id, "rejected")}
            >
              <Button danger size="small" icon={<CloseOutlined />}>
                Reject
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Title level={4}>Appeals Review</Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filter by status"
          value={filter}
          onChange={setFilter}
          allowClear
          style={{ width: 200 }}
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </Space>

      <Table
        dataSource={appeals}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="No appeals found" /> }}
      />
    </>
  );
}

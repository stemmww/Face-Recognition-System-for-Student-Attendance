import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      setAppeals(await listAppeals(filter));
    } catch {
      message.error(t("appeals.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    try {
      await reviewAppeal(id, status);
      message.success(t("appeals.statusUpdated", { status: status === "approved" ? t("common.approved") : t("common.rejected") }));
      fetchAppeals();
    } catch {
      message.error(t("appeals.reviewFailed"));
    }
  };

  const statusLabel = (status: string) => {
    if (status === "pending") return t("common.pending");
    if (status === "approved") return t("common.approved");
    if (status === "rejected") return t("common.rejected");
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const columns = [
    {
      title: t("common.id"),
      dataIndex: "id",
      width: 60,
    },
    {
      title: t("attendance.studentCol"),
      dataIndex: "student_id",
      width: 100,
      render: (id: number) => `Student #${id}`,
    },
    {
      title: t("appeals.record"),
      dataIndex: "attendance_id",
      width: 100,
      render: (id: number) => `#${id}`,
    },
    {
      title: t("appeals.reason"),
      dataIndex: "reason",
      ellipsis: true,
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      width: 110,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabel(status)}</Tag>
      ),
    },
    {
      title: t("appeals.submitted"),
      dataIndex: "created_at",
      width: 160,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: t("common.actions"),
      width: 160,
      render: (_: unknown, record: Appeal) => {
        if (record.status !== "pending") return <Tag>{t("common.reviewed")}</Tag>;
        return (
          <Space>
            <Popconfirm
              title={t("appeals.approveTitle")}
              description={t("appeals.approveDesc")}
              onConfirm={() => handleReview(record.id, "approved")}
            >
              <Button type="primary" size="small" icon={<CheckOutlined />}>
                {t("appeals.approve")}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={t("appeals.rejectTitle")}
              onConfirm={() => handleReview(record.id, "rejected")}
            >
              <Button danger size="small" icon={<CloseOutlined />}>
                {t("appeals.reject")}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Title level={4}>{t("appeals.reviewTitle")}</Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder={t("appeals.filterByStatus")}
          value={filter}
          onChange={setFilter}
          allowClear
          style={{ width: 200 }}
          options={[
            { value: "pending", label: t("common.pending") },
            { value: "approved", label: t("common.approved") },
            { value: "rejected", label: t("common.rejected") },
          ]}
        />
      </Space>

      <Table
        dataSource={appeals}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description={t("appeals.noAppealsFound")} /> }}
      />
    </>
  );
}

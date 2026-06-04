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
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import type { Appeal } from "@/types";
import { createAppeal, getMyAppeals } from "@/api/appeals";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { TextArea } = Input;

const statusColors: Record<string, string> = {
  pending: "#fa8c16",
  approved: "#52c41a",
  rejected: "#ff4d4f",
};

export default function Appeals() {
  const { t } = useTranslation();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchAppeals = useCallback(async () => {
    try {
      setAppeals(await getMyAppeals());
    } catch {
      message.error(t("appeals.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createAppeal(values);
      message.success(t("appeals.submitSuccess"));
      setModalOpen(false);
      form.resetFields();
      fetchAppeals();
    } catch {
      message.error(t("appeals.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: t("common.id"),
      dataIndex: "id",
      width: 60,
    },
    {
      title: t("appeals.attendanceRecord"),
      dataIndex: "attendance_id",
      width: 140,
      render: (id: number) => `Record #${id}`,
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
        <Tag color={statusColors[status]}>{t(`common.${status}`)}</Tag>
      ),
    },
    {
      title: t("appeals.submitted"),
      dataIndex: "created_at",
      width: 160,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("appeals.title")}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {t("appeals.newAppeal")}
          </Button>
        }
      />

      <Panel flush>
        <Table
          dataSource={appeals}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: <Empty description={t("appeals.noAppeals")} /> }}
        />
      </Panel>

      <Modal
        title={t("appeals.submitAppeal")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={t("common.submit")}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="attendance_id"
            label={t("appeals.attendanceRecordId")}
            rules={[{ required: true, message: t("appeals.enterRecordId") }]}
            extra={t("appeals.findIdHint")}
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder={t("appeals.recordIdPlaceholder")} />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t("appeals.reasonForAppeal")}
            rules={[
              { required: true, message: t("appeals.reasonRequired") },
              { min: 10, message: t("appeals.reasonMinLength") },
            ]}
          >
            <TextArea rows={4} placeholder={t("appeals.reasonPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

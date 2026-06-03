import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert, Button, Form, Input, InputNumber, Modal, Popconfirm,
  Space, Switch, Table, Tag, Typography, Upload, message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { Classroom, CsvImportResult } from "@/types";
import {
  createClassroom, deleteClassroom, importClassroomsCSV,
  listClassrooms, updateClassroom,
} from "@/api/classrooms";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

const ROOM_TYPE_COLOR: Record<string, string> = { L: "purple", P: "cyan", K: "default" };

export default function ClassroomManagement() {
  const { t } = useTranslation();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form] = Form.useForm();

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setClassrooms(await listClassrooms(false));
    } catch {
      message.error(t("classroomsPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (c: Classroom) => {
    setEditing(c);
    form.setFieldsValue({ name: c.name, capacity: c.capacity, is_active: c.is_active });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateClassroom(editing.id, { capacity: values.capacity, is_active: values.is_active });
        message.success(t("classroomsPage.updated"));
      } else {
        await createClassroom({ name: values.name, capacity: values.capacity });
        message.success(t("classroomsPage.created"));
      }
      setModalOpen(false);
      fetchAll();
    } catch {
      message.error(t("common.operationFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteClassroom(id);
      message.success(t("classroomsPage.deleted"));
      fetchAll();
    } catch {
      message.error(t("common.operationFailed"));
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    setCsvResult(null);
    try {
      const result = await importClassroomsCSV(csvFile);
      setCsvResult(result);
      if (result.created > 0) fetchAll();
    } catch {
      message.error(t("classroomsPage.importFailed"));
    } finally {
      setCsvLoading(false);
    }
  };

  const columns = [
    {
      title: t("common.name"),
      dataIndex: "name",
      key: "name",
      width: 150,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: t("classroomsPage.block"),
      dataIndex: "block",
      key: "block",
      width: 80,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: t("classroomsPage.floor"),
      dataIndex: "floor",
      key: "floor",
      width: 70,
      render: (v: number | null) => v ?? "—",
    },
    {
      title: t("classroomsPage.roomType"),
      key: "room_type",
      width: 150,
      render: (_: unknown, c: Classroom) =>
        c.room_type
          ? <Tag color={ROOM_TYPE_COLOR[c.room_type] ?? "default"}>{c.room_type_label ?? c.room_type}</Tag>
          : <Text type="secondary">—</Text>,
    },
    {
      title: t("classroomsPage.capacity"),
      dataIndex: "capacity",
      key: "capacity",
      width: 90,
      render: (v: number | null) => v ?? "—",
    },
    {
      title: t("common.status"),
      dataIndex: "is_active",
      key: "is_active",
      width: 90,
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>
          {v ? t("common.active") : t("common.inactive")}
        </Tag>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 160,
      render: (_: unknown, c: Classroom) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(c)}>
            {t("common.edit")}
          </Button>
          <Popconfirm
            title={t("classroomsPage.deleteConfirm")}
            onConfirm={() => handleDelete(c.id)}
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
        title={t("classroomsPage.title")}
        extra={
          <>
            <Button
              icon={<UploadOutlined />}
              onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}
            >
              {t("classroomsPage.importCSV")}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t("classroomsPage.addClassroom")}
            </Button>
          </>
        }
      />

      <Panel flush>
        <Table
          dataSource={classrooms}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 25, showTotal: (n) => `${n} ${t("common.total")}` }}
        />
      </Panel>

      <Modal
        title={editing ? t("classroomsPage.editClassroom") : t("classroomsPage.addClassroom")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? t("common.save") : t("common.create")}
        width={440}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={t("common.name")}
            rules={[{ required: true }]}
            extra={t("classroomsPage.nameHint")}
          >
            <Input
              placeholder="C1.1.349K"
              disabled={!!editing}
              style={{ fontFamily: "monospace", textTransform: "uppercase" }}
            />
          </Form.Item>
          <Form.Item name="capacity" label={t("classroomsPage.capacity")}>
            <InputNumber min={1} max={1000} style={{ width: 120 }} />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label={t("common.status")} valuePropName="checked">
              <Switch
                checkedChildren={t("common.active")}
                unCheckedChildren={t("common.inactive")}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={t("classroomsPage.importTitle")}
        open={csvModalOpen}
        onCancel={() => setCsvModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCsvModalOpen(false)}>{t("common.close")}</Button>,
          <Button
            key="import"
            type="primary"
            loading={csvLoading}
            disabled={!csvFile}
            onClick={handleCsvImport}
          >
            {t("classroomsPage.importCSV")}
          </Button>,
        ]}
        width={480}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            {t("classroomsPage.csvRequired")}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t("classroomsPage.csvOptional")}
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
              message={`${t("usersPage.importComplete")}: ${csvResult.created} ${t("usersPage.studentsCreated")}, ${csvResult.skipped} ${t("usersPage.accountsSkipped")}`}
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

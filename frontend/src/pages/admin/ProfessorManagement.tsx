import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert, Button, Form, Input, Modal, Popconfirm,
  Space, Table, Tag, Typography, Upload, message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { CourseSummary, CsvImportResult, Professor } from "@/types";
import {
  createProfessor, deleteProfessor, importProfessorsCSV,
  listProfessors, updateProfessor,
} from "@/api/professors";
import { BRAND_PRIMARY } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

export default function ProfessorManagement() {
  const { t } = useTranslation();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Professor | null>(null);
  const [form] = Form.useForm();

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setProfessors(await listProfessors());
    } catch {
      message.error(t("professorsPage.loadFailed"));
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

  const openEdit = (p: Professor) => {
    setEditing(p);
    form.setFieldsValue({ first_name: p.first_name, last_name: p.last_name });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateProfessor(editing.id, {
          first_name: values.first_name,
          last_name: values.last_name,
        });
        message.success(t("professorsPage.updated"));
      } else {
        await createProfessor({
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          password: values.password,
        });
        message.success(t("professorsPage.created"));
      }
      setModalOpen(false);
      fetchAll();
    } catch {
      message.error(t("common.operationFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProfessor(id);
      message.success(t("professorsPage.deleted"));
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
      const result = await importProfessorsCSV(csvFile);
      setCsvResult(result);
      if (result.created > 0) fetchAll();
    } catch {
      message.error(t("professorsPage.importFailed"));
    } finally {
      setCsvLoading(false);
    }
  };

  const columns = [
    {
      title: t("common.name"),
      key: "name",
      render: (_: unknown, p: Professor) => `${p.first_name} ${p.last_name}`,
    },
    { title: t("common.email"), dataIndex: "email", key: "email" },
    {
      title: t("nav.subjects"),
      key: "courses",
      render: (_: unknown, p: Professor) =>
        p.courses.length
          ? (
            <Space size={4} wrap>
              {p.courses.map((c: CourseSummary) => (
                <Tag key={c.id} color={BRAND_PRIMARY} style={{ fontSize: 11 }}>{c.code}</Tag>
              ))}
            </Space>
          )
          : <Text type="secondary">—</Text>,
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
      render: (_: unknown, p: Professor) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(p)}>
            {t("common.edit")}
          </Button>
          <Popconfirm
            title={t("professorsPage.deleteConfirm")}
            onConfirm={() => handleDelete(p.id)}
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
        title={t("professorsPage.title")}
        extra={
          <>
            <Button
              icon={<UploadOutlined />}
              onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}
            >
              {t("professorsPage.importCSV")}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t("professorsPage.addProfessor")}
            </Button>
          </>
        }
      />

      <Panel flush>
        <Table
          dataSource={professors}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (n) => `${n} ${t("common.total")}` }}
        />
      </Panel>

      {/* Create / Edit modal */}
      <Modal
        title={editing ? t("professorsPage.editProfessor") : t("professorsPage.addProfessor")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? t("common.save") : t("common.create")}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="first_name" label={t("usersPage.firstName")} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="last_name" label={t("usersPage.lastName")} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          {!editing && (
            <>
              <Form.Item name="email" label={t("common.email")} rules={[{ required: true, type: "email" }]}>
                <Input />
              </Form.Item>
              <Form.Item
                name="password"
                label={t("usersPage.password")}
                rules={[{ required: true, min: 6, message: t("usersPage.minPassword") }]}
              >
                <Input.Password />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* CSV import modal */}
      <Modal
        title={t("professorsPage.importTitle")}
        open={csvModalOpen}
        onCancel={() => setCsvModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCsvModalOpen(false)}>{t("common.close")}</Button>,
          <Button key="import" type="primary" loading={csvLoading} disabled={!csvFile} onClick={handleCsvImport}>
            {t("common.import")}
          </Button>,
        ]}
        width={480}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            {t("professorsPage.csvRequired")}
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
          <Alert
            style={{ marginTop: 12 }}
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
        )}
      </Modal>
    </div>
  );
}

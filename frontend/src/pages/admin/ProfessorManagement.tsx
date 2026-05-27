import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert, Button, Form, Input, Modal, Popconfirm, Select,
  Space, Table, Tag, Typography, Upload, message,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import type { CsvImportResult, Professor, ProfessorTag } from "@/types";
import {
  createProfessor, deleteProfessor, importProfessorsCSV,
  listAllTags, listProfessors, updateProfessor,
} from "@/api/professors";

const { Title, Text } = Typography;

export default function ProfessorManagement() {
  const { t } = useTranslation();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [allTags, setAllTags] = useState<ProfessorTag[]>([]);
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
      const [profs, tags] = await Promise.all([listProfessors(), listAllTags()]);
      setProfessors(profs);
      setAllTags(tags);
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
    form.setFieldsValue({
      first_name: p.first_name,
      last_name: p.last_name,
      tags: p.tags.map((tag) => tag.name),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateProfessor(editing.id, {
          first_name: values.first_name,
          last_name: values.last_name,
          tags: values.tags || [],
        });
        message.success(t("professorsPage.updated"));
      } else {
        await createProfessor({
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          password: values.password,
          tags: values.tags || [],
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

  const tagOptions = allTags.map((tag) => ({ value: tag.name, label: tag.name }));

  const columns = [
    {
      title: t("common.name"),
      key: "name",
      render: (_: unknown, p: Professor) => `${p.first_name} ${p.last_name}`,
    },
    { title: t("common.email"), dataIndex: "email", key: "email" },
    {
      title: t("professorsPage.tags"),
      key: "tags",
      render: (_: unknown, p: Professor) =>
        p.tags.length
          ? p.tags.map((tag) => <Tag key={tag.id} color="blue">{tag.name}</Tag>)
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
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t("professorsPage.title")}</Title>
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}
          >
            {t("professorsPage.importCSV")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("professorsPage.addProfessor")}
          </Button>
        </Space>
      </div>

      <Table
        dataSource={professors}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (n) => `${n} ${t("common.total")}` }}
      />

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
            <Form.Item
              name="first_name"
              label={t("usersPage.firstName")}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="last_name"
              label={t("usersPage.lastName")}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
          </div>
          {!editing && (
            <>
              <Form.Item
                name="email"
                label={t("common.email")}
                rules={[{ required: true, type: "email" }]}
              >
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
          <Form.Item name="tags" label={t("professorsPage.tags")}>
            <Select
              mode="tags"
              placeholder={t("professorsPage.addTags")}
              options={tagOptions}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t("professorsPage.importTitle")}
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
            {t("professorsPage.importCSV")}
          </Button>,
        ]}
        width={480}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
            {t("professorsPage.csvRequired")}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t("professorsPage.csvOptional")}
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
    </>
  );
}

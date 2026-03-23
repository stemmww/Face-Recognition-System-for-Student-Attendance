import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { User, Role } from "@/types";
import { createUser, deactivateUser, importStudentsCSV, listUsers, updateUser, type BulkImportResult } from "@/api/users";
import { formatDateTime } from "@/utils/formatters";

const { Title } = Typography;

const roleColors: Record<Role, string> = {
  admin: "red",
  professor: "blue",
  student: "green",
};

interface UserFormValues {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: Role;
}

export default function UserManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [form] = Form.useForm<UserFormValues>();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      message.error(t("usersPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      password: undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        const payload: Record<string, unknown> = {
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
        };
        if (values.password) payload.password = values.password;
        await updateUser(editingUser.id, payload as Partial<User>);
        message.success(t("usersPage.userUpdated"));
      } else {
        await createUser({
          email: values.email,
          password: values.password!,
          first_name: values.first_name,
          last_name: values.last_name,
          role: values.role,
        });
        message.success(t("usersPage.userCreated"));
      }
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error(editingUser ? t("usersPage.updateFailed") : t("usersPage.createFailed"));
    }
  };

  const handleCSVUpload = async (file: File) => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const result = await importStudentsCSV(file);
      setImportResult(result);
      if (result.created > 0) {
        message.success(t("usersPage.importSuccess", { created: result.created, enrolled: result.enrolled }));
        fetchUsers();
      } else {
        message.info(t("usersPage.noNewStudents"));
      }
    } catch {
      message.error(t("usersPage.importFailed"));
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeactivate = async (userId: number) => {
    try {
      await deactivateUser(userId);
      message.success(t("usersPage.userDeactivated"));
      fetchUsers();
    } catch {
      message.error(t("usersPage.deactivateFailed"));
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      searchText === "" ||
      `${u.first_name} ${u.last_name} ${u.email}`
        .toLowerCase()
        .includes(searchText.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const columns = [
    {
      title: t("common.name"),
      key: "name",
      render: (_: unknown, record: User) => `${record.first_name} ${record.last_name}`,
      sorter: (a: User, b: User) => a.last_name.localeCompare(b.last_name),
    },
    {
      title: t("common.email"),
      dataIndex: "email",
      key: "email",
    },
    {
      title: t("usersPage.role"),
      dataIndex: "role",
      key: "role",
      render: (role: Role) => (
        <Tag color={roleColors[role]}>{t(`roles.${role}`)}</Tag>
      ),
    },
    {
      title: t("common.status"),
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? t("common.active") : t("common.inactive")}</Tag>
      ),
    },
    {
      title: t("coursesPage.created"),
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => formatDateTime(d),
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            {t("common.edit")}
          </Button>
          {record.is_active && (
            <Popconfirm
              title={t("usersPage.deactivateTitle")}
              description={t("usersPage.deactivateDesc")}
              onConfirm={() => handleDeactivate(record.id)}
              okText={t("usersPage.deactivate")}
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                {t("usersPage.deactivate")}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t("usersPage.title")}</Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => { setImportModalOpen(true); setImportResult(null); }}>
            {t("usersPage.importCSV")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            {t("usersPage.createUser")}
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder={t("usersPage.searchPlaceholder")}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          style={{ width: 160 }}
          options={[
            { value: "all", label: t("usersPage.allRoles") },
            { value: "admin", label: t("roles.admin") },
            { value: "professor", label: t("roles.professor") },
            { value: "student", label: t("roles.student") },
          ]}
        />
      </Space>

      <Table
        dataSource={filteredUsers}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} ${t("common.users")}` }}
      />

      <Modal
        title={editingUser ? t("usersPage.editUser") : t("usersPage.createUser")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText={editingUser ? t("usersPage.saveChanges") : t("usersPage.createUser")}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="first_name"
            label={t("usersPage.firstName")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input placeholder="John" />
          </Form.Item>
          <Form.Item
            name="last_name"
            label={t("usersPage.lastName")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input placeholder="Doe" />
          </Form.Item>
          <Form.Item
            name="email"
            label={t("common.email")}
            rules={[
              { required: true, message: t("common.required") },
              { type: "email", message: t("login.emailInvalid") },
            ]}
          >
            <Input placeholder="john.doe@university.edu" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? t("usersPage.newPassword") : t("usersPage.password")}
            rules={editingUser ? [] : [{ required: true, message: t("common.required") }, { min: 6, message: t("usersPage.minPassword") }]}
          >
            <Input.Password placeholder={editingUser ? "••••••••" : t("usersPage.enterPassword")} />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="role"
              label={t("usersPage.role")}
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Select
                placeholder={t("usersPage.selectRole")}
                options={[
                  { value: "professor", label: t("roles.professor") },
                  { value: "student", label: t("roles.student") },
                  { value: "admin", label: t("roles.admin") },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={t("usersPage.importTitle")}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setImportModalOpen(false)}>
            {t("common.close")}
          </Button>,
        ]}
        width={560}
      >
        <Alert
          message={t("usersPage.csvFormat")}
          description={
            <div>
              <p style={{ margin: "4px 0" }}>{t("usersPage.csvRequired")}: <strong>email, first_name, last_name, password</strong></p>
              <p style={{ margin: "4px 0" }}>{t("usersPage.csvOptional")}: <strong>course_codes</strong> ({t("usersPage.csvSeparated")})</p>
              <code style={{ fontSize: 12, display: "block", marginTop: 8, padding: 8, borderRadius: 4 }}>
                email,first_name,last_name,password,course_codes<br />
                john@uni.edu,John,Doe,pass123,SE2322<br />
                jane@uni.edu,Jane,Smith,pass456,SE2322;CS101
              </code>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={(file) => {
            handleCSVUpload(file);
            return false;
          }}
          disabled={importLoading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {importLoading ? t("usersPage.importing") : t("usersPage.dragCSV")}
          </p>
        </Upload.Dragger>

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message={t("usersPage.importComplete")}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>{importResult.created}</strong> {t("usersPage.studentsCreated")}</li>
                  <li><strong>{importResult.skipped}</strong> {t("usersPage.accountsSkipped")}</li>
                  <li><strong>{importResult.enrolled}</strong> {t("usersPage.enrollmentsAdded")}</li>
                  {importResult.errors.length > 0 && (
                    <li style={{ color: "#ff4d4f" }}>
                      <strong>{importResult.errors.length}</strong> {t("usersPage.errors")}:
                      <ul style={{ paddingLeft: 16 }}>
                        {importResult.errors.slice(0, 10).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>...{t("usersPage.andMore", { count: importResult.errors.length - 10 })}</li>
                        )}
                      </ul>
                    </li>
                  )}
                </ul>
              }
              type={importResult.errors.length > 0 ? "warning" : "success"}
              showIcon
            />
          </div>
        )}
      </Modal>
    </>
  );
}

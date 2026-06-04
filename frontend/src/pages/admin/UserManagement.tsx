import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
} from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { User, Role, BulkImportResult } from "@/types";
import { createUser, deactivateUser, importStudentsCSV, listUsers, updateUser } from "@/api/users";
import { adminResetFaceData, adminSetEnrollmentPermission } from "@/api/faceEnrollment";
import { formatDateTime } from "@/utils/formatters";
import { BRAND_PRIMARY } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const roleColors: Record<Role, string> = {
  admin: "red",
  professor: BRAND_PRIMARY,
  student: "green",
};

interface UserFormValues {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role: Role;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;

  const data = error.response?.data as { detail?: unknown } | undefined;
  const detail = data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item !== "object" || item === null || !("msg" in item)) return null;
        const msg = (item as { msg?: unknown }).msg;
        return typeof msg === "string" ? msg : null;
      })
      .filter((msg): msg is string => Boolean(msg));

    if (messages.length > 0) return messages.join("; ");
  }

  return fallback;
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
    } catch (error) {
      message.error(
        getApiErrorMessage(
          error,
          editingUser ? t("usersPage.updateFailed") : t("usersPage.createFailed")
        )
      );
    }
  };

  const handleCSVUpload = async (file: File) => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const result = await importStudentsCSV(file);
      setImportResult(result);
      const affected = result.created + result.enrolled + result.updated_roles;
      if (affected > 0) {
        message.success(
          `CSV import complete: ${result.created} created, ${result.updated_roles} roles updated, ${result.enrolled} enrollments added`
        );
        fetchUsers();
      } else {
        message.info("No users were created or updated");
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

  const handleToggleEnrollPermission = async (userId: number, allowed: boolean) => {
    try {
      await adminSetEnrollmentPermission(userId, allowed);
      message.success(
        allowed ? t("usersPage.faceEnrollEnabled") : t("usersPage.faceEnrollDisabled")
      );
      fetchUsers();
    } catch {
      message.error(t("usersPage.faceEnrollToggleFailed"));
    }
  };

  const handleResetFaceData = async (userId: number) => {
    try {
      await adminResetFaceData(userId);
      message.success(t("usersPage.faceDataReset"));
      fetchUsers();
    } catch {
      message.error(t("usersPage.faceDataResetFailed"));
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
        <Tag bordered={false} color={roleColors[role]}>{t(`roles.${role}`)}</Tag>
      ),
    },
    {
      title: t("common.status"),
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) => (
        <Tag bordered={false} color={active ? "green" : "default"}>{active ? t("common.active") : t("common.inactive")}</Tag>
      ),
    },
    {
      title: t("coursesPage.created"),
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => formatDateTime(d),
    },
    {
      title: t("usersPage.faceEnrollment"),
      key: "face_enrollment",
      render: (_: unknown, record: User) => {
        if (record.role !== "student") return <span style={{ color: "#ccc" }}>—</span>;
        const enrolled = record.face_enrollment_status === "APPROVED";
        return (
          <Space direction="vertical" size={4}>
            <Space size={4}>
              <Tooltip title={t("usersPage.faceEnrollPermission")}>
                <Switch
                  size="small"
                  checked={record.can_self_enroll_face === true}
                  onChange={(val) => handleToggleEnrollPermission(record.id, val)}
                  checkedChildren={<CameraOutlined />}
                />
              </Tooltip>
              {enrolled ? (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
                  {t("usersPage.faceEnrolled")}
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="default" style={{ margin: 0 }}>
                  {t("usersPage.faceNotEnrolled")}
                </Tag>
              )}
            </Space>
            {enrolled && (
              <Popconfirm
                title={t("usersPage.resetFaceTitle")}
                description={t("usersPage.resetFaceDesc")}
                onConfirm={() => handleResetFaceData(record.id)}
                okText={t("common.delete")}
                okButtonProps={{ danger: true }}
              >
                <Button type="link" size="small" danger style={{ padding: 0, height: "auto" }}>
                  {t("usersPage.resetFaceData")}
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("usersPage.title")}
        extra={
          <>
            <Button icon={<UploadOutlined />} onClick={() => { setImportModalOpen(true); setImportResult(null); }}>
              {t("usersPage.importCSV")}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t("usersPage.createUser")}
            </Button>
          </>
        }
      />

      <Panel>
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
      </Panel>

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
            <Input placeholder="First name" />
          </Form.Item>
          <Form.Item
            name="last_name"
            label={t("usersPage.lastName")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input placeholder="Last name" />
          </Form.Item>
          <Form.Item
            name="email"
            label={t("common.email")}
            rules={[
              { required: true, message: t("common.required") },
              { type: "email", message: t("login.emailInvalid") },
            ]}
          >
            <Input placeholder="user@example.com" />
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
              <p style={{ margin: "4px 0" }}>{t("usersPage.csvOptional")}: <strong>role, course_codes</strong> ({t("usersPage.csvSeparated")})</p>
              <code style={{ fontSize: 12, display: "block", marginTop: 8, padding: 8, borderRadius: 4 }}>
                email,first_name,last_name,password,role,course_codes<br />
                student_1@example.com,student_1,Student,admin123,student,SE2322<br />
                professor_1@example.com,professor_1,Professor,admin123,professor,
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
                  <li><strong>{importResult.created}</strong> users created</li>
                  <li><strong>{importResult.skipped}</strong> {t("usersPage.accountsSkipped")}</li>
                  <li><strong>{importResult.updated_roles}</strong> roles updated</li>
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
    </div>
  );
}

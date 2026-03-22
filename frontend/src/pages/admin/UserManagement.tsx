import { useCallback, useEffect, useState } from "react";
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
import { ROLE_LABELS } from "@/utils/constants";
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
      message.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

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
        message.success("User updated");
      } else {
        await createUser({
          email: values.email,
          password: values.password!,
          first_name: values.first_name,
          last_name: values.last_name,
          role: values.role,
        });
        message.success("User created");
      }
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error(editingUser ? "Failed to update user" : "Failed to create user");
    }
  };

  const handleCSVUpload = async (file: File) => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const result = await importStudentsCSV(file);
      setImportResult(result);
      if (result.created > 0) {
        message.success(`${result.created} student(s) created, ${result.enrolled} enrollment(s) added`);
        fetchUsers();
      } else {
        message.info("No new students were created");
      }
    } catch {
      message.error("Failed to import CSV");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeactivate = async (userId: number) => {
    try {
      await deactivateUser(userId);
      message.success("User deactivated");
      fetchUsers();
    } catch {
      message.error("Failed to deactivate user");
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
      title: "Name",
      key: "name",
      render: (_: unknown, record: User) => `${record.first_name} ${record.last_name}`,
      sorter: (a: User, b: User) => a.last_name.localeCompare(b.last_name),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: Role) => (
        <Tag color={roleColors[role]}>{ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          {record.is_active && (
            <Popconfirm
              title="Deactivate this user?"
              description="They will no longer be able to log in."
              onConfirm={() => handleDeactivate(record.id)}
              okText="Deactivate"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                Deactivate
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
        <Title level={4} style={{ margin: 0 }}>
          User Management
        </Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => { setImportModalOpen(true); setImportResult(null); }}>
            Import CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Create User
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Search by name or email"
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
            { value: "all", label: "All Roles" },
            { value: "admin", label: "Administrator" },
            { value: "professor", label: "Professor" },
            { value: "student", label: "Student" },
          ]}
        />
      </Space>

      <Table
        dataSource={filteredUsers}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `${total} users` }}
      />

      <Modal
        title={editingUser ? "Edit User" : "Create New User"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText={editingUser ? "Save Changes" : "Create User"}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="first_name"
            label="First Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="John" />
          </Form.Item>
          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="Doe" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Required" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input placeholder="john.doe@university.edu" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? "New Password (leave blank to keep current)" : "Password"}
            rules={editingUser ? [] : [{ required: true, message: "Required" }, { min: 6, message: "Minimum 6 characters" }]}
          >
            <Input.Password placeholder={editingUser ? "••••••••" : "Enter password"} />
          </Form.Item>
          {!editingUser && (
            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: "Required" }]}
            >
              <Select
                placeholder="Select role"
                options={[
                  { value: "professor", label: "Professor" },
                  { value: "student", label: "Student" },
                  { value: "admin", label: "Administrator" },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Import Students from CSV"
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setImportModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={560}
      >
        <Alert
          message="CSV Format"
          description={
            <div>
              <p style={{ margin: "4px 0" }}>Required columns: <strong>email, first_name, last_name, password</strong></p>
              <p style={{ margin: "4px 0" }}>Optional: <strong>course_codes</strong> (comma or semicolon separated)</p>
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
            {importLoading ? "Importing..." : "Click or drag CSV file here"}
          </p>
        </Upload.Dragger>

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="Import Complete"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>{importResult.created}</strong> students created</li>
                  <li><strong>{importResult.skipped}</strong> existing accounts skipped</li>
                  <li><strong>{importResult.enrolled}</strong> new enrollments added</li>
                  {importResult.errors.length > 0 && (
                    <li style={{ color: "#ff4d4f" }}>
                      <strong>{importResult.errors.length}</strong> error(s):
                      <ul style={{ paddingLeft: 16 }}>
                        {importResult.errors.slice(0, 10).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>...and {importResult.errors.length - 10} more</li>
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

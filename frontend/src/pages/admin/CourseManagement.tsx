import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import type { Course, User } from "@/types";
import {
  assignProfessors,
  createCourse,
  deleteCourse,
  getCourseProfessors,
  getCourseStudents,
  enrollStudents,
  listCourses,
  removeProfessor,
  removeStudent,
  updateCourse,
} from "@/api/courses";
import { listUsers } from "@/api/users";
import { formatDateTime } from "@/utils/formatters";

const { Title, Text } = Typography;

interface CourseFormValues {
  code: string;
  name: string;
  description?: string;
  semester: string;
  academic_year: string;
}

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form] = Form.useForm<CourseFormValues>();

  // Drawer state for managing professors/students
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseProfessors, setCourseProfessors] = useState<User[]>([]);
  const [courseStudents, setCourseStudents] = useState<User[]>([]);
  const [allProfessors, setAllProfessors] = useState<User[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [assignProfModalOpen, setAssignProfModalOpen] = useState(false);
  const [enrollStudentModalOpen, setEnrollStudentModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await listCourses());
    } catch {
      message.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openCreate = () => {
    setEditingCourse(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    form.setFieldsValue({
      ...course,
      description: course.description ?? undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCourse) {
        await updateCourse(editingCourse.id, values as Partial<Course>);
        message.success("Course updated");
      } else {
        await createCourse(values);
        message.success("Course created");
      }
      setModalOpen(false);
      fetchCourses();
    } catch {
      message.error("Operation failed");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCourse(id);
      message.success("Course deleted");
      fetchCourses();
    } catch {
      message.error("Failed to delete course");
    }
  };

  // --- Drawer: manage professors & students ---
  const openDrawer = async (course: Course) => {
    setSelectedCourse(course);
    setDrawerOpen(true);
    try {
      const [profs, students, allProfs, allStuds] = await Promise.all([
        getCourseProfessors(course.id),
        getCourseStudents(course.id),
        listUsers("professor"),
        listUsers("student"),
      ]);
      setCourseProfessors(profs);
      setCourseStudents(students);
      setAllProfessors(allProfs);
      setAllStudents(allStuds);
    } catch {
      message.error("Failed to load course members");
    }
  };

  const handleAssignProfessors = async () => {
    if (!selectedCourse || selectedUserIds.length === 0) return;
    try {
      await assignProfessors(selectedCourse.id, selectedUserIds);
      message.success("Professors assigned");
      setAssignProfModalOpen(false);
      setSelectedUserIds([]);
      setCourseProfessors(await getCourseProfessors(selectedCourse.id));
    } catch {
      message.error("Failed to assign professors");
    }
  };

  const handleRemoveProf = async (profId: number) => {
    if (!selectedCourse) return;
    try {
      await removeProfessor(selectedCourse.id, profId);
      setCourseProfessors(await getCourseProfessors(selectedCourse.id));
    } catch {
      message.error("Failed to remove professor");
    }
  };

  const handleEnrollStudents = async () => {
    if (!selectedCourse || selectedUserIds.length === 0) return;
    try {
      await enrollStudents(selectedCourse.id, selectedUserIds);
      message.success("Students enrolled");
      setEnrollStudentModalOpen(false);
      setSelectedUserIds([]);
      setCourseStudents(await getCourseStudents(selectedCourse.id));
    } catch {
      message.error("Failed to enroll students");
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedCourse) return;
    try {
      await removeStudent(selectedCourse.id, studentId);
      setCourseStudents(await getCourseStudents(selectedCourse.id));
    } catch {
      message.error("Failed to remove student");
    }
  };

  const existingProfIds = new Set(courseProfessors.map((p) => p.id));
  const availableProfessors = allProfessors.filter((p) => !existingProfIds.has(p.id));

  const existingStudentIds = new Set(courseStudents.map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !existingStudentIds.has(s.id));

  const columns = [
    { title: "Code", dataIndex: "code", key: "code", width: 100 },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Semester", dataIndex: "semester", key: "semester", width: 120 },
    { title: "Year", dataIndex: "academic_year", key: "academic_year", width: 100 },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: "Actions",
      key: "actions",
      width: 260,
      render: (_: unknown, record: Course) => (
        <Space>
          <Button type="link" icon={<TeamOutlined />} onClick={() => openDrawer(record)}>
            Members
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm title="Delete this course?" onConfirm={() => handleDelete(record.id)} okButtonProps={{ danger: true }}>
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Course Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create Course</Button>
      </div>

      <Table dataSource={courses} columns={columns} rowKey="id" loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} courses` }} />

      {/* Create/Edit Modal */}
      <Modal
        title={editingCourse ? "Edit Course" : "Create Course"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingCourse ? "Save" : "Create"}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Course Code" rules={[{ required: true }]}>
            <Input placeholder="CS101" disabled={!!editingCourse} />
          </Form.Item>
          <Form.Item name="name" label="Course Name" rules={[{ required: true }]}>
            <Input placeholder="Introduction to Computer Science" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Space>
            <Form.Item name="semester" label="Semester" rules={[{ required: true }]}>
              <Select style={{ width: 160 }} placeholder="Select"
                options={[
                  { value: "Fall", label: "Fall" },
                  { value: "Spring", label: "Spring" },
                  { value: "Summer", label: "Summer" },
                ]} />
            </Form.Item>
            <Form.Item name="academic_year" label="Academic Year" rules={[{ required: true }]}>
              <Input placeholder="2025-2026" style={{ width: 140 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Members Drawer */}
      <Drawer
        title={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : ""}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
      >
        {/* Professors */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>Professors</Title>
          <Button size="small" icon={<UserAddOutlined />}
            onClick={() => { setSelectedUserIds([]); setAssignProfModalOpen(true); }}
            disabled={availableProfessors.length === 0}>
            Assign
          </Button>
        </div>
        <List
          size="small"
          bordered
          dataSource={courseProfessors}
          locale={{ emptyText: "No professors assigned" }}
          renderItem={(p) => (
            <List.Item
              actions={[
                <Popconfirm key="rm" title="Remove?" onConfirm={() => handleRemoveProf(p.id)}>
                  <Button type="link" danger size="small" icon={<UserDeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              {p.first_name} {p.last_name} <Text type="secondary">({p.email})</Text>
            </List.Item>
          )}
        />

        <div style={{ height: 24 }} />

        {/* Students */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Title level={5} style={{ margin: 0 }}>Enrolled Students</Title>
          <Button size="small" icon={<UserAddOutlined />}
            onClick={() => { setSelectedUserIds([]); setEnrollStudentModalOpen(true); }}
            disabled={availableStudents.length === 0}>
            Enroll
          </Button>
        </div>
        <List
          size="small"
          bordered
          dataSource={courseStudents}
          locale={{ emptyText: "No students enrolled" }}
          renderItem={(s) => (
            <List.Item
              actions={[
                <Popconfirm key="rm" title="Remove?" onConfirm={() => handleRemoveStudent(s.id)}>
                  <Button type="link" danger size="small" icon={<UserDeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              {s.first_name} {s.last_name} <Text type="secondary">({s.email})</Text>
            </List.Item>
          )}
        />
      </Drawer>

      {/* Assign Professors Modal */}
      <Modal
        title="Assign Professors"
        open={assignProfModalOpen}
        onOk={handleAssignProfessors}
        onCancel={() => setAssignProfModalOpen(false)}
        okText="Assign"
        okButtonProps={{ disabled: selectedUserIds.length === 0 }}
      >
        <Select
          mode="multiple"
          style={{ width: "100%", marginTop: 12 }}
          placeholder="Select professors"
          value={selectedUserIds}
          onChange={setSelectedUserIds}
          options={availableProfessors.map((p) => ({
            value: p.id,
            label: `${p.first_name} ${p.last_name} (${p.email})`,
          }))}
        />
      </Modal>

      {/* Enroll Students Modal */}
      <Modal
        title="Enroll Students"
        open={enrollStudentModalOpen}
        onOk={handleEnrollStudents}
        onCancel={() => setEnrollStudentModalOpen(false)}
        okText="Enroll"
        okButtonProps={{ disabled: selectedUserIds.length === 0 }}
      >
        <Select
          mode="multiple"
          style={{ width: "100%", marginTop: 12 }}
          placeholder="Select students"
          value={selectedUserIds}
          onChange={setSelectedUserIds}
          options={availableStudents.map((s) => ({
            value: s.id,
            label: `${s.first_name} ${s.last_name} (${s.email})`,
          }))}
          optionFilterProp="label"
          showSearch
        />
      </Modal>
    </>
  );
}

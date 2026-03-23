import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      message.error(t("coursesPage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        message.success(t("coursesPage.courseUpdated"));
      } else {
        await createCourse(values);
        message.success(t("coursesPage.courseCreated"));
      }
      setModalOpen(false);
      fetchCourses();
    } catch {
      message.error(t("common.operationFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCourse(id);
      message.success(t("coursesPage.courseDeleted"));
      fetchCourses();
    } catch {
      message.error(t("coursesPage.deleteFailed"));
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
      message.error(t("coursesPage.membersFailed"));
    }
  };

  const handleAssignProfessors = async () => {
    if (!selectedCourse || selectedUserIds.length === 0) return;
    try {
      await assignProfessors(selectedCourse.id, selectedUserIds);
      message.success(t("coursesPage.professorsAssigned"));
      setAssignProfModalOpen(false);
      setSelectedUserIds([]);
      setCourseProfessors(await getCourseProfessors(selectedCourse.id));
    } catch {
      message.error(t("coursesPage.assignFailed"));
    }
  };

  const handleRemoveProf = async (profId: number) => {
    if (!selectedCourse) return;
    try {
      await removeProfessor(selectedCourse.id, profId);
      setCourseProfessors(await getCourseProfessors(selectedCourse.id));
    } catch {
      message.error(t("coursesPage.removeProfFailed"));
    }
  };

  const handleEnrollStudents = async () => {
    if (!selectedCourse || selectedUserIds.length === 0) return;
    try {
      await enrollStudents(selectedCourse.id, selectedUserIds);
      message.success(t("coursesPage.studentsEnrolledSuccess"));
      setEnrollStudentModalOpen(false);
      setSelectedUserIds([]);
      setCourseStudents(await getCourseStudents(selectedCourse.id));
    } catch {
      message.error(t("coursesPage.enrollFailed"));
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedCourse) return;
    try {
      await removeStudent(selectedCourse.id, studentId);
      setCourseStudents(await getCourseStudents(selectedCourse.id));
    } catch {
      message.error(t("coursesPage.removeStudentFailed"));
    }
  };

  const existingProfIds = new Set(courseProfessors.map((p) => p.id));
  const availableProfessors = allProfessors.filter((p) => !existingProfIds.has(p.id));

  const existingStudentIds = new Set(courseStudents.map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !existingStudentIds.has(s.id));

  const columns = [
    { title: t("coursesPage.code"), dataIndex: "code", key: "code", width: 100 },
    { title: t("common.name"), dataIndex: "name", key: "name" },
    { title: t("coursesPage.semester"), dataIndex: "semester", key: "semester", width: 120 },
    { title: t("coursesPage.year"), dataIndex: "academic_year", key: "academic_year", width: 100 },
    {
      title: t("coursesPage.created"),
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (d: string) => formatDateTime(d),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 260,
      render: (_: unknown, record: Course) => (
        <Space>
          <Button type="link" icon={<TeamOutlined />} onClick={() => openDrawer(record)}>
            {t("coursesPage.members")}
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            {t("common.edit")}
          </Button>
          <Popconfirm title={t("coursesPage.deleteCourse")} onConfirm={() => handleDelete(record.id)} okButtonProps={{ danger: true }}>
            <Button type="link" danger icon={<DeleteOutlined />}>{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t("coursesPage.managementTitle")}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("coursesPage.createCourse")}</Button>
      </div>

      <Table dataSource={courses} columns={columns} rowKey="id" loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => `${total} ${t("common.courses")}` }} />

      {/* Create/Edit Modal */}
      <Modal
        title={editingCourse ? t("coursesPage.editCourse") : t("coursesPage.createCourse")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingCourse ? t("common.save") : t("common.create")}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="code" label={t("coursesPage.courseCode")} rules={[{ required: true }]}>
            <Input placeholder="CS101" disabled={!!editingCourse} />
          </Form.Item>
          <Form.Item name="name" label={t("coursesPage.courseName")} rules={[{ required: true }]}>
            <Input placeholder="Introduction to Computer Science" />
          </Form.Item>
          <Form.Item name="description" label={t("coursesPage.description")}>
            <Input.TextArea rows={3} placeholder={t("coursesPage.optionalDescription")} />
          </Form.Item>
          <Space>
            <Form.Item name="semester" label={t("coursesPage.semester")} rules={[{ required: true }]}>
              <Select style={{ width: 160 }} placeholder={t("coursesPage.semester")}
                options={[
                  { value: "Fall", label: t("coursesPage.fall") },
                  { value: "Spring", label: t("coursesPage.spring") },
                  { value: "Summer", label: t("coursesPage.summer") },
                ]} />
            </Form.Item>
            <Form.Item name="academic_year" label={t("coursesPage.academicYear")} rules={[{ required: true }]}>
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
          <Title level={5} style={{ margin: 0 }}>{t("coursesPage.professors")}</Title>
          <Button size="small" icon={<UserAddOutlined />}
            onClick={() => { setSelectedUserIds([]); setAssignProfModalOpen(true); }}
            disabled={availableProfessors.length === 0}>
            {t("common.assign")}
          </Button>
        </div>
        <List
          size="small"
          bordered
          dataSource={courseProfessors}
          locale={{ emptyText: t("coursesPage.noProfessors") }}
          renderItem={(p) => (
            <List.Item
              actions={[
                <Popconfirm key="rm" title={t("common.remove")} onConfirm={() => handleRemoveProf(p.id)}>
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
          <Title level={5} style={{ margin: 0 }}>{t("coursesPage.enrolledStudents")}</Title>
          <Button size="small" icon={<UserAddOutlined />}
            onClick={() => { setSelectedUserIds([]); setEnrollStudentModalOpen(true); }}
            disabled={availableStudents.length === 0}>
            {t("common.enroll")}
          </Button>
        </div>
        <List
          size="small"
          bordered
          dataSource={courseStudents}
          locale={{ emptyText: t("coursesPage.noStudents") }}
          renderItem={(s) => (
            <List.Item
              actions={[
                <Popconfirm key="rm" title={t("common.remove")} onConfirm={() => handleRemoveStudent(s.id)}>
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
        title={t("coursesPage.assignProfessors")}
        open={assignProfModalOpen}
        onOk={handleAssignProfessors}
        onCancel={() => setAssignProfModalOpen(false)}
        okText={t("common.assign")}
        okButtonProps={{ disabled: selectedUserIds.length === 0 }}
      >
        <Select
          mode="multiple"
          style={{ width: "100%", marginTop: 12 }}
          placeholder={t("coursesPage.selectProfessors")}
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
        title={t("coursesPage.enrollStudents")}
        open={enrollStudentModalOpen}
        onOk={handleEnrollStudents}
        onCancel={() => setEnrollStudentModalOpen(false)}
        okText={t("common.enroll")}
        okButtonProps={{ disabled: selectedUserIds.length === 0 }}
      >
        <Select
          mode="multiple"
          style={{ width: "100%", marginTop: 12 }}
          placeholder={t("coursesPage.selectStudents")}
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

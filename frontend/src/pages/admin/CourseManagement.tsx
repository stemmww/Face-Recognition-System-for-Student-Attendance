import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
  UploadOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import type { Course, CsvImportResult, Group, User } from "@/types";
import {
  type CourseGroupOut,
  addCourseGroup,
  assignProfessors,
  createCourse,
  deleteCourse,
  enrollStudents,
  getCourseProfessors,
  getCourseStudents,
  importCoursesCSV,
  listAllCourseGroups,
  listCourseGroups,
  listCourses,
  removeCourseGroup,
  removeProfessor,
  removeStudent,
  updateCourse,
} from "@/api/courses";
import { listGroups } from "@/api/groups";
import { listUsers } from "@/api/users";
import { formatDateTime } from "@/utils/formatters";
import { BRAND_PRIMARY } from "@/styles/theme";

const { Title, Text } = Typography;

const GROUP_TYPE_COLORS: Record<string, string> = { MAIN: BRAND_PRIMARY, ELECTIVE: "orange" };

function getApiErrorMessage(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
  ) {
    return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
  }
  return undefined;
}

interface CourseFormValues {
  code: string;
  name: string;
  description?: string;
  semester: string;
  academic_year: string;
}

function buildAcademicYearOptions() {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2;
  return Array.from({ length: 8 }, (_, i) => {
    const year = startYear + i;
    const value = `${year}-${year + 1}`;
    return { value, label: value };
  });
}

export default function CourseManagement() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form] = Form.useForm<CourseFormValues>();
  const academicYearOptions = (() => {
    const opts = buildAcademicYearOptions();
    if (editingCourse?.academic_year && !opts.some((o) => o.value === editingCourse.academic_year)) {
      return [{ value: editingCourse.academic_year, label: editingCourse.academic_year }, ...opts];
    }
    return opts;
  })();

  // Batch group tags for table column
  const [allCourseGroupsMap, setAllCourseGroupsMap] = useState<Map<number, CourseGroupOut[]>>(new Map());

  // CSV import
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [drawerTab, setDrawerTab] = useState<"professors" | "students" | "groups">("professors");

  // Professors tab
  const [professors, setProfessors] = useState<User[]>([]);
  const [allProfessors, setAllProfessors] = useState<User[]>([]);
  const [addProfessorIds, setAddProfessorIds] = useState<number[]>([]);

  // Students tab
  const [students, setStudents] = useState<User[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [addStudentIds, setAddStudentIds] = useState<number[]>([]);

  // Groups tab
  const [courseGroups, setCourseGroups] = useState<CourseGroupOut[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string>("FALL");

  const fetchAllGroupTags = useCallback(async () => {
    try {
      const all = await listAllCourseGroups();
      const map = new Map<number, CourseGroupOut[]>();
      for (const cg of all) {
        if (!map.has(cg.course_id)) map.set(cg.course_id, []);
        map.get(cg.course_id)!.push(cg);
      }
      setAllCourseGroupsMap(map);
    } catch {
      // non-critical
    }
  }, []);

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
    fetchAllGroupTags();
  }, [fetchCourses, fetchAllGroupTags]);

  const openCreate = () => {
    setEditingCourse(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    form.setFieldsValue({ ...course, description: course.description ?? undefined });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCourse) {
        const { code: _code, ...updatePayload } = values as Partial<Course> & { code?: string };
        await updateCourse(editingCourse.id, updatePayload);
        message.success(t("coursesPage.courseUpdated"));
      } else {
        const { code: _code, ...createPayload } = values as any;
        await createCourse(createPayload);
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
      fetchAllGroupTags();
    } catch {
      message.error(t("coursesPage.deleteFailed"));
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvLoading(true); setCsvResult(null);
    try {
      const result = await importCoursesCSV(csvFile);
      setCsvResult(result);
      if (result.created > 0) fetchCourses();
    } catch {
      message.error(t("coursesPage.importFailed"));
    } finally {
      setCsvLoading(false);
    }
  };

  // --- Drawer open ---
  const openDrawer = async (course: Course, tab: "professors" | "students" | "groups" = "professors") => {
    setSelectedCourse(course);
    setDrawerTab(tab);
    setDrawerOpen(true);
    setProfessors([]); setStudents([]); setCourseGroups([]);
    try {
      const [profs, studs, cGroups, allUsers, allG] = await Promise.all([
        getCourseProfessors(course.id),
        getCourseStudents(course.id),
        listCourseGroups(course.id),
        listUsers(),
        listGroups({ active_only: true }),
      ]);
      setProfessors(profs);
      setStudents(studs);
      setCourseGroups(cGroups);
      setAllProfessors(allUsers.filter((u) => u.role === "professor"));
      setAllStudents(allUsers.filter((u) => u.role === "student"));
      setAllGroups(allG);
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.membersFailed"));
    }
  };

  // --- Professors ---
  const handleAssignProfessors = async () => {
    if (!selectedCourse || !addProfessorIds.length) return;
    try {
      await assignProfessors(selectedCourse.id, addProfessorIds);
      message.success(t("coursesPage.professorsAssigned"));
      setAddProfessorIds([]);
      setProfessors(await getCourseProfessors(selectedCourse.id));
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.assignFailed"));
    }
  };

  const handleRemoveProfessor = async (pid: number) => {
    if (!selectedCourse) return;
    try {
      await removeProfessor(selectedCourse.id, pid);
      setProfessors((prev) => prev.filter((p) => p.id !== pid));
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.removeProfFailed"));
    }
  };

  // --- Students ---
  const handleEnrollStudents = async () => {
    if (!selectedCourse || !addStudentIds.length) return;
    try {
      await enrollStudents(selectedCourse.id, addStudentIds);
      message.success(t("coursesPage.studentsEnrolledSuccess"));
      setAddStudentIds([]);
      setStudents(await getCourseStudents(selectedCourse.id));
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.enrollFailed"));
    }
  };

  const handleRemoveStudent = async (sid: number) => {
    if (!selectedCourse) return;
    try {
      await removeStudent(selectedCourse.id, sid);
      setStudents((prev) => prev.filter((s) => s.id !== sid));
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.removeStudentFailed"));
    }
  };

  // --- Groups ---
  const handleAddGroup = async () => {
    if (!selectedCourse || !selectedGroupId) return;
    try {
      await addCourseGroup(selectedCourse.id, selectedGroupId, selectedSemester);
      setAddGroupModalOpen(false);
      setSelectedGroupId(null);
      const [cGroups, allG] = await Promise.all([
        listCourseGroups(selectedCourse.id),
        listGroups({ active_only: true }),
      ]);
      setCourseGroups(cGroups);
      setAllGroups(allG);
      fetchAllGroupTags();
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.assignFailed"));
    }
  };

  const handleRemoveGroup = async (gsId: number) => {
    if (!selectedCourse) return;
    try {
      await removeCourseGroup(selectedCourse.id, gsId);
      setCourseGroups((prev) => prev.filter((g) => g.group_subject_id !== gsId));
      fetchAllGroupTags();
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.removeProfFailed"));
    }
  };

  const linkedGroupIds = new Set(courseGroups.map((g) => g.group_id));
  const availableGroups = allGroups.filter((g) => !linkedGroupIds.has(g.id));
  const assignedProfIds = new Set(professors.map((p) => p.id));
  const availableProfessors = allProfessors.filter((p) => !assignedProfIds.has(p.id));
  const enrolledStudentIds = new Set(students.map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !enrolledStudentIds.has(s.id));

  const columns = [
    { title: t("coursesPage.code"), dataIndex: "code", key: "code", width: 100 },
    { title: t("common.name"), dataIndex: "name", key: "name" },
    { title: t("coursesPage.semester"), dataIndex: "semester", key: "semester", width: 120 },
    { title: t("coursesPage.academicYear"), dataIndex: "academic_year", key: "academic_year", width: 140 },
    {
      title: t("coursesPage.groups"),
      key: "groups",
      render: (_: unknown, record: Course) => {
        const tags = allCourseGroupsMap.get(record.id) ?? [];
        if (!tags.length) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        return (
          <Space size={4} wrap>
            {tags.map((cg) => (
              <Tag key={cg.group_subject_id} color={GROUP_TYPE_COLORS[cg.group_type] ?? "default"} style={{ fontSize: 11 }}>
                {cg.group_name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
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
      width: 220,
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
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}>{t("coursesPage.importCSV")}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("coursesPage.createCourse")}</Button>
        </Space>
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
          {editingCourse && (
            <Form.Item name="code" label={t("coursesPage.courseCode")}>
              <Input disabled />
            </Form.Item>
          )}
          <Form.Item name="name" label={t("coursesPage.courseName")} rules={[{ required: true }]}>
            <Input placeholder="Introduction to Computer Science" />
          </Form.Item>
          <Form.Item name="description" label={t("coursesPage.description")}>
            <Input.TextArea rows={3} placeholder={t("coursesPage.optionalDescription")} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="semester" label={t("coursesPage.semester")} rules={[{ required: true }]}>
              <Select style={{ width: 160 }} placeholder={t("coursesPage.semester")}
                options={[
                  { value: "Fall", label: t("coursesPage.fall") },
                  { value: "Spring", label: t("coursesPage.spring") },
                  { value: "Summer", label: t("coursesPage.summer") },
                ]} />
            </Form.Item>
            <Form.Item name="academic_year" label={t("coursesPage.academicYear")}
              rules={[{ required: true, message: t("coursesPage.academicYearRequired") }]}>
              <Select style={{ width: 160 }} placeholder={t("coursesPage.selectAcademicYear")}
                options={academicYearOptions} showSearch optionFilterProp="label" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Members Drawer */}
      <Drawer
        title={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.name}` : ""}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setAddProfessorIds([]); setAddStudentIds([]); }}
        width={560}
      >
        <Tabs activeKey={drawerTab} onChange={(k) => setDrawerTab(k as "professors" | "students" | "groups")}
          items={[
            {
              key: "professors",
              label: `${t("coursesPage.professors")} (${professors.length})`,
              children: (
                <>
                  <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
                    <Select mode="multiple" style={{ flex: 1 }} placeholder={t("coursesPage.selectProfessors")}
                      value={addProfessorIds} onChange={setAddProfessorIds} showSearch optionFilterProp="label"
                      options={availableProfessors.map((p) => ({ value: p.id, label: `${p.last_name} ${p.first_name} (${p.email})` }))} />
                    <Button type="primary" onClick={handleAssignProfessors} disabled={!addProfessorIds.length}>{t("common.assign")}</Button>
                  </Space.Compact>
                  <Table dataSource={professors} rowKey="id" size="small" pagination={false}
                    locale={{ emptyText: t("coursesPage.noProfessors") }}
                    columns={[
                      { title: t("common.name"), key: "name", render: (_: unknown, u: User) => `${u.last_name} ${u.first_name}` },
                      { title: t("common.email"), dataIndex: "email", key: "email" },
                      { title: "", key: "rm", width: 40, render: (_: unknown, u: User) => (
                        <Popconfirm title={t("common.remove")} onConfirm={() => handleRemoveProfessor(u.id)} okButtonProps={{ danger: true }}>
                          <Button type="text" danger size="small" icon={<UserDeleteOutlined />} />
                        </Popconfirm>
                      )},
                    ]} />
                </>
              ),
            },
            {
              key: "students",
              label: `${t("coursesPage.enrolledStudents")} (${students.length})`,
              children: (
                <>
                  <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
                    <Select mode="multiple" style={{ flex: 1 }} placeholder={t("coursesPage.selectStudents")}
                      value={addStudentIds} onChange={setAddStudentIds} showSearch optionFilterProp="label"
                      options={availableStudents.map((s) => ({ value: s.id, label: `${s.last_name} ${s.first_name} (${s.email})` }))} />
                    <Button type="primary" onClick={handleEnrollStudents} disabled={!addStudentIds.length}>{t("common.enroll")}</Button>
                  </Space.Compact>
                  <Table dataSource={students} rowKey="id" size="small" pagination={false}
                    locale={{ emptyText: t("coursesPage.noStudents") }}
                    columns={[
                      { title: t("common.name"), key: "name", render: (_: unknown, u: User) => `${u.last_name} ${u.first_name}` },
                      { title: t("common.email"), dataIndex: "email", key: "email" },
                      { title: "", key: "rm", width: 40, render: (_: unknown, u: User) => (
                        <Popconfirm title={t("common.remove")} onConfirm={() => handleRemoveStudent(u.id)} okButtonProps={{ danger: true }}>
                          <Button type="text" danger size="small" icon={<UserDeleteOutlined />} />
                        </Popconfirm>
                      )},
                    ]} />
                </>
              ),
            },
            {
              key: "groups",
              label: `${t("coursesPage.groups")} (${courseGroups.length})`,
              children: (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <Button size="small" icon={<PlusOutlined />}
                      onClick={() => { setSelectedGroupId(null); setAddGroupModalOpen(true); }}
                      disabled={availableGroups.length === 0}>
                      {t("coursesPage.addGroup")}
                    </Button>
                  </div>
                  <Table dataSource={courseGroups} rowKey="group_subject_id" size="small" pagination={false}
                    locale={{ emptyText: t("coursesPage.noGroups") }}
                    columns={[
                      { title: t("groups.group"), key: "name", render: (_: unknown, cg: CourseGroupOut) => (
                        <Space size={4}>
                          <Text strong>{cg.group_name}</Text>
                          <Tag color={GROUP_TYPE_COLORS[cg.group_type] ?? "default"} style={{ fontSize: 11 }}>{cg.group_type}</Tag>
                        </Space>
                      )},
                      { title: t("groups.semester"), dataIndex: "semester", key: "semester", width: 80, render: (s: string) => <Tag>{s}</Tag> },
                      { title: "", key: "rm", width: 40, render: (_: unknown, cg: CourseGroupOut) => (
                        <Popconfirm title={t("common.remove")} onConfirm={() => handleRemoveGroup(cg.group_subject_id)} okButtonProps={{ danger: true }}>
                          <Button type="text" danger size="small" icon={<UserDeleteOutlined />} />
                        </Popconfirm>
                      )},
                    ]} />
                </>
              ),
            },
          ]} />
      </Drawer>

      {/* Add Group Modal */}
      <Modal
        title={t("coursesPage.addGroup")}
        open={addGroupModalOpen}
        onOk={handleAddGroup}
        onCancel={() => setAddGroupModalOpen(false)}
        okText={t("common.assign")}
        okButtonProps={{ disabled: !selectedGroupId }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <Select showSearch optionFilterProp="label" placeholder={t("coursesPage.selectGroup")}
            value={selectedGroupId} onChange={setSelectedGroupId}
            options={availableGroups.map((g) => ({ value: g.id, label: g.name }))}
            style={{ width: "100%" }} />
          <Select value={selectedSemester} onChange={setSelectedSemester} style={{ width: "100%" }}
            options={[
              { value: "FALL", label: t("schedulesPage.fall") },
              { value: "WINTER", label: t("schedulesPage.winter") },
              { value: "SPRING", label: t("schedulesPage.spring") },
            ]} />
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        title={t("coursesPage.importTitle")}
        open={csvModalOpen}
        onCancel={() => setCsvModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCsvModalOpen(false)}>{t("common.close")}</Button>,
          <Button key="import" type="primary" loading={csvLoading} disabled={!csvFile} onClick={handleCsvImport}>{t("common.import")}</Button>,
        ]}
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontSize: 12, color: "#64748b" }}>{t("coursesPage.csvRequired")}</div>
          <div style={{ marginBottom: 12, fontSize: 12, color: "#94a3b8" }}>{t("coursesPage.csvOptional")}</div>
          <Upload accept=".csv" maxCount={1} beforeUpload={(file) => { setCsvFile(file); return false; }} onRemove={() => setCsvFile(null)}>
            <Button icon={<UploadOutlined />}>{t("usersPage.dragCSV")}</Button>
          </Upload>
        </div>
        {csvResult && (
          <Alert
            type={csvResult.errors.length > 0 ? "warning" : "success"}
            message={`${t("groups.created")}: ${csvResult.created}, ${t("groups.skipped")}: ${csvResult.skipped}`}
            description={csvResult.errors.length > 0 ? csvResult.errors.join("\n") : undefined}
            style={{ whiteSpace: "pre-line" }}
          />
        )}
      </Modal>
    </>
  );
}

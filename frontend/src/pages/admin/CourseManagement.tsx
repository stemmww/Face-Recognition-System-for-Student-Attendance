import { useCallback, useEffect, useMemo, useState } from "react";
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
  SearchOutlined,
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
  getCourseProfessors,
  importCoursesCSV,
  listAllCourseGroups,
  listCourseGroups,
  listCourses,
  removeCourseGroup,
  removeProfessor,
  updateCourse,
} from "@/api/courses";
import { listGroups, listGroupStudents } from "@/api/groups";
import { listUsers } from "@/api/users";
import { formatDateTime, getSemesterLabel } from "@/utils/formatters";
import { BRAND_PRIMARY } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

const GROUP_TYPE_COLORS: Record<string, string> = { MAIN: BRAND_PRIMARY, ELECTIVE: "orange" };
const TRIMESTER_OPTIONS = ["TRIMESTER_1", "TRIMESTER_2", "TRIMESTER_3"];

function getApiErrorMessage(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
  ) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null && "msg" in item) {
            return String((item as { msg?: unknown }).msg);
          }
          return undefined;
        })
        .filter(Boolean);
      if (messages.length) return messages.join("; ");
    }
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

interface GroupDerivedStudent extends User {
  group_names: string[];
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

function normalizeAcademicYearForForm(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) {
    const startYear = Number(trimmed);
    return `${startYear}-${startYear + 1}`;
  }
  return trimmed;
}

export default function CourseManagement() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [trimesterFilter, setTrimesterFilter] = useState<string>("ALL");
  const [academicYearFilter, setAcademicYearFilter] = useState<string>("ALL");
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

  // Students tab: read-only list derived from assigned groups
  const [students, setStudents] = useState<GroupDerivedStudent[]>([]);

  // Groups tab
  const [courseGroups, setCourseGroups] = useState<CourseGroupOut[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string>("TRIMESTER_1");

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
    form.setFieldsValue({
      ...course,
      academic_year: normalizeAcademicYearForForm(course.academic_year),
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
        const { code: _code, ...createPayload } = values as Omit<CourseFormValues, "code">  & { code?: string };
        await createCourse(createPayload);
        message.success(t("coursesPage.courseCreated"));
      }
      setModalOpen(false);
      fetchCourses();
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("common.operationFailed"));
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

  const loadCourseGroupsWithStudents = async (courseId: number) => {
    const cGroups = await listCourseGroups(courseId);
    const studentLists = await Promise.all(
      cGroups.map(async (group) => ({
        group,
        students: await listGroupStudents(group.group_id),
      }))
    );
    const studentMap = new Map<number, GroupDerivedStudent>();
    for (const { group, students: groupStudents } of studentLists) {
      for (const student of groupStudents) {
        const existing = studentMap.get(student.id);
        if (existing) {
          existing.group_names.push(group.group_name);
        } else {
          studentMap.set(student.id, { ...student, group_names: [group.group_name] });
        }
      }
    }
    setCourseGroups(cGroups);
    setStudents(
      [...studentMap.values()].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      )
    );
    return cGroups;
  };

  // --- Drawer open ---
  const openDrawer = async (course: Course, tab: "professors" | "students" | "groups" = "professors") => {
    setSelectedCourse(course);
    setDrawerTab(tab);
    setDrawerOpen(true);
    setProfessors([]); setStudents([]); setCourseGroups([]);
    try {
      const [profs, allUsers, allG] = await Promise.all([
        getCourseProfessors(course.id),
        listUsers(),
        listGroups({ active_only: true }),
      ]);
      setProfessors(profs);
      setAllProfessors(allUsers.filter((u) => u.role === "professor"));
      setAllGroups(allG);
      await loadCourseGroupsWithStudents(course.id);
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
      message.error(getApiErrorMessage(error) || t("coursesPage.removeGroupFailed"));
    }
  };

  // --- Groups ---
  const handleAddGroup = async () => {
    if (!selectedCourse || !selectedGroupId) return;
    try {
      await addCourseGroup(selectedCourse.id, selectedGroupId, selectedSemester);
      setAddGroupModalOpen(false);
      setSelectedGroupId(null);
      await loadCourseGroupsWithStudents(selectedCourse.id);
      setAllGroups(await listGroups({ active_only: true }));
      fetchAllGroupTags();
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.assignFailed"));
    }
  };

  const handleRemoveGroup = async (gsId: number) => {
    if (!selectedCourse) return;
    try {
      await removeCourseGroup(selectedCourse.id, gsId);
      await loadCourseGroupsWithStudents(selectedCourse.id);
      fetchAllGroupTags();
    } catch (error) {
      message.error(getApiErrorMessage(error) || t("coursesPage.removeProfFailed"));
    }
  };

  const linkedGroupIds = new Set(courseGroups.map((g) => g.group_id));
  const availableGroups = allGroups.filter((g) => !linkedGroupIds.has(g.id));
  const assignedProfIds = new Set(professors.map((p) => p.id));
  const availableProfessors = allProfessors.filter((p) => !assignedProfIds.has(p.id));
  const availableAcademicYears = useMemo(
    () => [...new Set(courses.map((course) => course.academic_year).filter(Boolean))].sort().reverse(),
    [courses]
  );
  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    return courses.filter((course) => {
      if (trimesterFilter !== "ALL" && course.semester !== trimesterFilter) return false;
      if (academicYearFilter !== "ALL" && course.academic_year !== academicYearFilter) return false;
      if (!query) return true;

      const groupTags = allCourseGroupsMap.get(course.id) ?? [];
      const searchable = [
        course.code,
        course.name,
        course.description,
        course.semester,
        getSemesterLabel(course.semester, t),
        course.academic_year,
        ...groupTags.map((group) => group.group_name),
      ];
      return searchable.some((value) => value?.toLowerCase().includes(query));
    });
  }, [academicYearFilter, allCourseGroupsMap, courseSearch, courses, t, trimesterFilter]);
  const hasCourseFilters =
    Boolean(courseSearch.trim()) || trimesterFilter !== "ALL" || academicYearFilter !== "ALL";

  const clearCourseFilters = () => {
    setCourseSearch("");
    setTrimesterFilter("ALL");
    setAcademicYearFilter("ALL");
  };

  const columns = [
    { title: t("coursesPage.code"), dataIndex: "code", key: "code", width: 100 },
    { title: t("common.name"), dataIndex: "name", key: "name" },
    { title: t("coursesPage.semester"), dataIndex: "semester", key: "semester", width: 120, render: (s: string) => getSemesterLabel(s, t) },
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("coursesPage.managementTitle")}
        extra={
          <>
            <Button icon={<UploadOutlined />} onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}>{t("coursesPage.importCSV")}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("coursesPage.createCourse")}</Button>
          </>
        }
      />

      <Panel flush>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            placeholder={t("coursesPage.searchPlaceholder")}
            style={{ flex: "1 1 320px", maxWidth: 460 }}
          />
          <Select
            value={trimesterFilter}
            onChange={setTrimesterFilter}
            style={{ width: 170 }}
            options={[
              { value: "ALL", label: t("coursesPage.allTrimesters") },
              ...TRIMESTER_OPTIONS.map((term) => ({ value: term, label: getSemesterLabel(term, t) })),
            ]}
          />
          <Select
            value={academicYearFilter}
            onChange={setAcademicYearFilter}
            style={{ width: 180 }}
            options={[
              { value: "ALL", label: t("coursesPage.allAcademicYears") },
              ...availableAcademicYears.map((year) => ({ value: year, label: year })),
            ]}
          />
          {hasCourseFilters && (
            <Button type="text" onClick={clearCourseFilters}>
              {t("coursesPage.clearFilters")}
            </Button>
          )}
          <Text type="secondary" style={{ marginLeft: "auto", fontSize: 13 }}>
            {t("coursesPage.filterResultCount", { shown: filteredCourses.length, total: courses.length })}
          </Text>
        </div>
        <Table dataSource={filteredCourses} columns={columns} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} ${t("common.courses")}` }} />
      </Panel>

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
            <Form.Item name="code" label={t("coursesPage.courseCode")} rules={[{ required: true }]}>
              <Input />
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
                options={TRIMESTER_OPTIONS.map((term) => ({ value: term, label: getSemesterLabel(term, t) }))} />
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
        onClose={() => { setDrawerOpen(false); setAddProfessorIds([]); }}
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
              label: `${t("coursesPage.studentsFromGroups")} (${students.length})`,
              children: (
                <>
                  <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                    {t("coursesPage.studentsFromGroupsHint")}
                  </Text>
                  <Table dataSource={students} rowKey="id" size="small" pagination={false}
                    locale={{ emptyText: t("coursesPage.noStudentsFromGroups") }}
                    columns={[
                      { title: t("common.name"), key: "name", render: (_: unknown, u: User) => `${u.last_name} ${u.first_name}` },
                      { title: t("common.email"), dataIndex: "email", key: "email" },
                      {
                        title: t("coursesPage.sourceGroups"),
                        dataIndex: "group_names",
                        key: "groups",
                        render: (groupNames: string[]) => (
                          <Space size={4} wrap>
                            {groupNames.map((name) => <Tag key={name}>{name}</Tag>)}
                          </Space>
                        ),
                      },
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
                      { title: t("groups.trimester"), dataIndex: "semester", key: "semester", width: 100, render: (s: string) => <Tag>{getSemesterLabel(s, t)}</Tag> },
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
            options={TRIMESTER_OPTIONS.map((term) => ({ value: term, label: getSemesterLabel(term, t) }))} />
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
    </div>
  );
}

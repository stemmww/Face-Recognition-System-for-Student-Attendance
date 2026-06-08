import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Button, Drawer, Input, Modal, Popconfirm,
  Select, Space, Switch, Table, Tabs, Tag, Typography, Upload, message,
} from "antd";
import {
  BookOutlined, DeleteOutlined, EditOutlined, PlusOutlined,
  SearchOutlined, TeamOutlined, UploadOutlined, UserDeleteOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { Course, CsvImportResult, Group, GroupSubject, User } from "@/types";
import {
  type GroupSubjectTag,
  addStudentsToGroup, createGroup, deleteGroup, importGroupsCSV, listGroups,
  listGroupStudents, removeStudentFromGroup, updateGroup,
  listGroupSubjects, addGroupSubject, removeGroupSubject,
  listAllGroupSubjects,
} from "@/api/groups";
import { listCourses } from "@/api/courses";
import { listUsers } from "@/api/users";
import { BRAND_PRIMARY_DARK } from "@/styles/theme";
import PageHeader from "@/components/dashboard/PageHeader";
import Panel from "@/components/dashboard/Panel";

const { Text } = Typography;

function getApiErrorMessage(error: unknown): string | undefined {
  if (
    typeof error === "object" && error !== null && "response" in error &&
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

const MAJOR_CODES = [
  "SE", "CS", "BDA", "MCS", "CB", "SST", "IIT", "EE", "ST",
  "DTNPE", "ITM", "ITE", "AIB", "MT", "DJ",
];

const MAJOR_LABELS: Record<string, string> = {
  SE: "SE — Software Engineering",
  CS: "CS — Computer Science",
  BDA: "BDA — Big Data Analysis",
  MCS: "MCS — Mathematical and Computational Science",
  CB: "CB — Cybersecurity",
  SST: "SST — Smart Security Technologies",
  IIT: "IIT — Industrial Internet of Things",
  EE: "EE — Electronic Engineering",
  ST: "ST — Smart Technologies",
  DTNPE: "DTNPE — Digital Technologies in Nuclear Power Engineering",
  ITM: "ITM — IT Management",
  ITE: "ITE — IT Entrepreneurship",
  AIB: "AIB — AI Business",
  MT: "MT — Media Technologies",
  DJ: "DJ — Digital Journalism",
};

const CODE_RE = /^([A-Z]+)-(\d{4})$/i;
const CUSTOM_ELECTIVE_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,49}$/i;

function normalizeElectiveCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s*-\s*/g, "-").replace(/\s+/g, "-");
}

interface ParsedCode {
  major: string; yearShort: number; groupNum: number;
  studyYear: number; valid: boolean; error?: string;
}

function parseGroupCode(raw: string): ParsedCode {
  const m = CODE_RE.exec(raw.trim());
  if (!m) return { major: "", yearShort: 0, groupNum: 0, studyYear: 0, valid: false, error: "Format: SE-2322" };
  const major = m[1].toUpperCase();
  if (!MAJOR_CODES.includes(major)) return { major, yearShort: 0, groupNum: 0, studyYear: 0, valid: false, error: `Unknown major "${major}"` };
  const digits = m[2];
  const yearShort = parseInt(digits.slice(0, 2), 10);
  const groupNum = parseInt(digits.slice(2), 10);
  const enrollmentFull = 2000 + yearShort;
  const now = new Date();
  const academicStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const studyYear = academicStart - enrollmentFull + 1;
  return { major, yearShort, groupNum, studyYear, valid: true };
}

const SEMESTER_OPTIONS = ["FALL", "WINTER", "SPRING"];
const TRIMESTER_OPTIONS = ["TRIMESTER_1", "TRIMESTER_2", "TRIMESTER_3"];
const META_TAG_BASE: CSSProperties = {
  borderRadius: 6,
  fontWeight: 600,
  lineHeight: "20px",
  marginInlineEnd: 0,
};

const GROUP_TYPE_TAG_STYLES: Record<string, CSSProperties> = {
  MAIN: {
    ...META_TAG_BASE,
    color: BRAND_PRIMARY_DARK,
    background: "rgba(1, 123, 223, 0.1)",
    borderColor: "rgba(1, 123, 223, 0.28)",
  },
  ELECTIVE: {
    ...META_TAG_BASE,
    color: "#047857",
    background: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
};

const TRIMESTER_TAG_STYLE: CSSProperties = {
  ...META_TAG_BASE,
  color: "#475569",
  background: "#f8fafc",
  borderColor: "#cbd5e1",
  fontWeight: 500,
};

export default function GroupManagement() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [allGroupSubjectsMap, setAllGroupSubjectsMap] = useState<Map<number, GroupSubjectTag[]>>(new Map());
  const [groupSearch, setGroupSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [majorFilter, setMajorFilter] = useState<string>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [parsedCode, setParsedCode] = useState<ParsedCode | null>(null);
  const [groupType, setGroupType] = useState<string>("MAIN");
  const [semester, setSemester] = useState<string | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  const [drawerGroup, setDrawerGroup] = useState<Group | null>(null);
  const [drawerTab, setDrawerTab] = useState<"students" | "subjects">("students");
  const [groupStudents, setGroupStudents] = useState<User[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [addStudentIds, setAddStudentIds] = useState<number[]>([]);
  const [groupSubjects, setGroupSubjects] = useState<GroupSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [addSubjectCourseId, setAddSubjectCourseId] = useState<number | null>(null);
  const [addSubjectSemester, setAddSubjectSemester] = useState<string>("FALL");

  const fetchSubjectTags = useCallback(async () => {
    try {
      const all = await listAllGroupSubjects();
      const map = new Map<number, GroupSubjectTag[]>();
      for (const gs of all) {
        if (!map.has(gs.group_id)) map.set(gs.group_id, []);
        map.get(gs.group_id)!.push(gs);
      }
      setAllGroupSubjectsMap(map);
    } catch {
      // non-critical
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [g, users, courses] = await Promise.all([
        listGroups({ active_only: false }),
        listUsers(),
        listCourses(),
      ]);
      setGroups(g);
      setAllStudents(users.filter((u) => u.role === "student"));
      setAllCourses(courses);
    } catch {
      message.error(t("groups.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchGroups(); fetchSubjectTags(); }, [fetchGroups, fetchSubjectTags]);

  const handleCodeChange = (val: string) => {
    setCodeInput(val);
    setParsedCode(groupType === "MAIN" && val.trim() ? parseGroupCode(val) : null);
  };

  const handleCodeBlur = () => {
    if (groupType !== "MAIN" && codeInput.trim()) {
      setCodeInput(normalizeElectiveCode(codeInput));
    }
  };

  const openCreate = () => {
    setEditing(null); setCodeInput(""); setParsedCode(null);
    setGroupType("MAIN"); setSemester(undefined); setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g); setCodeInput(g.name); setParsedCode(g.group_type === "MAIN" ? parseGroupCode(g.name) : null);
    setGroupType(g.group_type); setSemester(g.semester ?? undefined);
    setIsActive(g.is_active);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const customCode = normalizeElectiveCode(codeInput);
    const isMain = groupType === "MAIN";
    if (isMain && !parsedCode?.valid) { message.error(t("groups.fixCode")); return; }
    if (!isMain && !CUSTOM_ELECTIVE_CODE_RE.test(customCode)) { message.error(t("groups.fixElectiveCode")); return; }
    if (!isMain) setCodeInput(customCode);
    try {
      const payload = isMain ? {
        code: `${parsedCode!.major}-${parsedCode!.yearShort.toString().padStart(2, "0")}${parsedCode!.groupNum.toString().padStart(2, "0")}`,
        major: parsedCode!.major, enrollment_year_short: parsedCode!.yearShort,
        group_number: parsedCode!.groupNum, group_type: groupType,
        semester: undefined,
        ...(editing ? { is_active: isActive } : {}),
      } : {
        code: customCode, group_type: groupType,
        semester: groupType === "ELECTIVE" ? (semester || undefined) : undefined,
        ...(editing ? { is_active: isActive } : {}),
      };
      if (editing) {
        await updateGroup(editing.id, payload);
        message.success(t("groups.updated"));
      } else {
        await createGroup(payload);
        message.success(t("groups.created"));
      }
      setModalOpen(false); fetchGroups();
    } catch (e: unknown) {
      message.error(getApiErrorMessage(e) || t("common.operationFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    try { await deleteGroup(id); message.success(t("groups.deleted")); fetchGroups(); }
    catch { message.error(t("groups.deleteFailed")); }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvLoading(true); setCsvResult(null);
    try {
      const result = await importGroupsCSV(csvFile);
      setCsvResult(result);
      if (result.created > 0) fetchGroups();
    } catch { message.error(t("groups.importFailed")); }
    finally { setCsvLoading(false); }
  };

  const openDrawer = async (g: Group, tab: "students" | "subjects" = "students") => {
    setDrawerGroup(g); setDrawerTab(tab);
    setStudentsLoading(true); setSubjectsLoading(true);
    try {
      const [s, subj] = await Promise.all([listGroupStudents(g.id), listGroupSubjects(g.id)]);
      setGroupStudents(s); setGroupSubjects(subj);
    } finally { setStudentsLoading(false); setSubjectsLoading(false); }
  };

  const handleAddStudents = async () => {
    if (!drawerGroup || !addStudentIds.length) return;
    try {
      await addStudentsToGroup(drawerGroup.id, addStudentIds);
      message.success(t("groups.studentsAdded")); setAddStudentIds([]);
      const s = await listGroupStudents(drawerGroup.id); setGroupStudents(s); fetchGroups();
    } catch (e: unknown) { message.error(getApiErrorMessage(e) || t("groups.addStudentsFailed")); }
  };

  const handleRemoveStudent = async (sid: number) => {
    if (!drawerGroup) return;
    try {
      await removeStudentFromGroup(drawerGroup.id, sid);
      message.success(t("groups.studentRemoved"));
      setGroupStudents((prev) => prev.filter((s) => s.id !== sid)); fetchGroups();
    } catch { message.error(t("groups.removeStudentFailed")); }
  };

  const handleAddSubject = async () => {
    if (!drawerGroup || !addSubjectCourseId) return;
    try {
      const gs = await addGroupSubject(drawerGroup.id, { course_id: addSubjectCourseId, semester: addSubjectSemester });
      setGroupSubjects((prev) => [...prev, gs]); setAddSubjectCourseId(null);
      message.success(t("groups.subjectAdded"));
      fetchSubjectTags();
    } catch { message.error(t("groups.addSubjectFailed")); }
  };

  const handleRemoveSubject = async (gsId: number) => {
    if (!drawerGroup) return;
    try {
      await removeGroupSubject(drawerGroup.id, gsId);
      setGroupSubjects((prev) => prev.filter((s) => s.id !== gsId));
      message.success(t("groups.subjectRemoved"));
      fetchSubjectTags();
    } catch { message.error(t("groups.removeSubjectFailed")); }
  };

  const memberIds = new Set(groupStudents.map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !memberIds.has(s.id));
  const isMainGroupType = groupType === "MAIN";
  const normalizedElectiveCode = normalizeElectiveCode(codeInput);
  const electiveCodeValid = CUSTOM_ELECTIVE_CODE_RE.test(normalizedElectiveCode);
  const canSubmitGroup = isMainGroupType ? parsedCode?.valid : electiveCodeValid;
  const availableMajorCodes = useMemo(() => {
    const majors = new Set(groups.map((g) => g.major).filter(Boolean) as string[]);
    return [...majors].sort((a, b) => {
      const aIndex = MAJOR_CODES.indexOf(a);
      const bIndex = MAJOR_CODES.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [groups]);
  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return groups.filter((g) => {
      if (typeFilter !== "ALL" && g.group_type !== typeFilter) return false;
      if (majorFilter !== "ALL" && g.major !== majorFilter) return false;
      if (!query) return true;

      const subjects = allGroupSubjectsMap.get(g.id) ?? [];
      const searchable = [
        g.name,
        g.code,
        g.major,
        g.major_name,
        g.group_type,
        g.semester,
        ...subjects.flatMap((subject) => [subject.course_code, subject.course_name]),
      ];
      return searchable.some((value) => value?.toLowerCase().includes(query));
    });
  }, [allGroupSubjectsMap, groupSearch, groups, majorFilter, typeFilter]);
  const hasGroupFilters = Boolean(groupSearch.trim()) || typeFilter !== "ALL" || majorFilter !== "ALL";

  const clearGroupFilters = () => {
    setGroupSearch("");
    setTypeFilter("ALL");
    setMajorFilter("ALL");
  };

  const columns = [
    {
      title: t("groups.group"),
      key: "name",
      render: (_: unknown, g: Group) => (
        <Space>
          <Text strong style={{ fontSize: 15 }}>{g.name}</Text>
          <Tag style={GROUP_TYPE_TAG_STYLES[g.group_type] ?? META_TAG_BASE}>
            {t(`groups.type_${g.group_type}`)}
          </Tag>
          {!g.is_active && <Tag color="default">{t("common.inactive")}</Tag>}
          {g.semester && <Tag style={TRIMESTER_TAG_STYLE}>{t(`groups.sem_${g.semester}`)}</Tag>}
        </Space>
      ),
    },
    {
      title: t("groups.major"),
      dataIndex: "major_name",
      key: "major_name",
      render: (majorName: string, g: Group) => (
        <Text type={g.group_type === "ELECTIVE" ? "secondary" : undefined}>
          {g.group_type === "ELECTIVE" ? "—" : majorName}
        </Text>
      ),
    },
    {
      title: t("groups.studyYear"),
      key: "year",
      width: 120,
      render: (_: unknown, g: Group) => (
        <Text>{g.group_type === "ELECTIVE" ? "—" : g.current_study_year > 3 ? t("groups.graduated") : g.current_study_year > 0 ? `${t("groups.year")} ${g.current_study_year}` : "—"}</Text>
      ),
    },
    { title: t("groups.students"), dataIndex: "student_count", key: "student_count", width: 90 },
    {
      title: t("nav.subjects"),
      key: "subjects",
      render: (_: unknown, g: Group) => {
        const tags = allGroupSubjectsMap.get(g.id) ?? [];
        if (!tags.length) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        return (
          <Space size={4} wrap>
            {tags.map((gs, idx) => (
              <Tag key={idx} color="geekblue" style={{ fontSize: 11 }}>{gs.course_code}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 240,
      render: (_: unknown, g: Group) => (
        <Space size="small">
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => openDrawer(g, "students")}>{t("groups.students")}</Button>
          <Button type="link" size="small" icon={<BookOutlined />} onClick={() => openDrawer(g, "subjects")}>{t("nav.subjects")}</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(g)}>{t("common.edit")}</Button>
          <Popconfirm title={t("groups.deleteConfirm")} onConfirm={() => handleDelete(g.id)} okButtonProps={{ danger: true }}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>{t("common.delete")}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title={t("nav.groups")}
        extra={
          <>
            <Button icon={<UploadOutlined />} onClick={() => { setCsvFile(null); setCsvResult(null); setCsvModalOpen(true); }}>{t("groups.importCSV")}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("groups.addGroup")}</Button>
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
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            placeholder={t("groups.searchPlaceholder")}
            style={{ flex: "1 1 320px", maxWidth: 460 }}
          />
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 150 }}
            options={[
              { value: "ALL", label: t("groups.allTypes") },
              { value: "MAIN", label: t("groups.type_MAIN") },
              { value: "ELECTIVE", label: t("groups.type_ELECTIVE") },
            ]}
          />
          <Select
            value={majorFilter}
            onChange={setMajorFilter}
            style={{ width: 220 }}
            options={[
              { value: "ALL", label: t("groups.allMajors") },
              ...availableMajorCodes.map((major) => ({
                value: major,
                label: MAJOR_LABELS[major] ?? major,
              })),
            ]}
          />
          {hasGroupFilters && (
            <Button type="text" onClick={clearGroupFilters}>
              {t("groups.clearFilters")}
            </Button>
          )}
          <Text type="secondary" style={{ marginLeft: "auto", fontSize: 13 }}>
            {t("groups.filterResultCount", { shown: filteredGroups.length, total: groups.length })}
          </Text>
        </div>
        <Table dataSource={filteredGroups} columns={columns} rowKey="id" loading={loading}
          pagination={{ pageSize: 25, showTotal: (n) => `${n} ${t("common.total")}` }} />
      </Panel>

      {/* Create / Edit modal */}
      <Modal title={editing ? t("groups.editGroup") : t("groups.createGroup")}
        open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}
        okText={editing ? t("common.save") : t("common.create")}
        okButtonProps={{ disabled: !canSubmitGroup }} width={480} destroyOnClose>
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>{t("groups.code")} <span style={{ color: "#ef4444" }}>*</span></label>
            <Input value={codeInput} onChange={(e) => handleCodeChange(e.target.value)} onBlur={handleCodeBlur}
              placeholder={isMainGroupType ? "e.g. SE-2322" : "e.g. AI-ETHICS-2026"}
              status={
                isMainGroupType
                  ? parsedCode && !parsedCode.valid ? "error" : undefined
                  : codeInput.trim() && !electiveCodeValid ? "error" : undefined
              }
              style={{ fontFamily: "monospace", fontSize: 16 }} />
            {isMainGroupType && parsedCode?.error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{parsedCode.error}</div>}
            {!isMainGroupType && codeInput.trim() && !electiveCodeValid && (
              <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{t("groups.electiveCodeError")}</div>
            )}
            {isMainGroupType && parsedCode?.valid && (
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Tag color="blue">{MAJOR_LABELS[parsedCode.major] ?? parsedCode.major}</Tag>
                <Tag color="green">{parsedCode.studyYear > 3 ? t("groups.graduated") : parsedCode.studyYear > 0 ? `${t("groups.year")} ${parsedCode.studyYear}` : t("groups.graduated")}</Tag>
                <Tag>{t("groups.groupNum")} №{parsedCode.groupNum}</Tag>
              </div>
            )}
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
              {isMainGroupType ? t("groups.codeHint") : t("groups.electiveCodeHint")}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>{t("groups.type")}</label>
            <Select value={groupType} onChange={(value) => {
              setGroupType(value);
              setParsedCode(value === "MAIN" && codeInput.trim() ? parseGroupCode(codeInput) : null);
            }} style={{ width: "100%" }}
              options={[
                { value: "MAIN", label: t("groups.type_MAIN") },
                { value: "ELECTIVE", label: t("groups.type_ELECTIVE") },
              ]} />
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              {isMainGroupType ? t("groups.mainTypeHint") : t("groups.electiveTypeHint")}
            </div>
          </div>

          {groupType === "ELECTIVE" && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>{t("groups.trimester")}</label>
              <Select value={semester} onChange={setSemester} style={{ width: "100%" }} placeholder={t("groups.selectTrimester")}
                options={TRIMESTER_OPTIONS.map((s) => ({ value: s, label: t(`groups.sem_${s}`) }))} />
            </div>
          )}

          {editing && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>{t("common.status")}</label>
              <Switch checked={isActive} onChange={setIsActive} checkedChildren={t("common.active")} unCheckedChildren={t("common.inactive")} />
            </div>
          )}
        </div>
      </Modal>

      {/* CSV Import modal */}
      <Modal title={t("groups.importTitle")} open={csvModalOpen} onCancel={() => setCsvModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCsvModalOpen(false)}>{t("common.close")}</Button>,
          <Button key="import" type="primary" loading={csvLoading} disabled={!csvFile} onClick={handleCsvImport}>{t("groups.import")}</Button>,
        ]} width={520}>
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>{t("groups.csvFormat")}</Text>
          <Text code style={{ fontSize: 12 }}>code, group_type, trimester, student_emails</Text>
        </div>
        <Upload.Dragger accept=".csv" maxCount={1} beforeUpload={(f) => { setCsvFile(f); return false; }}
          onRemove={() => setCsvFile(null)}
          fileList={csvFile ? [{ uid: "1", name: csvFile.name, status: "done" }] : []}>
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">{t("usersPage.dragCSV")}</p>
        </Upload.Dragger>
        {csvResult && (
          <Alert style={{ marginTop: 12 }} type={csvResult.errors.length > 0 ? "warning" : "success"}
            message={`${t("groups.created")}: ${csvResult.created} | ${t("groups.skipped")}: ${csvResult.skipped}`}
            description={csvResult.errors.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {csvResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {csvResult.errors.length > 10 && <li>…{t("usersPage.andMore", { count: csvResult.errors.length - 10 })}</li>}
              </ul>
            ) : undefined} />
        )}
      </Modal>

      {/* Group drawer */}
      <Drawer title={drawerGroup?.name} open={!!drawerGroup}
        onClose={() => { setDrawerGroup(null); setGroupStudents([]); setGroupSubjects([]); setAddStudentIds([]); setAddSubjectCourseId(null); }}
        width={520}>
        <Tabs activeKey={drawerTab} onChange={(k) => setDrawerTab(k as "students" | "subjects")}
          items={[
            {
              key: "students",
              label: `${t("groups.students")} (${groupStudents.length})`,
              children: (
                <>
                  <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
                    <Select mode="multiple" style={{ flex: 1 }} placeholder={t("groups.addStudents")}
                      value={addStudentIds} onChange={setAddStudentIds} showSearch optionFilterProp="label"
                      options={availableStudents.map((s) => ({ value: s.id, label: `${s.last_name} ${s.first_name} (${s.email})` }))} />
                    <Button type="primary" onClick={handleAddStudents} disabled={!addStudentIds.length}>{t("common.assign")}</Button>
                  </Space.Compact>
                  <Table dataSource={groupStudents} loading={studentsLoading} rowKey="id" size="small" pagination={false}
                    columns={[
                      { title: t("common.name"), key: "name", render: (_: unknown, u: User) => `${u.last_name} ${u.first_name}` },
                      { title: t("common.email"), dataIndex: "email", key: "email" },
                      { title: "", key: "rm", width: 40, render: (_: unknown, u: User) => (
                        <Popconfirm title={t("groups.removeStudentConfirm")} onConfirm={() => handleRemoveStudent(u.id)} okButtonProps={{ danger: true }}>
                          <Button type="text" danger size="small" icon={<UserDeleteOutlined />} />
                        </Popconfirm>
                      )},
                    ]} />
                </>
              ),
            },
            {
              key: "subjects",
              label: `${t("nav.subjects")} (${groupSubjects.length})`,
              children: (
                <>
                  <Space style={{ marginBottom: 12 }} wrap>
                    <Select showSearch optionFilterProp="label" placeholder={t("groups.selectSubject")} style={{ width: 220 }}
                      value={addSubjectCourseId} onChange={setAddSubjectCourseId}
                      options={allCourses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))} />
                    <Select value={addSubjectSemester} onChange={setAddSubjectSemester} style={{ width: 110 }}
                      options={SEMESTER_OPTIONS.map((s) => ({ value: s, label: t(`groups.sem_${s}`) }))} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSubject} disabled={!addSubjectCourseId}>{t("common.assign")}</Button>
                  </Space>
                  <Table dataSource={groupSubjects} loading={subjectsLoading} rowKey="id" size="small" pagination={false}
                    columns={[
                      { title: t("groups.semester"), dataIndex: "semester", key: "semester", width: 80, render: (s: string) => <Tag>{s}</Tag> },
                      { title: t("groups.code"), dataIndex: "course_code", key: "code", width: 80 },
                      { title: t("groups.subject"), dataIndex: "course_name", key: "name" },
                      { title: "", key: "rm", width: 40, render: (_: unknown, gs: GroupSubject) => (
                        <Popconfirm title={t("groups.removeSubjectConfirm")} onConfirm={() => handleRemoveSubject(gs.id)} okButtonProps={{ danger: true }}>
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )},
                    ]} />
                </>
              ),
            },
          ]} />
      </Drawer>
    </div>
  );
}

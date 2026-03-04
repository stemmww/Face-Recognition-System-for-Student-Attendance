import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  List,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  PlayCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceSession, Course, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
import { listSchedules } from "@/api/schedules";
import { listSessions, startSession, stopSession } from "@/api/sessions";
import { getSessionAttendance } from "@/api/attendance";
import type { AttendanceRecord } from "@/types";

const { Title, Text } = Typography;

const statusConfig = {
  present: { color: "green", icon: <CheckCircleFilled style={{ color: "#52c41a" }} />, label: "Present" },
  late: { color: "orange", icon: <ClockCircleFilled style={{ color: "#fa8c16" }} />, label: "Late" },
  absent: { color: "red", icon: <CloseCircleFilled style={{ color: "#ff4d4f" }} />, label: "Absent" },
} as const;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LiveSession() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [startModalOpen, setStartModalOpen] = useState(false);

  // Active session state
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);

  const fetchCourses = useCallback(async () => {
    try {
      setCourses(await listCourses());
    } catch {
      message.error("Failed to load courses");
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const all = await listSessions({ status: "active" });
      setSessions(all);
      if (all.length > 0 && !activeSession) {
        setActiveSession(all[0]);
      }
    } catch {
      /* ignore */
    }
  }, [activeSession]);

  useEffect(() => {
    fetchCourses();
    fetchSessions();
  }, [fetchCourses, fetchSessions]);

  useEffect(() => {
    if (selectedCourse) {
      listSchedules(selectedCourse).then(setSchedules).catch(() => {});
    } else {
      setSchedules([]);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (!activeSession) return;
    const fetch = () => getSessionAttendance(activeSession.id).then(setSessionRecords).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStart = async () => {
    if (!selectedSchedule || !selectedDate) return;
    try {
      const session = await startSession({
        schedule_id: selectedSchedule,
        date: selectedDate.format("YYYY-MM-DD"),
      });
      setActiveSession(session);
      setStartModalOpen(false);
      message.success("Session started!");
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to start session");
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;
    try {
      await stopSession(activeSession.id);
      message.success("Session stopped. Absent students have been auto-marked.");
      setActiveSession(null);
      setSessionRecords([]);
      fetchSessions();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to stop session");
    }
  };

  const presentCount = sessionRecords.filter((r) => r.status === "present").length;
  const lateCount = sessionRecords.filter((r) => r.status === "late").length;
  const absentCount = sessionRecords.filter((r) => r.status === "absent").length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Live Attendance Session</Title>
        {!activeSession ? (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setStartModalOpen(true)}>
            Start Session
          </Button>
        ) : (
          <Button danger icon={<StopOutlined />} onClick={handleStop}>
            Stop Session
          </Button>
        )}
      </div>

      {!activeSession ? (
        <Card>
          <Empty description="No active session. Click 'Start Session' to begin attendance tracking." />
          {sessions.length > 0 && (
            <Alert
              type="info"
              message={`${sessions.length} active session(s) found`}
              style={{ marginTop: 16 }}
              action={
                <Button size="small" onClick={() => setActiveSession(sessions[0])}>
                  Rejoin
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card
              title="Recognized Students"
              extra={
                <Space>
                  <Badge count={presentCount} style={{ backgroundColor: "#52c41a" }} />
                  <Text type="secondary">Present</Text>
                  <Badge count={lateCount} style={{ backgroundColor: "#fa8c16" }} />
                  <Text type="secondary">Late</Text>
                  <Badge count={absentCount} style={{ backgroundColor: "#ff4d4f" }} />
                  <Text type="secondary">Absent</Text>
                </Space>
              }
            >
              {sessionRecords.length === 0 ? (
                <Empty description="Waiting for students to be recognized... Send camera frames to the session endpoint." />
              ) : (
                <List
                  dataSource={sessionRecords}
                  renderItem={(record) => {
                    const cfg = statusConfig[record.status];
                    return (
                      <List.Item>
                        <List.Item.Meta
                          avatar={cfg.icon}
                          title={record.student_name || `Student #${record.student_id}`}
                          description={record.student_email}
                        />
                        <Space>
                          <Tag color={cfg.color}>{cfg.label}</Tag>
                          {record.recognized_at && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(record.recognized_at).format("HH:mm:ss")}
                            </Text>
                          )}
                          <Tag>{record.marked_by}</Tag>
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Session Info">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Session ID">{activeSession.id}</Descriptions.Item>
                <Descriptions.Item label="Date">{activeSession.date}</Descriptions.Item>
                <Descriptions.Item label="Started">
                  {dayjs(activeSession.started_at).format("HH:mm:ss")}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color="green">Active</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="How It Works" style={{ marginTop: 16 }} size="small">
              <ol style={{ paddingLeft: 16, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                <li>Start a session for a scheduled class</li>
                <li>Run the camera client or send frames via API</li>
                <li>Students are recognized automatically</li>
                <li>Status is assigned based on arrival time</li>
                <li>Stop the session to auto-mark absent students</li>
              </ol>
            </Card>
          </Col>
        </Row>
      )}

      {/* Start Session Modal */}
      <Modal
        title="Start Attendance Session"
        open={startModalOpen}
        onOk={handleStart}
        onCancel={() => setStartModalOpen(false)}
        okText="Start"
        okButtonProps={{ disabled: !selectedSchedule }}
      >
        <Space direction="vertical" style={{ width: "100%", marginTop: 12 }}>
          <Text strong>Course</Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select course"
            value={selectedCourse}
            onChange={(v) => { setSelectedCourse(v); setSelectedSchedule(null); }}
            style={{ width: "100%" }}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />

          <Text strong>Schedule</Text>
          <Select
            placeholder="Select class time"
            value={selectedSchedule}
            onChange={setSelectedSchedule}
            style={{ width: "100%" }}
            disabled={!selectedCourse}
            options={schedules.map((s) => ({
              value: s.id,
              label: `${capitalize(s.day_of_week)} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} (${s.room}, ${capitalize(s.class_type)})`,
            }))}
          />

          <Text strong>Date</Text>
          <DatePicker
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
            style={{ width: "100%" }}
          />
        </Space>
      </Modal>
    </>
  );
}

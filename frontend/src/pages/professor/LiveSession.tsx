import { useCallback, useEffect, useRef, useState } from "react";
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
  Progress,
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
  QrcodeOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { QRCodeSVG } from "qrcode.react";
import dayjs from "dayjs";
import type { AttendanceSession, Course, QRToken, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
import { listSchedules } from "@/api/schedules";
import { getQRToken, listSessions, startSession, stopSession } from "@/api/sessions";
import { getSessionAttendance } from "@/api/attendance";
import type { AttendanceRecord } from "@/types";

const { Title, Text } = Typography;

const QR_REFRESH_INTERVAL = 25_000;

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

  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);

  // QR state
  const [qrToken, setQrToken] = useState<QRToken | null>(null);
  const [qrSeconds, setQrSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // --- QR token polling ---
  const fetchQR = useCallback(async () => {
    if (!activeSession) return;
    try {
      const tok = await getQRToken(activeSession.id);
      setQrToken(tok);
      const remaining = Math.max(
        0,
        Math.floor((new Date(tok.expires_at).getTime() - Date.now()) / 1000),
      );
      setQrSeconds(remaining);
    } catch {
      /* session may have been stopped */
    }
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) {
      setQrToken(null);
      return;
    }
    fetchQR();
    const interval = setInterval(fetchQR, QR_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [activeSession, fetchQR]);

  // countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!qrToken) return;
    countdownRef.current = setInterval(() => {
      setQrSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [qrToken]);

  const handleStart = async () => {
    if (!selectedSchedule || !selectedDate) return;
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            }),
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          message.warning("Could not get GPS location. Session will start without GPS validation.");
        }
      }

      const session = await startSession({
        schedule_id: selectedSchedule,
        date: selectedDate.format("YYYY-MM-DD"),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
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
      setQrToken(null);
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
                <Empty description="Waiting for students to scan the QR code and verify their face..." />
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
            {/* QR Code Card */}
            <Card
              title={
                <Space>
                  <QrcodeOutlined />
                  <span>Attendance QR Code</span>
                </Space>
              }
            >
              {qrToken ? (
                <div style={{ textAlign: "center" }}>
                  <QRCodeSVG
                    value={qrToken.token}
                    size={220}
                    level="M"
                    style={{ margin: "0 auto" }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">Refreshes in</Text>
                    <Progress
                      type="circle"
                      percent={Math.round((qrSeconds / 30) * 100)}
                      format={() => `${qrSeconds}s`}
                      size={50}
                      style={{ marginLeft: 12 }}
                    />
                  </div>
                  <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                    Project this QR code on screen for students to scan
                  </Text>
                </div>
              ) : (
                <Empty description="Generating QR code..." />
              )}
            </Card>

            <Card title="Session Info" style={{ marginTop: 16 }}>
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
                <li>Project the QR code on screen</li>
                <li>Students scan the QR and verify with face + GPS</li>
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

          <Alert
            type="info"
            message="Your GPS location will be captured to validate student proximity."
            showIcon
            style={{ marginTop: 8 }}
          />
        </Space>
      </Modal>
    </>
  );
}

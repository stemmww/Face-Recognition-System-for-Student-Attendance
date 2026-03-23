import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  FullscreenOutlined,
  OrderedListOutlined,
  PlayCircleOutlined,
  QrcodeOutlined,
  SaveOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { QRCodeSVG } from "qrcode.react";
import dayjs from "dayjs";
import type { AttendanceSession, AttendanceRecord, Course, EnrolledStudent, QRToken, Schedule } from "@/types";
import { listCourses } from "@/api/courses";
import { listSchedules } from "@/api/schedules";
import { getQRToken, listSessions, startSession, stopSession } from "@/api/sessions";
import {
  batchManualAttendance,
  getEnrolledStudentsForSession,
  getSessionAttendance,
} from "@/api/attendance";

const { Title, Text } = Typography;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LiveSession() {
  const { t } = useTranslation();

  const statusConfig = {
    present: { color: "green", icon: <CheckCircleFilled style={{ color: "#52c41a" }} />, label: t("common.present") },
    late: { color: "orange", icon: <ClockCircleFilled style={{ color: "#fa8c16" }} />, label: t("common.late") },
    absent: { color: "red", icon: <CloseCircleFilled style={{ color: "#ff4d4f" }} />, label: t("common.absent") },
  } as const;

  const [courses, setCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [qrIntervalSeconds, setQrIntervalSeconds] = useState(45);

  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);

  // QR state
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [qrToken, setQrToken] = useState<QRToken | null>(null);
  const [qrSeconds, setQrSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual roll call state
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [manualStatuses, setManualStatuses] = useState<Record<number, string>>({});
  const [savingManual, setSavingManual] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setCourses(await listCourses());
    } catch {
      message.error(t("coursesPage.loadFailed"));
    }
  }, [t]);

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
  useEffect(() => {
    if (!activeSession) {
      setQrToken(null);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const tok = await getQRToken(activeSession.id);
        if (cancelled) return;
        setQrToken(tok);
        const remaining = Math.max(
          0,
          Math.floor((new Date(tok.expires_at).getTime() - Date.now()) / 1000),
        );
        setQrSeconds(remaining);
        // Schedule next fetch when the token expires
        const refreshMs = tok.interval_seconds * 1000;
        timeoutId = setTimeout(poll, refreshMs);
      } catch {
        // Session may have been stopped; retry after a delay
        if (!cancelled) {
          timeoutId = setTimeout(poll, 10000);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeSession]);

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

  // Fetch enrolled students when session becomes active
  useEffect(() => {
    if (!activeSession) {
      setEnrolledStudents([]);
      setManualStatuses({});
      return;
    }
    getEnrolledStudentsForSession(activeSession.id)
      .then(setEnrolledStudents)
      .catch(() => {});
  }, [activeSession]);

  // Initialize manual statuses from existing records
  useEffect(() => {
    if (enrolledStudents.length === 0) return;
    const statuses: Record<number, string> = {};
    for (const student of enrolledStudents) {
      const existing = sessionRecords.find((r) => r.student_id === student.id);
      statuses[student.id] = existing?.status ?? "absent";
    }
    setManualStatuses(statuses);
  }, [enrolledStudents, sessionRecords]);

  const handleSaveManual = async () => {
    if (!activeSession) return;
    setSavingManual(true);
    try {
      const entries = Object.entries(manualStatuses).map(([studentId, status]) => ({
        student_id: Number(studentId),
        status,
      }));
      await batchManualAttendance(activeSession.id, entries);
      message.success(t("session.rollCallSaved"));
      // Refresh session records
      const records = await getSessionAttendance(activeSession.id);
      setSessionRecords(records);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || t("session.rollCallFailed"));
    } finally {
      setSavingManual(false);
    }
  };

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
          message.warning(t("session.gpsWarning"));
        }
      }

      const session = await startSession({
        schedule_id: selectedSchedule,
        date: selectedDate.format("YYYY-MM-DD"),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        qr_interval_seconds: qrIntervalSeconds,
      });
      setActiveSession(session);
      setStartModalOpen(false);
      message.success(t("session.sessionStarted"));
    } catch (err: any) {
      message.error(err?.response?.data?.detail || t("session.startFailed"));
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;
    try {
      await stopSession(activeSession.id);
      message.success(t("session.sessionStopped"));
      setActiveSession(null);
      setSessionRecords([]);
      setQrToken(null);
      fetchSessions();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || t("session.stopFailed"));
    }
  };

  const presentCount = sessionRecords.filter((r) => r.status === "present").length;
  const lateCount = sessionRecords.filter((r) => r.status === "late").length;
  const absentCount = sessionRecords.filter((r) => r.status === "absent").length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t("session.title")}</Title>
        {!activeSession ? (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setStartModalOpen(true)}>
            {t("session.startSession")}
          </Button>
        ) : (
          <Button danger icon={<StopOutlined />} onClick={handleStop}>
            {t("session.stopSession")}
          </Button>
        )}
      </div>

      {!activeSession ? (
        <Card>
          <Empty description={t("session.noActiveSession")} />
          {sessions.length > 0 && (
            <Alert
              type="info"
              message={t("session.activeSessionsFound", { count: sessions.length })}
              style={{ marginTop: 16 }}
              action={
                <Button size="small" onClick={() => setActiveSession(sessions[0])}>
                  {t("common.rejoin")}
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <Tabs
          defaultActiveKey="qr"
          items={[
            {
              key: "qr",
              label: (
                <span><QrcodeOutlined /> {t("session.qrAttendance")}</span>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={16}>
                    <Card
                      title={t("session.recognizedStudents")}
                      extra={
                        <Space>
                          <Badge count={presentCount} style={{ backgroundColor: "#52c41a" }} />
                          <Text type="secondary">{t("common.present")}</Text>
                          <Badge count={lateCount} style={{ backgroundColor: "#fa8c16" }} />
                          <Text type="secondary">{t("common.late")}</Text>
                          <Badge count={absentCount} style={{ backgroundColor: "#ff4d4f" }} />
                          <Text type="secondary">{t("common.absent")}</Text>
                        </Space>
                      }
                    >
                      {sessionRecords.length === 0 ? (
                        <Empty description={t("session.waitingForStudents")} />
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
                    <Card
                      title={
                        <Space>
                          <QrcodeOutlined />
                          <span>{t("session.attendanceQRCode")}</span>
                        </Space>
                      }
                      extra={
                        qrToken && (
                          <Button
                            type="text"
                            icon={<FullscreenOutlined />}
                            onClick={() => setQrFullscreen(true)}
                          >
                            {t("common.fullscreen")}
                          </Button>
                        )
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
                            <Text type="secondary">{t("session.refreshesIn")}</Text>
                            <Progress
                              type="circle"
                              percent={Math.round((qrSeconds / (qrToken?.interval_seconds ?? 45)) * 100)}
                              format={() => `${qrSeconds}s`}
                              size={50}
                              style={{ marginLeft: 12 }}
                            />
                          </div>
                          <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                            {t("session.projectQR")}
                          </Text>
                        </div>
                      ) : (
                        <Empty description={t("session.generatingQR")} />
                      )}
                    </Card>

                    <Card title={t("session.sessionInfo")} style={{ marginTop: 16 }}>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label={t("session.sessionId")}>{activeSession.id}</Descriptions.Item>
                        <Descriptions.Item label={t("common.date")}>{activeSession.date}</Descriptions.Item>
                        <Descriptions.Item label={t("session.started")}>
                          {dayjs(activeSession.started_at).format("HH:mm:ss")}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("common.status")}>
                          <Tag color="green">{t("common.active")}</Tag>
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>

                    <Card title={t("session.howItWorks")} style={{ marginTop: 16 }} size="small">
                      <ol style={{ paddingLeft: 16, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                        <li>{t("session.step1")}</li>
                        <li>{t("session.step2")}</li>
                        <li>{t("session.step3")}</li>
                        <li>{t("session.step4")}</li>
                        <li>{t("session.step5")}</li>
                      </ol>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: "rollcall",
              label: (
                <span><OrderedListOutlined /> {t("session.manualRollCall")}</span>
              ),
              children: (
                <Card
                  title={t("session.manualRollCall")}
                  extra={
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={savingManual}
                      disabled={enrolledStudents.length === 0}
                      onClick={handleSaveManual}
                    >
                      {t("session.saveAll")}
                    </Button>
                  }
                >
                  {enrolledStudents.length === 0 ? (
                    <Empty description={t("session.noEnrolledStudents")} />
                  ) : (
                    <>
                      <Alert
                        type="info"
                        message={t("session.rollCallFallback")}
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                      <List
                        dataSource={enrolledStudents}
                        renderItem={(student) => {
                          const status = manualStatuses[student.id] ?? "absent";
                          const cfg = statusConfig[status as keyof typeof statusConfig];
                          return (
                            <List.Item
                              actions={[
                                <Select
                                  key="status"
                                  value={status}
                                  onChange={(value) =>
                                    setManualStatuses((prev) => ({ ...prev, [student.id]: value }))
                                  }
                                  style={{ width: 130 }}
                                  options={[
                                    { value: "present", label: t("common.present") },
                                    { value: "late", label: t("common.late") },
                                    { value: "absent", label: t("common.absent") },
                                  ]}
                                />,
                              ]}
                            >
                              <List.Item.Meta
                                avatar={cfg.icon}
                                title={`${student.first_name} ${student.last_name}`}
                                description={student.email}
                              />
                            </List.Item>
                          );
                        }}
                      />
                    </>
                  )}
                </Card>
              ),
            },
          ]}
        />
      )}

      {/* QR Fullscreen Modal */}
      <Modal
        open={qrFullscreen}
        onCancel={() => setQrFullscreen(false)}
        footer={null}
        width="100vw"
        centered
        closable
        styles={{
          body: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
            padding: 32,
          },
          content: { borderRadius: 0 },
        }}
        style={{ top: 0, maxWidth: "100vw", padding: 0 }}
      >
        {qrToken && (
          <>
            <QRCodeSVG
              value={qrToken.token}
              size={Math.min(window.innerWidth * 0.6, window.innerHeight * 0.6, 500)}
              level="M"
            />
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <Progress
                type="circle"
                percent={Math.round((qrSeconds / (qrToken?.interval_seconds ?? 45)) * 100)}
                format={() => `${qrSeconds}s`}
                size={64}
              />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {t("session.scanQR")}
                </Text>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Start Session Modal */}
      <Modal
        title={t("session.startSessionModal")}
        open={startModalOpen}
        onOk={handleStart}
        onCancel={() => setStartModalOpen(false)}
        okText={t("common.start")}
        okButtonProps={{ disabled: !selectedSchedule }}
      >
        <Space direction="vertical" style={{ width: "100%", marginTop: 12 }}>
          <Text strong>{t("session.course")}</Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t("common.selectCourse")}
            value={selectedCourse}
            onChange={(v) => { setSelectedCourse(v); setSelectedSchedule(null); }}
            style={{ width: "100%" }}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />

          <Text strong>{t("session.schedule")}</Text>
          <Select
            placeholder={t("session.selectClassTime")}
            value={selectedSchedule}
            onChange={setSelectedSchedule}
            style={{ width: "100%" }}
            disabled={!selectedCourse}
            options={schedules.map((s) => ({
              value: s.id,
              label: `${capitalize(s.day_of_week)} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} (${s.room}, ${capitalize(s.class_type)})`,
            }))}
          />

          <Text strong>{t("common.date")}</Text>
          <DatePicker
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
            style={{ width: "100%" }}
          />

          <Text strong>{t("session.qrRotationInterval")}</Text>
          <Select
            value={qrIntervalSeconds}
            onChange={setQrIntervalSeconds}
            style={{ width: "100%" }}
            options={[
              { value: 15, label: t("session.qrInterval15") },
              { value: 30, label: t("session.qrInterval30") },
              { value: 45, label: t("session.qrInterval45") },
              { value: 60, label: t("session.qrInterval60") },
              { value: 90, label: t("session.qrInterval90") },
            ]}
          />

          <Alert
            type="info"
            message={t("session.gpsInfo")}
            showIcon
            style={{ marginTop: 8 }}
          />
        </Space>
      </Modal>
    </>
  );
}

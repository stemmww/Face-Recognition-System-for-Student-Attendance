import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Col, Row, Select, Statistic, Typography, message } from "antd";
import {
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { listUsers } from "@/api/users";
import { listCourses } from "@/api/courses";
import { getCourseTrends, type SessionTrendPoint } from "@/api/statistics";
import type { User, Course } from "@/types";

const { Title, Text } = Typography;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendCourse, setTrendCourse] = useState<number | undefined>(undefined);
  const [trendData, setTrendData] = useState<SessionTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([listUsers(), listCourses()]);
      setUsers(u);
      setCourses(c);
      if (c.length > 0) setTrendCourse(c[0].id);
    } catch {
      message.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (trendCourse) {
      setTrendLoading(true);
      getCourseTrends(trendCourse)
        .then(setTrendData)
        .catch(() => {})
        .finally(() => setTrendLoading(false));
    }
  }, [trendCourse]);

  const studentCount = users.filter((u) => u.role === "student").length;
  const professorCount = users.filter((u) => u.role === "professor").length;
  const activeCount = users.filter((u) => u.is_active).length;

  const cards = [
    {
      title: "Total Users",
      value: users.length,
      icon: <TeamOutlined style={{ fontSize: 28, color: "#1677ff" }} />,
      onClick: () => navigate("/admin/users"),
    },
    {
      title: "Students",
      value: studentCount,
      icon: <UserOutlined style={{ fontSize: 28, color: "#52c41a" }} />,
      onClick: () => navigate("/admin/users"),
    },
    {
      title: "Professors",
      value: professorCount,
      icon: <IdcardOutlined style={{ fontSize: 28, color: "#722ed1" }} />,
      onClick: () => navigate("/admin/users"),
    },
    {
      title: "Active Accounts",
      value: activeCount,
      icon: <BookOutlined style={{ fontSize: 28, color: "#faad14" }} />,
      onClick: () => navigate("/admin/users"),
    },
  ];

  return (
    <>
      <Title level={4}>Admin Dashboard</Title>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card
              hoverable
              onClick={card.onClick}
              loading={loading}
              style={{ borderRadius: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Statistic title={card.title} value={card.value} />
                {card.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      {/* Attendance trend chart */}
      <Card
        title="Attendance Trends"
        extra={
          <Select
            value={trendCourse}
            onChange={setTrendCourse}
            style={{ width: 240 }}
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
          />
        }
        loading={trendLoading}
        style={{ marginTop: 24, borderRadius: 8 }}
      >
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" name="Present" fill="#52c41a" stackId="a" />
              <Bar dataKey="late" name="Late" fill="#fa8c16" stackId="a" />
              <Bar dataKey="absent" name="Absent" fill="#ff4d4f" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Text type="secondary">Select a course to view attendance trends</Text>
        )}
      </Card>
    </>
  );
}

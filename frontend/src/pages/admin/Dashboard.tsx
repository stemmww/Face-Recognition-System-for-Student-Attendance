import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Col, Row, Statistic, Typography, message } from "antd";
import {
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import { listUsers } from "@/api/users";
import type { User } from "@/types";

const { Title } = Typography;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      message.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      <Card style={{ marginTop: 24, borderRadius: 8 }}>
        <Title level={5}>Quick Actions</Title>
        <p>
          Use the sidebar to manage users, courses, schedules, and the face registry.
          More dashboard widgets (attendance charts, recent sessions) will appear as those modules are built.
        </p>
      </Card>
    </>
  );
}

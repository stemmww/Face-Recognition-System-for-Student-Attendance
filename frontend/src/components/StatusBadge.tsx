import { Tag } from "antd";
import type { AttendanceStatus } from "@/types";

const colorMap: Record<AttendanceStatus, string> = {
  present: "green",
  late: "orange",
  absent: "red",
};

interface Props {
  status: AttendanceStatus;
}

export default function StatusBadge({ status }: Props) {
  return <Tag color={colorMap[status]}>{status.toUpperCase()}</Tag>;
}

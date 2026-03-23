import type {
  CourseStatistics,
  SessionTrendPoint,
  StudentTrendPoint,
} from "@/types";
import apiClient from "./client";

export async function getCourseStatistics(courseId: number): Promise<CourseStatistics> {
  const { data } = await apiClient.get<CourseStatistics>(`/statistics/course/${courseId}`);
  return data;
}

export async function getCourseTrends(courseId: number): Promise<SessionTrendPoint[]> {
  const { data } = await apiClient.get<SessionTrendPoint[]>(`/statistics/course/${courseId}/trends`);
  return data;
}

export async function getMyTrends(): Promise<StudentTrendPoint[]> {
  const { data } = await apiClient.get<StudentTrendPoint[]>("/statistics/student/me/trends");
  return data;
}

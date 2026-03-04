import type { Schedule } from "@/types";
import apiClient from "./client";

export async function listSchedules(courseId?: number): Promise<Schedule[]> {
  const params = courseId ? { course_id: courseId } : {};
  const { data } = await apiClient.get<Schedule[]>("/schedules", { params });
  return data;
}

export async function createSchedule(payload: {
  course_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  class_type?: string;
}): Promise<Schedule> {
  const { data } = await apiClient.post<Schedule>("/schedules", payload);
  return data;
}

export async function updateSchedule(
  scheduleId: number,
  payload: Partial<Schedule>
): Promise<Schedule> {
  const { data } = await apiClient.put<Schedule>(`/schedules/${scheduleId}`, payload);
  return data;
}

export async function deleteSchedule(scheduleId: number): Promise<void> {
  await apiClient.delete(`/schedules/${scheduleId}`);
}

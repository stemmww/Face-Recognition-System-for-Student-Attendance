import type { CsvImportResult, Schedule } from "@/types";
import apiClient from "./client";

export async function listSchedules(params?: {
  semester?: string;
  academic_year?: string;
  course_id?: number;
  professor_id?: number;
  classroom_id?: number;
  group_id?: number;
}): Promise<Schedule[]> {
  const { data } = await apiClient.get<Schedule[]>("/schedules", { params });
  return data;
}

export async function getMySchedule(): Promise<Schedule[]> {
  const { data } = await apiClient.get<Schedule[]>("/schedules/my");
  return data;
}

export async function createSchedule(payload: {
  course_id: number;
  professor_id?: number | null;
  classroom_id?: number | null;
  day_of_week: string;
  start_time: string;
  end_time?: string | null;
  lesson_type?: string;
  semester?: string | null;
  academic_year?: string | null;
  group_ids?: number[];
}): Promise<Schedule> {
  const { data } = await apiClient.post<Schedule>("/schedules", payload);
  return data;
}

export async function updateSchedule(
  scheduleId: number,
  payload: {
    course_id?: number | null;
    professor_id?: number | null;
    classroom_id?: number | null;
    day_of_week?: string;
    start_time?: string;
    end_time?: string;
    lesson_type?: string;
    semester?: string | null;
    academic_year?: string | null;
    group_ids?: number[];
  }
): Promise<Schedule> {
  const { data } = await apiClient.put<Schedule>(`/schedules/${scheduleId}`, payload);
  return data;
}

export async function deleteSchedule(scheduleId: number): Promise<void> {
  await apiClient.delete(`/schedules/${scheduleId}`);
}

export async function importSchedulesCSV(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<CsvImportResult>("/schedules/import/csv", formData);
  return data;
}

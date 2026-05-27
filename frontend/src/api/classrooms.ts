import type { Classroom, CsvImportResult } from "@/types";
import apiClient from "./client";

export async function listClassrooms(activeOnly: boolean = true): Promise<Classroom[]> {
  const { data } = await apiClient.get<Classroom[]>("/classrooms", {
    params: { active_only: activeOnly },
  });
  return data;
}

export async function getClassroom(classroomId: number): Promise<Classroom> {
  const { data } = await apiClient.get<Classroom>(`/classrooms/${classroomId}`);
  return data;
}

export async function createClassroom(payload: {
  name: string;
  capacity?: number | null;
  is_active?: boolean;
}): Promise<Classroom> {
  const { data } = await apiClient.post<Classroom>("/classrooms", payload);
  return data;
}

export async function updateClassroom(
  classroomId: number,
  payload: Partial<{
    name: string;
    capacity: number | null;
    room_type: string | null;
    is_active: boolean;
  }>
): Promise<Classroom> {
  const { data } = await apiClient.put<Classroom>(`/classrooms/${classroomId}`, payload);
  return data;
}

export async function deleteClassroom(classroomId: number): Promise<void> {
  await apiClient.delete(`/classrooms/${classroomId}`);
}

export async function importClassroomsCSV(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<CsvImportResult>("/classrooms/import/csv", formData);
  return data;
}

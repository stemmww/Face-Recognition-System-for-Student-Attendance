import type { CsvImportResult, Group, GroupSubject, User } from "@/types";
import apiClient from "./client";

export async function listGroups(params?: {
  active_only?: boolean;
  group_type?: string;
}): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>("/groups", { params });
  return data;
}

export async function getGroup(groupId: number): Promise<Group> {
  const { data } = await apiClient.get<Group>(`/groups/${groupId}`);
  return data;
}

export async function createGroup(payload: {
  code?: string;
  major?: string;
  enrollment_year_short?: number;
  enrollment_year_full?: number;
  group_number?: number;
  group_type?: string;
  semester?: string | null;
  academic_year?: string | null;
}): Promise<Group> {
  const { data } = await apiClient.post<Group>("/groups", payload);
  return data;
}

export async function updateGroup(
  groupId: number,
  payload: Partial<{
    code: string;
    major: string;
    enrollment_year_short: number;
    group_number: number;
    group_type: string;
    semester: string | null;
    academic_year: string | null;
    is_active: boolean;
  }>
): Promise<Group> {
  const { data } = await apiClient.put<Group>(`/groups/${groupId}`, payload);
  return data;
}

export async function deleteGroup(groupId: number): Promise<void> {
  await apiClient.delete(`/groups/${groupId}`);
}

export async function listGroupStudents(groupId: number): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/groups/${groupId}/students`);
  return data;
}

export async function addStudentsToGroup(groupId: number, studentIds: number[]): Promise<void> {
  await apiClient.post(`/groups/${groupId}/students`, { student_ids: studentIds });
}

export async function removeStudentFromGroup(groupId: number, studentId: number): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/students/${studentId}`);
}

export async function listGroupSubjects(groupId: number): Promise<GroupSubject[]> {
  const { data } = await apiClient.get<GroupSubject[]>(`/groups/${groupId}/subjects`);
  return data;
}

export async function addGroupSubject(
  groupId: number,
  payload: { course_id: number; semester: string }
): Promise<GroupSubject> {
  const { data } = await apiClient.post<GroupSubject>(`/groups/${groupId}/subjects`, payload);
  return data;
}

export async function removeGroupSubject(groupId: number, gsId: number): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/subjects/${gsId}`);
}

export interface GroupSubjectTag {
  group_id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  semester: string;
}

export async function listAllGroupSubjects(): Promise<GroupSubjectTag[]> {
  const { data } = await apiClient.get<GroupSubjectTag[]>("/groups/all-subjects");
  return data;
}

export async function importGroupsCSV(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<CsvImportResult>("/groups/import/csv", formData);
  return data;
}

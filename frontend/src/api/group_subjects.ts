import type { GroupSubject } from "@/types";
import apiClient from "./client";

export async function listGroupSubjects(groupId: number, semester?: string): Promise<GroupSubject[]> {
  const { data } = await apiClient.get<GroupSubject[]>(`/groups/${groupId}/subjects`, {
    params: semester !== undefined ? { semester } : {},
  });
  return data;
}

export async function addGroupSubject(
  groupId: number,
  payload: { course_id: number; semester: string }
): Promise<GroupSubject> {
  const { data } = await apiClient.post<GroupSubject>(`/groups/${groupId}/subjects`, payload);
  return data;
}

export async function removeGroupSubject(groupId: number, subjectId: number): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/subjects/${subjectId}`);
}

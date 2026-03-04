import type { Course, User } from "@/types";
import apiClient from "./client";

export async function listCourses(): Promise<Course[]> {
  const { data } = await apiClient.get<Course[]>("/courses");
  return data;
}

export async function getCourse(courseId: number): Promise<Course> {
  const { data } = await apiClient.get<Course>(`/courses/${courseId}`);
  return data;
}

export async function createCourse(payload: {
  code: string;
  name: string;
  description?: string;
  semester: string;
  academic_year: string;
}): Promise<Course> {
  const { data } = await apiClient.post<Course>("/courses", payload);
  return data;
}

export async function updateCourse(
  courseId: number,
  payload: Partial<Course>
): Promise<Course> {
  const { data } = await apiClient.put<Course>(`/courses/${courseId}`, payload);
  return data;
}

export async function deleteCourse(courseId: number): Promise<void> {
  await apiClient.delete(`/courses/${courseId}`);
}

export async function getCourseProfessors(courseId: number): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/courses/${courseId}/professors`);
  return data;
}

export async function assignProfessors(courseId: number, professorIds: number[]): Promise<void> {
  await apiClient.post(`/courses/${courseId}/professors`, { professor_ids: professorIds });
}

export async function removeProfessor(courseId: number, professorId: number): Promise<void> {
  await apiClient.delete(`/courses/${courseId}/professors/${professorId}`);
}

export async function getCourseStudents(courseId: number): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/courses/${courseId}/students`);
  return data;
}

export async function enrollStudents(courseId: number, studentIds: number[]): Promise<void> {
  await apiClient.post(`/courses/${courseId}/students`, { student_ids: studentIds });
}

export async function removeStudent(courseId: number, studentId: number): Promise<void> {
  await apiClient.delete(`/courses/${courseId}/students/${studentId}`);
}

import type { Course, CsvImportResult, User } from "@/types";
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
  name: string;
  description?: string | null;
  semester: string;
  academic_year: string;
  lesson_type?: string | null;
  group_type?: string | null;
}): Promise<Course> {
  const { data } = await apiClient.post<Course>("/courses", payload);
  return data;
}

export async function updateCourse(
  courseId: number,
  payload: Partial<{
    code: string;
    name: string;
    description: string | null;
    semester: string;
    academic_year: string;
    lesson_type: string | null;
    group_type: string | null;
  }>
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

export interface CourseGroupOut {
  group_subject_id: number;
  group_id: number;
  course_id: number;
  group_name: string;
  group_type: string;
  semester: string;
}

export async function listAllCourseGroups(): Promise<CourseGroupOut[]> {
  const { data } = await apiClient.get<CourseGroupOut[]>("/courses/all-groups");
  return data;
}

export async function listCourseGroups(courseId: number): Promise<CourseGroupOut[]> {
  const { data } = await apiClient.get<CourseGroupOut[]>(`/courses/${courseId}/groups`);
  return data;
}

export async function addCourseGroup(courseId: number, groupId: number, semester: string): Promise<CourseGroupOut> {
  const { data } = await apiClient.post<CourseGroupOut>(`/courses/${courseId}/groups`, { group_id: groupId, semester });
  return data;
}

export async function removeCourseGroup(courseId: number, groupSubjectId: number): Promise<void> {
  await apiClient.delete(`/courses/${courseId}/groups/${groupSubjectId}`);
}

export async function importCoursesCSV(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<CsvImportResult>("/courses/import/csv", formData);
  return data;
}

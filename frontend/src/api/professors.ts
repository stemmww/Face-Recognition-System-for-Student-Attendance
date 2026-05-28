import type { CsvImportResult, Professor } from "@/types";
import apiClient from "./client";

export async function listProfessors(): Promise<Professor[]> {
  const { data } = await apiClient.get<Professor[]>("/professors");
  return data;
}

export async function getProfessor(professorId: number): Promise<Professor> {
  const { data } = await apiClient.get<Professor>(`/professors/${professorId}`);
  return data;
}

export async function createProfessor(payload: {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}): Promise<Professor> {
  const { data } = await apiClient.post<Professor>("/professors", payload);
  return data;
}

export async function updateProfessor(
  professorId: number,
  payload: Partial<{ first_name: string; last_name: string; is_active: boolean }>
): Promise<Professor> {
  const { data } = await apiClient.put<Professor>(`/professors/${professorId}`, payload);
  return data;
}

export async function deleteProfessor(professorId: number): Promise<void> {
  await apiClient.delete(`/professors/${professorId}`);
}

export async function importProfessorsCSV(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<CsvImportResult>("/professors/import/csv", formData);
  return data;
}

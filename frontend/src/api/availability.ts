import type { ProfessorAvailability } from "@/types";
import apiClient from "./client";

export async function getMyAvailability(): Promise<ProfessorAvailability[]> {
  const { data } = await apiClient.get<ProfessorAvailability[]>("/availability");
  return data;
}

export async function getProfessorAvailability(professorId: number): Promise<ProfessorAvailability[]> {
  const { data } = await apiClient.get<ProfessorAvailability[]>(`/availability/professor/${professorId}`);
  return data;
}

export async function addAvailabilitySlot(payload: {
  day_of_week: string;
  start_time: string;
  end_time: string;
}): Promise<ProfessorAvailability> {
  const { data } = await apiClient.post<ProfessorAvailability>("/availability", payload);
  return data;
}

export async function deleteAvailabilitySlot(slotId: number): Promise<void> {
  await apiClient.delete(`/availability/${slotId}`);
}

import type { Appeal } from "@/types";
import apiClient from "./client";

export async function createAppeal(payload: {
  attendance_id: number;
  reason: string;
}): Promise<Appeal> {
  const { data } = await apiClient.post<Appeal>("/appeals", payload);
  return data;
}

export async function getMyAppeals(): Promise<Appeal[]> {
  const { data } = await apiClient.get<Appeal[]>("/appeals/me");
  return data;
}

export async function listAppeals(status?: string): Promise<Appeal[]> {
  const { data } = await apiClient.get<Appeal[]>("/appeals", {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function reviewAppeal(
  appealId: number,
  status: "approved" | "rejected"
): Promise<Appeal> {
  const { data } = await apiClient.patch<Appeal>(`/appeals/${appealId}`, { status });
  return data;
}

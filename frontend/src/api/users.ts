import type { User } from "@/types";
import apiClient from "./client";

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
}

export async function listUsers(role?: string): Promise<User[]> {
  const params = role ? { role } : {};
  const { data } = await apiClient.get<User[]>("/users", { params });
  return data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
}): Promise<User> {
  const { data } = await apiClient.post<User>("/users", payload);
  return data;
}

export async function updateUser(
  userId: number,
  payload: Partial<User>
): Promise<User> {
  const { data } = await apiClient.put<User>(`/users/${userId}`, payload);
  return data;
}

export async function deactivateUser(userId: number): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}

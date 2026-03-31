import type { BulkImportResult, User } from "@/types";
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

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiClient.put("/users/me/password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export async function deactivateUser(userId: number): Promise<void> {
  await apiClient.delete(`/users/${userId}`);
}

export async function uploadProfilePhoto(file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.put<User>("/users/me/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteProfilePhoto(): Promise<User> {
  const { data } = await apiClient.delete<User>("/users/me/photo");
  return data;
}

export async function importStudentsCSV(file: File): Promise<BulkImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<BulkImportResult>("/users/import-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

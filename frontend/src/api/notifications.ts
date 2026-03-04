import type { Notification } from "@/types";
import apiClient from "./client";

export async function listNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>("/notifications");
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/notifications/unread-count");
  return data.count;
}

export async function markRead(notificationId: number): Promise<Notification> {
  const { data } = await apiClient.patch<Notification>(`/notifications/${notificationId}/read`);
  return data;
}

export async function markAllRead(): Promise<void> {
  await apiClient.post("/notifications/read-all");
}

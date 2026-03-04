import type { AttendanceSession } from "@/types";
import apiClient from "./client";

export async function startSession(payload: {
  schedule_id: number;
  date: string;
}): Promise<AttendanceSession> {
  const { data } = await apiClient.post<AttendanceSession>("/sessions", payload);
  return data;
}

export async function stopSession(sessionId: number): Promise<AttendanceSession> {
  const { data } = await apiClient.post<AttendanceSession>(`/sessions/${sessionId}/stop`);
  return data;
}

export async function listSessions(params?: {
  course_id?: number;
  schedule_id?: number;
  status?: string;
}): Promise<AttendanceSession[]> {
  const { data } = await apiClient.get<AttendanceSession[]>("/sessions", { params });
  return data;
}

export async function getSession(sessionId: number): Promise<AttendanceSession> {
  const { data } = await apiClient.get<AttendanceSession>(`/sessions/${sessionId}`);
  return data;
}

export interface RecognitionResult {
  student_id: number;
  name: string;
  status: string;
  confidence: number;
  is_new: boolean;
}

export interface FrameResponse {
  recognized: RecognitionResult[];
  unknown_faces: number;
}

export async function processFrame(sessionId: number, frame: Blob): Promise<FrameResponse> {
  const form = new FormData();
  form.append("frame", frame, "frame.jpg");
  const { data } = await apiClient.post<FrameResponse>(`/sessions/${sessionId}/frame`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

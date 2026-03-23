import type {
  FaceEmbedding,
  FaceEnrollResponse,
  FaceVerifyResponse,
  PipelineStatus,
} from "@/types";
import apiClient from "./client";

export async function getPipelineStatus(): Promise<PipelineStatus> {
  const { data } = await apiClient.get<PipelineStatus>("/face/status");
  return data;
}

export async function enrollFace(userId: number, photo: File): Promise<FaceEnrollResponse> {
  const form = new FormData();
  form.append("user_id", String(userId));
  form.append("photo", photo);
  const { data } = await apiClient.post<FaceEnrollResponse>("/face/enroll", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listEmbeddings(userId: number): Promise<FaceEmbedding[]> {
  const { data } = await apiClient.get<FaceEmbedding[]>(`/face/embeddings/${userId}`);
  return data;
}

export async function deleteEmbedding(embeddingId: number): Promise<void> {
  await apiClient.delete(`/face/embeddings/${embeddingId}`);
}

export async function deleteAllEmbeddings(userId: number): Promise<void> {
  await apiClient.delete(`/face/embeddings/user/${userId}`);
}

export async function verifyFace(photo: File, threshold?: number): Promise<FaceVerifyResponse> {
  const form = new FormData();
  form.append("photo", photo);
  const params = threshold != null ? { threshold } : {};
  const { data } = await apiClient.post<FaceVerifyResponse>("/face/verify", form, {
    headers: { "Content-Type": "multipart/form-data" },
    params,
  });
  return data;
}

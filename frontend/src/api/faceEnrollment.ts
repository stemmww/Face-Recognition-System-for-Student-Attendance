import type { FaceEnrollmentMeResponse, FaceEnrollmentUploadResponse } from "@/types";
import apiClient from "./client";

export async function getFaceEnrollmentStatus(): Promise<FaceEnrollmentMeResponse> {
  const { data } = await apiClient.get<FaceEnrollmentMeResponse>("/face-enrollment/me");
  return data;
}

export async function submitFaceEnrollment(
  imageFile: File
): Promise<FaceEnrollmentUploadResponse> {
  const formData = new FormData();
  formData.append("photo", imageFile);
  const { data } = await apiClient.post<FaceEnrollmentUploadResponse>(
    "/face-enrollment/me",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function selfDeleteFaceData(): Promise<void> {
  await apiClient.delete("/face-enrollment/me");
}

export async function adminResetFaceData(userId: number): Promise<void> {
  await apiClient.delete(`/face-enrollment/users/${userId}`);
}

export async function adminSetEnrollmentPermission(
  userId: number,
  allowed: boolean
): Promise<void> {
  await apiClient.patch(`/face-enrollment/users/${userId}/permission`, {
    can_self_enroll_face: allowed,
  });
}

import type { LivenessChallenge, VerifyAttendanceResponse } from "@/types";
import apiClient from "./client";

export async function fetchChallenge(qrToken: string): Promise<LivenessChallenge> {
  const form = new FormData();
  form.append("token", qrToken);
  const { data } = await apiClient.post<LivenessChallenge>(
    "/attend/challenge",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function verifyAttendance(payload: {
  token: string;
  frames: Blob[];
  latitude?: number | null;
  longitude?: number | null;
  challenge_token?: string | null;
}): Promise<VerifyAttendanceResponse> {
  const form = new FormData();
  form.append("token", payload.token);
  payload.frames.forEach((blob, i) =>
    form.append("frames", blob, `frame${i}.jpg`),
  );
  if (payload.latitude != null && payload.longitude != null) {
    form.append("latitude", String(payload.latitude));
    form.append("longitude", String(payload.longitude));
  }
  if (payload.challenge_token) {
    form.append("challenge_token", payload.challenge_token);
  }
  const { data } = await apiClient.post<VerifyAttendanceResponse>(
    "/attend/verify",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

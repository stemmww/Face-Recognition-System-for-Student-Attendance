import type { TokenResponse } from "@/types";
import apiClient from "./client";

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function refreshToken(refresh_token: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/refresh", {
    refresh_token,
  });
  return data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return data;
}

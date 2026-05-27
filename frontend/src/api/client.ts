import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
});

function isAuthRequest(url?: string): boolean {
  if (!url) return false;

  try {
    const pathname = new URL(url, window.location.origin).pathname;
    return pathname.startsWith("/api/auth/") || pathname.startsWith("/auth/");
  } catch {
    return url.startsWith("/api/auth/") || url.startsWith("/auth/");
  }
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token && !isAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthRequest(original.url)
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const { data } = await axios.post("/api/auth/refresh", {
            refresh_token: refreshToken,
          });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

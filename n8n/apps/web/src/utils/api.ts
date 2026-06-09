const API_BASE_URL = "http://localhost:3001";

/**
 * Global fetch interceptor to inject Authorization header dynamically
 */
export async function apiRequest(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // 401 Unauthorized → force logout and redirect to login
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
      throw new Error("Session expired. Redirecting to login...");
    }

    let errorMsg = "Something went wrong";
    try {
      const errData = await response.json();
      errorMsg = errData.message || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  // Returns empty object for 204 or empty responses
  if (response.status === 204) {
    return {};
  }

  return response.json();
}

export const api = {
  auth: {
    register: (data: any) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: any) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    me: () => apiRequest("/auth/me"),
  },
  workflows: {
    list: () => apiRequest("/workflows"),
    get: (id: string) => apiRequest(`/workflows/${id}`),
    create: (data: { name: string; description?: string }) =>
      apiRequest("/workflows", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string; graph?: any }) =>
      apiRequest(`/workflows/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest(`/workflows/${id}`, { method: "DELETE" }),
    activate: (id: string) => apiRequest(`/workflows/${id}/activate`, { method: "POST" }),
    deactivate: (id: string) => apiRequest(`/workflows/${id}/deactivate`, { method: "POST" }),
    run: (id: string, payload?: any) =>
      apiRequest(`/workflows/${id}/run`, { method: "POST", body: JSON.stringify({ payload }) }),
  },
  executions: {
    list: (params?: { workflowId?: string; status?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams();
      if (params?.workflowId) query.set("workflowId", params.workflowId);
      if (params?.status) query.set("status", params.status);
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.offset) query.set("offset", String(params.offset));
      const qs = query.toString();
      return apiRequest(`/executions${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => apiRequest(`/executions/${id}`),
    cancel: (id: string) => apiRequest(`/executions/${id}/cancel`, { method: "POST" }),
    aggregate: (timeRange: string) => apiRequest(`/executions/aggregate?timeRange=${timeRange}`),
  },
  credentials: {
    list: () => apiRequest("/credentials"),
    create: (data: { name: string; type: string; data: Record<string, any> }) =>
      apiRequest("/credentials", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; type?: string; data?: Record<string, any> }) =>
      apiRequest(`/credentials/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest(`/credentials/${id}`, { method: "DELETE" }),
  },
  metrics: {
    get: () => apiRequest("/metrics"),
  },
  workspace: {
    get: () => apiRequest("/workspace"),
    update: (name: string) => apiRequest("/workspace", { method: "PATCH", body: JSON.stringify({ name }) }),
  },
};

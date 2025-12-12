import axios, { isAxiosError } from "axios";
import toast from "react-hot-toast";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5000/api";

const client = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

client.interceptors.response.use(
    (response) => response,
    (error) => {
        let errorMessage = "Ocurrió un error inesperado.";
        if (isAxiosError(error) && error.response) {
            errorMessage = error.response.data?.error || errorMessage;
        }
        toast.error(errorMessage);
        return Promise.reject(error);
    }
);

export async function apiFetch<TResponse>(...args: Parameters<typeof client.request>): Promise<TResponse> {
    const response = await client.request<TResponse>(...args);
    return response.data;
}

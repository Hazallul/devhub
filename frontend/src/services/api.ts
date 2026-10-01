import axios from 'axios';
import { CLIENT_ID } from '../lib/realtime';

const api = axios.create({
    baseURL: 'http://localhost:8081/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Bu sekmenin yaptığı değişikliğin anlık duyurusu yine bu sekmeye gönderilmez.
    config.headers['X-Client-Id'] = CLIENT_ID;
    return config;
});

// Süresi dolmuş token ile gezinmeye devam edilmesin.
api.interceptors.response.use(
    (res) => res,
    (error) => {
        const isLogin = String(error.config?.url ?? '').includes('/auth/login');
        if (error.response?.status === 401 && !isLogin) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') window.location.assign('/login');
        }
        return Promise.reject(error);
    }
);

/** Sunucunun döndürdüğü mesajı ya da anlaşılır bir varsayılanı verir. */
export function errorMessage(error: unknown, fallback = 'Bir şeyler ters gitti, lütfen tekrar deneyin.') {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;
        if (data?.message) return data.message;
        if (!error.response) return 'Sunucuya bağlanılamadı. Bağlantınızı kontrol edin.';
    }
    return fallback;
}

export default api;

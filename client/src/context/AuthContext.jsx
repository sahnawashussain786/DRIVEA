import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, setStoredToken } from "../assets/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!localStorage.getItem("drivea_token")) {
            setUser(null);
            setLoading(false);
            return null;
        }
        try {
            const u = await authApi.me();
            setUser(u);
            return u;
        } catch {
            setUser(null);
            setStoredToken(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const login = async (creds) => {
        const u = await authApi.login(creds);
        setUser(u);
        return u;
    };

    const register = async (info) => {
        const u = await authApi.register(info);
        setUser(u);
        return u;
    };

    const logout = async () => {
        await authApi.logout();
        setUser(null);
    };

    const updateUser = (patch) => {
        setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    return (
        <AuthContext.Provider value={{ user, loading, refresh, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);

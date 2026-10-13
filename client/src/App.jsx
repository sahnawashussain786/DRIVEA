import React from 'react'
import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Spinner } from './components/ui/Spinner'
import Login, { Register } from './pages/Login'
import Drive from './pages/Drive'
import Trash from './pages/Trash'
import SharedWithMe from './pages/SharedWithMe'
import SharedFile from './pages/SharedFile'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Spinner size="lg" />
            </div>
        )
    }
    return user ? children : <Navigate to="/login" replace />
}

const App = () => {
    return (
        <AuthProvider publishableKey={publishableKey || undefined}>
            <Toaster position="bottom-right" />
            <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/s/:token" element={<SharedFile />} />

                {/* Protected */}
                <Route path="/" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
                <Route path="/f/:id" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
                <Route path="/trash" element={<ProtectedRoute><Trash /></ProtectedRoute>} />
                <Route path="/shared" element={<ProtectedRoute><SharedWithMe /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    )
}

export default App

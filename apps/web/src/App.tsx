import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import './App.css'

// Placeholder pages (Phase 1-5 will implement these)
const SignInPlaceholder = () => <div className="p-8">Sign In Page</div>
const SignUpPlaceholder = () => <div className="p-8">Sign Up Page</div>
const EventsListPlaceholder = () => <div className="p-8">Events List Page (Protected)</div>
const EventSpacePlaceholder = () => <div className="p-8">Event Space Page (Protected)</div>

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/signin" element={<SignInPlaceholder />} />
            <Route path="/signup" element={<SignUpPlaceholder />} />

            {/* Protected Routes */}
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <EventsListPlaceholder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/:id"
              element={
                <ProtectedRoute>
                  <EventSpacePlaceholder />
                </ProtectedRoute>
              }
            />

            {/* Default Redirects */}
            <Route path="/" element={<Navigate to="/events" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App

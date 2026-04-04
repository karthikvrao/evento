import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { TooltipProvider } from './components/ui/tooltip'

// Lazy load pages
const SignInPage = lazy(() => import('./pages/SignInPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const EventsListPage = lazy(() => import('./pages/EventsListPage'))
const EventSpacePage = lazy(() => import('./pages/EventSpacePage'))

const queryClient = new QueryClient()

/**
 * Auth-aware root redirect:
 * - Logged in → /events
 * - Not logged in → /signin (no spurious ?next= param)
 */
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  return <Navigate to={user ? '/events' : '/signin'} replace />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingSpinner fullScreen />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/signup" element={<SignUpPage />} />

                {/* Protected Routes */}
                <Route
                  path="/events"
                  element={
                    <ProtectedRoute>
                      <EventsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/events/:id"
                  element={
                    <ProtectedRoute>
                      <EventSpacePage />
                    </ProtectedRoute>
                  }
                />

                {/* Default Redirects */}
                <Route path="/" element={<RootRedirect />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FileText, Mic, Play, Eye, EyeOff } from 'lucide-react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/events';

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate(next);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate(next);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background animate-in fade-in duration-500">
      {/* Left Panel - Brand (Strict 50%) */}
      <div className="lg:w-1/2 hidden lg:flex flex-col pt-32 xl:pt-40 p-12 xl:p-24 bg-gradient-to-br from-background via-background to-accent/15 relative overflow-hidden border-r border-border/10">
        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 max-w-2xl">
          <Logo className="mb-6 h-10 w-auto" />
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">
            Generate rich, mixed-media event content with AI
          </h1>
          <p className="text-base text-muted-foreground mb-8 max-w-xl leading-relaxed">
            Experience the power of glassmorphic design and abstract 3D elements representing text, audio, and video streams.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <FeatureTile icon={<FileText className="h-5 w-5" />} label="TEXT" color="blue" />
            <FeatureTile icon={<Mic className="h-5 w-5" />} label="AUDIO" color="indigo" />
            <FeatureTile icon={<Play className="h-5 w-5" />} label="VIDEO" color="sky" />
          </div>
        </div>
      </div>

      {/* Right Panel - Form (Strict 50%) */}
      <div className="lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 bg-background relative">
        <div className="w-full max-w-[440px] animate-in slide-in-from-right-8 duration-1000">
          <div className="lg:hidden flex justify-center mb-6">
            <Logo className="h-10 w-auto" />
          </div>

          <div className="bg-card/40 backdrop-blur-2xl p-8 lg:p-10 rounded-3xl border border-border/50 shadow-2xl shadow-black/20">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-muted-foreground mt-2">Enter your credentials to access your account</p>
            </div>

            <div className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-14 text-base font-semibold border-border/40 hover:bg-accent/30 transition-all duration-300 flex items-center justify-center gap-3 bg-white/5 text-foreground rounded-2xl cursor-pointer"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40"></span>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.2em]">
                  <span className="bg-background px-4 text-muted-foreground rounded-full border border-border/20 py-0.5">Or continue with</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-6">
                {error && (
                  <div className="p-4 text-sm bg-destructive/15 border border-destructive/20 text-destructive-foreground rounded-xl animate-in scale-in duration-300">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold ml-1">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="Enter your email address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-13 bg-accent/20 border-border/30 focus:border-primary/50 focus:bg-accent/30 transition-all rounded-xl px-4 text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" title="Enter your password" className="text-sm font-semibold">Password</Label>
                  </div>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      placeholder="Enter your password"
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-13 bg-accent/20 border-border/30 focus:border-primary/50 focus:bg-accent/30 pr-12 transition-all rounded-xl px-4 text-base"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 bg-transparent border-none outline-none shadow-none cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-3 py-1 ml-1">
                  <input 
                    type="checkbox" 
                    id="remember" 
                    className="h-5 w-5 rounded-lg border-border/50 bg-accent/20 text-primary focus:ring-primary/40 transition-all cursor-pointer" 
                  />
                  <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none font-medium">
                    Keep me logged in
                  </label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg font-bold transition-all rounded-2xl !bg-primary !text-primary-foreground hover:opacity-90 mt-2 border-none cursor-pointer"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign in to Account'}
                </Button>
              </form>

              <div className="text-center text-base pt-4">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link to="/signup" className="text-primary font-bold hover:underline underline-offset-4 decoration-2">
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureTile({ icon, label, color }: { icon: React.ReactNode, label: string, color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
    sky: 'from-sky-500/10 to-sky-500/5 border-sky-500/20 text-sky-400',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-2xl border bg-gradient-to-b ${colors[color]} backdrop-blur-md group hover:border-primary/30 hover:scale-105 transition-all duration-300`}>
      <div className="mb-4 p-3 rounded-full bg-background/50 group-hover:bg-primary/10 transition-colors">
        {icon}
      </div>
      <span className="text-xs font-bold tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../api/authService';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loginStore = useAuthStore(state => state.login);
  const setToken = useAuthStore(state => state.setToken);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({ email, password });
      
      // Set token first so subsequent requests (like getCurrentUser) have it in the header
      setToken(response.token);
      
      const user = await authService.getCurrentUser();
      
      loginStore(response.token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light tracking-tighter mb-4 uppercase text-text-primary">Welcome Back</h1>
          <p className="text-text-secondary text-sm tracking-widest uppercase opacity-60">Access your digital sanctuary</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-xs font-bold text-center uppercase tracking-widest"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase pl-4">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="fashion@example.com"
                className="w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 pl-14 pr-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end px-4">
              <label className="text-[10px] font-medium tracking-[0.3em] text-accent uppercase">Password</label>
              <Link to="/forgot-password" className="text-[10px] font-medium tracking-widest text-text-secondary hover:text-text-primary uppercase transition-colors">Forgot?</Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background-secondary border border-ink/5 rounded-2xl py-4 pl-14 pr-6 text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:bg-background-secondary/80 transition-all"
                disabled={isLoading}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-ink text-background-main font-medium rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-ink/5 group disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <span>SIGN IN</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-text-secondary text-sm">
            Don't have an account? {' '}
            <Link to="/signup" className="text-text-primary font-bold hover:text-accent transition-colors">Create one now</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { translations } from '../translations';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

export function Login({ lang, onBack }: { lang: 'en' | 'ar', onBack: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const t = translations[lang];

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(lang === 'ar' ? 'حدث خطأ أثناء تسجيل الدخول بجوجل' : 'An error occurred during Google authentication');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError(lang === 'ar' ? 'البريد الإلكتروني مستخدم بالفعل' : 'Email already in use');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError(lang === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
      } else if (err.code === 'auth/weak-password') {
        setError(lang === 'ar' ? 'كلمة المرور ضعيفة جداً' : 'Password is too weak');
      } else {
        setError(lang === 'ar' ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during authentication');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-10"
        onClick={onBack}
        style={{ [lang === 'ar' ? 'right' : 'left']: '1rem', left: 'auto' }}
      >
        {lang === 'ar' ? <ArrowRight className="w-5 h-5 text-slate-500" /> : <ArrowLeft className="w-5 h-5 text-slate-500" />}
      </Button>
      <CardHeader className="text-center pb-2 pt-10">
        <CardTitle className="text-2xl">
          {isSignUp ? (lang === 'ar' ? 'إنشاء حساب جديد' : 'Create New Account') : t.loginTitle}
        </CardTitle>
        <CardDescription className="text-base">
          {isSignUp 
            ? (lang === 'ar' ? 'أدخل بياناتك لإنشاء حساب' : 'Enter your details to create an account')
            : t.loginDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || isGoogleLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? (lang === 'ar' ? 'إنشاء حساب' : 'Sign Up') : (lang === 'ar' ? 'تسجيل الدخول' : 'Login'))}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-2 text-slate-500">
              {lang === 'ar' ? 'أو' : 'Or'}
            </span>
          </div>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full h-12 text-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700" 
          onClick={handleGoogleLogin}
          disabled={isLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {lang === 'ar' ? 'تسجيل الدخول باستخدام جوجل' : 'Sign in with Google'}
        </Button>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isSignUp 
              ? (lang === 'ar' ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'Already have an account? Login')
              : (lang === 'ar' ? 'ليس لديك حساب؟ إنشاء حساب' : 'Don\'t have an account? Sign Up')}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

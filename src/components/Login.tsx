import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
  const t = translations[lang];

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
          
          <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? (lang === 'ar' ? 'إنشاء حساب' : 'Sign Up') : (lang === 'ar' ? 'تسجيل الدخول' : 'Login'))}
          </Button>
        </form>

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

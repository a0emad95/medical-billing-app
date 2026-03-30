import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { translations } from '../translations';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

const ALLOWED_USERS: Record<string, string> = {
  'user1': 'pass123',
  'm.radwan': 'pass123',
  'user3': 'pass123',
  'user4': 'pass123',
  'user5': 'pass123',
};

export function Login({ lang, onBack, onLogin }: { lang: 'en' | 'ar', onBack: () => void, onLogin: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (ALLOWED_USERS[username] && ALLOWED_USERS[username] === password) {
      const user = { uid: username, email: `${username}@medaudit.local` };
      localStorage.setItem('medaudit_local_user', JSON.stringify(user));
      onLogin(user);
    } else {
      setError(lang === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password');
    }
    
    setIsLoading(false);
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
          {t.loginTitle}
        </CardTitle>
        <CardDescription className="text-base">
          {t.loginDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder={lang === 'ar' ? 'اسم المستخدم' : 'Username'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === 'ar' ? 'تسجيل الدخول' : 'Login')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

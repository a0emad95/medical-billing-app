import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Activity, DollarSign, FileWarning, Loader2, LogIn, User, History, LogOut, Globe, Plus, ArrowRight, ArrowLeft, Moon, Sun, BarChart3, Hospital, ShieldPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { analyzeInvoice, AuditReport } from './services/geminiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { translations } from './translations';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Chatbot } from './components/Chatbot';
import { CroppedImage } from './components/CroppedImage';
import { Login } from './components/Login';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [logo1Error, setLogo1Error] = useState(false);
  const [logo2Error, setLogo2Error] = useState(false);
  
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const t = translations[lang];

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && isAuthReady) {
      const path = `users/${user.uid}/invoices`;
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistory(docs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    } else {
      setHistory([]);
    }
  }, [user, isAuthReady]);

  const handleLogout = async () => {
    await signOut(auth);
    setIsGuest(false);
    setReport(null);
    setImagePreviews([]);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setReport(null);
    setCurrentAuditId(null);
    setError(null);
    setIsAnalyzing(true);
    setImagePreviews([]);

    try {
      const imageDataArray: {base64Image: string, mimeType: string}[] = [];
      const previews: string[] = [];

      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            previews.push(reader.result as string);
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imageDataArray.push({ base64Image: base64Data, mimeType: file.type });
      }

      setImagePreviews(previews);

      const result = await analyzeInvoice(imageDataArray, lang, customInstructions);
      setReport(result);

      // Save to history if logged in
      if (user) {
        const path = `users/${user.uid}/invoices`;
        try {
          const docRef = await addDoc(collection(db, path), {
            uid: user.uid,
            createdAt: new Date().toISOString(),
            language: lang,
            report: result
          });
          setCurrentAuditId(docRef.id);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'Pass':
      case 'Approved':
      case 'ناجح':
      case 'مقبول':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'Fail':
      case 'Rejected':
      case 'راسب':
      case 'مرفوض':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
      case 'Needs Review':
      case 'Partial Approval':
      case 'يحتاج مراجعة':
      case 'مقبول جزئياً':
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><AlertTriangle className="w-3 h-3 mr-1" /> {status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-4 overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="absolute top-4 right-4 flex gap-2 z-50" style={{ [lang === 'ar' ? 'left' : 'right']: '1rem', right: 'auto' }}>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="bg-white/50 backdrop-blur-sm dark:bg-slate-800/50 dark:text-white dark:border-slate-700">
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
          <Button variant="outline" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="bg-white/50 backdrop-blur-sm dark:bg-slate-800/50 dark:text-white dark:border-slate-700">
            <Globe className="w-4 h-4 mr-2" />
            {lang === 'en' ? 'العربية' : 'English'}
          </Button>
        </div>
        <AnimatePresence mode="wait">
          {!showLogin ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: lang === 'ar' ? 50 : -50 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-2xl"
            >
              <div className="flex items-center justify-center gap-6 md:gap-12 mb-10">
                {!logo1Error ? (
                  <motion.img
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    src="/1.png"
                    alt="Logo 1"
                    className="h-28 md:h-40 w-auto object-contain drop-shadow-lg dark:brightness-110"
                    referrerPolicy="no-referrer"
                    onError={() => setLogo1Error(true)}
                  />
                ) : (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="h-28 md:h-40 w-28 md:w-40 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-100 dark:border-blue-800/50"
                  >
                    <Hospital className="w-12 h-12 md:w-16 md:h-16 text-blue-500" />
                  </motion.div>
                )}
                
                <div className="h-20 w-px bg-slate-300 dark:bg-slate-700"></div>
                
                {!logo2Error ? (
                  <motion.img
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    src="/2.png"
                    alt="Logo 2"
                    className="h-28 md:h-40 w-auto object-contain drop-shadow-lg rounded-2xl dark:brightness-110"
                    referrerPolicy="no-referrer"
                    onError={() => setLogo2Error(true)}
                  />
                ) : (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="h-28 md:h-40 w-28 md:w-40 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border-2 border-indigo-100 dark:border-indigo-800/50"
                  >
                    <ShieldPlus className="w-12 h-12 md:w-16 md:h-16 text-indigo-500" />
                  </motion.div>
                )}
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4"
              >
                {t.appTitle}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-lg text-slate-600 dark:text-slate-300 mb-12 max-w-lg"
              >
                {t.appDesc}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowLogin(true)}
                  className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:shadow-[0_0_50px_rgba(37,99,235,0.8)] transition-all"
                >
                  {lang === 'ar' ? <ArrowLeft className="w-10 h-10" /> : <ArrowRight className="w-10 h-10" />}
                </motion.button>
                <span className="text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase text-sm">
                  {lang === 'ar' ? 'الدخول للتطبيق' : 'Enter Application'}
                </span>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: lang === 'ar' ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md"
            >
              <Login lang={lang} onBack={() => setShowLogin(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!logo1Error ? (
              <img 
                src="/1.png" 
                alt="صندوق الخدمات الطبية" 
                className="h-10 w-auto object-contain dark:brightness-110" 
                referrerPolicy="no-referrer"
                onError={() => setLogo1Error(true)}
              />
            ) : (
              <div className="h-10 w-10 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <Hospital className="w-6 h-6 text-blue-500" />
              </div>
            )}
            <span className="font-bold text-lg hidden sm:block">{t.appTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
              <Globe className="w-4 h-4 mr-2" />
              {lang === 'en' ? 'العربية' : 'English'}
            </Button>
            {user ? (
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {t.logout}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsGuest(false)}>
                {lang === 'ar' ? <ArrowRight className="w-4 h-4 mr-2" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
                {lang === 'ar' ? 'الرئيسية' : 'Home'}
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar History (Only for logged in users) */}
        {user && (
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-slate-500" />
                {t.history}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => { setReport(null); setCurrentAuditId(null); setImagePreviews([]); }}>
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500 italic">{t.noHistory}</p>
              ) : (
                <div className="space-y-3 pr-3">
                  {history.map((item) => (
                    <Card 
                      key={item.id} 
                      className="cursor-pointer hover:border-blue-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-blue-700 transition-colors"
                      onClick={() => {
                        setReport(item.report);
                        setCurrentAuditId(item.id);
                        setImagePreviews(item.imagePreviews || []); // Load previews if available
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                          </span>
                          <StatusBadge status={item.report.overall_summary.final_decision} />
                        </div>
                        <p className="text-sm font-medium truncate">
                          {item.report.report_metadata.patient_name || 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {item.report.report_metadata.hospital_name || 'Unknown Hospital'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Main Content */}
        <div className={user ? "lg:col-span-3 space-y-8" : "lg:col-span-4 max-w-5xl mx-auto w-full space-y-8"}>
          
          {/* Header */}
          {!report && (
            <header className="text-center space-y-2 py-8">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                {t.appTitle}
              </h1>
              <p className="text-slate-500 max-w-2xl mx-auto">
                {t.appDesc}
              </p>
            </header>
          )}

          {/* Upload Area */}
          {!report && (
            <Card className="border-dashed border-2 bg-white/50 hover:bg-white/80 dark:bg-slate-900/50 dark:hover:bg-slate-900/80 dark:border-slate-700 transition-colors">
              <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg dark:text-slate-200">{t.uploadTitle}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.uploadDesc}</p>
                </div>
                
                <div className="w-full max-w-md mt-4 mb-4 text-start">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {lang === 'ar' ? 'ملاحظات إضافية للتدقيق (اختياري)' : 'Custom Audit Instructions (Optional)'}
                  </label>
                  <textarea
                    className="w-full p-3 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    rows={3}
                    placeholder={lang === 'ar' ? 'مثال: ركز على الأدوية الموصوفة، أو تأكد من توقيع الطبيب الفلاني...' : 'e.g., Focus on prescribed medications, or ensure specific doctor signature...'}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    disabled={isAnalyzing}
                  />
                </div>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t.analyzing}
                    </>
                  ) : (
                    t.selectImage
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t.error}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Dashboard */}
          {report && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t.invoiceDetails}</h2>
                <Button variant="outline" onClick={() => { setReport(null); setImagePreviews([]); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t.newAudit}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Image Preview & Metadata */}
                <div className="space-y-6 md:col-span-1">
                  <Card className="dark:bg-slate-900 dark:border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2 dark:text-slate-200">
                        <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        {t.invoiceDetails}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {imagePreviews.length > 0 && (
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-4 p-4 max-h-64 overflow-y-auto">
                          {imagePreviews.map((preview, idx) => (
                            <img key={idx} src={preview} alt={`Invoice Preview ${idx + 1}`} className="max-h-48 object-contain" />
                          ))}
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">{t.patient}</span>
                          <span className="font-medium text-right dark:text-slate-200">{report.report_metadata.patient_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">{t.hospital}</span>
                          <span className="font-medium text-right dark:text-slate-200">{report.report_metadata.hospital_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">{t.admission}</span>
                          <span className="font-medium text-right dark:text-slate-200">{report.report_metadata.admission_date || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500 dark:text-slate-400">{t.discharge}</span>
                          <span className="font-medium text-right dark:text-slate-200">{report.report_metadata.discharge_date || 'N/A'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 text-slate-50 border-slate-800 dark:bg-slate-950">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{t.overallDecision}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{t.status}</span>
                        <StatusBadge status={report.overall_summary.final_decision} />
                      </div>
                      <Separator className="bg-slate-800" />
                      <div>
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t.auditorNotes}</span>
                        <p className="text-sm mt-1 leading-relaxed text-slate-300">
                          {report.overall_summary.notes}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Audit Tiers */}
                <div className="space-y-6 md:col-span-2">
                  
                  {/* Statistics Chart */}
                  {report.statistics && (
                    <Card className="dark:bg-slate-900 dark:border-slate-800">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                          <CardTitle className="text-lg dark:text-slate-200">
                            {lang === 'ar' ? 'إحصائيات التدقيق' : 'Audit Statistics'}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{report.statistics.total_invoices_analyzed}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{lang === 'ar' ? 'إجمالي الفواتير' : 'Total Invoices'}</div>
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{report.statistics.total_errors_found}</div>
                            <div className="text-sm text-red-500 dark:text-red-400">{lang === 'ar' ? 'إجمالي الأخطاء' : 'Total Errors'}</div>
                          </div>
                        </div>
                        
                        <div className="h-64 w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[
                                {
                                  name: lang === 'ar' ? 'إداري' : 'Admin',
                                  errors: report.statistics.error_breakdown.administrative_errors,
                                },
                                {
                                  name: lang === 'ar' ? 'طبي' : 'Medical',
                                  errors: report.statistics.error_breakdown.medical_errors,
                                },
                                {
                                  name: lang === 'ar' ? 'مالي' : 'Financial',
                                  errors: report.statistics.error_breakdown.financial_errors,
                                }
                              ]}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                              <Tooltip 
                                cursor={{fill: 'transparent'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Bar dataKey="errors" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Administrative Audit */}
                  <Card className="dark:bg-slate-900 dark:border-slate-800">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <FileWarning className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        <CardTitle className="text-lg dark:text-slate-200">{t.adminAudit}</CardTitle>
                      </div>
                      <StatusBadge status={report.administrative_audit.status} />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{t.missingSignatures}:</span>
                          {report.administrative_audit.missing_signatures ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">{t.yes}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">{t.no}</Badge>
                          )}
                        </div>
                        
                        {report.administrative_audit.errors.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-400 p-3 rounded-md text-sm border dark:border-red-900/50">
                            <span className="font-semibold block mb-1">{t.adminErrors}</span>
                            <ul className="list-disc pl-5 space-y-2">
                              {report.administrative_audit.errors.map((err: any, i: number) => {
                                const isObj = typeof err === 'object' && err !== null;
                                const msg = isObj ? err.message : err;
                                const bbox = isObj ? err.bounding_box : null;
                                return (
                                  <li key={i}>
                                    <div>{msg}</div>
                                    {bbox && imagePreviews.length > 0 && <CroppedImage src={imagePreviews[0]} bbox={bbox} />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Medical Logic Audit */}
                  <Card className="dark:bg-slate-900 dark:border-slate-800">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        <CardTitle className="text-lg dark:text-slate-200">{t.medicalAudit}</CardTitle>
                      </div>
                      <StatusBadge status={report.medical_audit.status} />
                    </CardHeader>
                    <CardContent>
                      {report.medical_audit.unjustified_medical_items.length > 0 ? (
                        <div className="space-y-3">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.unjustifiedItems}</span>
                          <ScrollArea className="h-[150px] pr-4">
                            <div className="space-y-3">
                              {report.medical_audit.unjustified_medical_items.map((item: any, i: number) => (
                                <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md border border-slate-100 dark:border-slate-700">
                                  <div className="font-medium text-sm text-slate-900 dark:text-slate-200">{item.item_name}</div>
                                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.reason}</div>
                                  {item.bounding_box && imagePreviews.length > 0 && <CroppedImage src={imagePreviews[0]} bbox={item.bounding_box} />}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">{t.noUnjustified}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Financial Fraud Audit */}
                  <Card className="dark:bg-slate-900 dark:border-slate-800">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                        <CardTitle className="text-lg dark:text-slate-200">{t.financialAudit}</CardTitle>
                      </div>
                      <StatusBadge status={report.financial_audit.status} />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {report.financial_audit.unbundling_detected.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            {t.unbundlingDetected}
                          </span>
                          {report.financial_audit.unbundling_detected.map((item: any, i: number) => (
                            <div key={i} className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-100 dark:border-amber-800/50 text-sm">
                              <div className="font-medium text-amber-900 dark:text-amber-400 mb-1">{t.separatedItems}</div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {item.separated_items.map((sep: string, j: number) => (
                                  <Badge key={j} variant="outline" className="bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">{sep}</Badge>
                                ))}
                              </div>
                              <div className="text-amber-800 dark:text-amber-500">{item.explanation}</div>
                              {item.bounding_box && imagePreviews.length > 0 && <CroppedImage src={imagePreviews[0]} bbox={item.bounding_box} />}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {report.financial_audit.vague_items.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.vagueItems}</span>
                            <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400 space-y-2">
                              {report.financial_audit.vague_items.map((item: any, i: number) => {
                                const isObj = typeof item === 'object' && item !== null;
                                const name = isObj ? item.item : item;
                                const bbox = isObj ? item.bounding_box : null;
                                return (
                                  <li key={i}>
                                    <div>{name}</div>
                                    {bbox && imagePreviews.length > 0 && <CroppedImage src={imagePreviews[0]} bbox={bbox} />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {report.financial_audit.suspicious_pricing.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.suspiciousPricing}</span>
                            <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400 space-y-2">
                              {report.financial_audit.suspicious_pricing.map((item: any, i: number) => {
                                const isObj = typeof item === 'object' && item !== null;
                                const name = isObj ? item.item : item;
                                const bbox = isObj ? item.bounding_box : null;
                                return (
                                  <li key={i}>
                                    <div>{name}</div>
                                    {bbox && imagePreviews.length > 0 && <CroppedImage src={imagePreviews[0]} bbox={bbox} />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>

                      {report.financial_audit.unbundling_detected.length === 0 && 
                       report.financial_audit.vague_items.length === 0 && 
                       report.financial_audit.suspicious_pricing.length === 0 && (
                        <p className="text-sm text-slate-500 italic">{t.noFinancialAnomalies}</p>
                      )}

                    </CardContent>
                  </Card>

                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Chatbot Agent */}
      <Chatbot report={report} lang={lang} user={user} auditId={currentAuditId} />
    </div>
  );
}


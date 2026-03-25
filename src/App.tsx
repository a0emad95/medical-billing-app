import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Activity, DollarSign, FileWarning, Loader2, LogIn, User, History, LogOut, Globe, Plus } from 'lucide-react';
import { analyzeInvoice, AuditReport } from './services/geminiService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { translations } from './translations';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Chatbot } from './components/Chatbot';
import { CroppedImage } from './components/CroppedImage';

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
  
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const t = translations[lang];

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsGuest(false);
    } catch (err) {
      console.error(err);
      setError("Failed to sign in.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsGuest(false);
    setReport(null);
    setImagePreview(null);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setReport(null);
    setError(null);
    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await analyzeInvoice(base64Data, file.type, lang);
      setReport(result);

      // Save to history if logged in
      if (user) {
        const path = `users/${user.uid}/invoices`;
        try {
          await addDoc(collection(db, path), {
            uid: user.uid,
            createdAt: new Date().toISOString(),
            language: lang,
            report: result
          });
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <Card className="w-full max-w-md shadow-lg border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex items-center justify-center mb-6">
              <img src="/logo.png" alt="صندوق الخدمات الطبية" className="h-20 w-auto object-contain" referrerPolicy="no-referrer" />
            </div>
            <CardTitle className="text-2xl">{t.loginTitle}</CardTitle>
            <CardDescription className="text-base">{t.loginDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Button className="w-full h-12 text-lg" onClick={handleLogin}>
              <LogIn className="w-5 h-5 mr-2" />
              {t.signInGoogle}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">OR</span>
              </div>
            </div>
            <Button variant="outline" className="w-full h-12 text-lg" onClick={() => setIsGuest(true)}>
              <User className="w-5 h-5 mr-2" />
              {t.continueGuest}
            </Button>
            
            <div className="pt-4 flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
                <Globe className="w-4 h-4 mr-2" />
                {lang === 'en' ? 'العربية' : 'English'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="صندوق الخدمات الطبية" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
            <span className="font-bold text-lg hidden sm:block">{t.appTitle}</span>
          </div>
          <div className="flex items-center gap-2">
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
                <LogIn className="w-4 h-4 mr-2" />
                {t.loginTitle}
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
              <Button variant="ghost" size="icon" onClick={() => { setReport(null); setImagePreview(null); }}>
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
                      className="cursor-pointer hover:border-blue-300 transition-colors"
                      onClick={() => {
                        setReport(item.report);
                        setImagePreview(null); // We don't save images to save space, so clear preview
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
            <Card className="border-dashed border-2 bg-white/50 hover:bg-white/80 transition-colors">
              <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-blue-50 rounded-full text-blue-600">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{t.uploadTitle}</h3>
                  <p className="text-sm text-slate-500">{t.uploadDesc}</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
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
                <Button variant="outline" onClick={() => { setReport(null); setImagePreview(null); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t.newAudit}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Image Preview & Metadata */}
                <div className="space-y-6 md:col-span-1">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500" />
                        {t.invoiceDetails}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {imagePreview && (
                        <div className="rounded-md overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                          <img src={imagePreview} alt="Invoice Preview" className="max-h-48 object-contain" />
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{t.patient}</span>
                          <span className="font-medium text-right">{report.report_metadata.patient_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{t.hospital}</span>
                          <span className="font-medium text-right">{report.report_metadata.hospital_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">{t.admission}</span>
                          <span className="font-medium text-right">{report.report_metadata.admission_date || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">{t.discharge}</span>
                          <span className="font-medium text-right">{report.report_metadata.discharge_date || 'N/A'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 text-slate-50 border-slate-800">
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
                  
                  {/* Administrative Audit */}
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <FileWarning className="w-5 h-5 text-indigo-500" />
                        <CardTitle className="text-lg">{t.adminAudit}</CardTitle>
                      </div>
                      <StatusBadge status={report.administrative_audit.status} />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">{t.missingSignatures}:</span>
                          {report.administrative_audit.missing_signatures ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">{t.yes}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-green-600 border-green-200 bg-green-50">{t.no}</Badge>
                          )}
                        </div>
                        
                        {report.administrative_audit.errors.length > 0 && (
                          <div className="bg-red-50 text-red-900 p-3 rounded-md text-sm">
                            <span className="font-semibold block mb-1">{t.adminErrors}</span>
                            <ul className="list-disc pl-5 space-y-2">
                              {report.administrative_audit.errors.map((err: any, i: number) => {
                                const isObj = typeof err === 'object' && err !== null;
                                const msg = isObj ? err.message : err;
                                const bbox = isObj ? err.bounding_box : null;
                                return (
                                  <li key={i}>
                                    <div>{msg}</div>
                                    {bbox && imagePreview && <CroppedImage src={imagePreview} bbox={bbox} />}
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
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        <CardTitle className="text-lg">{t.medicalAudit}</CardTitle>
                      </div>
                      <StatusBadge status={report.medical_audit.status} />
                    </CardHeader>
                    <CardContent>
                      {report.medical_audit.unjustified_medical_items.length > 0 ? (
                        <div className="space-y-3">
                          <span className="text-sm font-semibold text-slate-700">{t.unjustifiedItems}</span>
                          <ScrollArea className="h-[150px] pr-4">
                            <div className="space-y-3">
                              {report.medical_audit.unjustified_medical_items.map((item: any, i: number) => (
                                <div key={i} className="bg-slate-50 p-3 rounded-md border border-slate-100">
                                  <div className="font-medium text-sm text-slate-900">{item.item_name}</div>
                                  <div className="text-sm text-slate-500 mt-1">{item.reason}</div>
                                  {item.bounding_box && imagePreview && <CroppedImage src={imagePreview} bbox={item.bounding_box} />}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">{t.noUnjustified}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Financial Fraud Audit */}
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                        <CardTitle className="text-lg">{t.financialAudit}</CardTitle>
                      </div>
                      <StatusBadge status={report.financial_audit.status} />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {report.financial_audit.unbundling_detected.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            {t.unbundlingDetected}
                          </span>
                          {report.financial_audit.unbundling_detected.map((item: any, i: number) => (
                            <div key={i} className="bg-amber-50 p-3 rounded-md border border-amber-100 text-sm">
                              <div className="font-medium text-amber-900 mb-1">{t.separatedItems}</div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {item.separated_items.map((sep: string, j: number) => (
                                  <Badge key={j} variant="outline" className="bg-white text-amber-700 border-amber-200">{sep}</Badge>
                                ))}
                              </div>
                              <div className="text-amber-800">{item.explanation}</div>
                              {item.bounding_box && imagePreview && <CroppedImage src={imagePreview} bbox={item.bounding_box} />}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {report.financial_audit.vague_items.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">{t.vagueItems}</span>
                            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
                              {report.financial_audit.vague_items.map((item: any, i: number) => {
                                const isObj = typeof item === 'object' && item !== null;
                                const name = isObj ? item.item : item;
                                const bbox = isObj ? item.bounding_box : null;
                                return (
                                  <li key={i}>
                                    <div>{name}</div>
                                    {bbox && imagePreview && <CroppedImage src={imagePreview} bbox={bbox} />}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {report.financial_audit.suspicious_pricing.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700">{t.suspiciousPricing}</span>
                            <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
                              {report.financial_audit.suspicious_pricing.map((item: any, i: number) => {
                                const isObj = typeof item === 'object' && item !== null;
                                const name = isObj ? item.item : item;
                                const bbox = isObj ? item.bounding_box : null;
                                return (
                                  <li key={i}>
                                    <div>{name}</div>
                                    {bbox && imagePreview && <CroppedImage src={imagePreview} bbox={bbox} />}
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
      <Chatbot report={report} lang={lang} />
    </div>
  );
}


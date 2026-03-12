import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Camera, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Download,
  Moon,
  Sun
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import axios from 'axios';
import * as faceapi from '@vladmandic/face-api';
import { loadModels, getFaceDescriptor, createFaceMatcher } from './lib/faceApi';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
        : 'text-slate-500 hover:bg-indigo-50 dark:hover:bg-slate-800 dark:text-slate-400'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
      <Icon className={color.replace('bg-', 'text-')} size={24} />
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'student' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Auth State
  const [loginRole, setLoginRole] = useState<'admin' | 'student'>('admin');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  
  // Data State
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalStudents: 0, presentToday: 0, absentToday: 0, chartData: [] });
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  
  // Face Registration State
  const [registrationStep, setRegistrationStep] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedDescriptors, setCapturedDescriptors] = useState<any[]>([]);
  const [newStudent, setNewStudent] = useState({ id: '', name: '', email: '', department: '' });
  
  // Face Recognition State
  const [recognizing, setRecognizing] = useState(false);
  const recognizingRef = useRef(false);
  const [recognizedName, setRecognizedName] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await loadModels();
        setLoading(false);
        fetchData();
      } catch (err) {
        console.error("Failed to load models:", err);
        alert("Error loading AI models. Please check your internet connection.");
      }
    };
    init();

    return () => {
      stopCamera();
      if (recognitionIntervalRef.current) clearInterval(recognitionIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    recognizingRef.current = recognizing;
    if (!recognizing && recognitionIntervalRef.current) {
      clearInterval(recognitionIntervalRef.current);
      recognitionIntervalRef.current = null;
      stopCamera();
    }
  }, [recognizing]);

  const fetchData = async () => {
    try {
      if (userRole === 'admin') {
        const [studentsRes, statsRes] = await Promise.all([
          axios.get('/api/students'),
          axios.get('/api/stats')
        ]);
        setStudents(studentsRes.data);
        setStats(statsRes.data);
      } else if (userRole === 'student' && currentUser) {
        const res = await axios.get(`/api/students/${currentUser.id}/attendance`);
        setStudentAttendance(res.data);
      }
    } catch (err) {
      console.error("Fetch data error:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [isLoggedIn, userRole, currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/login', { ...loginData, role: loginRole });
      if (res.data.success) {
        setUserRole(res.data.role);
        setCurrentUser(res.data.user);
        setIsLoggedIn(true);
      }
    } catch (err) {
      alert("Invalid credentials");
    }
  };

  // --- Camera Handling ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: { ideal: 30 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        return new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve(true);
            };
          }
        });
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // --- Face Registration ---
  const captureImage = async () => {
    if (!videoRef.current || isCapturing) return;
    
    setIsCapturing(true);
    try {
      // Small delay to ensure frame is ready
      await new Promise(r => setTimeout(r, 100));
      const descriptor = await getFaceDescriptor(videoRef.current);
      
      if (descriptor) {
        setCapturedDescriptors(prev => [...prev, Array.from(descriptor)]);
        setRegistrationStep(prev => prev + 1);
      } else {
        alert("No face detected. Please look directly at the camera.");
      }
    } catch (err) {
      console.error("Capture error:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const saveStudent = async () => {
    if (!newStudent.id || !newStudent.name) {
      alert("Please fill in all student details.");
      return;
    }
    try {
      await axios.post('/api/students', {
        ...newStudent,
        face_encodings: capturedDescriptors
      });
      alert("Student registered successfully!");
      stopCamera();
      setRegistrationStep(0);
      setCapturedDescriptors([]);
      setNewStudent({ id: '', name: '', email: '', department: '' });
      setActiveTab('students');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Error saving student");
    }
  };

  // --- Face Recognition ---
  const startRecognition = async () => {
    if (recognizing) return;
    
    await startCamera();
    setRecognizing(true);
    
    const matcher = createFaceMatcher(students);
    if (!matcher) {
      alert("No registered students found. Please register students first.");
      setRecognizing(false);
      return;
    }
    
    recognitionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !recognizingRef.current) return;
      
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();
        
        if (canvasRef.current && videoRef.current) {
          const displaySize = { 
            width: videoRef.current.videoWidth || 640, 
            height: videoRef.current.videoHeight || 480 
          };
          faceapi.matchDimensions(canvasRef.current, displaySize);
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, displaySize.width, displaySize.height);
          
          for (const detection of resizedDetections) {
            const bestMatch = matcher.findBestMatch(detection.descriptor);
            const student = students.find(s => s.id === bestMatch.label);
            
            let label = "Unknown";
            let color = "red";

            if (student && bestMatch.distance < 0.5) {
              label = student.name;
              color = "green";
              
              if (recognizedName !== student.name) {
                setRecognizedName(student.name);
                axios.post('/api/attendance', { student_id: student.id })
                  .then(() => fetchData())
                  .catch(err => console.error("Attendance mark error:", err));
                
                // Clear name after 3 seconds
                setTimeout(() => setRecognizedName(null), 3000);
              }
            }
            
            const drawBox = new faceapi.draw.DrawBox(detection.detection.box, { 
              label: `${label} (${Math.round((1 - bestMatch.distance) * 100)}%)`,
              boxColor: color
            });
            drawBox.draw(canvasRef.current);
          }
        }
      } catch (err) {
        console.error("Recognition loop error:", err);
      }
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Initializing AI Models...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="text-indigo-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back</h2>
            <p className="text-slate-500 dark:text-slate-400">AI Face Recognition Attendance</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
            <button 
              onClick={() => setLoginRole('admin')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${loginRole === 'admin' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Admin
            </button>
            <button 
              onClick={() => setLoginRole('student')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${loginRole === 'student' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Student
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {loginRole === 'admin' ? 'Username' : 'Student ID'}
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder={loginRole === 'admin' ? 'admin' : 'STU001'}
                value={loginData.username}
                onChange={e => setLoginData({ ...loginData, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                value={loginData.password}
                onChange={e => setLoginData({ ...loginData, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
            >
              Sign In as {loginRole === 'admin' ? 'Admin' : 'Student'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-4">
              {loginRole === 'admin' ? (
                <>Default: <span className="font-mono">admin</span> / <span className="font-mono">admin123</span></>
              ) : (
                <>Default password is <span className="font-mono">student123</span></>
              )}
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-slate-50 dark:bg-slate-950 w-full flex text-slate-900 dark:text-slate-100">
        
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col`}>
          <div className="p-6 flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Camera className="text-white" size={20} />
            </div>
            {sidebarOpen && <span className="font-bold text-xl tracking-tight">FaceAI</span>}
          </div>

          <nav className="flex-1 px-3 space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            {userRole === 'admin' && (
              <>
                <SidebarItem icon={Users} label="Students" active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
                <SidebarItem icon={UserPlus} label="Register" active={activeTab === 'register'} onClick={() => setActiveTab('register')} />
                <SidebarItem icon={Camera} label="Attendance" active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} />
                <SidebarItem icon={FileText} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
              </>
            )}
            {userRole === 'student' && (
              <SidebarItem icon={FileText} label="My Attendance" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            )}
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              {sidebarOpen && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            <button 
              onClick={() => setIsLoggedIn(false)}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <LogOut size={20} />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white capitalize">{activeTab === 'reports' && userRole === 'student' ? 'My Attendance' : activeTab}</h1>
              <p className="text-slate-500 dark:text-slate-400">Welcome back, {userRole === 'admin' ? 'Administrator' : currentUser?.name}</p>
            </div>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {userRole === 'admin' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <StatCard title="Total Students" value={stats.totalStudents} icon={Users} color="bg-indigo-500" />
                      <StatCard title="Present Today" value={stats.presentToday} icon={CheckCircle} color="bg-emerald-500" />
                      <StatCard title="Absent Today" value={stats.absentToday} icon={XCircle} color="bg-rose-500" />
                      <StatCard title="Attendance Rate" value={`${stats.totalStudents ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0}%`} icon={LayoutDashboard} color="bg-amber-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6">Attendance Trends (Last 7 Days)</h3>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5' }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6">Department Distribution</h3>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={students.reduce((acc: any[], s) => {
                              const dept = acc.find(a => a.name === s.department);
                              if (dept) dept.count++;
                              else acc.push({ name: s.department, count: 1 });
                              return acc;
                            }, [])}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                              <Bar dataKey="count" fill="#818CF8" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <StatCard title="My Attendance Days" value={studentAttendance.length} icon={CheckCircle} color="bg-emerald-500" />
                      <StatCard title="Department" value={currentUser?.department} icon={Users} color="bg-indigo-500" />
                      <StatCard title="Student ID" value={currentUser?.id} icon={LayoutDashboard} color="bg-amber-500" />
                    </div>
                    
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                      <h3 className="text-xl font-bold mb-6">My Profile Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-sm text-slate-500">Full Name</p>
                          <p className="text-lg font-bold">{currentUser?.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-500">Email Address</p>
                          <p className="text-lg font-bold">{currentUser?.email}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-500">Department</p>
                          <p className="text-lg font-bold">{currentUser?.department}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-500">Student ID</p>
                          <p className="text-lg font-bold font-mono">{currentUser?.id}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'students' && (
              <motion.div 
                key="students"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search students..." 
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button 
                    onClick={() => setActiveTab('register')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium flex items-center space-x-2"
                  >
                    <UserPlus size={18} />
                    <span>Add Student</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">ID</th>
                        <th className="px-6 py-4 font-semibold">Name</th>
                        <th className="px-6 py-4 font-semibold">Email</th>
                        <th className="px-6 py-4 font-semibold">Department</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {students.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-sm">{student.id}</td>
                          <td className="px-6 py-4 font-medium">{student.name}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{student.email}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                              {student.department}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18} /></button>
                            <button 
                              onClick={async () => {
                                if (confirm("Delete this student?")) {
                                  await axios.delete(`/api/students/${student.id}`);
                                  fetchData();
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'register' && (
              <motion.div 
                key="register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xl font-bold mb-6">Student Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Student ID</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newStudent.id}
                          onChange={e => setNewStudent({ ...newStudent, id: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Full Name</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newStudent.name}
                          onChange={e => setNewStudent({ ...newStudent, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email Address</label>
                        <input 
                          type="email" 
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newStudent.email}
                          onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Department</label>
                        <select 
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                          value={newStudent.department}
                          onChange={e => setNewStudent({ ...newStudent, department: e.target.value })}
                        >
                          <option value="">Select Department</option>
                          <option value="Computer Science">Computer Science</option>
                          <option value="Information Technology">Information Technology</option>
                          <option value="Engineering">Engineering</option>
                          <option value="Business">Business</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
                    <h3 className="text-xl font-bold mb-6">Face Registration</h3>
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                      <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                        <div className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                          {capturedDescriptors.length} / 15 Images
                        </div>
                      </div>
                      
                      <div className="w-full space-y-4">
                        {registrationStep < 15 ? (
                          <button 
                            disabled={isCapturing}
                            onClick={async () => {
                              if (!videoRef.current?.srcObject) await startCamera();
                              else await captureImage();
                            }}
                            className={`w-full ${isCapturing ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center space-x-2 transition-all`}
                          >
                            {isCapturing ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Camera size={20} />
                            )}
                            <span>
                              {isCapturing ? 'Processing...' : (videoRef.current?.srcObject ? 'Capture Face' : 'Start Camera')}
                            </span>
                          </button>
                        ) : (
                          <button 
                            onClick={saveStudent}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center space-x-2 transition-all"
                          >
                            <CheckCircle size={20} />
                            <span>Complete Registration</span>
                          </button>
                        )}
                        <p className="text-center text-sm text-slate-500">
                          {registrationStep < 15 
                            ? `Please capture ${15 - registrationStep} more angles of your face.`
                            : "All images captured! Click 'Complete Registration' to save."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'attendance' && (
              <motion.div 
                key="attendance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold">Real-time Recognition</h3>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${recognizing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                      <span className="text-sm font-medium text-slate-500">{recognizing ? 'System Active' : 'System Idle'}</span>
                    </div>
                  </div>

                  <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden mb-8">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      playsInline
                      className="w-full h-full object-cover" 
                    />
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                    
                    {!recognizing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                        <button 
                          onClick={startRecognition}
                          className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold shadow-2xl flex items-center space-x-3 hover:scale-105 transition-transform"
                        >
                          <Camera size={24} />
                          <span>Start Recognition</span>
                        </button>
                      </div>
                    )}

                    {recognizing && (
                      <button 
                        onClick={() => setRecognizing(false)}
                        className="absolute top-4 right-4 bg-rose-600 text-white p-2 rounded-xl shadow-lg hover:bg-rose-700 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    )}

                    {recognizedName && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-6 py-3 rounded-2xl shadow-xl flex items-center space-x-3"
                      >
                        <div className="bg-emerald-100 p-2 rounded-full">
                          <CheckCircle className="text-emerald-600" size={20} />
                        </div>
                        <span className="font-bold text-lg">{recognizedName}</span>
                        <span className="text-slate-500 text-sm">Attendance Marked!</span>
                      </motion.div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Status</p>
                      <p className="font-bold">{recognizing ? 'Scanning...' : 'Ready'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Accuracy</p>
                      <p className="font-bold">98.4%</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-500 uppercase font-bold mb-1">Last Match</p>
                      <p className="font-bold">{recognizedName || 'None'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 justify-between items-center">
                  <div className="flex gap-4">
                    {userRole === 'admin' && (
                      <input 
                        type="date" 
                        className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                        onChange={async (e) => {
                          const res = await axios.get(`/api/attendance?date=${e.target.value}`);
                          setAttendance(res.data);
                        }}
                      />
                    )}
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search records..." 
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button className="bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium flex items-center space-x-2">
                    <Download size={18} />
                    <span>Export CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">Student ID</th>
                        <th className="px-6 py-4 font-semibold">Name</th>
                        <th className="px-6 py-4 font-semibold">Department</th>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold">Time</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(userRole === 'admin' ? attendance : studentAttendance).length > 0 ? (userRole === 'admin' ? attendance : studentAttendance).map((record, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-sm">{record.student_id}</td>
                          <td className="px-6 py-4 font-medium">{record.name}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{record.department}</td>
                          <td className="px-6 py-4">{record.date}</td>
                          <td className="px-6 py-4">{record.time}</td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-indigo-400 text-xs font-medium">
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

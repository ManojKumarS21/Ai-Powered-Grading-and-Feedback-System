"use client";

import { useState, useEffect, useRef } from "react";

interface Task {
  id: number;
  title: string;
  description: string;
  max_marks: number;
}

interface EvaluationResult {
  score: number;
  grade: string;
  feedback: string;
  improvements: string[];
}

/* ================= ENV ================= */
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL;


export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Challenge State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMaxMarks, setNewMaxMarks] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);

  // Chat Assistant State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hello! I'm your AI Doubt Assistant. Ask me anything about your code or the challenge! 🤖" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks();

    // Initialize WebSocket
    console.log(`Connecting to WebSocket on ${WS_URL}...`);
    const ws = new WebSocket(WS_URL || "ws://127.0.0.1:5005");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected!");
      ws.send(JSON.stringify({ type: "ping-socket", payload: { time: Date.now() } }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Message received from server:", data);

        if (data.type === "pong-socket") {
          console.log("Pong received:", data.payload.message);
        }

        if (data.type === "receive-response") {
          setMessages(prev => [...prev, { role: "ai", text: data.payload.message }]);
          setIsTyping(false);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setError("Doubt Assistant connection failed. Check your network.");
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected.");
    };

    return () => {
      console.log("Closing WebSocket...");
      ws.close();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatOpen]);

  async function fetchTasks() {
    try {
      const res = await fetch(`${API_URL}/api/tasks`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data);
      if (data.length > 0 && !selectedTask) setSelectedTask(data[0]);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Could not load tasks. Please ensure the backend is running.");
    }
  }

  async function handleSaveChallenge() {
    if (!newTitle || !newDesc) {
      setError("Title and Description are required.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const url = isEditingTask
        ? `${API_URL}/api/update-task/${selectedTask?.id}`
        : `${API_URL}/api/add-task`;

      const method = isEditingTask ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          max_marks: newMaxMarks,
        }),
      });

      if (response.ok) {
        setNewTitle("");
        setNewDesc("");
        setShowCreateModal(false);
        setIsEditingTask(false);
        fetchTasks();
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.message || "Failed to save challenge");
        } else {
          throw new Error(`Server Error: ${response.status}. The route might be missing or the server needs a restart.`);
        }
      }
    } catch (err: any) {
      console.error("Save failed:", err);
      setError(err.message || "Could not save. Check your connection.");
    } finally {
      setIsCreating(false);
    }
  }

  const openCreateModal = () => {
    setIsEditingTask(false);
    setNewTitle("");
    setNewDesc("");
    setNewMaxMarks(10);
    setShowCreateModal(true);
  };

  const openEditModal = () => {
    if (!selectedTask) return;
    setIsEditingTask(true);
    setNewTitle(selectedTask.title);
    setNewDesc(selectedTask.description);
    setNewMaxMarks(selectedTask.max_marks);
    setShowCreateModal(true);
  };

  async function handleSubmit() {
    if (!selectedTask) {
      setError("Please select a challenge first.");
      return;
    }
    setLoading(true);
    setEvaluation(null);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/submit-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: selectedTask.id,
          student_code: studentCode,
          language: language,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.message || "Evaluation failed");
        } else {
          throw new Error(`Server Error: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      setEvaluation(data);
    } catch (err: any) {
      console.error("Submission failed:", err);
      setError(err.message || "An unexpected error occurred during evaluation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendChat() {
    if (!chatInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open");
      return;
    }

    const userMsg = chatInput;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);

    wsRef.current.send(JSON.stringify({
      type: "ask-doubt",
      payload: {
        message: userMsg,
        context: {
          currentTask: selectedTask,
          studentCode: studentCode
        }
      }
    }));
  }

  const languages = [
    { label: "JavaScript", value: "javascript" },
    { label: "Python", value: "python" },
    { label: "Java", value: "java" },
    { label: "C++", value: "cpp" },
    { label: "C#", value: "csharp" },
  ];

  return (
    <main className="h-screen bg-[#060b18] text-slate-200 font-sans flex flex-col overflow-hidden">

      {/* Header */}
      <header className="px-6 py-3 border-b border-slate-800/60 bg-[#0a1122] flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            AI Code Evaluator
          </h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-wide border-l border-slate-700 ml-1 pl-2 uppercase">Professional Feedback Engine</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-slate-700 transition-all flex items-center gap-2"
        >
          <span>+</span> Create Challenge
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Left Side: Editor & Selection */}
        <div className="flex-1 flex flex-col border-r border-slate-800/60 overflow-hidden bg-[#0a1122]/30">

          {/* Controls Bar */}
          <div className="p-3 grid grid-cols-2 gap-3 border-b border-slate-800/40 shrink-0">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Current Challenge</label>
              <select
                className="w-full bg-[#0f172a] border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all cursor-pointer shadow-sm"
                value={selectedTask?.id || ""}
                onChange={(e) => {
                  const task = tasks.find(t => t.id === Number(e.target.value));
                  setSelectedTask(task || null);
                  setError(null);
                }}
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                onClick={openEditModal}
                className="mt-2 text-[9px] text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
              >
                ✎ Edit Current Challenge
              </button>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Programming Language</label>
              <select
                className="w-full bg-[#0f172a] border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all cursor-pointer shadow-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description Snippet */}
          {selectedTask && (
            <div className="px-4 py-2 bg-[#11192e] border-b border-slate-800/30 shrink-0">
              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-1 italic">"{selectedTask.description}"</p>
            </div>
          )}

          {/* Editor Container */}
          <div className="flex-1 relative flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Source Code Editor
              </span>
              <span className="text-[9px] font-mono text-cyan-500/80 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">{language.toUpperCase()}</span>
            </div>
            <textarea
              className="flex-1 w-full bg-[#080d1a] border border-slate-800/60 rounded-xl p-4 text-emerald-400 font-mono text-[13px] focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all resize-none shadow-2xl leading-relaxed custom-scrollbar overflow-y-auto"
              placeholder={`// Write your ${language} solution here... \n// Focus on efficiency and best practices.`}
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
            />
            {error && (
              <div className="absolute bottom-16 left-8 right-8 p-2 bg-red-950/60 border border-red-500/40 text-red-200 text-[10px] rounded backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-bottom-1">
                ⚠ {error}
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-3 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={loading || !studentCode || !selectedTask}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white text-[11px] font-black py-3 rounded-xl shadow-lg shadow-cyan-950/20 transform active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider overflow-hidden"
              >
                {loading ? "Crunching Algorithms..." : "Evaluate Solution"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Visual Reports */}
        <div className="w-full lg:w-[400px] bg-[#080d1a] flex flex-col overflow-hidden">
          <div className="p-5 h-full overflow-y-auto custom-scrollbar">
            {evaluation ? (
              <div className="animate-in fade-in slide-in-from-right-10 duration-700 space-y-5">

                {/* Score Circle Card */}
                <div className="bg-[#11192e] rounded-xl border border-slate-800/80 p-5 flex items-center justify-between shadow-lg">
                  <div className="space-y-1">
                    <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-tighter">Performance Score</h2>
                    <p className="text-[10px] text-slate-500">Based on logic and clarity.</p>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-slate-800" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * evaluation.score) / (selectedTask?.max_marks || 10)} className="text-cyan-500 transition-all duration-1000 ease-out" />
                    </svg>
                    <span className="absolute text-xl font-black text-white">{evaluation.grade}</span>
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#11192e]/40 p-3 rounded-xl border border-slate-800/60">
                    <span className="block text-xl font-black text-white">{evaluation.score}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Awarded Marks</span>
                  </div>
                  <div className="bg-[#11192e]/40 p-3 rounded-xl border border-slate-800/60">
                    <span className="block text-xl font-black text-white">{selectedTask?.max_marks}</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Available Marks</span>
                  </div>
                </div>

                {/* Feedback Blocks */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      Expert Feedback
                    </h3>
                    <div className="p-4 bg-[#11192e] rounded-xl border-l-4 border-cyan-500 shadow-sm text-xs text-slate-300 leading-relaxed font-medium">
                      {evaluation.feedback}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      Path to Mastery
                    </h3>
                    <div className="space-y-2">
                      {evaluation.improvements.map((item, i) => (
                        <div key={i} className="group p-3 bg-slate-900/50 rounded-lg border border-slate-800/40 hover:border-emerald-500/30 transition-all">
                          <div className="flex items-start gap-3">
                            <span className="text-emerald-500 text-[10px] font-bold mt-0.5">0{i + 1}</span>
                            <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors">{item}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <div className="w-16 h-16 mb-4 rounded-full bg-slate-800/30 flex items-center justify-center text-3xl border border-slate-700/20 grayscale">
                  🔬
                </div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Awaiting Analysis</h3>
                <p className="text-[10px] text-slate-600 mt-2 max-w-[180px]">Submit solution to trigger architectural review.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 transition-transform">
            <h2 className="text-xl font-black text-white mb-5 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              {isEditingTask ? "Edit Challenge" : "New Code Challenge"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                <input
                  type="text"
                  className="w-full bg-[#060b18] border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="e.g. Find Max Value"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                <textarea
                  className="w-full bg-[#060b18] border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500 outline-none h-24 resize-none"
                  placeholder="Task instructions..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Max Marks</label>
                <input
                  type="number"
                  className="w-full bg-[#060b18] border border-slate-800 rounded-lg p-2 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                  value={newMaxMarks}
                  onChange={(e) => setNewMaxMarks(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-2.5 rounded-xl transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveChallenge}
                disabled={isCreating || !newTitle || !newDesc}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold py-2.5 rounded-xl shadow-lg shadow-cyan-950/40 transition-all disabled:opacity-30"
              >
                {isCreating ? "SAVING..." : (isEditingTask ? "UPDATE" : "CREATE")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Assistant */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen && (
          <div className="mb-4 w-80 h-[400px] bg-[#0f172a] border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-800 bg-[#11192e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-[10px]">🤖</div>
                <span className="text-xs font-black text-white uppercase tracking-wider">AI Assistant</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-500 hover:text-white transition-colors text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#080d1a]/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-2.5 rounded-xl text-[11px] leading-relaxed shadow-sm ${msg.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-br-none'
                    : 'bg-[#1e293b] text-slate-300 border border-slate-800 rounded-bl-none'
                    }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1e293b] p-2 rounded-xl border border-slate-800 flex gap-1 items-center">
                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce delay-150"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-slate-800 bg-[#0a1122]">
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-[#060b18] border border-slate-800 rounded-lg py-2 px-3 pr-10 text-[11px] text-slate-300 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                  placeholder="Ask a doubt..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isTyping}
                  className="absolute right-1.5 top-1.5 text-cyan-500 hover:text-cyan-400 disabled:opacity-30 transition-colors p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${isChatOpen ? 'bg-cyan-600 rotate-90' : 'bg-gradient-to-tr from-cyan-600 to-blue-700 hover:scale-110 active:scale-95'
            }`}
        >
          {isChatOpen ? (
            <span className="text-white text-2xl">×</span>
          ) : (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
          {!isChatOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#060b18] animate-pulse"></span>
          )}
        </button>
      </div>

      {/* CSS Utility for Scrollbar */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </main>
  );
}

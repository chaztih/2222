import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle, Camera, Plus, Trash2, Image as ImageIcon, ListTodo, Calendar, Sparkles, X, ShieldCheck, Zap, Infinity as InfinityIcon } from "lucide-react";
import { Task, Subtask, PhotoEntry } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"tasks" | "gallery">("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [adsRemoved, setAdsRemoved] = useState(true); // Default to true until checked
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchPhotos();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setAdsRemoved(data.adsRemoved);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const removeAds = async () => {
    try {
      const res = await fetch("/api/settings/remove-ads", { method: "POST" });
      if (res.ok) {
        setAdsRemoved(true);
      }
    } catch (err) {
      console.error("Failed to remove ads", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotos = async () => {
    try {
      const res = await fetch("/api/photos");
      const data = await res.json();
      setPhotos(data);
    } catch (err) {
      console.error("Failed to fetch photos", err);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle }),
      });
      const newTask = await res.json();
      setTasks([newTask, ...tasks]);
      setNewTaskTitle("");
    } catch (err) {
      console.error("Failed to add task", err);
    }
  };

  const addSubtask = async (taskId: number, title: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const newSubtask = await res.json();
      setTasks(tasks.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSubtask] } : t));
    } catch (err) {
      console.error("Failed to add subtask", err);
    }
  };

  const deleteTask = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task", err);
    }
  };

  const toggleSubtask = async (subtaskId: number, completed: boolean, file?: File) => {
    const formData = new FormData();
    formData.append("completed", completed.toString());
    if (file) formData.append("photo", file);

    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        body: formData,
      });
      const updatedSubtask = await res.json();
      
      setTasks(tasks.map(t => ({
        ...t,
        subtasks: t.subtasks.map(s => s.id === subtaskId ? updatedSubtask : s)
      })));
      
      if (file) fetchPhotos();
    } catch (err) {
      console.error("Failed to toggle subtask", err);
    }
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-12">
      <header className="mb-12 text-center relative">
        {!adsRemoved && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="absolute right-0 top-0 flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-1.5 rounded-full shadow-lg shadow-orange-200 transition-all border border-white/20"
          >
            <Sparkles size={14} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Premium</span>
          </motion.button>
        )}
        <h1 className="text-5xl font-serif font-bold tracking-tight mb-2">GoalTracker</h1>
        <p className="text-muted-foreground font-light italic">Document your journey, one step at a time.</p>
      </header>

      <nav className="flex justify-center mb-12 gap-4">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all ${
            activeTab === "tasks" ? "bg-black text-white shadow-lg" : "bg-white text-black hover:bg-black/5"
          }`}
        >
          <ListTodo size={18} />
          <span className="text-sm font-medium">Tasks</span>
        </button>
        <button
          onClick={() => setActiveTab("gallery")}
          className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all ${
            activeTab === "gallery" ? "bg-black text-white shadow-lg" : "bg-white text-black hover:bg-black/5"
          }`}
        >
          <ImageIcon size={18} />
          <span className="text-sm font-medium">Gallery</span>
        </button>
      </nav>

      <main>
        <AnimatePresence mode="wait">
          {activeTab === "tasks" ? (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={addTask} className="mb-8">
                <div className="relative">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Set a new big goal..."
                    className="w-full bg-white rounded-2xl px-6 py-4 pr-16 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-lg font-medium"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-black text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </form>

              <div className="space-y-6">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onAddSubtask={addSubtask}
                    onDeleteTask={deleteTask}
                    onToggleSubtask={toggleSubtask}
                  />
                ))}
                {tasks.length === 0 && !loading && (
                  <div className="text-center py-20 opacity-30 italic">
                    No goals set yet. Start by adding one above.
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GalleryView photos={photos} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!adsRemoved && (
        <div className="mt-12 p-8 bg-white rounded-[2rem] card-shadow border border-black/5 text-center overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-black/5 to-transparent" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/20 mb-6">Sponsored Content</p>
          
          <div className="group cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <div className="aspect-[16/6] bg-zinc-100 rounded-2xl flex items-center justify-center overflow-hidden relative mb-6">
              <img 
                src="https://picsum.photos/seed/premium/800/300?grayscale" 
                alt="Premium" 
                className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-t from-white/80 to-transparent">
                <h4 className="text-xl font-serif font-bold text-black/80 mb-1">Focus on what matters.</h4>
                <p className="text-xs text-black/50 italic">Remove distractions and unlock premium features.</p>
              </div>
            </div>
            
            <button className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-all group-hover:gap-3">
              Upgrade to Lifetime Premium
              <Zap size={12} className="text-amber-500" />
            </button>
          </div>
        </div>
      )}

      <SubscriptionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onConfirm={removeAds} 
      />
    </div>
  );
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function SubscriptionModal({ isOpen, onClose, onConfirm }: SubscriptionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            <button 
              onClick={onClose}
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-black/5 transition-colors z-10"
            >
              <X size={20} className="text-black/30" />
            </button>

            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3">
                <Sparkles size={40} className="text-amber-500" />
              </div>
              
              <h2 className="text-3xl font-serif font-bold mb-4">Go Premium</h2>
              <p className="text-black/50 mb-10 leading-relaxed">
                Elevate your productivity with a one-time purchase. No subscriptions, just pure focus.
              </p>

              <div className="space-y-4 mb-10">
                {[
                  { icon: <ShieldCheck size={18} />, text: "Remove all advertisements" },
                  { icon: <Zap size={18} />, text: "Faster performance & sync" },
                  { icon: <InfinityIcon size={18} />, text: "Unlimited goals & storage" }
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-4 text-left p-4 rounded-2xl bg-zinc-50 border border-black/5">
                    <div className="text-amber-500">{feature.icon}</div>
                    <span className="text-sm font-medium text-black/70">{feature.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="w-full bg-black text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <span>Unlock Forever</span>
                <span className="opacity-40 font-light">|</span>
                <span>$300</span>
              </button>
              
              <p className="mt-6 text-[10px] uppercase tracking-widest text-black/30 font-bold">
                One-time payment • Lifetime access
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface TaskCardProps {
  key?: any;
  task: Task;
  onAddSubtask: (id: number, title: string) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (id: number, completed: boolean, file?: File) => void;
}

function TaskCard({ task, onAddSubtask, onDeleteTask, onToggleSubtask }: TaskCardProps) {
  const [newSubtask, setNewSubtask] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    onAddSubtask(task.id, newSubtask);
    setNewSubtask("");
  };

  return (
    <div className="bg-white rounded-3xl p-8 card-shadow border border-black/5">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-serif font-bold leading-tight">{task.title}</h2>
        <button onClick={() => onDeleteTask(task.id)} className="text-black/20 hover:text-red-500 transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {task.subtasks.map((sub) => (
          <SubtaskItem key={sub.id} subtask={sub} onToggle={onToggleSubtask} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          placeholder="Add a small step..."
          className="flex-1 bg-[#F8F7F4] rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
        />
        <button type="submit" className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/80 transition-colors">
          Add
        </button>
      </form>
    </div>
  );
}

interface SubtaskItemProps {
  key?: any;
  subtask: Subtask;
  onToggle: (id: number, completed: boolean, file?: File) => void;
}

function SubtaskItem({ subtask, onToggle }: SubtaskItemProps) {
  const isCompleted = subtask.completed === 1 || subtask.completed === true;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onToggle(subtask.id, true, file);
    }
  };

  return (
    <div className="flex items-center gap-4 group">
      <button
        onClick={() => !isCompleted && onToggle(subtask.id, !isCompleted)}
        className={`transition-colors ${isCompleted ? "text-emerald-500" : "text-black/20 hover:text-black/40"}`}
      >
        {isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      
      <span className={`flex-1 text-sm transition-all ${isCompleted ? "text-black/40 line-through" : "text-black/80"}`}>
        {subtask.title}
      </span>

      {!isCompleted && (
        <label className="cursor-pointer text-black/20 hover:text-black/60 transition-colors opacity-0 group-hover:opacity-100">
          <Camera size={18} />
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
        </label>
      )}

      {subtask.photo_url && (
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-black/5">
          <img src={subtask.photo_url} alt="Proof" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

function GalleryView({ photos }: { photos: PhotoEntry[] }) {
  const groupedPhotos = photos.reduce((acc, photo) => {
    const date = new Date(photo.completed_at || "").toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, PhotoEntry[]>);

  const dates = Object.keys(groupedPhotos);

  if (photos.length === 0) {
    return (
      <div className="text-center py-20 opacity-30 italic">
        No photos uploaded yet. Complete steps with photos to see them here.
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {dates.map((date) => (
        <section key={date}>
          <div className="flex items-center gap-4 mb-6">
            <Calendar size={18} className="text-black/40" />
            <h3 className="text-lg font-serif font-bold">{date}</h3>
            <div className="flex-1 h-px bg-black/5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {groupedPhotos[date].map((photo) => (
              <motion.div
                key={photo.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl overflow-hidden card-shadow border border-black/5"
              >
                <div className="aspect-square overflow-hidden bg-black/5">
                  <img src={photo.photo_url!} alt={photo.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">{photo.task_title}</p>
                  <p className="text-sm font-medium text-black/80">{photo.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}


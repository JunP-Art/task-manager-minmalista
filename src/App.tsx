import React, { useState, useEffect } from 'react';
import { Plus, Circle, CheckCircle2, Clock, Trash2, Star, Bell, X, Calendar } from 'lucide-react';

// Interfaz para definir la estructura de una tarea
interface Task {
  id: string;
  title: string;
  createdAt: number; // timestamp de creación
  completedAt?: number; // timestamp de finalización
  isCompleted: boolean;
  type: 'indefinite' | 'priority';
  notificationInterval?: number; // en minutos
  lastNotifiedAt?: number; // timestamp de la última notificación
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'indefinite' | 'priority'>('indefinite');
  const [newTaskInterval, setNewTaskInterval] = useState<number>(15);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  // Registrar Service Worker y comprobar permisos
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed:', err);
      });
    }
  }, []);

  // Cargar tareas desde localStorage al iniciar
  useEffect(() => {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error("Error al parsear tareas desde localStorage");
      }
    }
  }, []);

  // Guardar tareas en localStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Sistema de notificaciones (revisa cada 5 segundos)
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      setTasks(prevTasks => {
        let hasChanges = false;
        const updatedTasks = prevTasks.map(task => {
          if (!task.isCompleted && task.type === 'priority' && task.notificationInterval) {
            const timeSinceLast = now - (task.lastNotifiedAt || task.createdAt);
            const intervalMs = task.notificationInterval * 60 * 1000;
            
            if (timeSinceLast >= intervalMs) {
              hasChanges = true;
              // Mostrar la notificación (toast)
              setToast({ id: crypto.randomUUID(), title: task.title });
              
              // Mostrar notificación nativa (OS)
              if ('Notification' in window && Notification.permission === 'granted') {
                const title = 'Recordatorio de Tarea';
                const options = {
                  body: task.title,
                  icon: 'https://fav.farm/🔔',
                  vibrate: [200, 100, 200],
                  tag: task.id,
                  requireInteraction: true
                };

                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(title, options);
                  }).catch(() => {
                    new Notification(title, options);
                  });
                } else {
                  new Notification(title, options);
                }
              }
              
              return { ...task, lastNotifiedAt: now };
            }
          }
          return task;
        });
        return hasChanges ? updatedTasks : prevTasks;
      });
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // Auto-ocultar el toast después de 5 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Manejar la adición de una nueva tarea
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      createdAt: Date.now(),
      isCompleted: false,
      type: newTaskType,
      ...(newTaskType === 'priority' ? { 
        notificationInterval: newTaskInterval,
        lastNotifiedAt: Date.now() 
      } : {})
    };

    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setNewTaskType('indefinite'); // Resetear a por defecto
  };

  // Manejar la selección de prioridad y pedir permisos
  const handleSetPriority = async () => {
    setNewTaskType('priority');
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          setNotificationPermission(perm);
        } catch (e) {
          console.error('Error al pedir permisos:', e);
        }
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
  };

  // Manejar el clic en el botón de completar
  const handleToggleComplete = (task: Task) => {
    if (task.isCompleted) {
      // Si ya está completada, permitir desmarcarla directamente
      setTasks(tasks.map(t => 
        t.id === task.id 
          ? { ...t, isCompleted: false, completedAt: undefined } 
          : t
      ));
    } else {
      // Si no está completada, mostrar el modal de confirmación
      setTaskToComplete(task);
    }
  };

  // Confirmar la finalización de la tarea desde el modal
  const confirmCompletion = () => {
    if (!taskToComplete) return;

    setTasks(tasks.map(t => 
      t.id === taskToComplete.id 
        ? { ...t, isCompleted: true, completedAt: Date.now() } 
        : t
    ));
    setTaskToComplete(null);
  };

  // Cancelar la finalización desde el modal
  const cancelCompletion = () => {
    setTaskToComplete(null);
  };

  // Eliminar una tarea
  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  // Formatear la hora (ej: 14:30)
  const formatTime = (timestamp: number) => {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 pb-24 sm:pb-8">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 p-4 max-w-sm mx-auto sm:mx-0 animate-in slide-in-from-top-4 fade-in duration-300 flex items-start space-x-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full flex-shrink-0 mt-0.5">
            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-bounce" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Recordatorio de tarea</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{toast.title}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-500 focus:outline-none p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Cabecera */}
        <header className="mb-6 pt-4 sm:mb-8 sm:pt-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Mi Día</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 capitalize">
            {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
        </header>

        {/* Sección de Entrada */}
        <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-zinc-900/95 backdrop-blur-md pt-2 pb-4 sm:static sm:bg-transparent sm:backdrop-blur-none sm:p-0 sm:mb-8">
          <form onSubmit={handleAddTask} className="bg-white dark:bg-zinc-800 shadow-sm rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-700/50 transition-all focus-within:ring-2 focus-within:ring-indigo-500 dark:focus-within:ring-indigo-400">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Plus className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Añadir una tarea"
                className="block w-full pl-11 pr-24 sm:pr-28 py-3.5 sm:py-4 bg-transparent border-0 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base sm:text-lg outline-none focus:ring-0"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-zinc-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Añadir
                </button>
              </div>
            </div>
            
            {/* Opciones de la tarea */}
            <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-gray-50/50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-700/50 gap-2">
              <div className="flex space-x-1 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => setNewTaskType('indefinite')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center ${
                    newTaskType === 'indefinite' 
                      ? 'bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white' 
                      : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                  Indefinido
                </button>
                <button
                  type="button"
                  onClick={handleSetPriority}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center ${
                    newTaskType === 'priority' 
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' 
                      : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 ${newTaskType === 'priority' ? 'fill-current' : ''}`} />
                  Prioritaria
                </button>
              </div>
              
              {newTaskType === 'priority' && (
                <div className="flex items-center space-x-2 ml-auto">
                  <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                  <select
                    value={newTaskInterval}
                    onChange={(e) => setNewTaskInterval(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-transparent border-none text-indigo-700 dark:text-indigo-300 font-medium focus:ring-0 cursor-pointer p-0 pr-2 outline-none"
                  >
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={25}>25 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
              )}

              {newTaskType === 'priority' && notificationPermission === 'denied' && (
                <div className="w-full mt-2 text-xs text-red-500 dark:text-red-400 flex items-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                  <X className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                  Permisos de notificación denegados en tu navegador. Habilítalos en la configuración del sitio.
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Sección de Pendientes */}
        <div className="space-y-3 mb-10">
          {activeTasks.length === 0 && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              <p>No tienes tareas pendientes. ¡Disfruta tu día!</p>
            </div>
          )}
          {activeTasks.map(task => (
            <div 
              key={task.id} 
              className={`group flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border hover:shadow-md transition-all ${
                task.type === 'priority' 
                  ? 'border-indigo-100 dark:border-indigo-900/50' 
                  : 'border-gray-100 dark:border-zinc-700/50'
              }`}
            >
              <div className="flex items-center space-x-4 overflow-hidden">
                <button 
                  onClick={() => handleToggleComplete(task)}
                  className="flex-shrink-0 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1 -ml-1 sm:p-0 sm:ml-0"
                  aria-label="Completar tarea"
                >
                  <Circle className="h-6 w-6 sm:h-6 sm:w-6" />
                </button>
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-medium truncate">{task.title}</span>
                    {task.type === 'priority' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 whitespace-nowrap">
                        <Bell className="w-3 h-3 mr-1" />
                        Cada {task.notificationInterval}m
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>Añadido a las {formatTime(task.createdAt)}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteTask(task.id)}
                className="opacity-100 sm:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all focus:outline-none p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700"
                aria-label="Eliminar tarea"
              >
                <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Sección de Completadas */}
        {completedTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center">
              Completadas 
              <span className="ml-2 bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                {completedTasks.length}
              </span>
            </h2>
            <div className="space-y-3 opacity-75">
              {completedTasks.map(task => (
                <div 
                  key={task.id} 
                  className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700/50"
                >
                  <div className="flex items-center space-x-4 overflow-hidden">
                    <button 
                      onClick={() => handleToggleComplete(task)}
                      className="flex-shrink-0 text-indigo-500 dark:text-indigo-400 focus:outline-none rounded-full p-1 -ml-1 sm:p-0 sm:ml-0"
                      aria-label="Desmarcar tarea"
                    >
                      <CheckCircle2 className="h-6 w-6" />
                    </button>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-base font-medium line-through text-gray-500 dark:text-gray-400 truncate">{task.title}</span>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-500 mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>Completado a las {task.completedAt ? formatTime(task.completedAt) : ''}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-100 sm:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all focus:outline-none p-2.5 sm:p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700"
                    aria-label="Eliminar tarea"
                  >
                    <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación */}
      {taskToComplete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-6 sm:pb-0">
            <div className="p-6 sm:p-6">
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full mx-auto mb-6 sm:hidden"></div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                ¿Ya has completado la tarea?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 line-clamp-2">
                "{taskToComplete.title}"
              </p>
              <div className="flex flex-col space-y-3">
                <button
                  onClick={confirmCompletion}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
                >
                  Sí
                </button>
                <button
                  onClick={cancelCompletion}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
                >
                  No, volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

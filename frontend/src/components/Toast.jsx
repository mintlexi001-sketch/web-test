/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // useRef so the Set persists across re-renders without causing them
  const activeTimers = useRef(new Set())

  // Clear all pending timers if the provider ever unmounts (test teardown, SSR, etc.)
  useEffect(() => {
    const timers = activeTimers.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  const toast = useCallback(({ message, type = 'default', duration = 3500 }) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    const timerId = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      activeTimers.current.delete(timerId)
    }, duration)
    activeTimers.current.add(timerId)
  }, [])

  toast.success = (msg, opts = {}) => toast({ message: msg, type: 'success', duration: opts.duration ?? 3500 })
  toast.error   = (msg, opts = {}) => toast({ message: msg, type: 'error',   duration: opts.duration ?? 3500 })

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === 'success' ? <CheckCircle size={16} /> : t.type === 'error' ? <XCircle size={16} /> : null}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

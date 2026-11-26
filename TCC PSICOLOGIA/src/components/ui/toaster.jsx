import * as React from "react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(({ id, title, description, variant, action, open, onOpenChange }) => (
        open && (
          <div
            key={id}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg transition-all",
              variant === "destructive"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-white text-slate-900"
            )}
          >
            <div className="flex-1 min-w-0">
              {title && <p className="text-sm font-semibold">{title}</p>}
              {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
              {action}
            </div>
            <button
              onClick={() => onOpenChange?.(false)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      ))}
    </div>
  )
}

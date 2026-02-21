"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "destructive"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-gray-900 text-white": variant === "default",
          "bg-gray-100 text-gray-700": variant === "secondary",
          "border border-gray-300 text-gray-600": variant === "outline",
          "bg-green-50 text-green-700 border border-green-200": variant === "success",
          "bg-red-50 text-red-600 border border-red-200": variant === "destructive",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }

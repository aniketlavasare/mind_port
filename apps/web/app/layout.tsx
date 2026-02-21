import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "MindPort",
  description: "Build, run, and deploy AI agent brains",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}

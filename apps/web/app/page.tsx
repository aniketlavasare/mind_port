import Link from "next/link"
import { ArrowRight, Cpu, Lock, Zap } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900 tracking-tight">MindPort</span>
        <div className="flex items-center gap-6">
          <Link href="/library" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Library
          </Link>
          <Link href="/docs" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Docs
          </Link>
          <Link href="/examples" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Examples
          </Link>
          <Link
            href="/builder"
            className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-md hover:bg-gray-700 transition-colors"
          >
            Open Builder
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 bg-gray-50 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Powered by 0G Compute · Google ADK
          </div>

          <h1 className="text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            AI agents as<br />
            <span className="text-gray-400">structured specs</span>
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed max-w-lg mx-auto">
            Define an agent with a prompt, policy, and model. Run it instantly.
            Package it as an NFT and transfer ownership — with the brain.
          </p>

          <div className="flex items-center gap-3 justify-center pt-2">
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Open Builder
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Agent Library
            </Link>
          </div>
        </div>
      </main>

      {/* Feature strip */}
      <section className="border-t border-gray-100 px-6 py-12">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-gray-700" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Spec-driven agents</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Define behaviour with a structured JSON spec — prompt, policy, model. No code required.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-gray-700" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Instant execution</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Agents run on-demand via Google ADK. See the full trace per response.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-gray-700" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">NFT-gated access</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              The agent brain is encrypted and bound to an NFT. Ownership transfer rotates the key.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-4 text-center">
        <p className="text-xs text-gray-400">MindPort · Built with Google ADK + 0G Compute</p>
      </footer>
    </div>
  )
}

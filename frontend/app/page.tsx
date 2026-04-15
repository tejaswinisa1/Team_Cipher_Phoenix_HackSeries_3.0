'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, Brain, ArrowRight, Zap, ChevronRight, Activity, Database, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative">
      {/* Animated Background */}
      <div className="bg-animated-gradient" />
      <div className="bg-grid" />

      {/* Header */}
      <header className="border-b border-blue-500/20 glass sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="h-8 w-8 text-blue-400" />
              <div className="absolute inset-0 h-8 w-8 bg-blue-400/20 rounded-full blur-md" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              DataDAO India
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
              <div className="h-2 w-2 bg-emerald-400 rounded-full pulse-glow" />
              <span>Algorand Testnet Active</span>
            </div>
            <Link href="/dashboard">
              <Button className="btn-shine bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          {/* LEFT SIDE - Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30">
              <Zap className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300">AI-Powered • Blockchain-Secured</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="text-white">Own Your Data.</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-emerald-400 bg-clip-text text-transparent">
                Let AI Decide.
              </span>
              <br />
              <span className="text-white">Secured by Algorand.</span>
            </h1>

            <p className="text-xl text-gray-300 leading-relaxed max-w-xl">
              Intelligent consent management that evaluates, decides, and executes on-chain. 
              Full control, zero compromise, immutable proof.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="btn-shine bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-lg px-8 py-6 glow-primary">
                  Launch Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-blue-500/50 hover:bg-blue-500/10 text-lg px-8 py-6">
                View Live Demo
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center space-x-6 pt-4 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full" />
                <span>Sub-5s Finality</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-1.5 w-1.5 bg-blue-400 rounded-full" />
                <span>AI Decision Engine</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="h-1.5 w-1.5 bg-purple-400 rounded-full" />
                <span>Immutable Proof</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Live System Preview */}
          <div className="relative">
            <div className="glass rounded-2xl p-6 space-y-4 float">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Live System Flow</span>
                </div>
                <div className="h-2 w-2 bg-emerald-400 rounded-full pulse-glow" />
              </div>

              {/* Animated Flow Steps */}
              <div className="space-y-3">
                {[
                  { icon: Database, label: 'Request Received', status: 'location data • 25 ALGO', step: 0 },
                  { icon: Brain, label: 'AI Evaluating', status: 'Purpose: Market research', step: 1 },
                  { icon: Shield, label: 'Decision: APPROVED', status: 'Price adjusted to 30 ALGO', step: 2 },
                  { icon: Lock, label: 'On-Chain Executed', status: 'TX: 0x8F...91K ✓', step: 3 }
                ].map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeStep === item.step;
                  const isCompleted = activeStep > item.step;
                  
                  return (
                    <div
                      key={index}
                      className={`flex items-center space-x-4 p-4 rounded-lg transition-all duration-500 ${
                        isActive
                          ? 'bg-blue-500/20 border border-blue-500/50 glow-primary'
                          : isCompleted
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-gray-800/50 border border-gray-700/50'
                      }`}
                    >
                      <div className={`relative p-2 rounded-lg ${
                        isActive ? 'bg-blue-500/30' : isCompleted ? 'bg-emerald-500/30' : 'bg-gray-700/50'
                      }`}>
                        <Icon className={`h-5 w-5 ${
                          isActive ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-gray-500'
                        }`} />
                        {isActive && (
                          <div className="absolute inset-0 bg-blue-400/20 rounded-lg blur-md" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${
                          isActive ? 'text-white' : isCompleted ? 'text-emerald-300' : 'text-gray-400'
                        }`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500">{item.status}</p>
                      </div>
                      {isCompleted && (
                        <div className="text-emerald-400 text-lg">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Glow effect behind card */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 rounded-3xl blur-2xl -z-10" />
          </div>
        </div>
      </section>

      {/* Live System Flow Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Intelligent Execution Flow
            </span>
          </h2>
          <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
            From request to immutable proof in under 5 seconds
          </p>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Database, title: 'Request', desc: 'Data access request submitted', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400' },
              { icon: Brain, title: 'AI Agent', desc: 'Evaluates risk, value & purpose', bgClass: 'bg-purple-500/20', textClass: 'text-purple-400' },
              { icon: Shield, title: 'Algorand', desc: 'Smart transaction executed', bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-400' },
              { icon: Lock, title: 'Proof', desc: 'Immutable compliance record', bgClass: 'bg-cyan-500/20', textClass: 'text-cyan-400' }
            ].map((step, index) => (
              <div key={index} className="relative group">
                <div className="glass rounded-xl p-6 text-center hover-card gradient-border">
                  <div className={`inline-flex p-4 rounded-xl ${step.bgClass} mb-4 group-hover:scale-110 transition-transform`}>
                    <step.icon className={`h-8 w-8 ${step.textClass}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-400">{step.desc}</p>
                </div>
                {index < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-6 w-6 text-blue-400/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Algorand Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto glass rounded-2xl p-8 md:p-12 gradient-border">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300">Blockchain Powered</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Secured by Algorand Blockchain
              </h2>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Every approval becomes an immutable on-chain transaction. 
                Tamper-proof compliance with sub-5-second finality and near-zero fees.
              </p>
              <div className="space-y-3">
                {[
                  'Instant transaction finality',
                  'Immutable audit trail',
                  'Verifiable compliance proof',
                  'Micro-payment capable'
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full" />
                    <span className="text-sm text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-400">Live Contract</div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full pulse-glow" />
                  <span className="text-xs text-emerald-400 font-semibold">TESTNET</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">App ID</span>
                  <span className="text-xs font-mono text-blue-400 font-bold">758667150</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Network</span>
                  <span className="text-xs text-emerald-400 font-semibold flex items-center">
                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full mr-2" />
                    Algorand TestNet
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Contract</span>
                  <span className="text-xs text-white">ConsentContract (PyTeal)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">On-chain fields</span>
                  <span className="text-xs text-white">5 proof fields</span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-500 mb-2">Global state written per consent</div>
                <pre className="text-xs bg-gray-900/50 p-3 rounded text-gray-400 overflow-auto">
{`{
  "request_id":   "req_...",
  "consent_status": "approved",
  "price":        "25",
  "usage_conditions_hash": "a3f9...",
  "timestamp":    "2026-04-14T..."
}`}
                </pre>
              </div>
              <a
                href="https://testnet.explorer.perawallet.app/application/758667150"
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors mt-2"
              >
                View on Pera Explorer →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Core Innovation Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Core Innovation
          </span>
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            {
              icon: Brain,
              title: 'Agentic Decision Engine',
              desc: 'AI evaluates risk, value, and purpose in real-time using hybrid rule + LLM architecture',
              iconGradient: 'bg-gradient-to-br from-blue-600 to-purple-600',
              glowGradient: 'bg-gradient-to-r from-blue-600 to-purple-600'
            },
            {
              icon: Shield,
              title: 'On-Chain Consent Execution',
              desc: 'Every approval is enforced via Algorand smart transaction with embedded metadata',
              iconGradient: 'bg-gradient-to-br from-emerald-600 to-blue-600',
              glowGradient: 'bg-gradient-to-r from-emerald-600 to-blue-600'
            },
            {
              icon: Lock,
              title: 'Verifiable Compliance',
              desc: 'Tamper-proof audit trail for regulators with instant transaction verification',
              iconGradient: 'bg-gradient-to-br from-purple-600 to-pink-600',
              glowGradient: 'bg-gradient-to-r from-purple-600 to-pink-600'
            }
          ].map((card, index) => (
            <div key={index} className="group relative">
              <div className="glass rounded-2xl p-8 h-full hover-card gradient-border">
                <div className={`inline-flex p-4 rounded-xl ${card.iconGradient} mb-6 group-hover:scale-110 transition-transform`}>
                  <card.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">{card.title}</h3>
                <p className="text-gray-400 leading-relaxed">{card.desc}</p>
              </div>
              <div className={`absolute -inset-1 ${card.glowGradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity -z-10`} />
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center glass rounded-2xl p-12 gradient-border">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to Control Your Data?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Experience the future of privacy-preserving data marketplace
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="btn-shine bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-lg px-12 py-6 glow-primary">
              Launch Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              DataDAO India
            </span>
          </div>
          <p className="text-sm text-gray-500">Agentic Data Marketplace • Powered by AI & Algorand</p>
        </div>
      </footer>
    </div>
  );
}

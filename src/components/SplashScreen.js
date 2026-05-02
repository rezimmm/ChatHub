import React from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0f0f1a] z-[9999] overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative flex flex-col items-center">
        {/* Animated Logo Container */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-violet-500/20 transform hover:scale-105 transition-transform duration-300">
            <MessageSquare className="w-12 h-12 animate-[bounce_2s_infinite]" />
          </div>
          
          {/* Pulsing rings */}
          <div className="absolute -inset-4 border border-violet-500/20 rounded-full animate-[ping_3s_infinite]" />
          <div className="absolute -inset-8 border border-indigo-500/10 rounded-full animate-[ping_3s_infinite_1s]" />
        </div>
        
        {/* Text Content */}
        <div className="mt-12 text-center">
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Chat<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Hub</span>
          </h1>
          <div className="mt-4 flex items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
            <span className="text-sm font-medium tracking-wide uppercase">Establishing Connection</span>
          </div>
        </div>

        {/* Premium Progress Indicator */}
        <div className="mt-10 w-64 h-1.5 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
          <div className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600 animate-shimmer" 
               style={{ 
                 width: '100%',
                 backgroundSize: '200% 100%'
               }} 
          />
        </div>
      </div>

      {/* Version or Footer info */}
      <div className="absolute bottom-10 text-gray-600 text-xs font-medium tracking-widest uppercase">
        Secure Messaging Protocol v2.0
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
        @keyframes tilt {
          0%, 50%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(1deg); }
          75% { transform: rotate(-1deg); }
        }
        .animate-tilt {
          animation: tilt 10s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;

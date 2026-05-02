import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Bug, Info, Heart, MessageSquare, Shield } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-12 px-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl mt-auto relative overflow-hidden">
      {/* Decorative top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
        {/* Brand Section */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-2 rounded-lg shadow-lg">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              ChatHub
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs text-center md:text-left leading-relaxed">
            A premium real-time communication platform built for modern teams and communities. Experience the future of messaging.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all hover:scale-110">
              <Github className="h-5 w-5" />
            </a>
            {/* Add more social icons if needed */}
          </div>
        </div>

        {/* Links Section */}
        <div className="flex flex-col items-center gap-6">
          <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-widest text-xs">Platform</h4>
          <div className="flex flex-col items-center gap-4">
            <Link 
              to="/about" 
              className="group flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              <Info className="h-4 w-4 opacity-70 group-hover:opacity-100" /> About Us
            </Link>
            <Link 
              to="/report-bug" 
              className="group flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              <Bug className="h-4 w-4 opacity-70 group-hover:opacity-100" /> Report a Bug
            </Link>
            <Link 
              to="/auth" 
              className="group flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              <Shield className="h-4 w-4 opacity-70 group-hover:opacity-100" /> Security
            </Link>
          </div>
        </div>

        {/* Credits Section */}
        <div className="flex flex-col items-center md:items-end gap-4">
          <div className="text-right flex flex-col items-center md:items-end gap-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Crafted with <Heart className="h-4 w-4 text-red-500 fill-red-500 animate-pulse" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              By the ChatHub Open Source Team
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-tighter text-violet-600 dark:text-violet-400">
              Live v1.0.0
            </span>
          </div>
          <div className="text-[11px] text-gray-400 dark:text-gray-600 text-center md:text-right mt-4">
            © {currentYear} ChatHub. All rights reserved.<br />
            Built with passion for the modern web.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

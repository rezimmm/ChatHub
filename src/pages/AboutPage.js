import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MessageSquare, Shield, Zap, Users, Globe, Code, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import Footer from '../components/Footer';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="font-bold text-xl bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            ChatHub
          </div>
          <div className="w-20"></div> {/* Spacer */}
        </div>
      </nav>

      <main className="flex-grow relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-violet-500/10 to-transparent pointer-events-none"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Hero Section */}
        <section className="relative pt-24 pb-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-wider mb-8 animate-bounce">
              <Sparkles className="h-3 w-3" /> Reimagining Communication
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-8 leading-[1.1]">
              The Future of <br />
              <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-teal-500 bg-clip-text text-transparent">
                Team Collaboration
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-12 leading-relaxed max-w-2xl mx-auto">
              ChatHub is a premium real-time communication platform designed for teams who value speed, security, and a stunning user experience.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/auth')} className="bg-violet-600 hover:bg-violet-700 h-14 px-8 text-lg shadow-xl shadow-violet-600/20 group">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.open('https://github.com', '_blank')} className="h-14 px-8 text-lg">
                View on GitHub
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 px-4 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="h-6 w-6 text-yellow-500" />}
              title="Lightning Fast"
              description="Real-time messaging powered by WebSockets ensures your conversations flow without delay."
            />
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-green-500" />}
              title="Secure by Design"
              description="Industry-standard encryption and secure authentication keep your data private and protected."
            />
            <FeatureCard 
              icon={<MessageSquare className="h-6 w-6 text-blue-500" />}
              title="Rich Interactions"
              description="Share images, files, and links with beautiful previews and an intuitive interface."
            />
            <FeatureCard 
              icon={<Users className="h-6 w-6 text-purple-500" />}
              title="Team Collaboration"
              description="Create channels, invite members, and manage your workspace with ease."
            />
            <FeatureCard 
              icon={<Globe className="h-6 w-6 text-orange-500" />}
              title="Universal Access"
              description="A fully responsive design that works perfectly on desktop, tablet, and mobile devices."
            />
            <FeatureCard 
              icon={<Code className="h-6 w-6 text-pink-500" />}
              title="Modern Tech Stack"
              description="Built with React, Spring Boot, and MongoDB for ultimate performance and scalability."
            />
          </div>
        </section>

        {/* Our Story */}
        <section className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white text-center">Our Mission</h2>
            <div className="prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-400">
              <p>
                ChatHub was born out of a desire to create a communication tool that feels as good as it functions. 
                We believe that the tools we use every day should be beautiful, intuitive, and empower us to connect 
                with others effortlessly.
              </p>
              <p>
                Our team is dedicated to continuous improvement, listening to our community, and pushing the 
                boundaries of what a web-based chat application can be.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
      {description}
    </p>
  </div>
);

export default AboutPage;

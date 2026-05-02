import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bug, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import Footer from '../components/Footer';

const ReportBugPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    severity: 'medium',
    description: '',
    steps: '',
    browser: navigator.userAgent
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/support/report-bug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to send report');
      setSubmitted(true);
    } catch (error) {
      console.error('Error reporting bug:', error);
      alert('Failed to send bug report. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
          <div className="font-bold text-xl bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
            <Bug className="h-5 w-5 text-violet-600" /> Bug Reporter
          </div>
          <div className="w-20"></div> {/* Spacer */}
        </div>
      </nav>

      <main className="flex-grow py-12 px-4 relative overflow-x-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[600px] bg-violet-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/5 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-2xl mx-auto relative z-10">
          {submitted ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center shadow-xl border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Bug Reported Successfully!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-10 text-lg">
                Thank you for helping us improve ChatHub. Our engineers will look into this right away.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => setSubmitted(false)} variant="outline">
                  Report Another Bug
                </Button>
                <Button onClick={() => navigate('/')}>
                  Return to Home
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-8">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Something not working?</h2>
                  <p className="text-gray-500 dark:text-gray-400">Provide as much detail as possible to help us fix it.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bug Title</label>
                  <input 
                    required
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g., Messages not loading in DM"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-violet-500 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Severity</label>
                  <select 
                    name="severity"
                    value={formData.severity}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-violet-500 transition-all outline-none"
                  >
                    <option value="low">Low - Minor visual issue</option>
                    <option value="medium">Medium - Something works poorly</option>
                    <option value="high">High - Feature completely broken</option>
                    <option value="critical">Critical - App crashes / Data loss</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
                  <textarea 
                    required
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="What happened? What did you expect to happen?"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-violet-500 transition-all outline-none resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Steps to Reproduce</label>
                  <textarea 
                    name="steps"
                    value={formData.steps}
                    onChange={handleChange}
                    rows={3}
                    placeholder="1. Open DM with user X&#10;2. Click on image icon&#10;3. ..."
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-violet-500 transition-all outline-none resize-none"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-lg font-bold gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-5 w-5" /> Submit Report
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ReportBugPage;

import React, { useState, useEffect } from 'react';
import { Shield, Zap, Search, AlertTriangle, CheckCircle, Code, Settings, Share2, Rocket } from 'lucide-react';
import { analyzeCode, ReviewResult, Issue } from '../engine/parser';

const App = () => {
  const [score, setScore] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [metrics, setMetrics] = useState({ complexity: 0, maintainability: 0, security: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('javascript');

  useEffect(() => {
    // Listen for code review requests from content script
    const listener = (message: any) => {
      if (message.type === 'REVIEW_CODE') {
        performAnalysis(message.code, message.language);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const performAnalysis = (code: string, language: any) => {
    setAnalyzing(true);
    setCurrentLanguage(language);
    
    // Slight delay to show animation (premium feel)
    setTimeout(() => {
      const result = analyzeCode(code, language);
      setScore(result.score);
      setIssues(result.issues);
      setMetrics(result.metrics);
      setAnalyzing(false);
    }, 500);
  };

  return (
    <div className="min-h-screen p-4 flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="text-accent" size={24} />
          <h1 className="text-xl font-bold">Code Reviewer</h1>
        </div>
        <div className="text-xs text-text-secondary">v1.0.0</div>
      </header>

      {/* Score Dashboard */}
      <div className={`glass p-6 rounded-2xl flex items-center justify-between transition-all duration-500 ${analyzing ? 'opacity-50 blur-sm' : ''}`}>
        {issues.length === 0 && score === 0 && !analyzing ? (
          <div className="flex flex-col items-center justify-center w-full py-8 text-center gap-3">
            <Rocket className="text-accent animate-bounce" size={40} />
            <div>
              <h2 className="font-bold text-lg">Ready for Review</h2>
              <p className="text-sm text-text-secondary">Click "Review" on any code block in GitHub.</p>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Health Score</h2>
              <div className="text-4xl font-black mt-1 flex items-baseline gap-1">
                <span className={score > 80 ? 'text-success' : score > 50 ? 'text-warning' : 'text-danger'}>
                  {score}
                </span>
                <span className="text-lg text-text-secondary">/100</span>
              </div>
            </div>
            <div className="relative w-16 h-16">
              {analyzing ? (
                <div className="w-full h-full border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    className="text-gray-700 stroke-current"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`${score > 80 ? 'text-success' : score > 50 ? 'text-warning' : 'text-danger'} stroke-current`}
                    strokeWidth="3"
                    strokeDasharray={`${score}, 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              )}
            </div>
          </>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Zap size={16} />} label="Complexity" value={analyzing ? '...' : `${Math.round(metrics.complexity)}%`} color="var(--accent)" />
        <MetricCard icon={<Shield size={16} />} label="Security" value={analyzing ? '...' : `${metrics.security}%`} color={metrics.security < 70 ? 'var(--danger)' : 'var(--success)'} />
      </div>

      {/* Issues List */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
            {analyzing ? 'Analyzing...' : `Issues (${issues.length})`}
          </h3>
          <span className="text-[10px] bg-accent/10 px-2 py-0.5 rounded text-accent uppercase font-bold">{currentLanguage}</span>
        </div>
        
        {analyzing && (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="glass p-4 rounded-xl h-24 animate-pulse"></div>
            ))}
          </div>
        )}

        {!analyzing && issues.length === 0 && score > 0 && (
          <div className="glass p-8 rounded-xl flex flex-col items-center text-center gap-2">
            <CheckCircle className="text-success" size={32} />
            <p className="text-sm font-medium">Clear as crystal! No issues found.</p>
          </div>
        )}

        {!analyzing && issues.map(issue => (
          <div key={issue.id} className="glass p-4 rounded-xl border-l-4" style={{ borderColor: `var(--${issue.severity})` }}>
            <div className="flex items-start gap-3">
              {issue.severity === 'error' ? <AlertTriangle className="text-danger shrink-0" size={18} /> : 
               issue.severity === 'warning' ? <AlertTriangle className="text-warning shrink-0" size={18} /> : 
               <Search className="text-accent shrink-0" size={18} />}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold uppercase text-text-secondary">{issue.type}</span>
                  <span className="text-xs text-text-secondary">Line {issue.line}</span>
                </div>
                <p className="text-sm mt-1 leading-relaxed">{issue.message}</p>
                <div className="mt-3 flex gap-2">
                  <button className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition">View Code</button>
                  <button className="text-xs bg-accent/20 text-accent hover:bg-accent/30 px-2 py-1 rounded transition">Quick Fix</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Status */}
      <footer className="mt-auto pt-6 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          Local Engine Active
        </div>
        <button className="hover:text-accent transition">Engine Settings</button>
      </footer>
    </div>
  );
};

const MetricCard = ({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
  <div className="glass p-3 rounded-xl">
    <div className="flex items-center gap-2 mb-1">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
    </div>
    <div className="text-sm font-bold">{value}</div>
  </div>
);

export default App;

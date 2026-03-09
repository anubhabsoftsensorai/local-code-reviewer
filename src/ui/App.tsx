import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Search, AlertTriangle, CheckCircle, Code2, Settings, Terminal, Rocket, Info, Hash, ChevronRight, Sparkles } from 'lucide-react';
import { analyzeCode, ReviewResult, Issue } from '../engine/parser';

const SEVERITY_CONFIG = {
  error: { color: '#f87171', glow: 'rgba(248,113,113,0.15)', bg: 'rgba(248,113,113,0.08)', label: 'Error' },
  warning: { color: '#fbbf24', glow: 'rgba(251,191,36,0.15)', bg: 'rgba(251,191,36,0.08)', label: 'Warning' },
  info: { color: '#38bdf8', glow: 'rgba(56,189,248,0.15)', bg: 'rgba(56,189,248,0.08)', label: 'Info' },
};

const App = () => {
  const [score, setScore] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [metrics, setMetrics] = useState({ complexity: 0, maintainability: 0, security: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('typescript');
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    chrome.storage.local.get(['pendingReview'], (result: any) => {
      if (result.pendingReview) {
        performAnalysis(result.pendingReview.code, result.pendingReview.language);
        chrome.storage.local.remove('pendingReview');
      }
    });

    const messageListener = (message: any) => {
      if (message.type === 'REVIEW_CODE') {
        performAnalysis(message.code, message.language);
      }
    };

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      const val = (changes as any).pendingReview?.newValue;
      if (val) {
        performAnalysis(val.code, val.language);
        chrome.storage.local.remove('pendingReview');
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const performAnalysis = (code: string, language: any) => {
    setAnalyzing(true);
    setCurrentLanguage(language || 'typescript');
    setTimeout(() => {
      const result = analyzeCode(code, language || 'typescript');
      setScore(result.score);
      setIssues(result.issues);
      setMetrics(result.metrics);
      setAnalyzing(false);
    }, 800);
  };

  const tabs = [
    { label: 'All', count: issues.length },
    { label: 'Errors', count: issues.filter(i => i.severity === 'error').length },
    { label: 'Warnings', count: issues.filter(i => i.severity === 'warning').length },
  ];

  const filteredIssues = issues.filter(issue => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Errors') return issue.severity === 'error';
    if (activeTab === 'Warnings') return issue.severity === 'warning';
    return true;
  });

  const scoreColor = score > 80 ? '#34d399' : score > 50 ? '#fbbf24' : '#f87171';

  return (
    <div className="app-shell">
      {/* Ambient background glows */}
      <div className="ambient-top" />
      <div className="ambient-bottom" />

      <div className="content-wrapper">
        {/* Header */}
        <header className="header">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="brand">
            <div className="brand-icon">
              <Terminal size={17} />
            </div>
            <div>
              <h1 className="brand-name">GIT</h1>
              <span className="brand-sub">Standard Inspector</span>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.06)' }}
            whileTap={{ scale: 0.95 }}
            className="icon-btn"
          >
            <Settings size={16} className="icon-muted" />
          </motion.button>
        </header>

        <AnimatePresence mode="wait">
          {analyzing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="loading-state"
            >
              <div className="spinner-wrap">
                <div className="spinner-track" />
                <div className="spinner-ring" />
                <Rocket className="spinner-icon" size={26} />
              </div>
              <div className="loading-text">
                <p className="loading-title">Analyzing AST…</p>
                <p className="loading-sub">100% Local Intelligence</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="main-content">

              {/* Score Card */}
              <div className="score-card">
                <div className="score-card-noise" />
                {issues.length === 0 && score === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon-wrap">
                      <Search size={26} className="icon-muted" />
                    </div>
                    <div>
                      <h2 className="empty-title">Ready to Inspect</h2>
                      <p className="empty-sub">Select code in GitHub to begin analysis</p>
                    </div>
                  </div>
                ) : (
                  <div className="score-row">
                    <div>
                      <p className="score-label">Health Score</p>
                      <div className="score-value-row">
                        <motion.span
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="score-number"
                          style={{ color: scoreColor }}
                        >
                          {score}
                        </motion.span>
                        <span className="score-denom">/100</span>
                      </div>
                      <p className="score-verdict">
                        {score > 80 ? 'Excellent quality' : score > 50 ? 'Needs attention' : 'Critical issues'}
                      </p>
                    </div>

                    <div className="score-ring-wrap">
                      <svg className="score-ring-svg" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" className="ring-track" strokeWidth="6" fill="none" />
                        <motion.circle
                          cx="50" cy="50" r="40"
                          stroke={scoreColor}
                          strokeWidth="6"
                          strokeDasharray="251"
                          initial={{ strokeDashoffset: 251 }}
                          animate={{ strokeDashoffset: 251 - (251 * score) / 100 }}
                          strokeLinecap="round"
                          fill="none"
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                          style={{ filter: `drop-shadow(0 0 6px ${scoreColor}80)` }}
                        />
                      </svg>
                      <Zap size={18} className="ring-center-icon" style={{ color: scoreColor }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="metrics-row">
                <MetricCard icon={<Zap size={15} />} label="Complexity" value={`${Math.round(metrics.complexity)}%`} color="#38bdf8" />
                <MetricCard icon={<Shield size={15} />} label="Security" value={`${metrics.security}%`} color={metrics.security < 70 ? '#f87171' : '#34d399'} />
              </div>

              {/* Findings */}
              <div className="findings-section">
                {/* Section header */}
                <div className="findings-header">
                  <div className="findings-title-row">
                    <span className="findings-label">Violations</span>
                    <span className="violations-badge">{issues.length}</span>
                  </div>
                  <div className="lang-chip">
                    <span className="lang-dot" />
                    <span className="lang-text">{currentLanguage}</span>
                  </div>
                </div>

                {/* Tab strip */}
                <div className="tab-strip">
                  {tabs.map(tab => (
                    <button
                      key={tab.label}
                      onClick={() => setActiveTab(tab.label)}
                      className={`tab-btn ${activeTab === tab.label ? 'tab-active' : ''}`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`tab-count ${activeTab === tab.label ? 'tab-count-active' : ''}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Issue list or empty */}
                {issues.length === 0 && score > 0 ? (
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="all-clear">
                    <div className="all-clear-icon">
                      <CheckCircle size={28} />
                    </div>
                    <div>
                      <p className="all-clear-title">Architecture Verified</p>
                      <p className="all-clear-sub">No pattern violations detected in this module.</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="issue-list">
                    <AnimatePresence>
                      {filteredIssues.map((issue, idx) => (
                        <IssueCard key={issue.id} issue={issue} index={idx} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-status">
            <span className="status-dot" />
            Local Engine v1.0.5
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">Source</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <motion.div whileHover={{ y: -1 }} className="metric-card">
    <div className="metric-header">
      <span style={{ color }}>{icon}</span>
      <span className="metric-label">{label}</span>
    </div>
    <div className="metric-value" style={{ color }}>{value}</div>
  </motion.div>
);

const IssueCard = ({ issue, index }: { issue: Issue; index: number }) => {
  const sev = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.07 }}
      className="issue-card"
      style={{ '--sev-color': sev.color, '--sev-glow': sev.glow, '--sev-bg': sev.bg } as React.CSSProperties}
    >
      {/* Left severity bar */}
      <div className="issue-sev-bar" />

      <div className="issue-body">
        {/* Top row */}
        <div className="issue-meta">
          <div className="issue-type-wrap">
            <span className="issue-type-dot" style={{ background: sev.color }} />
            <span className="issue-type">{issue.type}</span>
          </div>
          <div className="issue-line">
            <Hash size={9} />
            <span>L{issue.line || 1}</span>
          </div>
        </div>

        {/* Message */}
        <p className="issue-message">{issue.message}</p>

        {/* Code snippet */}
        {issue.lineContent && (
          <div className="code-snippet">
            <span className="code-line-num">{issue.line || 1}</span>
            <code className="code-content">{issue.lineContent}</code>
          </div>
        )}

        {/* Actions */}
        <div className="issue-actions">
          <button className="btn-details">
            <Info size={11} />
            Details
          </button>
          <button className="btn-patch">
            <Sparkles size={11} />
            Patch Fix
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default App;

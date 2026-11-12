import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  ArrowRight, 
  Trash2, 
  HelpCircle,
  Cpu
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const PRESET_QUERIES = [
  'Which products need immediate reordering this week?',
  'What is our total warehouse inventory valuation?',
  'Are there any dead-stock items pending liquidation?',
  'Explain the safety stock and reorder point formulas.'
];

export default function AiAssistant() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async () => {
    try {
      const res = await api.get('/ai/history');
      if (res.data.success && res.data.data.length > 0) {
        const formatted = res.data.data.map(m => {
          let metadata = {};
          if (m.metadata) {
            try {
              metadata = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            } catch (e) {}
          }
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            suggested_actions: metadata.suggested_actions || [],
            source: metadata.source || 'AI_SERVICE'
          };
        });
        setMessages(formatted);
      } else {
        // Initial welcome message
        setMessages([
          {
            id: 'init_welcome',
            role: 'assistant',
            content: `Hello ${user?.name || 'there'}! I am StockSense AI Assistant. I continuously monitor inventory levels against dynamic reorder points (ROP), detect stagnant dead stock, and interface with our Python demand forecasting microservice. What would you like to examine today?`,
            suggested_actions: [
              { label: 'Review Urgent Reorder Queue', route: '/reordering' },
              { label: 'Check Dead Stock Audit', route: '/dead-stock' },
              { label: 'Explore Demand Forecasting', route: '/forecasting' }
            ],
            source: 'AI_SERVICE'
          }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    setInput('');
    const userMsg = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: queryText
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: queryText });
      if (res.data.success) {
        const aiMsg = {
          id: 'ai_' + Date.now(),
          role: 'assistant',
          content: res.data.data.reply,
          suggested_actions: res.data.data.suggested_actions || [],
          source: res.data.data.source || 'AI_SERVICE'
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'Sorry, I encountered an issue processing your query. Please try again.',
          suggested_actions: [],
          source: 'SYSTEM'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-[calc(100vh-4rem)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-content-primary tracking-tight">StockSense AI Assistant</h2>
            <span className="flex items-center gap-1 text-[11px] font-bold bg-emerald-sage text-emerald-forest px-2.5 py-0.5 rounded-full border border-emerald-primary/20">
              <Sparkles className="w-3 h-3 text-emerald-primary" /> Active Model Engine
            </span>
          </div>
          <p className="text-xs text-content-secondary mt-0.5">
            Real-time conversational intelligence over warehouse inventory, safety stock formulas, and purchase orders.
          </p>
        </div>

        <button
          onClick={() => {
            setMessages([]);
            fetchChatHistory();
          }}
          className="p-2 text-content-secondary hover:text-content-primary hover:bg-surface-bg border border-surface-border rounded-lg transition text-xs flex items-center gap-1.5"
          title="Reset conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Preset Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-content-secondary flex items-center gap-1 flex-shrink-0">
          <HelpCircle className="w-3 h-3" /> Quick Prompts:
        </span>
        {PRESET_QUERIES.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            className="flex-shrink-0 px-3 py-1 bg-surface-card border border-surface-border hover:border-emerald-primary text-content-primary rounded-full transition text-[11px] font-medium"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 bg-surface-card border border-surface-border rounded-xl p-5 overflow-y-auto space-y-4 shadow-xs">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-emerald-primary text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-xl space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-4 rounded-xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-emerald-primary text-white font-medium rounded-tr-none'
                      : 'bg-surface-bg border border-surface-border text-content-primary rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>

                {/* Suggested Action Pills */}
                {!isUser && m.suggested_actions && m.suggested_actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {m.suggested_actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => act.route && navigate(act.route)}
                        className="flex items-center gap-1 px-3 py-1 bg-emerald-sage hover:bg-emerald-primary hover:text-white text-emerald-forest font-bold rounded-lg text-[11px] transition shadow-2xs border border-emerald-primary/10"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-emerald-sage text-emerald-forest flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-primary text-white flex items-center justify-center font-bold flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-surface-bg border border-surface-border rounded-xl text-xs text-content-secondary flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-primary animate-ping" />
              <span>Analyzing warehouse parameters...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          placeholder="Ask anything about inventory levels, ROP thresholds, dead stock, or forecasting..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-surface-card border border-surface-border rounded-xl text-xs text-content-primary focus:outline-none focus:border-emerald-primary shadow-xs"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-5 py-3 bg-emerald-primary hover:bg-emerald-hover text-white text-xs font-bold rounded-xl transition disabled:opacity-40 flex items-center gap-2 shadow-xs"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

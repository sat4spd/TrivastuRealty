'use client';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Users, ShieldAlert, Sparkles, Send, Play, Square, Download, Activity, FileSpreadsheet, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function MarketingCampaigns() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'

  // Step 1: Audience
  const [file, setFile] = useState(null);
  const [audienceData, setAudienceData] = useState({ total: 0, valid: 0, invalid: 0, sample: [], contacts: [] });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Step 2: Message
  const [messageType, setMessageType] = useState('ai'); // 'ai' or 'template'
  const [messageContent, setMessageContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Write a 2-sentence WhatsApp message inviting clients to visit Sunrise Villas this weekend. Offer a 10% discount on spot booking.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateName, setTemplateName] = useState('marketing_broadcast_1');

  // Step 3: Execution
  const [campaignName, setCampaignName] = useState('');
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [campaignStats, setCampaignStats] = useState({ sent: 0, failed: 0, total: 0, status: 'pending' });
  const [isStarting, setIsStarting] = useState(false);

  // History Tab
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Poll for active campaign stats
  useEffect(() => {
    let interval;
    if (activeCampaignId && (campaignStats.status === 'running' || campaignStats.status === 'pending')) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get('https://api.trivastu.com/api/campaigns', { withCredentials: true });
          const current = res.data.find(c => c._id === activeCampaignId);
          if (current) {
            setCampaignStats({
              sent: current.sentCount,
              failed: current.failedCount,
              total: current.totalRecipients,
              status: current.status
            });
            if (current.status !== 'running' && current.status !== 'pending') {
              clearInterval(interval);
            }
          }
        } catch (e) {
          console.error("Poll error", e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeCampaignId, campaignStats.status]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get('https://api.trivastu.com/api/campaigns', { withCredentials: true });
      setCampaignHistory(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  // Handle File Upload (Client-side parsing + server validation)
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Must be excel
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      alert("Please upload a valid Excel (.xlsx) file.");
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post('https://api.trivastu.com/api/campaigns/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      setAudienceData(res.data);
      if (res.data.validContacts > 0) {
        setStep(2);
      } else {
        alert("No valid phone numbers found in the file.");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Error uploading file.");
    }
    setIsUploading(false);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const res = await axios.post('https://api.trivastu.com/api/campaigns/generate-ai', { prompt: aiPrompt }, { withCredentials: true });
      setMessageContent(res.data.message);
    } catch (err) {
      alert("AI Generation failed.");
    }
    setIsGenerating(false);
  };

  const handleStartCampaign = async () => {
    if (!campaignName) return alert("Please enter a campaign name.");
    if (!messageContent && messageType === 'ai') return alert("Please generate a message first.");
    
    setIsStarting(true);
    try {
      const payload = {
        campaignName,
        contacts: audienceData.contacts,
        messageText: messageType === 'ai' ? messageContent : templateName // Simplification: we either send text or template ID
      };

      const res = await axios.post('https://api.trivastu.com/api/campaigns/start', payload, { withCredentials: true });
      
      setActiveCampaignId(res.data.campaignId);
      setCampaignStats({ sent: 0, failed: 0, total: audienceData.validContacts, status: 'running' });
      setStep(3);
    } catch (err) {
      alert("Failed to start campaign.");
    }
    setIsStarting(false);
  };

  const handleStopCampaign = async () => {
    if (!activeCampaignId) return;
    try {
      await axios.post(`https://api.trivastu.com/api/campaigns/stop/${activeCampaignId}`, {}, { withCredentials: true });
      setCampaignStats(prev => ({ ...prev, status: 'stopped' }));
    } catch (err) {
      alert("Failed to stop campaign.");
    }
  };

  const handleDownloadReport = (id) => {
    window.open(`https://api.trivastu.com/api/campaigns/report/${id}`, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Marketing Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Bulk WhatsApp marketing broadcast system with AI personalization.</p>
        </div>
        
        {/* Anti-Ban Warning */}
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 text-red-700 rounded-lg border border-red-100 shadow-sm text-sm">
          <ShieldAlert size={18} className="text-red-500" />
          <div className="leading-tight">
            <strong>Anti-Ban Protection Active.</strong>
            <p className="text-red-600/80 text-xs">Messages are sent with a 2-4 sec delay. Do not spam users who haven't opted in.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('new')} 
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'new' ? 'border-[#C8A45D] text-[#C8A45D]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          New Campaign
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'history' ? 'border-[#C8A45D] text-[#C8A45D]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Campaign History & Reports
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          
          {/* Left: Steps Sidebar */}
          <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-6 shrink-0">
            <ul className="space-y-6">
              {[
                { id: 1, name: 'Audience Upload', icon: Users, desc: 'Excel / CSV' },
                { id: 2, name: 'Message Drafting', icon: Sparkles, desc: 'AI or Templates' },
                { id: 3, name: 'Execution Dash', icon: Activity, desc: 'Live Monitoring' },
              ].map(s => (
                <li key={s.id} className={`flex gap-4 ${step === s.id ? 'opacity-100' : step > s.id ? 'opacity-60' : 'opacity-40 grayscale'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-sm transition-colors ${step === s.id ? 'border-[#C8A45D] bg-[#C8A45D]/10 text-[#C8A45D]' : step > s.id ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-300 text-gray-400'}`}>
                    {step > s.id ? <Check size={16} /> : s.id}
                  </div>
                  <div>
                    <h3 className={`font-semibold text-sm ${step === s.id ? 'text-gray-900' : 'text-gray-500'}`}>{s.name}</h3>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Step Content */}
          <div className="flex-1 p-8 bg-white relative">
            
            {/* STEP 1: AUDIENCE */}
            {step === 1 && (
              <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">Upload Audience</h2>
                  <p className="text-gray-500 text-sm mt-2">Upload an Excel file (.xlsx). It must contain a <strong>Name</strong> column and a <strong>Phone</strong> column.</p>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-[#C8A45D]/50 hover:bg-[#C8A45D]/5 bg-gray-50/50'}`}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls,.csv" />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-4 text-[#C8A45D]">
                      <div className="h-10 w-10 border-4 border-[#C8A45D] border-t-transparent rounded-full animate-spin" />
                      <p className="font-semibold">Parsing Database...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-gray-500 hover:text-[#C8A45D]">
                      <div className="h-16 w-16 bg-[#C8A45D]/10 rounded-full flex items-center justify-center text-[#C8A45D]">
                        <FileSpreadsheet size={32} />
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-gray-900">Click to Select Excel File</p>
                        <p className="text-sm mt-1">Maximum 10,000 rows per campaign</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Data Preview */}
                {audienceData.total > 0 && !isUploading && (
                  <div className="space-y-4">
                    <div className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Rows</p>
                        <p className="text-2xl font-bold text-gray-900">{audienceData.totalRows}</p>
                      </div>
                      <div className="flex-1 border-l pl-4 border-gray-200">
                        <p className="text-xs text-green-600 uppercase tracking-wider font-semibold">Valid Phones 📥</p>
                        <p className="text-2xl font-bold text-green-700">{audienceData.validContacts}</p>
                      </div>
                      <div className="flex-1 border-l pl-4 border-gray-200">
                        <p className="text-xs text-red-500 uppercase tracking-wider font-semibold">Invalid/Empty 📉</p>
                        <p className="text-2xl font-bold text-red-600">{audienceData.invalidContacts}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-600">PREVIEW (FIRST 5 ROWS)</p>
                      </div>
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 bg-white">
                          <tr>
                            <th className="px-4 py-2 font-medium border-b border-r bg-gray-50/50">Name</th>
                            <th className="px-4 py-2 font-medium border-b bg-gray-50/50">Parsed WhatsApp Number</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {audienceData.sample?.map((s, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-2 border-r">{s.name || <span className="text-gray-400 italic">Empty</span>}</td>
                              <td className="px-4 py-2 font-mono text-green-700 text-xs">+{s.phone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: MESSAGE */}
            {step === 2 && (
              <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Compose Message</h2>
                  <div className="inline-flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setMessageType('ai')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${messageType === 'ai' ? 'bg-white shadow text-[#C8A45D]' : 'text-gray-500 hover:text-gray-900'}`}>✨ AI Generation</button>
                    <button onClick={() => setMessageType('template')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${messageType === 'template' ? 'bg-white shadow text-[#C8A45D]' : 'text-gray-500 hover:text-gray-900'}`}>📋 Templates</button>
                  </div>
                </div>

                <div className="flex gap-6 flex-1 min-h-0">
                  {/* Left Controls */}
                  <div className="w-1/2 space-y-5 flex flex-col">
                    {messageType === 'ai' ? (
                      <>
                        <div className="space-y-2 flex-1 flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">What are we promoting today?</label>
                          <textarea 
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            placeholder="e.g. Write a festive offer for Diwali giving 50,000 off on flat bookings."
                            className="w-full h-32 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C8A45D] focus:border-[#C8A45D] resize-none"
                          />
                          <button 
                            onClick={handleGenerateAI}
                            disabled={isGenerating || !aiPrompt}
                            className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                          >
                            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={18} />}
                            {isGenerating ? 'Generating Magic...' : 'Generate Marketing Copy'}
                          </button>
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col">
                          <label className="text-sm font-semibold text-gray-700">Refine Copy (Edit directly if needed)</label>
                          <textarea 
                            value={messageContent}
                            onChange={e => setMessageContent(e.target.value)}
                            placeholder="Generated message will appear here..."
                            className="w-full flex-1 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#C8A45D] focus:border-[#C8A45D] resize-none"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Meta Template Name</label>
                        <input 
                          type="text" 
                          value={templateName}
                          onChange={e => setTemplateName(e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm"
                          placeholder="e.g. marketing_broadcast_1"
                        />
                        <p className="text-xs text-gray-500">The exact template name registered in your WhatsApp Business Manager.</p>
                      </div>
                    )}
                  </div>

                  {/* Right Preview (WhatsApp Bubble) */}
                  <div className="w-1/2 bg-[url('https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover relative rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
                    <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shadow-md z-10">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <img src="/logo.png" className="w-6 h-6 object-contain filter invert opacity-80" alt="T" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Trivastu Realty</p>
                        <p className="text-[10px] text-white/70">Business Account</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto w-full max-w-full">
                      {/* Interactive Msg Mockup */}
                      <div className="bg-white rounded-xl rounded-tl-none p-1.5 shadow-sm max-w-[90%] break-words">
                        <div className="p-2 text-[13px] leading-relaxed whitespace-pre-wrap text-gray-800 font-sans break-words break-all" style={{wordBreak: "break-word"}}>
                          {messageType === 'ai' 
                            ? (messageContent || <span className="text-gray-400 italic">Generate a message to see preview...</span>)
                            : <span className="text-gray-500 italic">[Template Content will be populated by Meta]</span>
                          }
                        </div>
                        {messageType === 'ai' && (
                          <div className="mt-2 space-y-[1px] border-t border-gray-100 pt-[1px]">
                             <div className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-center text-[13px] text-[#00a884] cursor-pointer outline-none font-medium border-b border-gray-100">
                                ✅ I am interested
                             </div>
                             <div className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-center text-[13px] text-[#00a884] cursor-pointer outline-none font-medium rounded-b-lg">
                                🛑 Stop messages
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 flex justify-between items-center mt-auto">
                  <button onClick={() => setStep(1)} className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900">Back</button>
                  <div className="flex items-center gap-4">
                    <input 
                      type="text" 
                      placeholder="Name this Campaign..."
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:border-[#C8A45D] outline-none"
                    />
                    <button 
                      onClick={handleStartCampaign}
                      disabled={isStarting || !campaignName || (messageType === 'ai' && !messageContent)}
                      className="px-6 py-2.5 bg-[#C8A45D] hover:bg-[#b08f4c] text-white rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isStarting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                      Launch Campaign
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 3: EXECUTION */}
            {step === 3 && (
              <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 pt-8">
                <div className="text-center space-y-2">
                  <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg ${campaignStats.status === 'running' ? 'bg-[#C8A45D] animate-pulse' : campaignStats.status === 'stopped' ? 'bg-red-500' : 'bg-green-500'}`}>
                    {campaignStats.status === 'running' ? <Send size={28} className="text-white ml-1" /> : campaignStats.status === 'stopped' ? <Square size={24} className="text-white" /> : <Check size={32} className="text-white" />}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">{campaignName}</h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold uppercase tracking-wider text-gray-600">
                    <span className={`w-2 h-2 rounded-full ${campaignStats.status === 'running' ? 'bg-amber-500 animate-ping' : campaignStats.status === 'stopped' ? 'bg-red-500' : 'bg-green-500'}`} />
                    {campaignStats.status}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-semibold text-gray-600">Progress</span>
                    <span className="text-2xl font-bold text-gray-900">{Math.round(((campaignStats.sent + campaignStats.failed) / campaignStats.total) * 100)}%</span>
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-[#C8A45D] transition-all duration-1000 ease-out"
                      style={{ width: `${(campaignStats.sent / campaignStats.total) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-red-400 transition-all duration-1000 ease-out"
                      style={{ width: `${(campaignStats.failed / campaignStats.total) * 100}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 text-center">
                      <p className="text-xs text-gray-500 font-semibold uppercase">Total</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{campaignStats.total}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-green-100 text-center">
                      <p className="text-xs text-green-600 font-semibold uppercase">Delivered</p>
                      <p className="text-2xl font-bold text-green-700 mt-1">{campaignStats.sent}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-red-100 text-center">
                      <p className="text-xs text-red-500 font-semibold uppercase">Failed</p>
                      <p className="text-2xl font-bold text-red-600 mt-1">{campaignStats.failed}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  {campaignStats.status === 'running' ? (
                    <button 
                      onClick={handleStopCampaign}
                      className="px-8 py-3 bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Square size={18} fill="currentColor" /> Stop Campaign
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleDownloadReport(activeCampaignId)}
                      className="px-8 py-3 bg-gray-900 hover:bg-black shadow-md shadow-black/20 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Download size={18} /> Download Detailed Log (CSV)
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-400">
                    {campaignStats.status === 'running' 
                      ? "Do not close this window. Messages are being sent slowly to avoid WhatsApp ban algorithms."
                      : "Logs automatically expire and are deleted from the database securely after 7 days."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* HISTORY TAB */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loadingHistory ? (
            <div className="p-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-[#C8A45D] border-t-transparent animate-spin" /></div>
          ) : campaignHistory.length === 0 ? (
            <div className="p-20 text-center text-gray-500">
              <Activity size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="font-medium text-lg text-gray-900">No campaigns yet</p>
              <p className="text-sm">Start your first marketing broadcast to see reports here.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Campaign Name</th>
                  <th className="px-6 py-4">Date Started</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Volume</th>
                  <th className="px-6 py-4">Success %</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaignHistory.map(campaign => (
                  <tr key={campaign._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{campaign.name}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(campaign.createdAt).toLocaleDateString()} {new Date(campaign.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === 'completed' ? 'bg-green-100 text-green-700' : 
                        campaign.status === 'running' ? 'bg-amber-100 text-amber-700' : 
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{campaign.totalRecipients.toLocaleString()}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                         <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                           <div className="h-full bg-green-500" style={{ width: `${campaign.totalRecipients > 0 ? (campaign.sentCount / campaign.totalRecipients) * 100 : 0}%`}} />
                         </div>
                         <span className="text-xs font-medium text-gray-600">{campaign.totalRecipients > 0 ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100) : 0}%</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDownloadReport(campaign._id)}
                        className="text-[#C8A45D] hover:text-[#b08f4c] font-semibold flex items-center gap-1 ml-auto"
                      >
                        <Download size={14} /> Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

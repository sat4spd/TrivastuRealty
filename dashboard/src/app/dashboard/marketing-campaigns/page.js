'use client';
import React, { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api';
import { ShieldAlert, Send, Play, Square, Download, FileSpreadsheet, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import styles from './campaigns.module.css';

export default function MarketingCampaigns() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'

  // Step 1: Audience
  const [file, setFile] = useState(null);
  const [audienceData, setAudienceData] = useState({ total: 0, valid: 0, invalid: 0, sample: [], contacts: [] });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Step 2: Message
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [messageType, setMessageType] = useState('ai'); // 'ai' or 'template'
  const [messageContent, setMessageContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Write a 2-sentence WhatsApp message inviting clients to visit Sunrise Villas this weekend. Offer a 10% discount on spot booking.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Fetch Meta Templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await api.get('/campaigns/templates');
        setMetaTemplates(res.data);
        if (res.data.length > 0) {
          setTemplateName(res.data[0].name);
        }
      } catch (e) {
        console.error("Failed to fetch templates", e);
      }
      setLoadingTemplates(false);
    };
    fetchTemplates();
  }, []);

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
          const res = await api.get('/campaigns');
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
      const res = await api.get('/campaigns');
      setCampaignHistory(res.data);
    } catch (e) {
      console.error("History load error", e);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  // Handle File Upload
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      alert("Please upload a valid Excel (.xlsx) file.");
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/campaigns/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAudienceData(res.data);
      if (res.data.validContacts > 0) {
        setStep(2);
      } else {
        alert("No valid phone numbers found in the file.");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Authentication or Upload error.");
    }
    setIsUploading(false);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const res = await api.post('/campaigns/generate-ai', { prompt: aiPrompt });
      setMessageContent(res.data.message);
    } catch (err) {
      alert("AI Generation failed. Check API key status or connectivity.");
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
        messageText: messageType === 'ai' ? messageContent : templateName
      };

      const res = await api.post('/campaigns/start', payload);
      
      setActiveCampaignId(res.data.campaignId);
      setCampaignStats({ sent: 0, failed: 0, total: audienceData.validContacts, status: 'running' });
      setStep(3);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to start campaign.");
    }
    setIsStarting(false);
  };

  const handleStopCampaign = async () => {
    if (!activeCampaignId) return;
    try {
      await api.post(`/campaigns/stop/${activeCampaignId}`);
      setCampaignStats(prev => ({ ...prev, status: 'stopped' }));
    } catch (err) {
      alert("Failed to stop campaign.");
    }
  };

  const handleDownloadReport = (id) => {
    const token = localStorage.getItem('trivastu_token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.trivastu.com';
    // Append token to window open URL since we can't send auth headers via window.open
    // Or we can fetch blob and download. Since GET /api/admin/campaigns/report needs auth,
    // let's do a fetch blob approach to properly inject Authorization header:
    api.get(`/campaigns/report/${id}`, { responseType: 'blob' })
      .then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Campaign_Report_${id}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(() => alert("Failed to download report."));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Marketing Campaigns</h1>
          <p className={styles.subtitle}>Bulk WhatsApp marketing broadcast system with AI personalization.</p>
        </div>
        
        <div className={styles.warningBox}>
          <ShieldAlert size={20} />
          <div>
            <strong>Anti-Ban Protection Active.</strong>
            <p>Messages are sent with a 2-4 sec delay. Do not spam users who haven't opted in.</p>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button 
          onClick={() => setActiveTab('new')} 
          className={`${styles.tab} ${activeTab === 'new' ? styles.active : ''}`}
        >
          New Campaign
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
        >
          Campaign History & Reports
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className={styles.card}>
          
          <div className={styles.wizardSidebar}>
            {[
              { id: 1, name: 'Audience Upload', desc: 'Excel / CSV' },
              { id: 2, name: 'Message Drafting', desc: 'AI or Templates' },
              { id: 3, name: 'Execution Dash', desc: 'Live Monitoring' },
            ].map(s => (
              <div key={s.id} className={`${styles.wizardStep} ${step === s.id ? styles.active : step > s.id ? styles.completed : ''}`}>
                <div className={styles.stepIcon}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <div className={styles.stepText}>
                  <h3>{s.name}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.contentArea}>
            
            {/* STEP 1 */}
            {step === 1 && (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 className={styles.stepTitle}>Upload Audience</h2>
                <p className={styles.stepDesc}>Upload an Excel file (.xlsx) containing a <strong>Name</strong> and <strong>Phone</strong> column.</p>

                <div className={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".xlsx,.xls,.csv" />
                  {isUploading ? (
                    <div style={{ color: '#C8A45D' }}>
                      <p style={{ fontWeight: 'bold' }}>Parsing Database...</p>
                    </div>
                  ) : (
                    <div>
                      <div className={styles.uploadIconWrap}>
                        <FileSpreadsheet size={32} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>Click to Select Excel File</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>Maximum 10,000 rows per campaign</p>
                    </div>
                  )}
                </div>

                {audienceData.total > 0 && !isUploading && (
                  <>
                    <div className={styles.statsBar}>
                      <div className={styles.statItem}>
                        <div className={styles.statLabel}>Total Rows</div>
                        <div className={styles.statValue}>{audienceData.totalRows}</div>
                      </div>
                      <div className={styles.statItem}>
                        <div className={styles.statLabel}>Valid Phones</div>
                        <div className={`${styles.statValue} ${styles.green}`}>{audienceData.validContacts}</div>
                      </div>
                      <div className={styles.statItem}>
                        <div className={styles.statLabel}>Invalid Formats</div>
                        <div className={`${styles.statValue} ${styles.red}`}>{audienceData.invalidContacts}</div>
                      </div>
                    </div>

                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Parsed WhatsApp Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audienceData.sample?.map((s, i) => (
                          <tr key={i}>
                            <td>{s.name || <em>Empty</em>}</td>
                            <td style={{ color: '#047857', fontFamily: 'monospace' }}>+{s.phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className={styles.stepTitle} style={{ textAlign: 'left', margin: 0 }}>Compose Message</h2>
                  <div style={{ background: '#F3F4F6', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => setMessageType('ai')} 
                      style={{ padding: '6px 16px', border: 'none', background: messageType==='ai' ? 'white' : 'transparent', borderRadius: '6px', fontWeight: 'bold', color: messageType==='ai' ? '#C8A45D' : '#6B7280', cursor: 'pointer', boxShadow: messageType==='ai' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                    >✨ AI Gen</button>
                    <button 
                      onClick={() => setMessageType('template')}
                      style={{ padding: '6px 16px', border: 'none', background: messageType==='template' ? 'white' : 'transparent', borderRadius: '6px', fontWeight: 'bold', color: messageType==='template' ? '#C8A45D' : '#6B7280', cursor: 'pointer', boxShadow: messageType==='template' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                    >📋 Target Template</button>
                  </div>
                </div>

                <div className={styles.messageLayout}>
                  <div className={styles.messageControls}>
                    {messageType === 'ai' ? (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>What are we promoting today?</label>
                          <textarea 
                            className={styles.textarea} 
                            value={aiPrompt} 
                            onChange={e => setAiPrompt(e.target.value)} 
                          />
                          <button className={styles.primaryBtn} onClick={handleGenerateAI} disabled={isGenerating} style={{ width: '100%', marginTop: '8px' }}>
                            {isGenerating ? 'Generating...' : 'Generate Marketing Copy'}
                          </button>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Refine Copy (Edit directly if needed)</label>
                          <textarea 
                            className={styles.textarea} 
                            style={{ flex: 1 }}
                            value={messageContent} 
                            onChange={e => setMessageContent(e.target.value)} 
                            placeholder="Generated message goes here..."
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>Meta Template</label>
                        <select
                          value={templateName}
                          onChange={e => setTemplateName(e.target.value)}
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: 'white' }}
                          disabled={loadingTemplates}
                        >
                          {loadingTemplates ? (
                            <option value="">Fetching templates...</option>
                          ) : metaTemplates.length > 0 ? (
                            metaTemplates.map(t => (
                              <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                            ))
                          ) : (
                            <option value="">No approved templates found</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className={styles.phonePreview}>
                    <div className={styles.phoneHeader}>
                      <div className={styles.phoneAvatar}>T</div>
                      <div>
                        <p className={styles.phoneName}>Trivastu Realty</p>
                        <p className={styles.phoneSub}>Business Account</p>
                      </div>
                    </div>
                    <div className={styles.phoneBody}>
                       <div className={styles.waMessage}>
                         {messageType === 'ai' ? (messageContent || <em>Generate a message...</em>) : <em>[Template rendering]</em>}
                         {messageType === 'ai' && (
                           <div className={styles.waButtons}>
                             <div className={styles.waBtn}>✅ I am interested</div>
                             <div className={styles.waBtn}>🛑 Stop messages</div>
                           </div>
                         )}
                       </div>
                    </div>
                  </div>
                </div>

                <div className={styles.actionFooter}>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#6B7280', fontWeight: 'bold', cursor: 'pointer' }}>Back</button>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      placeholder="Name this Campaign..."
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', width: '250px' }}
                    />
                    <button 
                      className={styles.actionBtn} 
                      onClick={handleStartCampaign}
                      disabled={isStarting || !campaignName || (messageType==='ai' && !messageContent)}
                    >
                      <Send size={16} /> Launch Campaign
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '32px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  background: campaignStats.status === 'running' ? '#C8A45D' : campaignStats.status === 'stopped' ? '#EF4444' : '#10B981'
                }}>
                  {campaignStats.status === 'running' ? <Send size={32} style={{marginLeft: '4px'}}/> : campaignStats.status==='stopped' ? <Square size={28}/> : <Check size={36}/>}
                </div>
                
                <h2 style={{ fontSize: '32px', margin: '0 0 8px 0', color: '#111827' }}>{campaignName}</h2>
                <span style={{ 
                  display: 'inline-block', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                  background: campaignStats.status === 'running' ? '#FEF3C7' : '#F3F4F6', color: campaignStats.status === 'running' ? '#D97706' : '#6B7280'
                }}>
                  Status: {campaignStats.status}
                </span>

                <div className={styles.progressContainer}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                     <span style={{ fontSize: '14px', fontWeight: '600', color: '#6B7280'}}>Progress</span>
                     <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827'}}>{Math.round(((campaignStats.sent + campaignStats.failed) / campaignStats.total) * 100)}%</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFillGreen} style={{ width: `${(campaignStats.sent / campaignStats.total) * 100}%` }} />
                    <div className={styles.progressFillRed} style={{ width: `${(campaignStats.failed / campaignStats.total) * 100}%` }} />
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                     <div style={{ flex: 1, background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB'}}>
                       <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 'bold'}}>Total</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 'bold'}}>{campaignStats.total}</p>
                     </div>
                     <div style={{ flex: 1, background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #D1FAE5'}}>
                       <p style={{ margin: 0, fontSize: '11px', color: '#059669', textTransform: 'uppercase', fontWeight: 'bold'}}>Delivered</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#047857'}}>{campaignStats.sent}</p>
                     </div>
                     <div style={{ flex: 1, background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #FEE2E2'}}>
                       <p style={{ margin: 0, fontSize: '11px', color: '#DC2626', textTransform: 'uppercase', fontWeight: 'bold'}}>Failed</p>
                       <p style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#B91C1C'}}>{campaignStats.failed}</p>
                     </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                  {campaignStats.status === 'running' ? (
                    <button onClick={handleStopCampaign} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}><Square size={16} fill="white"/> Stop Loop</button>
                  ) : (
                    <button onClick={() => handleDownloadReport(activeCampaignId)} style={{ background: '#111827', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}><Download size={16} /> Download Logs (CSV)</button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      ) : (
        /* HISTORY TAB */
        <div className={styles.card} style={{ minHeight: 'auto', padding: '0', display: 'block' }}>
          {loadingHistory ? (
            <div style={{ padding: '64px', textAlign: 'center' }}>Loading...</div>
          ) : campaignHistory.length === 0 ? (
            <div style={{ padding: '64px', textAlign: 'center', color: '#6B7280' }}>No campaigns found.</div>
          ) : (
            <table className={styles.dataTable} style={{ margin: 0, border: 'none', borderRadius: 0 }}>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaignHistory.map(c => (
                  <tr key={c._id}>
                     <td><strong style={{ color: '#111827' }}>{c.name}</strong></td>
                     <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                     <td><span style={{ fontSize: '11px', background: '#F3F4F6', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase'}}>{c.status}</span></td>
                     <td>{c.totalRecipients}</td>
                     <td>{c.totalRecipients > 0 ? Math.round((c.sentCount / c.totalRecipients)*100) : 0}%</td>
                     <td style={{ textAlign: 'right' }}>
                       <button onClick={() => handleDownloadReport(c._id)} style={{ background: 'none', border: 'none', color: '#C8A45D', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'}}><Download size={14}/> CSV</button>
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

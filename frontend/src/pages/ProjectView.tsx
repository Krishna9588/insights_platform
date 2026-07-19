import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getProject, runPipeline, requestFreshData, getAllChatHistory } from '@/api';
import BackButton from '@/components/layout/BackButton';
import ReactMarkdown from 'react-markdown';

export default function ProjectView() {
  const { selectedProjectView, setActivePage, setChatProject, showToast } = useStore();
  const [data, setData] = useState<any>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Company Profile');
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedProjectView) return;
    setChatProject(selectedProjectView);
    setLoading(true);
    getProject(selectedProjectView)
      .then((res: any) => {
        setData(res);
        
        // Determine the first available tab to set as active
        const availableTabs = [];
        if (res?.data_sources?.company_profile) availableTabs.push('Company Profile');
        if (res?.agent3_output?.insights) availableTabs.push('Insights');
        if (res?.agent4_output?.briefs) availableTabs.push('Product Briefs');
        if (res?.agent3_output?.strategic_moves || res?.data_sources?.company_profile?.data?.strategic_moves) availableTabs.push('Strategic Moves');
        if (res?.agent2_output?.problems || res?.data_sources?.company_profile?.data?.current_problems_struggling_with) availableTabs.push('Problems');
        if (res?.insights?.differentiators || res?.data_sources?.company_profile?.data?.differentiators) availableTabs.push('Differentiators');
        if (res?.insights?.tech_stack_highlights || res?.data_sources?.company_profile?.data?.tech_stack) availableTabs.push('Tech Stack Highlights');
        if (res?.requested_data && res.requested_data.length > 0) availableTabs.push('Requested Data');
        if (res?.data_sources?.reddit) availableTabs.push('Reddit');
        if (res?.data_sources?.play_store) availableTabs.push('Play Store');
        if (res?.data_sources?.app_store) availableTabs.push('App Store');
        if (res?.data_sources?.youtube) availableTabs.push('YouTube');
        if (res?.data_sources?.internal_transcripts || res?.data_sources?.google_drive_transcripts) availableTabs.push('Transcripts');
        if (res?.data_sources?.news) availableTabs.push('News');

        if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
          setActiveTab(availableTabs[0]);
        }
      })
      .catch((err) => {
        console.error(err);
        showToast('Failed to load project details');
      })
      .finally(() => setLoading(false));
      
    // Fetch chat history
    getAllChatHistory(selectedProjectView)
      .then((res: any) => {
        if (res.data && res.data.history) {
          setChatHistory(res.data.history);
        } else if (res.history) {
          setChatHistory(res.history);
        }
      })
      .catch((err) => console.error("Failed to fetch chat history:", err));
  }, [selectedProjectView, showToast]);

  if (!selectedProjectView) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p className="muted">No project selected.</p>
        <button className="button" onClick={() => setActivePage('dashboard')} style={{ marginTop: 16 }}>Go to Dashboard</button>
      </div>
    );
  }

  const handleAskCopilot = () => {
    setChatProject(selectedProjectView);
    showToast(`Copilot set to: ${selectedProjectView}`);
  };

  const profile = data?.data_sources?.company_profile?.data || {};

  const tabs = [];
  if (data?.data_sources?.company_profile) tabs.push('Company Profile');
  if (data?.agent3_output?.insights) tabs.push('Insights');
  if (data?.agent4_output?.briefs) tabs.push('Product Briefs');
  if (data?.insights?.strategic_moves || profile.strategic_moves) tabs.push('Strategic Moves');
  if (data?.agent2_output?.problems || profile.current_problems_struggling_with) tabs.push('Problems');
  if (data?.insights?.differentiators || profile.differentiators) tabs.push('Differentiators');
  if (data?.insights?.tech_stack_highlights || profile.tech_stack) tabs.push('Tech Stack Highlights');
  if (data?.requested_data && data.requested_data.length > 0) tabs.push('Requested Data');
  if (data?.data_sources?.reddit) tabs.push('Reddit');
  if (data?.data_sources?.play_store) tabs.push('Play Store');
  if (data?.data_sources?.app_store) tabs.push('App Store');
  if (data?.data_sources?.youtube) tabs.push('YouTube');
  if (
    data?.data_sources?.internal_transcripts ||
    data?.data_sources?.google_drive_transcripts ||
    data?.data_sources?.internal_transcripts_drive ||
    data?.data_sources?.internal_transcripts_local
  ) tabs.push('Transcripts');
  if (data?.data_sources?.news) tabs.push('News');
  if (chatHistory.length > 0) tabs.push('Chat History');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 64 }}>
      <header className="topbar">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="button compact secondary" onClick={() => setActivePage('collection')} style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
              ← Back
            </button>
            <p className="eyebrow" style={{ margin: 0 }}>Project View</p>
          </div>
          {(() => {
            let projName = data?.project_name || profile.company_name || selectedProjectView;
            if (projName && projName.startsWith('Monitor: ')) {
              projName = projName.substring(9);
            }
            const domainStr = data?.domain || profile.domain;
            let cleanDomain = '';
            if (domainStr) {
              try {
                cleanDomain = new URL(domainStr.startsWith('http') ? domainStr : `https://${domainStr}`).hostname;
              } catch(e) {
                cleanDomain = domainStr.replace(/^https?:\/\//, '').split('/')[0];
              }
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {cleanDomain && (
                  <a href={domainStr.startsWith('http') ? domainStr : `https://${domainStr}`} target="_blank" rel="noreferrer" title="Visit Website">
                    <img src={`https://img.logo.dev/${cleanDomain}?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=64`} alt="Logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: '#fff' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                  </a>
                )}
                <h1 style={{ margin: 0 }}>{projName}</h1>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 8 }}>
                  {domainStr && (
                    <a href={domainStr.startsWith('http') ? domainStr : `https://${domainStr}`} target="_blank" rel="noreferrer" title="Website" style={{ textDecoration: 'none' }}>
                      <span style={{ fontSize: 16 }}>🌐</span>
                    </a>
                  )}
                  {profile.youtube_official_channel && (
                    <a href={profile.youtube_official_channel} target="_blank" rel="noreferrer" title="YouTube" style={{ display: 'flex' }}>
                      <img src="https://img.logo.dev/youtube.com?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=32" alt="YouTube" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                    </a>
                  )}
                  {profile.linkedin_company_page && (
                    <a href={profile.linkedin_company_page} target="_blank" rel="noreferrer" title="LinkedIn" style={{ display: 'flex' }}>
                      <img src="https://img.logo.dev/linkedin.com?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=32" alt="LinkedIn" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                    </a>
                  )}
                  {profile.playstore_link && (
                    <a href={profile.playstore_link} target="_blank" rel="noreferrer" title="Play Store" style={{ display: 'flex' }}>
                      <img src="https://img.logo.dev/play.google.com?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=32" alt="Play Store" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                    </a>
                  )}
                  {profile.appstore_link && (
                    <a href={profile.appstore_link} target="_blank" rel="noreferrer" title="App Store" style={{ display: 'flex' }}>
                      <img src="https://img.logo.dev/apple.com?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=32" alt="App Store" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                    </a>
                  )}
                  {data?.data_sources?.reddit && (
                    <a href="#" onClick={(e) => {e.preventDefault(); setActiveTab('Reddit')}} title="Reddit Data Available" style={{ display: 'flex' }}>
                      <img src="https://img.logo.dev/reddit.com?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=32" alt="Reddit" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain' }} onError={(e) => e.currentTarget.style.display = 'none'} />
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        <div className="actions">
          <button 
            className="button compact" 
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-green) 100%)', 
              color: 'white', 
              border: 'none', 
              boxShadow: 'var(--shadow-sm)',
              fontWeight: 600
            }} 
            onClick={handleAskCopilot}
          >
            Ask Copilot <img src="/send.png" alt="Send" style={{ width: 14, height: 14, marginLeft: 6 }} />
          </button>
        </div>
      </header>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-strong)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Need fresh data?</h3>
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>Re-run the deep research pipeline to update this project with the latest information.</p>
          </div>
          {updating && (
            <button className="button compact secondary" onClick={() => setActivePage('dashboard')} style={{ fontSize: 12 }}>
              View Progress in Dashboard →
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input 
            type="text" 
            placeholder="E.g. Focus specifically on their latest pricing model..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--hairline)' }}
            disabled={updating}
          />
          <button 
            className="button" 
            disabled={updating}
            onClick={async () => {
              if (!customPrompt.trim()) return;
              try {
                setUpdating(true);
                const res = await requestFreshData({
                  project_name: selectedProjectView || 'Unknown',
                  query: customPrompt,
                  provider: 'gemini',
                });
                // Update local data state with the new requested data
                setData((prev: any) => ({
                  ...prev,
                  requested_data: res.requested_data
                }));
                // Switch to the Requested Data tab automatically
                setActiveTab('Requested Data');
                showToast('Fresh data fetched and appended!');
                setCustomPrompt('');
              } catch (e) {
                showToast('Failed to fetch requested data');
              } finally {
                setUpdating(false);
              }
            }}
          >
            {updating ? 'Updating...' : 'Update Data'}
          </button>
        </div>
        {updating && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'var(--hairline)' }}>
            <div style={{ height: '100%', background: 'var(--accent-blue)', width: '50%', animation: 'progress 2s infinite ease-in-out' }} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <span className="spinner dark" />
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="muted">Project data not found.</p>
        </div>
      ) : (
        <div className="grid cols-1" style={{ gap: 24 }}>
          {/* Top Level Summary Stats */}
          {(data.domain || profile.year_founded || profile.employee_count || profile.no_of_users || (profile.names_of_founders && profile.names_of_founders.length > 0) || profile.funding_stage || profile.available_platforms || profile.industry_and_segment || profile.revenue_or_funding) && (
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Domain</span>
                <p style={{ fontWeight: 500, wordBreak: 'break-all' }}>
                  {data.domain ? <a href={data.domain.startsWith('http') ? data.domain : `https://${data.domain}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{data.domain}</a> : 'N/A'}
                </p>
              </div>
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Founded</span>
                <p style={{ fontWeight: 500 }}>{profile.year_founded || 'N/A'}</p>
              </div>
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Employees</span>
                <p style={{ fontWeight: 500 }}>{profile.employee_count || 'N/A'}</p>
              </div>
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Users</span>
                <p style={{ fontWeight: 500 }}>{profile.no_of_users || 'N/A'}</p>
              </div>
              {profile.names_of_founders && profile.names_of_founders.length > 0 && (
                <div>
                  <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Founders</span>
                  <p style={{ fontWeight: 500 }}>{profile.names_of_founders.join(', ')}</p>
                </div>
              )}
              {profile.funding_stage && (
                <div>
                  <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Funding Stage</span>
                  <p style={{ fontWeight: 500 }}>{profile.funding_stage}</p>
                </div>
              )}
              {profile.available_platforms && (
                <div>
                  <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Platforms</span>
                  <p style={{ fontWeight: 500 }}>{profile.available_platforms}</p>
                </div>
              )}
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Industry & Segment</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {(profile.industry_and_segment || 'N/A').split(',').map((seg: string, i: number) => (
                    <span key={i} style={{ padding: '2px 8px', background: 'var(--surface-strong)', borderRadius: 999, fontSize: 12, border: '1px solid var(--hairline)', fontWeight: 500 }}>{seg.trim()}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Revenue / Funding</span>
                <p style={{ fontWeight: 500 }}>{profile.annual_revenue || profile.funding_raised || 'N/A'}</p>
              </div>
              {profile.exact_hq_location && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>HQ Location</span>
                  <p style={{ fontWeight: 500 }}>{profile.exact_hq_location}</p>
                </div>
              )}
            </div>
            {profile.key_positioning && (
              <div style={{ marginTop: 24 }}>
                <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Key Positioning</span>
                <p style={{ lineHeight: 1.6, marginTop: 4, color: 'var(--body)' }}>{profile.key_positioning}</p>
              </div>
            )}
          </div>
          )}

          {/* Tabs Navigation */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--hairline)', overflowX: 'auto', paddingBottom: 8 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? 'var(--surface-strong)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === tab ? 'var(--hairline)' : 'transparent',
                  color: activeTab === tab ? 'var(--ink)' : 'var(--muted)',
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{tab}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content" style={{ minHeight: 400 }}>
            {activeTab === 'Company Profile' && (
              <div className="card">
                <h3 style={{ marginBottom: 16 }}>Extended Profile</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
                  {profile['c-suite_officer'] && (
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Leadership</span>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {profile['c-suite_officer'].map((person: string, i: number) => {
                          const [name, ...designationParts] = person.split(' - ');
                          const designation = designationParts.join(' - ');
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface-strong)', borderRadius: 4, fontSize: 13, gap: 16 }}>
                              <span style={{ fontWeight: 500 }}>{name}</span>
                              <span style={{ color: 'var(--muted)', textAlign: 'right' }}>{designation}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {profile.target_customer_segments && (
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Target Customers</span>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 14 }}>
                        {profile.target_customer_segments.map((seg: string, i: number) => <li key={i}>{seg}</li>)}
                      </ul>
                    </div>
                  )}
                  {profile.locations_operating_in && (
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Locations</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {profile.locations_operating_in.map((loc: string, i: number) => (
                          <span key={i} style={{ padding: '4px 10px', background: 'var(--surface-strong)', borderRadius: 999, fontSize: 12, border: '1px solid var(--hairline)' }}>{loc}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.competitors && (
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Competitors</span>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 14 }}>
                        {profile.competitors.map((comp: any, i: number) => (
                          <li key={i}>{comp.name || comp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {profile.revenue_model && (
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Revenue Model</span>
                      <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{profile.revenue_model}</p>
                    </div>
                  )}
                  {profile.pricing_tiers && profile.pricing_tiers.length > 0 && (
                    <div>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Pricing Tiers</span>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 14 }}>
                        {profile.pricing_tiers.map((tier: string, i: number) => <li key={i}>{tier}</li>)}
                      </ul>
                    </div>
                  )}
                  {profile.market_sentiment && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Market Sentiment</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                        {profile.market_sentiment.overall && (
                          <div style={{ padding: '12px 16px', background: 'var(--surface-strong)', borderRadius: 8, borderLeft: '3px solid var(--accent-blue)' }}>
                            <strong style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Sentiment</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, fontWeight: 500 }}>{profile.market_sentiment.overall}</p>
                          </div>
                        )}
                        {profile.market_sentiment.analyst_view && (
                          <div style={{ padding: '12px 16px', background: 'var(--surface-strong)', borderRadius: 8 }}>
                            <strong style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyst View</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{profile.market_sentiment.analyst_view}</p>
                          </div>
                        )}
                        {profile.market_sentiment.user_community_view && (
                          <div style={{ padding: '12px 16px', background: 'var(--surface-strong)', borderRadius: 8 }}>
                            <strong style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Community View</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{profile.market_sentiment.user_community_view}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {profile.other_crucial_details && profile.other_crucial_details.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Other Crucial Details</span>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 14 }}>
                        {profile.other_crucial_details.map((detail: string, i: number) => (
                          <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {profile.milestones && (
                  <div style={{ marginTop: 24 }}>
                    <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Milestones</span>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 14 }}>
                      {profile.milestones.map((m: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
                    </ul>
                  </div>
                )}
                
                {profile.new_features_launched && (
                  <div style={{ marginTop: 24 }}>
                    <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>New Features</span>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 14 }}>
                      {profile.new_features_launched.map((m: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
                    </ul>
                  </div>
                )}

                {profile.recent_partnerships_and_integrations && (
                  <div style={{ marginTop: 24 }}>
                    <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Partnerships & Integrations</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                      {profile.recent_partnerships_and_integrations.map((p: any, i: number) => (
                        <div key={i} style={{ padding: 12, background: 'var(--surface-strong)', borderRadius: 8 }}>
                          <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{p.partner || 'Unknown'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({p.type})</span></p>
                          <p style={{ fontSize: 14, margin: '4px 0 0 0' }}>{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Strategic Moves' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎯</span> Strategic Moves
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(profile.strategic_moves || []).map((move: any, i: number) => (
                    <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, lineHeight: 1.5 }}>{move.move || move.description || move}</p>
                      {move.effect && move.effect.length > 0 && (
                        <ul style={{ paddingLeft: 16, margin: 0, fontSize: 14, color: 'var(--body)' }}>
                          {move.effect.map((ef: string, j: number) => <li key={j}>{ef}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                  {(!profile.strategic_moves || profile.strategic_moves.length === 0) && (
                    <p className="muted" style={{ fontSize: 14 }}>No strategic moves recorded.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Problems' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Agent 2 Extracted Problems if available */}
                {data.agent2_output?.problems && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🔍</span> Deep Research Insights & Problems
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {data.agent2_output.problems.map((prob: any, i: number) => (
                        <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8, borderLeft: `3px solid ${prob.severity === 'Critical' ? 'var(--error)' : 'var(--warn)'}` }}>
                          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>{prob.problem}</p>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--hairline)', borderRadius: 4 }}>{prob.category}</span>
                            <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--hairline)', borderRadius: 4 }}>Severity: {prob.severity}</span>
                          </div>
                          {prob.evidence && prob.evidence.length > 0 && (
                            <ul style={{ paddingLeft: 16, margin: '8px 0 0 0', fontSize: 13, color: 'var(--body)' }}>
                              {prob.evidence.map((ev: string, j: number) => <li key={j} style={{marginBottom: 4}}>{ev}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scraper Identified Problems (Agent 1 fallback) */}
                {(!data.agent2_output?.problems && profile.current_problems_struggling_with) && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>⚠️</span> Problems Struggling With
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {(profile.current_problems_struggling_with || []).map((prob: any, i: number) => (
                        <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8, borderLeft: '3px solid var(--error)' }}>
                          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, lineHeight: 1.5 }}>{prob.description || prob.issue || prob}</p>
                          {prob.effect && prob.effect.length > 0 && (
                            <ul style={{ paddingLeft: 16, margin: 0, fontSize: 14, color: 'var(--body)', marginTop: 8 }}>
                              {prob.effect.map((ef: string, j: number) => <li key={j}>{ef}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regulatory and User Complaints */}
                {(profile.regulatory_and_legal_issues || profile.user_complaints) && (
                  <div className="grid cols-2" style={{ gap: 24 }}>
                    {profile.regulatory_and_legal_issues && (
                      <div className="card">
                        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>⚖️</span> Regulatory & Legal
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {profile.regulatory_and_legal_issues.map((issue: any, i: number) => (
                            <div key={i} style={{ padding: 12, background: 'var(--surface-strong)', borderRadius: 8 }}>
                              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{issue.issue || issue.description || issue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.user_complaints && (
                      <div className="card">
                        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>🗣️</span> User Complaints
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {profile.user_complaints.map((comp: any, i: number) => (
                            <div key={i} style={{ padding: 12, background: 'var(--surface-strong)', borderRadius: 8 }}>
                              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{comp.issue || comp.description || comp}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Differentiators' && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✨</span> Differentiators
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(profile.differentiators || []).map((diff: any, i: number) => (
                    <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                      <p style={{ fontSize: 15, lineHeight: 1.5 }}>{diff.feature || diff.description || diff}</p>
                    </div>
                  ))}
                  {(!profile.differentiators || profile.differentiators.length === 0) && (
                    <p className="muted" style={{ fontSize: 14 }}>No differentiators recorded.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Requested Data' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {data.requested_data && data.requested_data.map((item: any, i: number) => (
                  <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--hairline)', paddingBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>💡</span> {item.query}
                      </h3>
                      <span className="muted" style={{ fontSize: 12 }}>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="markdown-body" style={{ color: 'var(--body)' }}>
                      <ReactMarkdown>{item.response}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Tech Stack Highlights' && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>💻</span> Tech Stack Highlights
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {(profile.tech_stack_highlights || []).map((tech: string, i: number) => (
                    <span key={i} style={{ 
                      padding: '6px 16px', 
                      background: 'var(--surface-strong)', 
                      border: '1px solid var(--hairline)', 
                      borderRadius: 999, 
                      fontSize: 14, 
                      fontWeight: 500 
                    }}>
                      {tech}
                    </span>
                  ))}
                  {(!profile.tech_stack_highlights || profile.tech_stack_highlights.length === 0) && (
                    <p className="muted" style={{ fontSize: 14 }}>No tech stack data recorded.</p>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'Insights' && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>💡</span> Strategic Insights
                </h3>
                {data.agent3_output?.insights ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {data.agent3_output.insights.map((insight: any, i: number) => (
                      <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8, borderLeft: `4px solid ${insight.priority === 'Critical' ? 'var(--error)' : insight.priority === 'High' ? 'var(--warning)' : 'var(--accent-blue)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{insight.insight || 'Insight'}</h4>
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: 'var(--surface)', border: '1px solid var(--hairline)' }}>{insight.priority} Priority</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                          <div>
                            <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Root Cause</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{insight.root_cause}</p>
                          </div>
                          <div>
                            <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Implication</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{insight.implication}</p>
                          </div>
                          {insight.competitor_gap && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Competitor Gap</span>
                              <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{insight.competitor_gap}</p>
                            </div>
                          )}
                          {insight.opportunity_size && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Opportunity Size</span>
                              <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{insight.opportunity_size}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 14 }}>No insights generated yet. Please run the research pipeline.</p>
                )}
              </div>
            )}

            {activeTab === 'Product Briefs' && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🚀</span> Actionable Product Briefs
                </h3>
                {data.agent4_output?.briefs ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {data.agent4_output.briefs.map((brief: any, i: number) => (
                      <div key={i} style={{ padding: 20, background: 'var(--surface-strong)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--hairline)' }}>
                          <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{brief.feature_name}</h4>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--accent-blue)', color: 'white' }}>{brief.priority}</span>
                            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--hairline)' }}>Effort: {brief.effort}</span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                          <div>
                            <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>The Problem</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.6 }}>{brief.problem}</p>
                          </div>
                          <div>
                            <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>The Solution</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.6 }}>{brief.solution}</p>
                          </div>
                          
                          {brief.user_flow && brief.user_flow.length > 0 && (
                            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 8, marginTop: 8 }}>
                              <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12, display: 'block', marginBottom: 8 }}>User Flow</span>
                              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
                                {brief.user_flow.map((step: string, idx: number) => (
                                  <li key={idx} style={{ paddingBottom: 4 }}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                            <div>
                              <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Expected Impact</span>
                              <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5, fontWeight: 500, color: 'var(--success)' }}>{brief.expected_impact}</p>
                            </div>
                            <div>
                              <span className="eyebrow" style={{ color: 'var(--muted)', fontSize: 12 }}>Success Metric</span>
                              <p style={{ margin: '4px 0 0 0', fontSize: 14, lineHeight: 1.5 }}>{brief.success_metric}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 14 }}>No product briefs generated yet. Please run the research pipeline.</p>
                )}
              </div>
            )}

            {activeTab === 'Reddit' && data.data_sources?.reddit && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📱</span> Reddit Data
                </h3>
                {Object.keys(data.data_sources.reddit).map(key => {
                   const item = data.data_sources.reddit[key];
                   if (item.error) return <p key={key} className="muted">Error: {item.error}</p>;
                   const redditData = item.data || item;
                   if (!redditData || (!redditData.posts && !redditData.subreddit_info)) return null;
                   return (
                     <div key={key} style={{ marginBottom: 24 }}>
                       <h4 style={{ margin: '0 0 12px 0' }}>{redditData.type === 'subreddit' ? 'Subreddit' : 'Search'}: {redditData.subreddit_info?.name || redditData.query || redditData.user_info?.name || 'Reddit Data'}</h4>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                         {(redditData.posts || []).map((post: any, i: number) => (
                           <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                             <a href={post.url || `https://reddit.com${post.permalink}`} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-blue)', textDecoration: 'none' }}>{post.title || `Post by ${post.author}`}</a>
                             <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--muted)' }}>Score: {post.score} | Comments: {post.num_comments} | Author: {post.author}</p>
                             {post.selftext && <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>{post.selftext.substring(0, 300)}{post.selftext.length > 300 ? '...' : ''}</p>}
                           </div>
                         ))}
                       </div>
                     </div>
                   );
                })}
              </div>
            )}
            
            {activeTab === 'YouTube' && data.data_sources?.youtube && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>▶️</span> YouTube Data
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(Array.isArray(data.data_sources.youtube) 
                      ? data.data_sources.youtube 
                      : Object.values(data.data_sources.youtube || {}).flat()
                   ).map((video: any, i: number) => {
                    if (video.error) return <p key={i} className="muted">Error: {video.error}</p>;
                    return (
                      <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                        <a href={video.url || video.link} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-blue)', textDecoration: 'none' }}>{video.title}</a>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--muted)' }}>
                          {video.transcript_words ? `Transcript Words: ${video.transcript_words}` : 'No Transcript'} | Scraped: {new Date(video.scraped_at).toLocaleDateString()}
                        </p>
                        {video.description && <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{video.description.substring(0, 300)}{video.description.length > 300 ? '...' : ''}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'Play Store' && data.data_sources?.play_store && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>👾</span> Play Store Data
                </h3>
                {data.data_sources.play_store.extracted_data && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0' }}>{data.data_sources.play_store.extracted_data.metadata?.title || 'App Info'}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(data.data_sources.play_store.extracted_data.reviews || []).slice(0, 50).map((review: any, i: number) => (
                        <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: 14 }}>{review.userName || 'User'}</strong>
                            <span style={{ fontSize: 13, color: 'var(--accent-blue)' }}>{review.score || review.rating} ★</span>
                          </div>
                          <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>{review.content || review.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.data_sources.play_store.error && <p className="muted">Error: {data.data_sources.play_store.error}</p>}
              </div>
            )}

            {activeTab === 'App Store' && data.data_sources?.app_store && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🍎</span> App Store Data
                </h3>
                {data.data_sources.app_store.extracted_data && (
                  <div>
                    <h4 style={{ margin: '0 0 12px 0' }}>{data.data_sources.app_store.extracted_data.metadata?.title || data.data_sources.app_store.extracted_data.metadata?.trackName || 'App Info'}</h4>
                    {(data.data_sources.app_store.extracted_data.reviews && data.data_sources.app_store.extracted_data.reviews.length > 0) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data.data_sources.app_store.extracted_data.reviews.slice(0, 50).map((review: any, i: number) => (
                          <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <strong style={{ fontSize: 14 }}>{review.userName || review.author || 'User'}</strong>
                              <span style={{ fontSize: 13, color: 'var(--accent-blue)' }}>{review.score || review.rating} ★</span>
                            </div>
                            <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>{review.content || review.text || review.review}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted" style={{ fontSize: 14 }}>No reviews found for this app.</p>
                    )}
                  </div>
                )}
                {data.data_sources.app_store.error && <p className="muted">Error: {data.data_sources.app_store.error}</p>}
              </div>
            )}

            {activeTab === 'News' && data.data_sources?.news && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📰</span> News Data
                </h3>
                {(() => {
                  const articles = data.data_sources.news.extracted_data?.articles || data.data_sources.news.articles || [];
                  if (articles.length === 0) return null;
                  return (
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {articles.map((article: any, i: number) => (
                          <div key={i} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                            <a href={article.url || article.link} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-blue)', textDecoration: 'none' }}>{article.title}</a>
                            <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>{article.description || article.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {data.data_sources.news.error && <p className="muted">Error: {data.data_sources.news.error}</p>}
              </div>
            )}

            {activeTab === 'Chat History' && chatHistory.length > 0 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>💬</span> Copilot Chat History
                </h3>
                {chatHistory.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--surface-strong)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <strong style={{ fontSize: 15, color: 'var(--ink)' }}>User: {item.question}</strong>
                      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, marginLeft: 16 }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="markdown-body" style={{ fontSize: 14, color: 'var(--body)' }}>
                      <ReactMarkdown>{item.answer}</ReactMarkdown>
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                      Session: {item.title || item.session_id}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Transcripts' && (data.data_sources?.internal_transcripts || data.data_sources?.google_drive_transcripts || data.data_sources?.internal_transcripts_drive || data.data_sources?.internal_transcripts_local) && (
              <div className="card">
                <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📄</span> Transcripts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {[data.data_sources?.internal_transcripts, data.data_sources?.google_drive_transcripts, data.data_sources?.internal_transcripts_drive, data.data_sources?.internal_transcripts_local].map((sourceGroup: any, idx: number) => {
                    if (!sourceGroup) return null;
                    const files = Array.isArray(sourceGroup) ? sourceGroup : (sourceGroup.signals ? [sourceGroup] : Object.values(sourceGroup));
                    return files.map((file: any, i: number) => {
                       if (file.status === 'error' || file.error) return <p key={`err-${idx}-${i}`} className="muted">Error: {file.error || file.message}</p>;
                       if (!file.signals || file.signals.length === 0) return null;
                       return (
                         <div key={`${idx}-${i}`} style={{ marginBottom: 24 }}>
                           <h4 style={{ margin: '0 0 12px 0' }}>{file.source_file || file.metadata?.source_file || 'Transcript'}</h4>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                             {(file.signals || []).map((sig: any, j: number) => (
                               <div key={j} style={{ padding: 16, background: 'var(--surface-strong)', borderRadius: 8 }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                   <strong style={{ fontSize: 14 }}>{sig.signal_type || sig.type}</strong>
                                   <span style={{ fontSize: 13, color: 'var(--accent-blue)' }}>Confidence: {sig.confidence || sig.conf}</span>
                                 </div>
                                 <p style={{ margin: '8px 0 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>{sig.content}</p>
                               </div>
                             ))}
                           </div>
                         </div>
                       );
                    });
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      <BackButton fallback="collection" />
    </div>
  );
}

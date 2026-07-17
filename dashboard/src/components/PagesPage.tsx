import { useState } from 'react';
import PagesManager from './PagesManager.tsx';
import CampaignsManager from './CampaignsManager.tsx';
import type { PageData, CampaignData } from '../api.ts';

interface PagesPageProps {
  pages: PageData[];
  campaigns: CampaignData[];
  onPagesChange?: (pages: PageData[]) => void;
  onCampaignsChange?: (campaigns: CampaignData[]) => void;
}

export default function PagesPage({
  pages,
  campaigns,
  onPagesChange,
  onCampaignsChange,
}: PagesPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pages' | 'campaigns'>('pages');

  return (
    <div className="container">
      <div style={{ height: 24 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2>📋 Quản lý Fanpage & Chiến dịch</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className={`btn btn-sm ${activeSubTab === 'pages' ? 'btn-primary' : ''}`} onClick={() => setActiveSubTab('pages')}>
            Facebook Pages
          </button>
          <button className={`btn btn-sm ${activeSubTab === 'campaigns' ? 'btn-primary' : ''}`} onClick={() => setActiveSubTab('campaigns')}>
            Chiến dịch (Campaigns)
          </button>
        </div>
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        {activeSubTab === 'pages' ? (
          <PagesManager initialPages={pages} onPagesChange={onPagesChange} />
        ) : (
          <CampaignsManager initialCampaigns={campaigns} onCampaignsChange={onCampaignsChange} />
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import PagesManager from '@/components/PagesManager.tsx';
import CampaignsManager from '@/components/CampaignsManager.tsx';

export default function PagesPage() {
  const [activeSubTab, setActiveSubTab] = useState<'pages' | 'campaigns'>('pages');

  return (
    <div className="container">
      <div className="spacer-24" />
      <div className="flex justify-between items-center flex-wrap gap-12" style={{ marginBottom: '1.5rem' }}>
        <h2>📋 Quản lý Fanpage & Chiến dịch</h2>
        <div className="flex gap-6">
          <button className={`btn btn-sm ${activeSubTab === 'pages' ? 'btn-primary' : ''}`} onClick={() => setActiveSubTab('pages')}>
            Facebook Pages
          </button>
          <button className={`btn btn-sm ${activeSubTab === 'campaigns' ? 'btn-primary' : ''}`} onClick={() => setActiveSubTab('campaigns')}>
            Chiến dịch (Campaigns)
          </button>
        </div>
      </div>
      
      <div className="mt-16">
        {activeSubTab === 'pages' ? (
          <PagesManager />
        ) : (
          <CampaignsManager />
        )}
      </div>
    </div>
  );
}

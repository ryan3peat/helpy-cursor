import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Users, Home } from 'lucide-react';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { TranslationDictionary } from '../types';
import { logger } from '../utils/logger';

interface AnalyticsProps {
  onBack: () => void;
  t: TranslationDictionary;
}

interface AnalyticsData {
  households: {
    active: number;
    pending: number;
    total: number;
  };
  users: {
    active: number;
    pending: number;
    total: number;
  };
}

const Analytics: React.FC<AnalyticsProps> = ({ onBack, t }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isScrolled } = useScrollHeader({ collapseThreshold: 50, expandThreshold: 110 });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const apiUrl = import.meta.env?.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/analytics`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        logger.error('Analytics fetch error:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const StatCard = ({ 
    title, 
    icon: Icon, 
    active, 
    pending, 
    total 
  }: { 
    title: string; 
    icon: typeof Users;
    active: number; 
    pending: number; 
    total: number;
  }) => (
    <div className="bg-card rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon size={20} className="text-primary" />
        </div>
        <h3 className="text-title font-bold text-foreground">{title}</h3>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-body text-muted-foreground">Total</span>
          <span className="text-display text-foreground">{total}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between items-center">
          <span className="text-body text-muted-foreground">Active</span>
          <span className="text-title text-primary font-semibold">{active}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-body text-muted-foreground">Pending</span>
          <span className="text-title text-[#FF9800] font-semibold">{pending}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 page-content">
        {/* Header */}
        <header 
          className="sticky top-0 z-20 bg-background -mx-4 px-4 sm:-mx-6 sm:px-6 pb-3 flex items-end transition-shadow duration-200"
          style={{ 
            height: '120px',
            boxShadow: isScrolled ? '0 8px 16px -8px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="text-primary font-bold" style={{ fontSize: '20px' }}>SuperAdmin</span>
              <h1 className="text-display text-foreground">Analytics</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="pt-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="bg-destructive/10 rounded-2xl p-6 text-center">
              <p className="text-destructive">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-destructive text-white rounded-xl text-body font-semibold"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Households */}
              <StatCard
                title="Unique Households"
                icon={Home}
                active={data.households.active}
                pending={data.households.pending}
                total={data.households.total}
              />

              {/* Users */}
              <StatCard
                title="Users"
                icon={Users}
                active={data.users.active}
                pending={data.users.pending}
                total={data.users.total}
              />
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="helpy-footer mt-8">
          <span className="helpy-logo">helpy</span>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

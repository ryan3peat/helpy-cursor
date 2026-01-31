import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Users, Home, Gift, ChevronDown, Calendar } from 'lucide-react';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { TranslationDictionary } from '../types';
import { logger } from '../utils/logger';

interface AnalyticsProps {
  onBack: () => void;
  t: TranslationDictionary;
}

interface BettyRedemption {
  id: string;
  codeUsed: string;
  createdAt: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  convertedToPaidAt: string | null;
  userEmail: string;
  userName: string;
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
  bettyPromo: {
    totalAllTime: number;
    filteredCount: number;
    redemptions: BettyRedemption[];
    dateFilter: string;
  };
}

type DateFilter = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30_days' | 'ytd';

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'ytd', label: 'Year to Date' },
];

const Analytics: React.FC<AnalyticsProps> = ({ onBack, t }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('last_30_days');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { isScrolled } = useScrollHeader({ collapseThreshold: 50, expandThreshold: 110 });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env?.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/analytics?dateFilter=${dateFilter}`);
        
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
  }, [dateFilter]);

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
          <span className="text-body font-medium text-muted-foreground">Total</span>
          <span className="text-display text-foreground">{total}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between items-center">
          <span className="text-body font-medium text-muted-foreground">Active</span>
          <span className="text-title text-primary font-semibold">{active}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-body font-medium text-muted-foreground">Pending</span>
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
            paddingTop: 'env(safe-area-inset-top)',
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

              {/* Betty Promo Redemptions */}
              <div className="bg-card rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#9C27B0]/10 flex items-center justify-center">
                      <Gift size={20} className="text-[#9C27B0]" />
                    </div>
                    <h3 className="text-title font-bold text-foreground">Betty Promo</h3>
                  </div>
                  
                  {/* Date Filter Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-xl text-body font-medium text-foreground"
                    >
                      <Calendar size={16} className="text-muted-foreground" />
                      <span>{DATE_FILTER_OPTIONS.find(o => o.value === dateFilter)?.label}</span>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isFilterOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-card rounded-xl shadow-lg border border-border z-30 overflow-hidden">
                        {DATE_FILTER_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setDateFilter(option.value);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-body font-medium hover:bg-secondary transition-colors ${
                              dateFilter === option.value ? 'text-primary bg-primary/5' : 'text-foreground'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Stats Summary */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-body font-medium text-muted-foreground">Total (All Time)</span>
                    <span className="text-display text-foreground">{data.bettyPromo.totalAllTime}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <span className="text-body font-medium text-muted-foreground">
                      {DATE_FILTER_OPTIONS.find(o => o.value === dateFilter)?.label}
                    </span>
                    <span className="text-title text-[#9C27B0] font-semibold">{data.bettyPromo.filteredCount}</span>
                  </div>
                </div>

                {/* Redemptions List */}
                {data.bettyPromo.redemptions.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Redemptions
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {data.bettyPromo.redemptions.map((redemption) => (
                        <div 
                          key={redemption.id} 
                          className="bg-secondary/50 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="text-body font-semibold text-foreground truncate">
                                {redemption.userName}
                              </p>
                              <p className="text-caption text-muted-foreground truncate">
                                {redemption.userEmail}
                              </p>
                            </div>
                            {redemption.convertedToPaidAt && (
                              <span className="ml-2 px-2 py-1 bg-primary/10 text-primary text-caption font-semibold rounded-lg whitespace-nowrap">
                                Converted
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-caption text-muted-foreground">
                            <span>
                              Redeemed: {new Date(redemption.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                            {redemption.trialEndsAt && (
                              <span>
                                Trial ends: {new Date(redemption.trialEndsAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-center py-6 text-body text-muted-foreground">
                    No redemptions in this period
                  </div>
                )}
              </div>
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

import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { TranslationDictionary } from '../types';

interface TrialBannerProps {
  trialEndsAt: string;
  t: TranslationDictionary;
  onUpgradeClick: () => void;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ trialEndsAt, t, onUpgradeClick }) => {
  const getDaysRemaining = () => {
    const end = new Date(trialEndsAt);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const daysLeft = getDaysRemaining();
  const isUrgent = daysLeft <= 7;

  return (
    <div
      className={`mx-4 mb-4 p-4 rounded-xl border flex items-center justify-between ${
        isUrgent
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-primary/10 border-primary/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isUrgent ? 'bg-amber-500/20' : 'bg-primary/20'}`}>
          <Clock size={20} className={isUrgent ? 'text-amber-600' : 'text-primary'} />
        </div>
        <div>
          <p className={`text-body font-semibold ${isUrgent ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
            {t['subscription.trial_banner'] || 'Free Trial'}
          </p>
          <p className="text-caption text-muted-foreground">
            {daysLeft} {t['subscription.days_remaining'] || 'days remaining'}
          </p>
        </div>
      </div>
      <button
        onClick={onUpgradeClick}
        className={`flex items-center gap-1 px-4 py-2 rounded-lg text-body font-medium transition-colors ${
          isUrgent
            ? 'bg-amber-500 text-white'
            : 'bg-primary text-primary-foreground'
        }`}
      >
        {t['common.view_plan'] || 'View Plan'}
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default TrialBanner;




// components/UserGuide.tsx
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Bell,
  Languages,
  Lightbulb,
  MessageCircleQuestionMark,
  Crown,
  CheckCircle2,
  UserCheck,
  Lock,
  Check,
  X,
  Star,
  Play,
} from 'lucide-react';
import { User, UserRole, TranslationDictionary } from '../types';
import { SUBSCRIPTION_PLANS } from '../services/stripeService';
import { SUPPORTED_LANGUAGES } from '../constants';
import { NAV_ITEMS, FEATURE_ICONS } from '../config/navConfig';
import { getGuideRoles, getRoleConfig, RoleConfig } from '../config/rolePermissions';
import { useDemoMode } from '../contexts/DemoModeContext';

interface UserGuideProps {
  currentUser: User;
  t: TranslationDictionary;
  onNavigateToPlan: () => void;
  onNavigateToFeedback: () => void;
}

// Dynamic text component - shows dynamic content in Helpy blue
const DynamicText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-primary font-semibold">{children}</span>
);

// Accordion section component
const AccordionSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="text-primary">{icon}</div>
          <span className="text-title font-bold text-foreground">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown size={20} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={20} className="text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-0 animate-fade-in">
          <div className="border-t border-border pt-4">{children}</div>
        </div>
      )}
    </div>
  );
};

// Feature card component (Level 2 - child of section headers)
// Smaller, indented, muted styling to show hierarchy
const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  isPremium?: boolean;
  t: TranslationDictionary;
}> = ({ icon, title, description, isPremium, t }) => (
  <div className="flex gap-2.5 py-2 ml-6">
    <div className="h-fit mt-0.5">
      {isPremium ? (
        <div className="text-amber-600">{icon}</div>
      ) : (
        <div className="text-muted-foreground">{icon}</div>
      )}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <h4 className="text-body font-semibold text-foreground">{title}</h4>
        {isPremium && (
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-micro font-semibold rounded-full flex items-center gap-1">
            <Crown size={10} />
            {t['common.core'] || 'Core'}+
          </span>
        )}
      </div>
      <p className="text-body font-normal text-muted-foreground mt-0.5">{description}</p>
    </div>
  </div>
);

// Ability list item component
const AbilityItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 py-1.5">
    <CheckCircle2 size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
    <span className="text-body text-foreground">{children}</span>
  </div>
);

// Restriction list item component (for things helpers cannot do)
const RestrictionItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 py-1.5">
    <X size={14} className="text-destructive mt-0.5 flex-shrink-0" />
    <span className="text-body text-foreground">{children}</span>
  </div>
);

// Bullet list item component (for profile-only roles like Child)
const BulletItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 py-1.5">
    <span className="text-primary mt-0.5 flex-shrink-0">•</span>
    <span className="text-body text-foreground">{children}</span>
  </div>
);

// Role card component - expandable card for each role
const RoleCard: React.FC<{
  title: string;
  description: string;
  isCurrentRole?: boolean;
  t: TranslationDictionary;
  children: React.ReactNode;
}> = ({ title, description, isCurrentRole, t, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`rounded-xl mb-3 overflow-hidden ${isCurrentRole ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-muted'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-body font-bold text-foreground">{title}</span>
            {isCurrentRole && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-micro font-semibold rounded-full">
                {t['guide.you'] || 'You'}
              </span>
            )}
          </div>
          <p className="text-body text-muted-foreground mt-0.5">{description}</p>
        </div>
        {isOpen ? (
          <ChevronDown size={18} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0 animate-fade-in">
          <div className="border-t border-border/50 pt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

// Tip card component
const TipCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="bg-muted rounded-xl p-4 mb-3">
    <div className="flex items-start gap-3">
      <Lightbulb size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <h4 className="text-body font-semibold text-foreground">{title}</h4>
        <p className="text-body text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  </div>
);

const UserGuide: React.FC<UserGuideProps> = ({ currentUser, t, onNavigateToPlan, onNavigateToFeedback }) => {
  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;
  const { isViewingAsHelper } = useDemoMode();
  
  const isAdmin = currentUser.role === UserRole.MASTER;
  const isSpouse = currentUser.role === UserRole.SPOUSE;
  // isHelper: true if actual Helper OR SuperAdmin viewing as Helper
  const isHelper = currentUser.role === UserRole.HELPER || (isSuperAdmin && isViewingAsHelper);
  const isChild = currentUser.role === UserRole.CHILD;

  // Get plans from existing constants
  const freePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'free');
  const corePlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'core');
  const proPlan = SUBSCRIPTION_PLANS.find((p) => p.id === 'pro');

  // Get role display name
  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case UserRole.MASTER:
        return t['guide.role_admin_title'] || 'Admin';
      case UserRole.SPOUSE:
        return t['guide.role_spouse_title'] || 'Spouse';
      case UserRole.HELPER:
        return t['guide.role_helper_title'] || 'Helper';
      case UserRole.CHILD:
        return t['guide.role_child_title'] || 'Child';
      default:
        return role;
    }
  };

  return (
    <div className="space-y-4">
      {/* Getting Started */}
      <AccordionSection
        title={t['guide.getting_started'] || 'Getting Started'}
        icon={<Play size={20} />}
      >
        <div className="mb-4">
          <h3 className="text-body font-bold text-foreground flex items-center gap-2 mb-2">
            <Languages size={18} className="text-foreground" />
            {t['guide.languages_title'] || 'Multi-Language Support'}
          </h3>
          <p className="text-body text-muted-foreground mb-3">
            {t['guide.languages_desc'] ||
              'Helpy automatically translates content. You can change your language anytime from the dashboard.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <span
                key={lang.code}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-body font-medium"
              >
                {lang.name}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-border my-4" />

        <div>
          <h3 className="text-body font-bold text-foreground flex items-center gap-2 mb-2">
            <Bell size={18} className="text-foreground" />
            {t['guide.notifications_title'] || 'Push Notifications'}
          </h3>
          <p className="text-body text-muted-foreground">
            {t['guide.notifications_desc'] ||
              'Get notified when new tasks, meals, or expenses are added. Enable in Profile > Settings.'}
          </p>
        </div>
      </AccordionSection>

      {/* Roles Section - Dynamically rendered from centralized config */}
      <AccordionSection
        title={t['guide.roles_title'] || 'Roles'}
        icon={<Users size={20} />}
        defaultOpen={false}
      >
        <p className="text-body text-muted-foreground mb-4">
          {t['guide.roles_desc'] || 'Helpy has different roles with different permissions. Learn what each role can do.'}
        </p>

        {getGuideRoles().map((roleConfig) => (
          <RoleCard
            key={roleConfig.role}
            title={roleConfig.displayName}
            description={roleConfig.description}
            isCurrentRole={currentUser.role === roleConfig.role}
            t={t}
          >
            {/* Profile-only roles (like Child) have different display format */}
            {roleConfig.isProfileOnly ? (
              <>
                {/* This profile is for: */}
                {roleConfig.profileFor && roleConfig.profileFor.length > 0 && (
                  <div className="mb-3">
                    <p className="text-caption text-muted-foreground mb-2 font-semibold">
                      {t['guide.this_profile_is_for'] || 'This profile is for:'}
                    </p>
                    {roleConfig.profileFor.map((item) => (
                      <BulletItem key={item.key}>{item.label}</BulletItem>
                    ))}
                  </div>
                )}
                
                {/* Note */}
                {roleConfig.note && (
                  <p className="text-caption text-muted-foreground mt-2">
                    {t['guide.child_note'] || roleConfig.note}
                  </p>
                )}
              </>
            ) : (
              <>
                {/* What you can do */}
                {roleConfig.abilities.length > 0 && (
                  <div className="mb-3">
                    <p className="text-caption text-muted-foreground mb-2 font-semibold">
                      {t['guide.what_you_can_do'] || 'What they can do:'}
                    </p>
                    {roleConfig.abilities.map((ability) => (
                      <AbilityItem key={ability.key}>{ability.label}</AbilityItem>
                    ))}
                  </div>
                )}
                
                {/* What you can't do */}
                {roleConfig.restrictions.length > 0 && (
                  <div>
                    <p className="text-caption text-muted-foreground mb-2 font-semibold">
                      {t['guide.what_you_cant_do'] || "What they can't do:"}
                    </p>
                    {roleConfig.restrictions.map((restriction) => (
                      <RestrictionItem key={restriction.key}>{restriction.label}</RestrictionItem>
                    ))}
                  </div>
                )}
                
                {/* Special case: Admin has no restrictions */}
                {roleConfig.restrictions.length === 0 && roleConfig.role === UserRole.MASTER && (
                  <p className="text-caption text-muted-foreground mt-2">
                    {t['guide.full_access'] || 'Full access - no restrictions'}
                  </p>
                )}
              </>
            )}
          </RoleCard>
        ))}
      </AccordionSection>

      {/* Features Section */}
      <AccordionSection
        title={t['guide.features'] || 'Features'}
        icon={<Star size={20} />}
        defaultOpen={true}
      >
        {/* Home - Level 1 Section Header */}
        <div className="mb-3">
          <h3 className="text-body font-bold text-foreground flex items-center gap-2">
            <NAV_ITEMS.dashboard.icon size={18} className="text-foreground" />
            {t['guide.dashboard_title'] || 'Home'}
          </h3>
          <p className="text-body text-foreground mt-1 ml-6">
            {t['guide.dashboard_desc'] ||
              'Your home screen shows a quick overview of everything: shopping items needed, pending tasks, upcoming meals, and monthly expenses.'}
          </p>
        </div>

        <FeatureCard
          icon={<NAV_ITEMS.todo.icon size={14} />}
          title={t['guide.family_board_title'] || 'Family Board'}
          description={
            t['guide.family_board_desc'] ||
            'Pin notes for your whole family to see. Tap to edit and share reminders, announcements, or instructions.'
          }
          t={t}
        />

        <div className="border-t border-border my-4" />

        {/* To-Do - Level 1 Section Header */}
        <div className="mb-3">
          <h3 className="text-body font-bold text-foreground flex items-center gap-2">
            <NAV_ITEMS.todo.icon size={18} className="text-foreground" />
            {t['guide.todo_title'] || 'To-Do'}
          </h3>
          <p className="text-body text-foreground mt-1 ml-6">
            {t['guide.todo_desc'] || 'Manage shopping lists and household tasks in one place.'}
          </p>
        </div>

        <FeatureCard
          icon={<FEATURE_ICONS.shopping size={14} />}
          title={t['guide.shopping_title'] || 'Shopping Lists'}
          description={
            t['guide.shopping_desc'] ||
            'Add items with quantity, assign to family members or your helper, and organize by location.'
          }
          t={t}
        />

        <FeatureCard
          icon={<FEATURE_ICONS.tasks size={14} />}
          title={t['guide.tasks_title'] || 'Tasks'}
          description={
            t['guide.tasks_desc'] ||
            'Create tasks with due dates, set recurrence for repeating chores, and assign to specific people.'
          }
          t={t}
        />

        <div className="border-t border-border my-4" />

        {/* Meals - Level 1 Section Header */}
        <div className="mb-3">
          <h3 className="text-body font-bold text-foreground flex items-center gap-2">
            <NAV_ITEMS.meals.icon size={18} className="text-foreground" />
            {t['guide.meals_title'] || 'Meals'}
          </h3>
          <p className="text-body text-foreground mt-1 ml-6">
            {t['guide.meals_desc'] || 'Plan breakfast, lunch, dinner, and snacks for your family.'}
          </p>
        </div>

        <FeatureCard
          icon={<UserCheck size={14} />}
          title={t['guide.rsvp'] || 'RSVP'}
          description={t['guide.meals_rsvp'] || 'Family members can RSVP to meals so you know who will be eating.'}
          t={t}
        />

        <FeatureCard
          icon={<Users size={14} />}
          title={t['meals.audience_label'] || 'Audience'}
          description={t['guide.meals_audience'] || 'Set meals for everyone, adults only, or kids only.'}
          t={t}
        />

        <div className="border-t border-border my-4" />

        {/* Expenses - Hide from helpers */}
        {!isHelper && (
          <>
            {/* Expenses - Level 1 Section Header */}
            <div className="mb-3">
              <h3 className="text-body font-bold text-foreground flex items-center gap-2">
                <NAV_ITEMS.expenses.icon size={18} className="text-foreground" />
                {t['guide.expenses_title'] || 'Expenses'}
              </h3>
              <p className="text-body text-foreground mt-1 ml-6">
                {t['guide.expenses_desc'] || 'Track household spending with categories and visual breakdowns.'}
              </p>
            </div>

            <FeatureCard
              icon={<FEATURE_ICONS.manualEntry size={14} />}
              title={t['expenses.manual_entry'] || 'Manual Entry'}
              description={
                t['guide.expenses_manual'] || 'Add expenses manually with amount, category, merchant, and date.'
              }
              t={t}
            />

            <FeatureCard
              icon={<FEATURE_ICONS.receiptScan size={14} />}
              title={t['guide.plan_receipt_scan'] || 'AI Receipt Scanning'}
              description={
                t['guide.expenses_scan'] || 'Scan receipts with AI to automatically extract total, merchant, and date.'
              }
              isPremium
              t={t}
            />

            <div className="border-t border-border my-4" />
          </>
        )}

        {/* Family - Level 1 Section Header */}
        <div className="mb-3">
          <h3 className="text-body font-bold text-foreground flex items-center gap-2">
            <NAV_ITEMS.info.icon size={18} className="text-foreground" />
            {t['guide.info_title'] || 'Family'}
          </h3>
          <p className="text-body text-foreground mt-1 ml-6">
            {t['guide.info_desc'] || 'Store important places, house routines, and manage helpers.'}
          </p>
        </div>

        <FeatureCard
          icon={<FEATURE_ICONS.places size={14} />}
          title={t['guide.places_title'] || 'Places'}
          description={
            t['guide.places_desc'] || 'Save important addresses like home, school, doctor, hospital, and shops.'
          }
          t={t}
        />

        <FeatureCard
          icon={<FEATURE_ICONS.routines size={14} />}
          title={t['guide.routines_title'] || 'Practice'}
          description={
            t['guide.routines_desc'] ||
            'Document house rules, schedules, cleaning instructions, and emergency procedures.'
          }
          t={t}
        />

        {!isHelper && !isChild && (
          <FeatureCard
            icon={<FEATURE_ICONS.helperManagement size={14} />}
            title={t['guide.helper_mgmt_title'] || 'Helper'}
            description={
              t['guide.helper_mgmt_desc'] ||
              'Track helper salary, holiday records, and generate payslips with digital signatures.'
            }
            isPremium
            t={t}
          />
        )}
      </AccordionSection>

      {/* Plan Comparison - Only show to Admin/Spouse */}
      {(isAdmin || isSpouse) && (
        <AccordionSection
          title={t['guide.your_plan'] || 'Subscription'}
          icon={<Crown size={20} />}
        >
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">
                    {t['guide.plan_feature'] || 'Feature'}
                  </th>
                  <th className="text-center py-2 px-2 font-semibold">
                    <DynamicText>{t['common.free'] || 'Free'}</DynamicText>
                  </th>
                  <th className="text-center py-2 px-2 font-semibold">
                    <DynamicText>{t['common.core'] || 'Core'}</DynamicText>
                  </th>
                  <th className="text-center py-2 px-2 font-semibold">
                    <DynamicText>{t['common.pro'] || 'Pro'}</DynamicText>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-2 text-foreground">
                    {t['guide.plan_family_members'] || 'Family Members'}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <DynamicText>{freePlan?.maxFamily || 3}</DynamicText>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <DynamicText>{corePlan?.maxFamily || 4}</DynamicText>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <DynamicText>{proPlan?.maxFamily || 8}</DynamicText>
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-2 text-foreground">{t['guide.plan_helpers'] || 'Helpers'}</td>
                  <td className="py-3 px-2 text-center">
                    <DynamicText>{freePlan?.maxHelpers || 1}</DynamicText>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <DynamicText>{corePlan?.maxHelpers || 1}</DynamicText>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <DynamicText>{proPlan?.maxHelpers || 4}</DynamicText>
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 px-2 text-foreground">
                    {t['guide.plan_receipt_scan'] || 'AI Receipt Scanning'}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <X size={16} className="text-muted-foreground mx-auto" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Check size={16} className="text-primary mx-auto" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Check size={16} className="text-primary mx-auto" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-2 text-foreground">
                    {t['guide.plan_helper_mgmt'] || 'Helper'}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <X size={16} className="text-muted-foreground mx-auto" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Check size={16} className="text-primary mx-auto" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Check size={16} className="text-primary mx-auto" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            onClick={onNavigateToPlan}
            className="w-full mt-4 py-3 bg-primary text-primary-foreground rounded-xl text-body font-semibold shadow-sm transition-colors"
          >
            {t['guide.plan_view_plans'] || 'View Plans'}
          </button>
        </AccordionSection>
      )}

      {/* Tips & Best Practices */}
      <AccordionSection
        title={t['guide.tips'] || 'Tips & Best Practices'}
        icon={<Lightbulb size={20} />}
      >
        <TipCard
          title={t['guide.tip_1_title'] || 'Assign to Helper by Default'}
          description={t['guide.tip_1_desc'] || 'When you add a task, it auto-assigns to your helper if you have one.'}
        />
        <TipCard
          title={t['guide.tip_2_title'] || 'Use Recurrence'}
          description={
            t['guide.tip_2_desc'] || 'Set daily, weekly, or monthly tasks to never forget routine chores.'
          }
        />
        <TipCard
          title={t['guide.tip_3_title'] || 'Pin Important Notes'}
          description={
            t['guide.tip_3_desc'] || 'The Family Board is visible to everyone - perfect for reminders.'
          }
        />
        <TipCard
          title={t['guide.tip_4_title'] || 'Plan Meals Ahead'}
          description={t['guide.tip_4_desc'] || 'Use Week View to batch-plan all meals for the week.'}
        />
        <TipCard
          title={t['guide.tip_5_title'] || 'Keep Places Updated'}
          description={
            t['guide.tip_5_desc'] || 'Helpers need quick access to school, doctor, and emergency info.'
          }
        />
      </AccordionSection>

      {/* Need Help Footer */}
      <button
        onClick={onNavigateToFeedback}
        className="w-full bg-card rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3 text-left"
      >
        <MessageCircleQuestionMark size={20} className="text-primary flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-title font-bold text-foreground">
            {t['guide.need_help'] || 'Need Help?'}
          </h3>
          <p className="text-body text-muted-foreground">
            {t['guide.feedback_cta'] || 'Have a question? Tap Feedback in Settings.'}
          </p>
        </div>
        <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
      </button>
    </div>
  );
};

export default UserGuide;


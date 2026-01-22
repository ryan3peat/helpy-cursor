"use client";

import { motion } from "framer-motion";

export default function PrivacyContent() {
  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-12">
            Last Updated: January 2026
          </p>

          {/* The Short Version */}
          <Section title="The Short Version">
            <p>
              We keep your family&apos;s data private and safe. We don&apos;t sell your personal 
              information to data brokers. We only collect what we need to make Helpy 
              work for you. We may show you relevant offers based on your shopping 
              habits to help keep Helpy affordable.
            </p>
          </Section>

          {/* What We Collect */}
          <Section title="What We Collect">
            <p className="mb-4">
              We collect the basics: your name, email, and whatever you add to Helpy 
              (tasks, meals, expenses, family profiles). If you&apos;re a helper, your 
              salary info is private - other helpers can&apos;t see it.
            </p>
            <p className="mb-2">This includes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information (name, email, phone number)</li>
              <li>Household data (family profiles, roles, allergies, preferences)</li>
              <li>App content (to-do items, meal plans, expenses, receipts)</li>
              <li>Helper employment data (contracts, salary slips) - restricted by role-based access</li>
              <li>Profile photos and receipt images stored in secure cloud storage</li>
              <li>Push notification tokens (required for notifications to work)</li>
            </ul>
          </Section>

          {/* How We Protect Your Data */}
          <Section title="How We Protect Your Data">
            <p className="mb-4">
              Your data is encrypted and locked to your household. Even we can&apos;t 
              casually browse through your family&apos;s shopping lists.
            </p>
            <p className="mb-2">Our security measures:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Encryption in Transit:</strong> All data uses TLS (same security as banks)</li>
              <li><strong>Encryption at Rest:</strong> Data stored with AES-256 encryption on Supabase infrastructure</li>
              <li><strong>Row Level Security:</strong> Database-level isolation ensures queries only return your household&apos;s data</li>
              <li><strong>Role-Based Access:</strong> Helpers can only see their own salary/contract information</li>
              <li><strong>Authentication:</strong> Handled by Clerk (SOC 2 Type II certified) - we never store your password</li>
            </ul>
          </Section>

          {/* Who Can See Your Data */}
          <Section title="Who Can See Your Data">
            <p className="mb-4">
              Only your household members can see your household&apos;s data. Nobody else - 
              not other Helpy users, not advertisers peeking at your account. Helpers 
              can only see their own pay info, not other helpers&apos;.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Household data is isolated via Row Level Security (RLS) policies enforced at the database level</li>
              <li>Helper salary/contract data has additional RLS: helpers see only their own records, Admin/Spouse roles see all</li>
              <li>Salary slip PDFs are generated locally on your device (never uploaded to our servers)</li>
              <li>Our support team can access data only for troubleshooting if you contact us</li>
            </ul>
          </Section>

          {/* Services We Use */}
          <Section title="Services We Use">
            <p className="mb-4">
              We use trusted companies to run Helpy - they handle things like login, 
              payments, and storing your data securely.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold">Service</th>
                    <th className="text-left py-2 pr-4 font-semibold">What It Does</th>
                    <th className="text-left py-2 font-semibold">Privacy Link</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Supabase</td>
                    <td className="py-2 pr-4">Stores your data</td>
                    <td className="py-2"><a href="https://supabase.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Clerk</td>
                    <td className="py-2 pr-4">Handles login</td>
                    <td className="py-2"><a href="https://clerk.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">clerk.com/privacy</a></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Stripe</td>
                    <td className="py-2 pr-4">Processes payments</td>
                    <td className="py-2"><a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Hosts the app</td>
                    <td className="py-2"><a href="https://vercel.com/legal/privacy-policy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Google Gemini</td>
                    <td className="py-2 pr-4">AI features (receipt scanning)</td>
                    <td className="py-2"><a href="https://ai.google.dev/terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">ai.google.dev/terms</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Sharing Your Data */}
          <Section title="Sharing Your Data">
            <p className="mb-4">
              We don&apos;t sell your personal information to data brokers. However, we may 
              use your shopping and task data to show you relevant suggestions and 
              partner offers within the app.
            </p>
            <p className="mb-4">
              For example, if you frequently buy a certain brand, we might show you 
              deals or recommendations for that brand. This helps us keep Helpy 
              affordable while making your experience more useful.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>We may analyze your shopping lists, tasks, and expenses to personalize your experience</li>
              <li>We may partner with vendors to show relevant offers based on your usage patterns</li>
              <li>These recommendations appear within Helpy - we don&apos;t share your raw data with advertisers</li>
              <li>We may share anonymized, aggregate data (like &quot;50% of users buy milk weekly&quot;) with partners</li>
              <li>Individual personal data (name, email, salary) is never sold to third parties</li>
              <li>We may disclose data if required by law or court order</li>
              <li>If Helpy is acquired, your data may transfer to the new owner (we&apos;d notify you)</li>
            </ul>
          </Section>

          {/* How Long We Keep Your Data */}
          <Section title="How Long We Keep Your Data">
            <p className="mb-4">
              Your data stays as long as you use Helpy. Delete your account, and it&apos;s 
              gone immediately - we don&apos;t hang onto it.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Active accounts:</strong> Data retained while account is active</li>
              <li><strong>Deleted accounts:</strong> Data removed immediately upon deletion</li>
              <li><strong>Push subscriptions:</strong> Inactive subscriptions auto-cleaned after 30 days</li>
              <li><strong>Employment records:</strong> May be retained as required by local labor/tax laws</li>
            </ul>
          </Section>

          {/* Your Choices */}
          <Section title="Your Choices">
            <p className="mb-4">
              You can update your info anytime in the app. Want out? Delete your 
              account and everything goes with it.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> View your data within the Helpy app</li>
              <li><strong>Correction:</strong> Update your profile information anytime</li>
              <li><strong>Deletion:</strong> Delete your account immediately (Settings → Delete Account)</li>
              <li><strong>Notifications:</strong> Toggle push notifications on/off in Profile settings</li>
            </ul>
            <p className="mt-4">
              Need a copy of all your data? Email us at{" "}
              <a href="mailto:hello@helpyfam.com" className="text-primary hover:underline">
                hello@helpyfam.com
              </a>
            </p>
          </Section>

          {/* Kids & Family */}
          <Section title="Kids & Family">
            <p className="mb-4">
              Parents add their kids to Helpy - we don&apos;t talk to kids directly or ask 
              for their age. Parents control everything.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not collect age or date of birth</li>
              <li>&quot;Child&quot; is a permission role, not age verification</li>
              <li>Parent/guardian manages all child profile data</li>
              <li>We don&apos;t market to or communicate directly with children</li>
              <li>If a child created an account independently, contact us to remove it</li>
            </ul>
          </Section>

          {/* What We Don't Do */}
          <Section title="What We Don't Do">
            <p className="mb-4">
              We don&apos;t sell your name, email, or salary information to anyone. We don&apos;t 
              let advertisers access your account. But we may use your shopping and 
              task patterns to show you helpful, relevant offers inside the app.
            </p>
            <p className="mb-2 font-medium">What we never do:</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Sell personal identity data (name, email, phone) to third parties</li>
              <li>Give advertisers direct access to your account or personal details</li>
              <li>Share helper salary/contract information</li>
              <li>Use third-party tracking pixels that follow you around the internet</li>
            </ul>
            <p className="mb-2 font-medium">What we may do:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Show you relevant product suggestions based on your shopping history</li>
              <li>Partner with brands to offer deals on products you actually use</li>
              <li>Display sponsored content in the app based on your household&apos;s preferences</li>
            </ul>
          </Section>

          {/* Changes to This Policy */}
          <Section title="Changes to This Policy">
            <p>
              If we change how we handle your data, we&apos;ll let you know in the app. 
              Continued use after changes constitutes acceptance.
            </p>
          </Section>

          {/* Questions */}
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Questions?</h2>
            <p>
              Email:{" "}
              <a href="mailto:hello@helpyfam.com" className="text-primary hover:underline">
                hello@helpyfam.com
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Reusable section component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-foreground mb-4">{title}</h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

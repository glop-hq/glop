export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 7, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">1. Information We Collect</h2>
          <p>
            When you use Glop, we collect information you provide directly, such as your name and email
            address when creating an account. We also collect data from your AI coding sessions, including
            prompts, tool calls, and session metadata, as part of the core functionality of the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">2. How We Use Your Information</h2>
          <p>
            We use your information to provide, maintain, and improve the Service. This includes displaying
            session data on your dashboard, enabling sharing with teammates, and generating insights about
            your team&apos;s AI coding workflows.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">3. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with third-party service providers
            who help us operate the Service, such as hosting and analytics providers. Session data is only
            visible to members of your workspace unless you explicitly share it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">4. Data Security</h2>
          <p>
            We take security seriously and use industry-standard measures to protect your information.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active or as needed to provide the Service.
            You may request deletion of your data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">6. Cookies</h2>
          <p>
            We use cookies and similar technologies to maintain your session and preferences.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">7. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            by posting a notice on the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">8. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at privacy@glop.dev.
          </p>
        </section>
      </div>
    </div>
  );
}

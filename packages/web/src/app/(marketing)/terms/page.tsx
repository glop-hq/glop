export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 7, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Glop (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">2. Description of Service</h2>
          <p>
            Glop provides a platform for teams to monitor, share, and learn from AI-assisted coding sessions.
            The Service includes a web application and a command-line tool.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account and any activity that occurs under it.
            You must provide accurate information when creating an account.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">4. Acceptable Use</h2>
          <p>
            You agree not to misuse the Service. This includes attempting to access it using a method other than
            the interface and instructions we provide, or using the Service to violate any law or regulation.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">5. Data and Content</h2>
          <p>
            You retain ownership of any data you submit to the Service. By using Glop, you grant us the right
            to process your data as needed to provide the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">6. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time, with or without cause.
            You may stop using the Service at any time.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">7. Disclaimer</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any kind, either express or implied.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">8. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes
            constitutes acceptance of the updated Terms.
          </p>
        </section>
      </div>
    </div>
  );
}

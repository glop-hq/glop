export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: March 7, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By using Glop (&quot;the Service&quot;), you agree to these Terms of Service.
            If you don&apos;t agree with them, please don&apos;t use the Service.
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
            When you create an account, please keep your credentials secure and provide accurate information.
            You&apos;re responsible for activity that happens under your account.
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
            Either of us can end this relationship at any time. You can stop using Glop whenever you like,
            and we may suspend or close accounts if needed.
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

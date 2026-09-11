export const metadata = {
  title: "Terms of Service — cain",
};

const LAST_UPDATED = "September 10, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-sat-night text-black dark:text-sat-frost">
      <div className="container mx-auto px-6 py-16 max-w-2xl">
        <p className="text-xs font-semibold tracking-wide uppercase text-black/40 dark:text-sat-mist mb-2">
          Draft, last updated {LAST_UPDATED}
        </p>
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Terms of Service</h1>

        <div className="space-y-6 text-black/75 dark:text-sat-mist leading-relaxed">
          <p>
            cain (cainsat.org) is a student-built educational project, not a company. It is not
            affiliated with or endorsed by College Board. SAT® is a trademark registered by
            College Board. Questions about these terms can go to <strong>[owner email]</strong>.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Educational use only</h2>
          <p>
            cain is a study tool for SAT preparation. It is provided for personal, educational
            use. Do not use it to cheat on an actual exam or to violate College Board&apos;s
            rules.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">No guarantee of results</h2>
          <p>
            Full-test scores shown by cain are estimates, worked out from College Board&apos;s
            own published conversion tables. The real SAT is adaptive, and your official score may
            differ. cain makes no guarantee about the score you will achieve on any exam.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">The service may change</h2>
          <p>
            cain is a small, evolving project. Features, content, and availability may change or
            stop at any time, with or without notice.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Acceptable use</h2>
          <p>
            Use cain honestly: don&apos;t attempt to disrupt the service, access another
            student&apos;s account or data, or misuse the sign-in system. Accounts found doing so
            may be suspended or deleted.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Your account</h2>
          <p>
            You are responsible for the Google account you sign in with. You can delete your cain
            account and all of its data at any time from the sidebar.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Governing law</h2>
          <p>These terms are governed by the laws of the State of Washington, USA.</p>

          <p className="text-sm text-black/45 dark:text-sat-mist/70 mt-10">
            This is a draft for the owner to review, not legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Privacy Policy — cain",
};

const LAST_UPDATED = "September 10, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-sat-night text-black dark:text-sat-frost">
      <div className="container mx-auto px-6 py-16 max-w-2xl">
        <p className="text-xs font-semibold tracking-wide uppercase text-black/40 dark:text-sat-mist mb-2">
          Last updated {LAST_UPDATED}
        </p>
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-black/75 dark:text-sat-mist leading-relaxed">
          <p>
            cain (cainsat.org) is a student-built project, not a company. If you have a question
            about this policy or your data, contact <strong>stas.grushetzky@gmail.com</strong>.
          </p>

          <p>
            cain is not affiliated with or endorsed by College Board. SAT® is a trademark
            registered by College Board.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">How you sign in</h2>
          <p>
            You sign in with Google only. cain receives your name, email address, and profile
            picture URL from Google and stores those three fields. cain does not store your
            Google password, and does not keep your Google access or refresh tokens.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">What else is stored</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Every lesson you complete</li>
            <li>Every practice and test answer you submit, along with the time it took you</li>
            <li>Your XP and streak records</li>
            <li>Your full-test scores</li>
            <li>Planner tasks and settings, if you use tasks.cainsat.org</li>
            <li>A push-notification subscription, if you turn on reminders</li>
          </ul>
          <p>
            cain does not collect your date of birth, grade, school, or location.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Where it is stored</h2>
          <p>
            The app runs on Vercel, in the United States. The database runs on Supabase, in the
            ca-central-1 region (Canada). Question content for the full test is fetched by
            cain&apos;s own server from College Board&apos;s public question bank; no information
            about you is sent to College Board.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">What it is used for</h2>
          <p>
            Your data is used only to run the app for you: to track your progress, score your
            tests, and remind you about planner tasks if you opt in. cain does not run
            advertising, does not sell or rent your data, and does not share it with anyone
            except the hosting providers named above. cain does not build a profile of you for
            anything beyond running these features.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Deleting your data</h2>
          <p>
            You can delete your account and everything tied to it at any time from the sidebar
            (Delete my account). You can also email <strong>stas.grushetzky@gmail.com</strong> to request
            deletion.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Age</h2>
          <p>
            cain is intended for high-school students. If you are under 13, you need a
            parent&apos;s permission before creating an account, and should not sign up without
            it.
          </p>

          <h2 className="text-xl font-display font-bold mt-8 mb-2">Security</h2>
          <p>
            cain is served over HTTPS, uses secure session cookies, and restricts database access
            to the app itself.
          </p>

          <p className="text-sm text-black/45 dark:text-sat-mist/70 mt-10">
            This is not legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}

// Public privacy policy page. Required by Google to publish the OAuth
// consent screen to production. Whitelisted in middleware.ts.
// Template: review the wording before publishing your own consent screen.
import { SITE } from "@/config/site";
import { APP_URL } from "@/lib/app-url";

// Read the contact address and URL at request time, not build time.
export const dynamic = "force-dynamic";

export const metadata = {
  title: `Privacy Policy | ${SITE.appName}`,
  description: `Privacy policy for ${SITE.appName}.`,
};

export default function PrivacyPage() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <div className="min-h-screen bg-[hsl(222,40%,8%)] px-4 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Privacy Policy</h1>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-white/70">
          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold text-white">What this app is</h2>
            <p>
              {SITE.appName} ({APP_URL}) is a private, single-user, self-hosted
              personal dashboard. It is not a public service. Sign-in is restricted to an allowlist of the owner&apos;s own Google
              accounts; no other users can access the app or its data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold text-white">Google user data</h2>
            <p>
              The app requests access to Google Calendar, Google Contacts, Google Sheets,
              and Google Drive (app-created files only) solely to display and manage the
              owner&apos;s own data inside the dashboard: showing and editing calendar
              events, autocompleting contacts, exporting backups to Sheets, and saving
              backup files to Drive.
            </p>
            <p className="mt-3">
              Google data is fetched on demand and displayed to the authenticated owner.
              OAuth tokens are stored server-side and used only to make these requests.
              No Google user data is sold, shared with third parties, transferred to
              advertisers, or used for any purpose other than the features above.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold text-white">Data storage and retention</h2>
            <p>
              All application data lives in a private database on a server controlled by
              the owner. Data is retained until the owner deletes it. Access to Google
              data can be revoked at any time at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-blue-400 underline underline-offset-2"
              >
                myaccount.google.com/permissions
              </a>
              , which immediately invalidates the app&apos;s tokens.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-lg font-semibold text-white">Contact</h2>
            <p>
              Questions about this policy: {contact ?? "contact the operator of this instance"}
            </p>
          </section>
        </div>

      </div>
    </div>
  );
}

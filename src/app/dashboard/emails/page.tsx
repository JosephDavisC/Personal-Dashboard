import { EmailHistory } from "@/components/emails/EmailHistory";

export default function EmailsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Emails
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          History of emails sent by the dashboard
        </p>
      </div>

      <EmailHistory />
    </div>
  );
}

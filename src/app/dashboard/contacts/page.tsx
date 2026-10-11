import { ContactsTracker } from "@/components/contacts/ContactsTracker";

export default function ContactsPage() {
  return (
    <div className="min-w-0 animate-page-fade-in space-y-6 overflow-hidden">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Contacts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your networking database synced from Google Contacts
        </p>
      </div>
      <ContactsTracker />
    </div>
  );
}

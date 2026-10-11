import { Mail, Phone, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShiftTracker } from "@/components/shifts/ShiftTracker";
import { SHIFT_CONTACTS } from "@/config/shifts";

export default function ShiftsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Shifts</h1>
      <ShiftTracker />

      {SHIFT_CONTACTS.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              Supervisor Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {SHIFT_CONTACTS.map((c) => (
                <div
                  key={c.email}
                  className="rounded-lg border border-border/50 bg-background/50 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <a
                    href={`mailto:${c.email}`}
                    className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </a>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Phone className="h-3 w-3" />
                      {c.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

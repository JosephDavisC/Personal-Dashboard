import { auth } from "@/lib/auth";

const PEOPLE_API = "https://people.googleapis.com/v1";

interface PersonResource {
  resourceName: string;
  emailAddresses?: { value: string }[];
  names?: { displayName: string }[];
  phoneNumbers?: { value: string }[];
  organizations?: { name?: string; title?: string }[];
}

async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (session?.error) {
    throw new Error("Google token expired. Please re-login.");
  }
  if (!session?.accessToken) {
    throw new Error("No access token available. Please re-login.");
  }
  return session.accessToken;
}

/** Search both saved contacts and "Other Contacts" (Gmail auto-saved) in parallel. */
export async function searchContacts(
  query: string
): Promise<{ email: string; name?: string }[]> {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const params = new URLSearchParams({
    query,
    readMask: "names,emailAddresses",
    pageSize: "20",
  });

  function parseResults(data: { results?: { person: PersonResource }[] }) {
    return (data.results ?? [])
      .map((r) => ({
        email: r.person.emailAddresses?.[0]?.value ?? "",
        name: r.person.names?.[0]?.displayName,
      }))
      .filter((c) => c.email);
  }

  // Search saved contacts + other contacts in parallel
  const [savedRes, otherRes] = await Promise.all([
    fetch(`${PEOPLE_API}/people:searchContacts?${params.toString()}`, { headers })
      .then(async (r) => r.ok ? parseResults(await r.json() as { results?: { person: PersonResource }[] }) : [])
      .catch(() => [] as { email: string; name?: string }[]),
    fetch(`${PEOPLE_API}/otherContacts:search?${params.toString()}`, { headers })
      .then(async (r) => r.ok ? parseResults(await r.json() as { results?: { person: PersonResource }[] }) : [])
      .catch(() => [] as { email: string; name?: string }[]),
  ]);

  // Merge and deduplicate by email
  const seen = new Set<string>();
  const merged: { email: string; name?: string }[] = [];
  for (const c of [...savedRes, ...otherRes]) {
    const key = c.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  return merged;
}

export interface GoogleContact {
  resourceName: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
}

/** Fetch all saved contacts from Google People API (paginated). Requires contacts.readonly scope. */
export async function listAllContacts(): Promise<GoogleContact[]> {
  const token = await getAccessToken();
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: "names,emailAddresses,phoneNumbers,organizations",
      pageSize: "1000",
      sortOrder: "FIRST_NAME_ASCENDING",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `${PEOPLE_API}/people/me/connections?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.status === 403) {
      throw new Error("Contacts scope not granted. Please re-login and grant Contacts permission.");
    }

    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      throw new Error(
        body.error?.message ?? `Contacts API error: ${res.status}`
      );
    }

    const data = (await res.json()) as {
      connections?: PersonResource[];
      nextPageToken?: string;
    };

    for (const p of data.connections ?? []) {
      const name = p.names?.[0]?.displayName;
      if (!name) continue;

      contacts.push({
        resourceName: p.resourceName,
        name,
        email: p.emailAddresses?.[0]?.value,
        phone: p.phoneNumbers?.[0]?.value,
        company: p.organizations?.[0]?.name ?? undefined,
        title: p.organizations?.[0]?.title ?? undefined,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return contacts;
}

/** Fetch "Other Contacts" — auto-saved from Gmail interactions. Requires contacts.other.readonly or contacts.readonly scope. */
export async function listOtherContacts(): Promise<GoogleContact[]> {
  const token = await getAccessToken();
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    // otherContacts only supports: names, emailAddresses, phoneNumbers, metadata, photos
    // (NOT organizations — that causes 400)
    const params = new URLSearchParams({
      readMask: "names,emailAddresses,phoneNumbers",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `${PEOPLE_API}/otherContacts?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.status === 403) {
      throw new Error("Other Contacts scope not granted. Please re-login and grant Contacts permission.");
    }

    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      throw new Error(
        body.error?.message ?? `Other Contacts API error: ${res.status}`
      );
    }

    const data = (await res.json()) as {
      otherContacts?: PersonResource[];
      nextPageToken?: string;
    };

    for (const p of data.otherContacts ?? []) {
      const name = p.names?.[0]?.displayName;
      const email = p.emailAddresses?.[0]?.value;
      // Other contacts often have just an email and no name
      if (!name && !email) continue;

      contacts.push({
        resourceName: p.resourceName,
        name: name ?? email ?? "",
        email,
        phone: p.phoneNumbers?.[0]?.value,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return contacts;
}

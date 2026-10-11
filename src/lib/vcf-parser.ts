/**
 * VCF/vCard parser for Apple Contacts import.
 * Handles vCard 2.1, 3.0, and 4.0 formats exported by Apple Contacts.
 */

export interface ParsedVCard {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
}

/** Unfold continuation lines (RFC 6350 §3.2) */
function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

/** Decode quoted-printable encoded values */
function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/** Extract the value from a vCard property line, handling encoding */
function extractValue(line: string): string {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return "";

  const params = line.slice(0, colonIdx).toUpperCase();
  let value = line.slice(colonIdx + 1).trim();

  if (params.includes("ENCODING=QUOTED-PRINTABLE")) {
    value = decodeQuotedPrintable(value);
  }

  return value;
}

/** Get the property name (before params) from a line */
function getProperty(line: string): string {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return "";
  const propWithParams = line.slice(0, colonIdx);
  // Property name is before the first ; or .
  const semiIdx = propWithParams.indexOf(";");
  const dotIdx = propWithParams.indexOf(".");
  let name = propWithParams;
  if (semiIdx !== -1) name = propWithParams.slice(0, semiIdx);
  // Handle group prefix like item1.TEL
  if (dotIdx !== -1 && (semiIdx === -1 || dotIdx < semiIdx)) {
    name = propWithParams.slice(dotIdx + 1, semiIdx !== -1 ? semiIdx : undefined);
  }
  return name.toUpperCase().trim();
}

/** Parse a single vCard block into a ParsedVCard */
function parseCard(block: string): ParsedVCard | null {
  const lines = unfold(block).split(/\r?\n/);

  let name = "";
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  let title: string | null = null;
  let notes: string | null = null;

  for (const line of lines) {
    const prop = getProperty(line);
    const value = extractValue(line);

    if (!value) continue;

    switch (prop) {
      case "FN":
        name = value;
        break;

      case "N":
        // N:LastName;FirstName;MiddleName;Prefix;Suffix
        if (!name) {
          const parts = value.split(";");
          const first = parts[1]?.trim() ?? "";
          const last = parts[0]?.trim() ?? "";
          name = [first, last].filter(Boolean).join(" ");
        }
        break;

      case "EMAIL":
        if (!email) email = value;
        break;

      case "TEL":
        if (!phone) phone = value;
        break;

      case "ORG":
        // ORG:CompanyName;Department
        if (!company) company = value.split(";")[0]?.trim() ?? null;
        break;

      case "TITLE":
        if (!title) title = value;
        break;

      case "NOTE":
        if (!notes) notes = value.replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
        break;
    }
  }

  if (!name) return null;

  return { name, email, phone, company, title, notes };
}

/** Parse a VCF file string into an array of contacts */
export function parseVCF(text: string): ParsedVCard[] {
  const contacts: ParsedVCard[] = [];
  // Split into individual vCard blocks
  const blocks = text.split(/BEGIN:VCARD/i).slice(1);

  for (const block of blocks) {
    const endIdx = block.toUpperCase().indexOf("END:VCARD");
    const cardText = endIdx !== -1 ? block.slice(0, endIdx) : block;
    const card = parseCard(cardText);
    if (card) contacts.push(card);
  }

  return contacts;
}

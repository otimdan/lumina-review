import type { ParsedRef, ParseFormat } from "@/types";

// ─── Normalise a raw parsed object into ParsedRef ────────────────────────────
function normalise(raw: Record<string, unknown>): ParsedRef {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]).filter(Boolean) : [];

  return {
    title:     str(raw.title),
    authors:   arr(raw.authors),
    abstract:  str(raw.abstract),
    journal:   str(raw.journal),
    year:      str(raw.year),
    volume:    str(raw.volume),
    issue:     str(raw.issue),
    pages:     str(raw.pages) || `${str(raw.startPage)}${raw.endPage ? "-" + str(raw.endPage) : ""}`,
    doi:       str(raw.doi).replace(/^https?:\/\/doi\.org\//i, "").replace(/^doi:\s*/i, ""),
    pmid:      str(raw.pmid),
    issn:      str(raw.issn),
    publisher: str(raw.publisher),
    keywords:  arr(raw.keywords),
    url:       str(raw.url),
    raw,
  };
}

// ─── RIS Parser ──────────────────────────────────────────────────────────────
export function parseRIS(text: string): ParsedRef[] {
  const records: ParsedRef[] = [];
  let cur: Record<string, unknown> | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const tag = rawLine.slice(0, 2).trim();
    const val = rawLine.slice(6).trim();

    if (tag === "TY") {
      cur = { type: val, authors: [], keywords: [] };
      continue;
    }
    if (!cur) continue;

    if (tag === "ER") {
      if (cur.title) records.push(normalise(cur));
      cur = null;
      continue;
    }

    const authors = cur.authors as string[];
    const keywords = cur.keywords as string[];

    if (tag === "AU" || tag === "A1" || tag === "A2") authors.push(val);
    else if (tag === "TI" || tag === "T1") cur.title = cur.title || val;
    else if (tag === "AB" || tag === "N2") cur.abstract = ((cur.abstract as string) || "") + val + " ";
    else if (tag === "JO" || tag === "JF" || tag === "J2" || tag === "T2") cur.journal = cur.journal || val;
    else if (tag === "PY" || tag === "Y1") cur.year = val.split("/")[0].trim();
    else if (tag === "VL") cur.volume = val;
    else if (tag === "IS") cur.issue = val;
    else if (tag === "SP") cur.startPage = val;
    else if (tag === "EP") cur.endPage = val;
    else if (tag === "DO") { if (val.includes("10.")) cur.doi = val; }
    else if (tag === "M3") { if (val.includes("10.")) cur.doi = cur.doi || val; }
    else if (tag === "SN") cur.issn = val;
    else if (tag === "KW") keywords.push(val);
    else if (tag === "PB") cur.publisher = val;
    else if (tag === "UR") cur.url = val;
    else if (tag === "AN") cur.accession = val;
  }

  return records;
}

// ─── PubMed / MEDLINE Parser ─────────────────────────────────────────────────
export function parsePubMed(text: string): ParsedRef[] {
  const records: ParsedRef[] = [];
  let cur: Record<string, unknown> | null = null;
  let lastTag = "";

  for (const rawLine of text.split(/\r?\n/)) {
    // Continuation lines start with 6 spaces
    if (rawLine.startsWith("      ") && cur && lastTag) {
      const cont = rawLine.trim();
      if (lastTag === "TI") cur.title = ((cur.title as string) || "") + " " + cont;
      else if (lastTag === "AB") cur.abstract = ((cur.abstract as string) || "") + " " + cont;
      continue;
    }

    const tag = rawLine.slice(0, 4).trim();
    const val = rawLine.slice(6).trim();
    if (!val && !tag) continue;

    if (tag === "PMID") {
      if (cur?.title) records.push(normalise(cur));
      cur = { pmid: val, authors: [], keywords: [] };
      lastTag = tag;
      continue;
    }
    if (!cur) continue;
    lastTag = tag;

    const authors = cur.authors as string[];
    const keywords = cur.keywords as string[];

    if (tag === "TI") cur.title = val;
    else if (tag === "AB") cur.abstract = val;
    else if (tag === "FAU") authors.unshift(val); // Full author name preferred
    else if (tag === "AU" && !(cur.authors as string[]).length) authors.push(val);
    else if (tag === "JT") cur.journal = val;
    else if (tag === "TA") cur.journalAbr = val;
    else if (tag === "DP") cur.year = val.split(" ")[0];
    else if (tag === "VI") cur.volume = val;
    else if (tag === "IP") cur.issue = val;
    else if (tag === "PG") cur.pages = val;
    else if (tag === "AID" || tag === "LID") {
      if (val.includes("[doi]")) cur.doi = val.replace(/\s*\[doi\]/, "").trim();
    }
    else if (tag === "MH" || tag === "OT") keywords.push(val);
    else if (tag === "IS") cur.issn = cur.issn || val;
    else if (tag === "AB") cur.abstract = val;
  }

  if (cur?.title) records.push(normalise(cur));
  return records;
}

// ─── EndNote XML Parser ───────────────────────────────────────────────────────
export function parseEndNoteXML(text: string): ParsedRef[] {
  // Use fast-xml-parser when available, fall back to DOMParser (browser) or regex
  try {
    const { XMLParser } = require("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false, isArray: (name: string) =>
      ["record","author","keyword"].includes(name)
    });
    const result = parser.parse(text);
    const records = result?.xml?.records?.record || result?.records?.record || [];

    return (Array.isArray(records) ? records : [records]).map((r: Record<string, unknown>) => {
      const textOf = (obj: unknown): string => {
        if (!obj) return "";
        if (typeof obj === "string") return obj;
        const o = obj as Record<string, unknown>;
        return String(o["style"] || o["#text"] || Object.values(o)[0] || "");
      };

      const titles   = (r["titles"] as Record<string, unknown>) || {};
      const contribs = (r["contributors"] as Record<string, unknown>) || {};
      const dates    = (r["dates"] as Record<string, unknown>) || {};
      const authorsRaw = ((contribs["authors"] as Record<string, unknown>)?.["author"]) || [];
      const authors  = (Array.isArray(authorsRaw) ? authorsRaw : [authorsRaw]).map(textOf);
      const keywords = ((r["keywords"] as Record<string, unknown>)?.["keyword"]) as unknown[] || [];

      return normalise({
        title:     textOf(titles["title"]) || textOf(titles["secondary-title"]),
        authors,
        abstract:  textOf((r["abstract"] as Record<string, unknown>)?.["style"] ? r["abstract"] : { text: r["abstract"] }),
        journal:   textOf((r["periodical"] as Record<string, unknown>)?.["full-title"]) || textOf(titles["secondary-title"]),
        year:      textOf((dates["year"] as unknown)),
        volume:    textOf(r["volume"] as unknown),
        issue:     textOf(r["number"] as unknown),
        pages:     textOf(r["pages"] as unknown),
        doi:       textOf(r["electronic-resource-num"] as unknown),
        publisher: textOf(r["publisher"] as unknown),
        keywords:  (Array.isArray(keywords) ? keywords : [keywords]).map(textOf),
      });
    }).filter((r: ParsedRef) => r.title);
  } catch {
    // If fast-xml-parser not available, basic regex fallback
    return parseEndNoteXMLFallback(text);
  }
}

function parseEndNoteXMLFallback(text: string): ParsedRef[] {
  const records: ParsedRef[] = [];
  const recordRegex = /<record>([\s\S]*?)<\/record>/gi;
  let match;
  while ((match = recordRegex.exec(text)) !== null) {
    const body = match[1];
    const get = (tag: string) => {
      const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i"));
      return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
    };
    const getAll = (tag: string) => {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "gi");
      const results: string[] = [];
      let m2;
      while ((m2 = re.exec(body)) !== null) {
        results.push(m2[1].replace(/<[^>]+>/g, "").trim());
      }
      return results;
    };
    const title = get("title");
    if (!title) continue;
    records.push(normalise({
      title,
      authors: getAll("author"),
      abstract: get("abstract"),
      journal: get("full-title") || get("secondary-title"),
      year: get("year"),
      volume: get("volume"),
      issue: get("number"),
      pages: get("pages"),
      doi: get("electronic-resource-num"),
      publisher: get("publisher"),
      keywords: getAll("keyword"),
    }));
  }
  return records;
}

// ─── Format detection ─────────────────────────────────────────────────────────
export function detectFormat(fileName: string, text: string): ParseFormat {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "xml" || ext === "enx") return "endnote_xml";
  if (ext === "nbib") return "pubmed";
  if (text.includes("PMID-") || text.includes("PMID- ")) return "pubmed";
  if (text.trimStart().startsWith("<")) return "endnote_xml";
  return "ris";
}

// ─── Master parse function ────────────────────────────────────────────────────
export function parseFile(fileName: string, text: string): { refs: ParsedRef[]; format: ParseFormat } {
  const format = detectFormat(fileName, text);
  let refs: ParsedRef[] = [];

  if (format === "pubmed") refs = parsePubMed(text);
  else if (format === "endnote_xml") refs = parseEndNoteXML(text);
  else refs = parseRIS(text);

  return { refs: refs.filter(r => r.title.length > 0), format };
}

// ─── Deduplication ────────────────────────────────────────────────────────────
export function deduplicate(
  existing: Array<{ doi?: string | null; pmid?: string | null; title: string }>,
  incoming: ParsedRef[]
): { unique: ParsedRef[]; duplicates: ParsedRef[] } {
  const doisSeen = new Set(existing.map(r => r.doi).filter(Boolean) as string[]);
  const pmidsSeen = new Set(existing.map(r => r.pmid).filter(Boolean) as string[]);
  const titlesSeen = new Set(existing.map(r => r.title.toLowerCase().slice(0, 80)));

  const unique: ParsedRef[] = [];
  const duplicates: ParsedRef[] = [];
  const doisNew = new Set<string>();
  const pmidsNew = new Set<string>();
  const titlesNew = new Set<string>();

  for (const ref of incoming) {
    const tkey = ref.title.toLowerCase().slice(0, 80);
    const isDup =
      (ref.doi  && (doisSeen.has(ref.doi)  || doisNew.has(ref.doi)))  ||
      (ref.pmid && (pmidsSeen.has(ref.pmid) || pmidsNew.has(ref.pmid))) ||
      (tkey     && (titlesSeen.has(tkey)   || titlesNew.has(tkey)));

    if (isDup) {
      duplicates.push(ref);
    } else {
      unique.push(ref);
      if (ref.doi)  doisNew.add(ref.doi);
      if (ref.pmid) pmidsNew.add(ref.pmid);
      if (tkey)     titlesNew.add(tkey);
    }
  }

  return { unique, duplicates };
}

// ─── Citation string builder ──────────────────────────────────────────────────
export function buildCitation(ref: ParsedRef): string {
  let c = "";
  if (ref.journal) c += ref.journal;
  if (ref.year) c += (c ? " " : "") + ref.year;
  if (ref.volume) c += ";" + ref.volume;
  if (ref.issue) c += "(" + ref.issue + ")";
  if (ref.pages) c += ":" + ref.pages;
  return c;
}

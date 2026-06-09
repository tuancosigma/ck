import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Turns short task notes into a polished timesheet description. Uses Gemini when
// GEMINI_API_KEY is configured, otherwise a deterministic local rules engine.

const PROMPT = (input: string) =>
  `You are a professional software engineer. Rewrite the following brief task notes into a polished, professional timesheet description (keep it concise, professional, active voice): "${input}"`;

// Keyword → verb-phrase map for the local fallback.
const KEYWORD_MAP: [RegExp, string][] = [
  [/\bfix(ed|ing)?\b/i, "Resolved issues on"],
  [/\bbug(s)?\b/i, "Resolved a defect in"],
  [/\b(?:meeting|sync|standup|call)\b/i, "Participated in team sync regarding"],
  [/\breview(ed|ing)?\b/i, "Reviewed"],
  [/\bimplement(ed|ing)?\b/i, "Implemented"],
  [/\bdevelop(ed|ing|ment)?\b/i, "Developed"],
  [/\btest(ed|ing|s)?\b/i, "Tested"],
  [/\bdeploy(ed|ment)?\b/i, "Deployed"],
  [/\brefactor(ed|ing)?\b/i, "Refactored"],
  [/\bdoc(s|umentation)?\b/i, "Documented"],
  [/\bdesign(ed|ing)?\b/i, "Designed"],
  [/\bsupport\b/i, "Provided support for"],
];

function localRewrite(input: string): string {
  const parts = input
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences = parts.map((part) => {
    for (const [re, verb] of KEYWORD_MAP) {
      if (re.test(part)) {
        // Strip the matched keyword to use the remainder as the object.
        const rest = part.replace(re, "").replace(/\s+/g, " ").trim();
        const object = rest || "assigned tasks";
        return `${verb} ${object}`;
      }
    }
    // No keyword match: capitalise and prefix with a neutral verb.
    return `Worked on ${part}`;
  });

  // Capitalise first letter of each sentence and join.
  const text = sentences
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(". ");
  return text.endsWith(".") ? text : `${text}.`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { input } = await req.json().catch(() => ({ input: "" }));
  const trimmed = String(input ?? "").trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: "Please enter a few words to expand." },
      { status: 400 }
    );
  }

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(PROMPT(trimmed));
      const text = result.response.text().trim();
      if (text) return NextResponse.json({ text, source: "ai" });
    } catch (e) {
      console.error("Gemini suggest-worklog failed, using local fallback:", e);
    }
  }

  return NextResponse.json({ text: localRewrite(trimmed), source: "local" });
}

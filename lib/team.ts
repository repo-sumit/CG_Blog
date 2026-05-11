// Team metadata — designation, POD/team, and topic interests for each
// approved editor. Keyed by lowercase email. Edit this file when someone
// changes role or joins/leaves.
//
// Why a code map and not a DB column: these strings change rarely and the
// people who write posts are the same five teammates. Keeping it in code
// means no migration is needed to update titles, and authors can't edit
// each other's bylines.

export interface TeamMember {
  designation: string;
  pod: string;
  topics: string[];
}

export const TEAM_META: Record<string, TeamMember> = {
  "sumit.kumar@convegenius.ai": {
    designation: "Product Associate",
    pod: "HP Higher ED",
    topics: ["Product", "AI", "Launch"],
  },
  "aditya.c@convegenius.ai": {
    designation: "Product Manager",
    pod: "ConveGenius AI",
    topics: ["Product", "Experiment", "Engineering"],
  },
  "om.kumar@convegenius.ai": {
    designation: "Engineering",
    pod: "Platform",
    topics: ["Engineering", "Sprint Update"],
  },
  "insha.naseem@convegenius.ai": {
    designation: "Design",
    pod: "Brand",
    topics: ["Design", "Research"],
  },
  "aryan.singh@convegenius.ai": {
    designation: "Engineering",
    pod: "Platform",
    topics: ["Engineering", "QA"],
  },
};

export function teamMetaFor(email: string | null | undefined): TeamMember | null {
  if (!email) return null;
  return TEAM_META[email.toLowerCase()] ?? null;
}

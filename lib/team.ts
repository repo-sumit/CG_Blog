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
  /**
   * Position in every public/admin list of teammates. Lower = earlier.
   * This is the single source of truth — `lib/db/public.ts` and
   * `lib/db/profiles.ts` both sort their results by this number so the
   * order is identical across the landing's Contributors grid, the
   * dashboard's team panel, and the admin schedule view. Edit the
   * numbers below to re-order; never inline a different order anywhere
   * else.
   */
  displayOrder: number;
}

export const TEAM_META: Record<string, TeamMember> = {
  "aditya.c@convegenius.ai": {
    designation: "Senior Product Manager",
    pod: "Product",
    topics: ["Product", "Launch", "Experiment"],
    displayOrder: 1,
  },
  "sumit.kumar@convegenius.ai": {
    designation: "Product Associate",
    pod: "HP Higher ED",
    topics: ["Product", "AI", "Launch"],
    displayOrder: 2,
  },
  "om.kumar@convegenius.ai": {
    designation: "Senior UI/UX Designer",
    pod: "Design",
    topics: ["Design", "Product", "Research"],
    displayOrder: 3,
  },
  "insha.naseem@convegenius.ai": {
    designation: "Design Intern",
    pod: "Design",
    topics: ["Design", "Research"],
    displayOrder: 4,
  },
  "aryan.singh@convegenius.ai": {
    designation: "Product Intern",
    pod: "Product",
    topics: ["Product", "Research"],
    displayOrder: 5,
  },
};

export function teamMetaFor(email: string | null | undefined): TeamMember | null {
  if (!email) return null;
  return TEAM_META[email.toLowerCase()] ?? null;
}

/**
 * Returns the `displayOrder` for a teammate's email, or a large sentinel
 * (so unknown emails sort to the end while still preserving secondary
 * sorts like full_name). Always pair this with a tie-break by name so
 * unknown teammates have a stable order amongst themselves.
 */
export function teamDisplayOrderFor(email: string | null | undefined): number {
  const meta = teamMetaFor(email);
  return meta?.displayOrder ?? Number.MAX_SAFE_INTEGER;
}

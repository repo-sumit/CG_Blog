// Default weekly post template (Tiptap JSON).
export const WEEKLY_TEMPLATE = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Focus of the Week" }] },
    { type: "paragraph", content: [{ type: "text", text: "What was your main focus?" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Key Work Completed" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph" }] },
        { type: "listItem", content: [{ type: "paragraph" }] },
        { type: "listItem", content: [{ type: "paragraph" }] },
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Impact / Outcome" }] },
    { type: "paragraph", content: [{ type: "text", text: "What changed because of this work?" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Learnings" }] },
    { type: "paragraph", content: [{ type: "text", text: "What did you learn?" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Blockers / Risks" }] },
    { type: "paragraph", content: [{ type: "text", text: "Any blockers that need manager/team attention?" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan for Next Week" }] },
    { type: "paragraph", content: [{ type: "text", text: "What will you work on next?" }] },
  ],
};

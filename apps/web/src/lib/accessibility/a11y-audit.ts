export type A11yChecklistItem = {
  id: string;
  label: string;
};

export const a11yChecklist: A11yChecklistItem[] = [
  { id: "landmark-main", label: "Main landmark is present" },
  { id: "focus-visible", label: "Interactive elements expose visible focus state" },
  { id: "labels", label: "Forms and controls have accessible labels" },
  { id: "contrast", label: "Critical text and state colors stay readable" },
  { id: "responsive-375-768-1440", label: "Layouts hold at 375px, 768px, and 1440px" },
];

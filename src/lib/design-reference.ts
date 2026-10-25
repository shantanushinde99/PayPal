export const DESIGN_ITEM = "Homepage matches the reference design (layout, colours, main sections)";

export const withDesignItem = (requirements: string[]) =>
  requirements.includes(DESIGN_ITEM) ? requirements : [...requirements, DESIGN_ITEM];

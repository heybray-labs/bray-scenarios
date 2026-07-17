export type ScenarioClassificationRef = {
  slug?: string;
  label: string;
  color: string;
  icon: string;
};

export type ScenarioClassifications = {
  category?: ScenarioClassificationRef | null;
  audienceLevel?: ScenarioClassificationRef | null;
  duration?: ScenarioClassificationRef | null;
  tags?: ScenarioClassificationRef[];
};

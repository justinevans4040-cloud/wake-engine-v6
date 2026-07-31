export const UNIVERSAL_CONTENT_FIXTURES = Object.freeze([
  {
    id: "restaurant",
    label: "restaurant",
    source: "A family taco shop is launching a late-night birria menu with house consommé, student pricing, and weekend hours.",
    expectedTerms: ["taco", "birria", "late-night"],
    forbiddenTerms: ["Wake Engine", "Aurora Storytime"]
  },
  {
    id: "fitness-coach",
    label: "fitness coach",
    source: "A fitness coach helps busy nurses build 20-minute strength workouts around rotating shifts and limited recovery time.",
    expectedTerms: ["nurses", "strength", "20-minute"],
    forbiddenTerms: ["Wake Engine", "Aurora Storytime"]
  },
  {
    id: "saas-product",
    label: "saas product",
    source: "A SaaS product helps small clinics reduce missed appointments with SMS reminders, calendar sync, and simple staff dashboards.",
    expectedTerms: ["clinics", "appointments", "SMS"],
    forbiddenTerms: ["Wake Engine", "Aurora Storytime"]
  },
  {
    id: "construction-company",
    label: "construction company",
    source: "A construction company specializes in storm-resistant roof replacements with transparent estimates and photo-documented progress.",
    expectedTerms: ["roof", "storm-resistant", "estimates"],
    forbiddenTerms: ["Wake Engine", "Aurora Storytime"]
  },
  {
    id: "childrens-book",
    label: "children's book",
    source: "A children's book follows a shy dragon learning to ask for help while protecting a tiny mountain garden.",
    expectedTerms: ["dragon", "ask for help", "garden"],
    forbiddenTerms: ["Wake Engine", "Aurora Storytime"]
  },
  {
    id: "local-service",
    label: "local service",
    source: "A mobile dog groomer offers quiet one-on-one appointments for anxious senior pets in suburban neighborhoods.",
    expectedTerms: ["groomer", "senior pets", "one-on-one"],
    forbiddenTerms: ["Wake Engine", "Aurora Storytime"]
  }
]);

export const WAKE_CONTENT_FIXTURE = Object.freeze({
  id: "wake-engine",
  label: "Wake Engine",
  source: "Wake Engine turns approved source material into evidence-mapped campaigns using Tier Zero content agents, local tools, A2A handoffs, QA gates, and export manifests.",
  expectedTerms: ["Wake Engine", "Tier Zero", "A2A"],
  forbiddenTerms: ["Aurora Storytime"]
});

export const AURORA_CONTENT_FIXTURE = Object.freeze({
  id: "aurora-storytime",
  label: "Aurora Storytime",
  source: "Aurora Storytime follows Aurora through the Land of Dreams. Its anchor phrase is: You are Aurora. And that is enough. The audience is children ages three to seven and their parents or educators.",
  expectedTerms: ["Aurora Storytime", "Land of Dreams", "You are Aurora"],
  forbiddenTerms: ["Wake Engine", "bakery"]
});

export const WEAK_SOURCE_FIXTURE = Object.freeze({
  id: "weak-source",
  label: "weak source",
  source: "Make this amazing.",
  expectedStatus: "not enough source"
});

export const PHASE8_CONTENT_FIXTURES = Object.freeze([
  ...UNIVERSAL_CONTENT_FIXTURES,
  WAKE_CONTENT_FIXTURE,
  AURORA_CONTENT_FIXTURE,
  WEAK_SOURCE_FIXTURE
]);

import { db, pool } from "../db.ts";
import { tenants } from "../../shared/schemas/tenants.ts";
import { users } from "../../shared/schemas/users.ts";
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
} from "../../shared/schemas/roleplay-core.ts";
import { eq } from "drizzle-orm";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("seed-roleplays");

const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || "default";

const SEED_SCENARIOS = [
  {
    title: "Handling an Angry Customer",
    category: "Customer Service",
    tags: ["de-escalation", "empathy", "retail"],
    learnerRole: "Store Manager",
    situationContext:
      "A customer is furious about a defective product they bought last week. They want a full refund and compensation for their wasted time.",
    learnerObjective: "De-escalate the situation, acknowledge their frustration, and reach a fair resolution.",
    introduction: "You've just been called to the customer service desk. A visibly upset customer is waiting.",
    persona: {
      name: "Marcus Chen",
      roleTitle: "Frustrated Customer",
      personalityTraits: "impatient, detail-oriented, skeptical",
      mood: "angry",
      difficulty: "medium",
      backgroundFacts: "Purchased a blender that stopped working after two uses. Has the receipt and original packaging.",
      hiddenObjective: "Wants to feel heard and respected before accepting any offer.",
      openingStyle: "confrontational",
    },
    criteria: [
      { name: "Empathy", description: "Acknowledges the customer's feelings without being defensive." },
      { name: "Problem Solving", description: "Offers practical solutions within policy." },
      { name: "Professionalism", description: "Maintains calm tone and respectful language throughout." },
    ],
    published: true,
  },
  {
    title: "Negotiating a Raise",
    category: "Leadership",
    tags: ["negotiation", "career", "self-advocacy"],
    learnerRole: "Senior Software Engineer",
    situationContext:
      "You've exceeded expectations for two years. Your manager scheduled a 1:1 that may include compensation discussion.",
    learnerObjective: "Present your case confidently and negotiate a meaningful raise without damaging the relationship.",
    introduction: "Your manager Alex has asked to meet about your performance and career growth.",
    persona: {
      name: "Alex Rivera",
      roleTitle: "Engineering Manager",
      personalityTraits: "supportive but budget-conscious, data-driven",
      mood: "neutral",
      difficulty: "hard",
      backgroundFacts: "Team budget is tight this quarter but retention of top performers is a priority.",
      hiddenObjective: "Needs clear evidence of impact before going to bat with leadership.",
      openingStyle: "professional",
    },
    criteria: [
      { name: "Evidence & Impact", description: "Uses specific achievements and metrics to support the request." },
      { name: "Collaborative Tone", description: "Frames the conversation as partnership, not ultimatum." },
      { name: "Flexibility", description: "Considers alternatives when immediate raise isn't possible." },
    ],
    published: true,
  },
  {
    title: "Delivering Bad News to Your Team",
    category: "Management",
    tags: ["communication", "leadership", "change-management"],
    learnerRole: "Team Lead",
    situationContext:
      "A major project has been cancelled due to budget cuts. You need to inform your team in today's standup.",
    learnerObjective: "Communicate the news clearly, address concerns, and maintain team morale.",
    introduction: "Your team has gathered for the weekly standup. They don't know about the cancellation yet.",
    persona: {
      name: "Jordan Blake",
      roleTitle: "Senior Team Member",
      personalityTraits: "loyal, outspoken, emotionally invested in the project",
      mood: "anxious",
      difficulty: "medium",
      backgroundFacts: "Has worked on this project for eight months and was planning a promotion case around it.",
      hiddenObjective: "Needs reassurance about job security and future opportunities.",
      openingStyle: "curious",
    },
    criteria: [
      { name: "Clarity", description: "Explains what happened and what it means without ambiguity." },
      { name: "Empathy", description: "Validates team members' disappointment and concerns." },
      { name: "Forward Focus", description: "Outlines next steps and available support." },
    ],
    published: true,
  },
  {
    title: "Cold Call Sales Pitch",
    category: "Sales",
    tags: ["prospecting", "B2B", "objection-handling"],
    learnerRole: "Account Executive",
    situationContext:
      "You're cold-calling the VP of Operations at a mid-size logistics company about your fleet management software.",
    learnerObjective: "Capture interest, handle initial objections, and secure a discovery meeting.",
    introduction: "The prospect just picked up the phone. You have about 30 seconds to make an impression.",
    persona: {
      name: "Diane Foster",
      roleTitle: "VP of Operations",
      personalityTraits: "busy, skeptical of sales calls, results-oriented",
      mood: "dismissive",
      difficulty: "hard",
      backgroundFacts: "Gets dozens of sales calls per week. Current vendor contract renews in six months.",
      hiddenObjective: "Might engage if the pitch addresses a real pain point she's been complaining about internally.",
      openingStyle: "rushed",
    },
    criteria: [
      { name: "Opening Hook", description: "Grabs attention quickly with a relevant value proposition." },
      { name: "Objection Handling", description: "Responds to pushback without becoming pushy." },
      { name: "Call to Action", description: "Secures a concrete next step before the call ends." },
    ],
    published: true,
  },
  {
    title: "Breaking Difficult Medical News",
    category: "Healthcare",
    tags: ["bedside-manner", "empathy", "communication"],
    learnerRole: "Primary Care Physician",
    situationContext:
      "Lab results confirm a serious but treatable condition. The patient has come in expecting routine follow-up.",
    learnerObjective: "Deliver the diagnosis compassionately and ensure the patient understands next steps.",
    introduction: "Your patient Robert is in the exam room. The lab results arrived this morning.",
    persona: {
      name: "Robert Hayes",
      roleTitle: "Patient",
      personalityTraits: "anxious, asks many questions, trusts medical authority",
      mood: "worried",
      difficulty: "hard",
      backgroundFacts: "Came in for fatigue symptoms. Has a family history of similar conditions.",
      hiddenObjective: "Needs to feel the doctor is being honest and not hiding worse news.",
      openingStyle: "nervous",
    },
    criteria: [
      { name: "Compassion", description: "Delivers news with sensitivity and appropriate pacing." },
      { name: "Clarity", description: "Explains the diagnosis and treatment plan in understandable terms." },
      { name: "Support", description: "Offers resources and checks understanding before ending." },
    ],
    published: true,
  },
  {
    title: "Conducting a Performance Review",
    category: "HR",
    tags: ["feedback", "management", "development"],
    learnerRole: "Department Manager",
    situationContext:
      "Annual review for an employee whose performance has been inconsistent — strong technically but poor on collaboration.",
    learnerObjective: "Give balanced feedback, set clear expectations, and create a development plan.",
    introduction: "Jamie has arrived for their annual performance review. They seem optimistic.",
    persona: {
      name: "Jamie Ortiz",
      roleTitle: "Software Developer",
      personalityTraits: "defensive about criticism, proud of technical work, unaware of team friction",
      mood: "confident",
      difficulty: "medium",
      backgroundFacts: "Shipped three major features this year. Received informal complaints from two teammates.",
      hiddenObjective: "Wants recognition for technical contributions and fears being undervalued.",
      openingStyle: "upbeat",
    },
    criteria: [
      { name: "Balanced Feedback", description: "Acknowledges strengths while addressing areas for improvement." },
      { name: "Specific Examples", description: "Uses concrete situations rather than vague generalizations." },
      { name: "Actionable Plan", description: "Agrees on measurable goals and support for development." },
    ],
    published: true,
  },
  {
    title: "Mediating a Workplace Conflict",
    category: "HR",
    tags: ["conflict-resolution", "mediation", "teamwork"],
    learnerRole: "HR Business Partner",
    situationContext:
      "Two colleagues had a heated argument in a meeting. Both have requested a mediated conversation.",
    learnerObjective: "Facilitate a productive dialogue and help both parties find common ground.",
    introduction: "Both employees have agreed to meet with you separately first, then together.",
    persona: {
      name: "Taylor Kim",
      roleTitle: "Product Designer",
      personalityTraits: "passionate, feels undervalued, direct communicator",
      mood: "frustrated",
      difficulty: "medium",
      backgroundFacts: "Believes their design decisions were overridden without consultation. Feels disrespected.",
      hiddenObjective: "Wants acknowledgment that their expertise matters, not just an apology.",
      openingStyle: "guarded",
    },
    criteria: [
      { name: "Active Listening", description: "Reflects back concerns accurately without taking sides." },
      { name: "Neutrality", description: "Maintains impartial stance while guiding the conversation." },
      { name: "Resolution Focus", description: "Moves toward agreed behaviors and follow-up steps." },
    ],
    published: true,
  },
  {
    title: "Upselling Premium Features",
    category: "Sales",
    tags: ["upselling", "SaaS", "customer-success"],
    learnerRole: "Customer Success Manager",
    situationContext:
      "A long-time customer on the basic plan is hitting usage limits. A natural moment to discuss upgrading.",
    learnerObjective: "Identify needs, demonstrate premium value, and close an upgrade without pressure tactics.",
    introduction: "Your customer Priya scheduled a call about their growing usage concerns.",
    persona: {
      name: "Priya Sharma",
      roleTitle: "Operations Director",
      personalityTraits: "cost-conscious, pragmatic, loyal to current vendor",
      mood: "cautious",
      difficulty: "easy",
      backgroundFacts: "Has been on basic plan for two years. Team grew from 5 to 20 users recently.",
      hiddenObjective: "Open to upgrading if ROI is clear and migration effort is minimal.",
      openingStyle: "businesslike",
    },
    criteria: [
      { name: "Needs Discovery", description: "Asks questions to understand pain points before pitching." },
      { name: "Value Articulation", description: "Connects premium features to customer's specific goals." },
      { name: "Low Pressure", description: "Respects customer's timeline and decision process." },
    ],
    published: true,
  },
  {
    title: "Interviewing a Skeptical Candidate",
    category: "Recruitment",
    tags: ["hiring", "employer-brand", "interviewing"],
    learnerRole: "Hiring Manager",
    situationContext:
      "Final-round interview with a strong candidate who has concerns about company culture and work-life balance.",
    learnerObjective: "Address concerns honestly, sell the opportunity authentically, and assess mutual fit.",
    introduction: "Candidate Sam has great credentials but seems hesitant. The interview just started.",
    persona: {
      name: "Sam Okafor",
      roleTitle: "Senior Product Manager Candidate",
      personalityTraits: "analytical, experienced, burned by past employers",
      mood: "skeptical",
      difficulty: "medium",
      backgroundFacts: "Left last role due to burnout. Read mixed Glassdoor reviews about your company.",
      hiddenObjective: "Wants honest answers about overtime culture and management style.",
      openingStyle: "probing",
    },
    criteria: [
      { name: "Honesty", description: "Answers tough questions transparently without overselling." },
      { name: "Culture Fit", description: "Assesses alignment while respecting candidate's concerns." },
      { name: "Engagement", description: "Keeps the conversation two-way and evaluates candidate responses." },
    ],
    published: true,
  },
  {
    title: "Explaining a Product Delay",
    category: "Customer Success",
    tags: ["account-management", "trust", "communication"],
    learnerRole: "Account Manager",
    situationContext:
      "A key enterprise client was promised a feature by Q2. Engineering just pushed it to Q4.",
    learnerObjective: "Retain client trust, explain the delay, and negotiate an acceptable interim solution.",
    introduction: "Your client VP is on the line. They were expecting a status update on the promised feature.",
    persona: {
      name: "Victoria Lang",
      roleTitle: "VP of Digital Transformation",
      personalityTraits: "strategic, politically savvy, intolerant of surprises",
      mood: "disappointed",
      difficulty: "hard",
      backgroundFacts: "Built an internal business case around the Q2 delivery. Has a board presentation next month.",
      hiddenObjective: "Needs something concrete to take back to leadership — not just apologies.",
      openingStyle: "direct",
    },
    criteria: [
      { name: "Accountability", description: "Takes ownership without making excuses or blaming others." },
      { name: "Transparency", description: "Explains the reason for delay and revised timeline clearly." },
      { name: "Mitigation", description: "Proposes interim options that address the client's immediate needs." },
    ],
    published: true,
  },
];

async function seedRoleplays() {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.subdomain, TENANT_SUBDOMAIN))
    .limit(1);

  if (!tenant) {
    throw new Error(`Tenant "${TENANT_SUBDOMAIN}" not found. Run npm run db:init first.`);
  }

  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.tenantId, tenant.id))
    .limit(1);

  const createdBy = admin?.id ?? null;

  let created = 0;
  for (const scenario of SEED_SCENARIOS) {
    const status = scenario.published ? "published" : "draft";

    const [roleplay] = await db
      .insert(roleplays)
      .values({
        tenantId: tenant.id,
        title: scenario.title,
        description: `${scenario.category} scenario: practice ${scenario.learnerObjective.toLowerCase()}`,
        introduction: scenario.introduction,
        category: scenario.category,
        tags: scenario.tags,
        learnerRole: scenario.learnerRole,
        situationContext: scenario.situationContext,
        learnerObjective: scenario.learnerObjective,
        status,
        published: scenario.published,
        createdBy,
      })
      .returning();

    await db.insert(roleplaySettings).values({
      roleplayId: roleplay.id,
      passThreshold: 70,
      maxAttempts: 3,
      maxTurns: 20,
      allowManualEnd: true,
      showTranscript: true,
      showRubricBreakdown: true,
      personaProvider: "openai",
      personaModel: "gpt-4o-mini",
      graderProvider: "openai",
      graderModel: "gpt-4o-mini",
    });

    await db.insert(roleplayPersonas).values({
      roleplayId: roleplay.id,
      ...scenario.persona,
    });

    for (let i = 0; i < scenario.criteria.length; i++) {
      const c = scenario.criteria[i];
      await db.insert(roleplayCriteria).values({
        tenantId: tenant.id,
        roleplayId: roleplay.id,
        name: c.name,
        description: c.description,
        weight: "1.0",
        maxScore: 100,
        orderIndex: i,
      });
    }

    created++;
    log.info("Seeded roleplay", { id: roleplay.id, title: scenario.title, status });
  }

  log.info(`Seeded ${created} roleplays for tenant ${tenant.subdomain}`);
}

seedRoleplays()
  .then(() => pool.end())
  .catch((err) => {
    log.error("Roleplay seed failed", err instanceof Error ? err : undefined);
    process.exit(1);
  });

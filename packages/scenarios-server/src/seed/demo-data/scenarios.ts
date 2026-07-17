import { makeScoreBand } from "./score-band-helpers.ts";
import { SCENARIO_BRIEFS } from "./scenario-briefs.ts";
import type { DemoScenario, ScoreBandContent, ScoreBandId } from "./types.ts";
import { DEFAULT_REWARD_TIERS } from "@heybray/gamification/schema";

type DemoScenarioBase = Omit<DemoScenario, "description" | "playbook" | "rewardTiers">;

const angryCustomerCriteria = ["Empathy", "Problem Solving", "Professionalism"];

const handlingAngryCustomer: DemoScenarioBase = {
  slug: "handling-angry-customer",
  title: "Handling an Angry Customer",
  category: "Customer Service",
  audienceLevel: "manager",
  duration: "standard",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, angryCustomerCriteria, [95, 94, 93], [
      {
        persona: "This blender died after two uses. I want a full refund and something for my wasted Saturday driving here.",
        learner:
          "Marcus, I'm really sorry you've had this experience — that's frustrating, especially after making a special trip. I'd like to understand exactly what happened so we can make this right today.",
      },
      {
        persona: "It just stopped mid-smoothie. I've got the receipt and the box right here.",
        learner:
          "Thank you for bringing everything in. I'm going to authorize a full refund immediately, and I'd also like to offer a store credit for the inconvenience. Does that work for you?",
      },
      {
        persona: "A refund plus credit? Okay. I just wanted someone to actually listen.",
        learner:
          "You deserved to be heard. I'll process the refund now and email you a confirmation within the hour. Is there anything else I can help with today?",
      },
    ], "Excellent de-escalation. You validated emotions first, moved quickly to a fair resolution, and closed with reassurance."),
    makeScoreBand("mid", 72, 84, angryCustomerCriteria, [78, 76, 80], [
      {
        persona: "This blender broke after two uses. I want my money back.",
        learner: "I'm sorry about that. We can definitely look at a refund if you have your receipt.",
      },
      {
        persona: "Of course I have the receipt. Do you think I'd come here without it?",
        learner: "No, I didn't mean it that way. Let me check our return policy and see what we can do.",
      },
      {
        persona: "Fine. How long is this going to take?",
        learner: "I'll process a refund for you now. It should show up in a few business days.",
      },
    ], "You resolved the issue but missed early opportunities to acknowledge frustration. Tone improved once you focused on the refund."),
    makeScoreBand("low", 50, 62, angryCustomerCriteria, [52, 48, 58], [
      {
        persona: "Your store sold me a broken blender. I want a refund.",
        learner: "Returns are handled at the desk. Did you read the warranty card?",
      },
      {
        persona: "Are you serious? I don't want a warranty — I want my money back.",
        learner: "We might be able to exchange it if it's within 30 days.",
      },
      {
        persona: "I said refund. This is exactly why I'm angry.",
        learner: "Okay, I'll get a supervisor.",
      },
    ], "Defensive opening and policy-first responses escalated tension. Practice leading with empathy before discussing options."),
  ],
};

const negotiatingRaiseCriteria = ["Evidence & Impact", "Collaborative Tone", "Flexibility"];

const negotiatingRaise: DemoScenarioBase = {
  slug: "negotiating-raise",
  title: "Negotiating a Raise",
  category: "Leadership",
  audienceLevel: "individual-contributor",
  duration: "standard",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, negotiatingRaiseCriteria, [96, 92, 94], [
      {
        persona: "You asked to discuss compensation. What's on your mind?",
        learner:
          "I've led the payments migration that cut incident response time by 40%, mentored two mid-level engineers to promotion, and consistently delivered ahead of roadmap. I'd like to discuss aligning my compensation with that impact.",
      },
      {
        persona: "The work has been strong. Budget is tight until Q3 though.",
        learner:
          "I understand constraints. Would you be open to a phased adjustment — partial now with a committed review in Q3 — or exploring a title bump that reflects scope?",
      },
      {
        persona: "If you can document the migration ROI, I can make a case to leadership.",
        learner:
          "I'll send a one-pager by Friday with metrics and peer feedback. I'd appreciate being part of that conversation with leadership if possible.",
      },
    ], "Strong case built on evidence, collaborative framing, and creative alternatives when budget was constrained."),
    makeScoreBand("mid", 72, 84, negotiatingRaiseCriteria, [75, 80, 74], [
      {
        persona: "You wanted to talk about a raise?",
        learner: "Yes — I've been doing good work and feel I'm due for more compensation.",
      },
      {
        persona: "Can you be more specific about impact?",
        learner: "I've shipped a lot of features and helped the team. I think a 10% raise is fair.",
      },
      {
        persona: "I'll see what I can do, but no promises this quarter.",
        learner: "Okay, thanks. Let me know.",
      },
    ], "You stated intent clearly but relied on general claims. Adding metrics and exploring alternatives would strengthen your case."),
    makeScoreBand("low", 50, 62, negotiatingRaiseCriteria, [55, 50, 58], [
      {
        persona: "What's the compensation topic you wanted to discuss?",
        learner: "I need a raise. Other companies are paying more and I'm underpaid.",
      },
      {
        persona: "That's a strong statement. What outcomes justify it?",
        learner: "I've been here two years. That's enough.",
      },
      {
        persona: "I need data, not tenure alone.",
        learner: "Well, if you can't pay market rate, maybe I should look elsewhere.",
      },
    ], "Ultimatum-style framing without evidence damaged rapport. Reframe around impact and partnership."),
  ],
};

const badNewsCriteria = ["Clarity", "Empathy", "Forward Focus"];

const deliveringBadNews: DemoScenarioBase = {
  slug: "delivering-bad-news",
  title: "Delivering Bad News to Your Team",
  category: "Management",
  audienceLevel: "manager",
  duration: "standard",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, badNewsCriteria, [94, 95, 91], [
      {
        persona: "Before we dive into tickets — anything big on your mind today?",
        learner:
          "Yes. Leadership cancelled Project Atlas effective today due to budget cuts. I know many of you have invested months here, and this is disappointing news.",
      },
      {
        persona: "Eight months of work, gone? What happens to our roles?",
        learner:
          "Your roles are secure. We're being redeployed to the platform initiative starting next week. I'll work with each of you on how your Atlas work translates to that roadmap.",
      },
      {
        persona: "I was building my promotion case on this.",
        learner:
          "That's valid. Let's schedule a 1:1 this week to capture your impact in writing and identify growth paths on platform. I'll advocate for you in calibration.",
      },
    ], "Clear news delivery, empathetic validation, and concrete forward plans — especially around career impact."),
    makeScoreBand("mid", 72, 84, badNewsCriteria, [78, 76, 77], [
      {
        persona: "Ready for standup updates?",
        learner: "Heads up — Project Atlas is cancelled. Budget reasons.",
      },
      {
        persona: "Wow. What about our jobs?",
        learner: "Everyone stays on the team. We'll move to other work.",
      },
      {
        persona: "When do we find out what's next?",
        learner: "Leadership will share more details soon. Let's stay focused for now.",
      },
    ], "You communicated the decision but left timeline and individual impact vague. Add specific next steps and 1:1 offers."),
    makeScoreBand("low", 50, 62, badNewsCriteria, [50, 48, 55], [
      {
        persona: "What's on the agenda today?",
        learner: "Atlas is done. Leadership pulled funding.",
      },
      {
        persona: "That's it? We've been working nights on this.",
        learner: "I don't make these calls. We need to pivot quickly.",
      },
      {
        persona: "Are any of us getting laid off?",
        learner: "I haven't heard about layoffs. Let's get back to work.",
      },
    ], "News felt abrupt and dismissive of emotional impact. Slow down, acknowledge loss, and provide reassurance."),
  ],
};

const coldCallCriteria = ["Opening Hook", "Objection Handling", "Call to Action"];

const coldCallSales: DemoScenarioBase = {
  slug: "cold-call-sales",
  title: "Cold Call Sales Pitch",
  category: "Sales",
  audienceLevel: "individual-contributor",
  duration: "quick",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, coldCallCriteria, [93, 95, 92], [
      {
        persona: "I've got two minutes. What is this about?",
        learner:
          "Diane, I'll be brief — we help logistics teams cut unplanned downtime 18% on average. I noticed your team expanded regional routes last quarter; is fleet utilization still a headache?",
      },
      {
        persona: "We're locked in with our vendor until next year.",
        learner:
          "Totally fair. Most ops leaders we talk to start a comparison six months out. Would a 20-minute discovery next week be worth it to see if we'd beat renewal terms?",
      },
      {
        persona: "Send a one-pager. If it's relevant, I'll look.",
        learner:
          "Will do — I'll include a benchmark from a peer in your industry. Can I follow up Thursday to see if a short call makes sense?",
      },
    ], "Relevant hook, respected the objection, and secured a concrete follow-up with value attached."),
    makeScoreBand("mid", 72, 84, coldCallCriteria, [76, 78, 74], [
      {
        persona: "Who is this?",
        learner: "I'm with FleetSync — we sell fleet management software.",
      },
      {
        persona: "Not interested. We have a vendor.",
        learner: "We're often cheaper and have better analytics. Can I send info?",
      },
      {
        persona: "Email it. I've got to go.",
        learner: "Sure, I'll send something over. Thanks for your time.",
      },
    ], "Generic pitch without tying to her context. Objection handling was feature-led rather than curiosity-led."),
    makeScoreBand("low", 50, 62, coldCallCriteria, [48, 52, 50], [
      {
        persona: "This is Diane.",
        learner: "Hi! Our platform is the best fleet tool on the market. Want a demo today?",
      },
      {
        persona: "No. I'm in a meeting.",
        learner: "It'll only take five minutes — you'll love our dashboard.",
      },
      {
        persona: "Please remove me from your list.",
        learner: "Wait — we have a limited-time discount!",
      },
    ], "Pushy opening ignored her time constraints. Practice permission-based discovery before pitching."),
  ],
};

const medicalNewsCriteria = ["Compassion", "Clarity", "Support"];

const breakingMedicalNews: DemoScenarioBase = {
  slug: "breaking-medical-news",
  title: "Breaking Difficult Medical News",
  category: "Healthcare",
  audienceLevel: "individual-contributor",
  duration: "extended",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, medicalNewsCriteria, [95, 93, 96], [
      {
        persona: "So the fatigue — is it just stress like we thought?",
        learner:
          "Robert, I wish it were that simple. Your labs show Type 2 diabetes. I know that's a lot to hear — do you want a moment before we talk through what it means?",
      },
      {
        persona: "Diabetes? My father had that. Am I going to be okay?",
        learner:
          "With treatment and lifestyle changes, many people live full, healthy lives. We'll start with medication, nutrition counseling, and check-ins every three months.",
      },
      {
        persona: "What do I tell my family?",
        learner:
          "That's a good question. I'll give you a written plan and a nurse line for questions. What feels most important to clarify before you leave today?",
      },
    ], "Paced delivery, plain language, and checked understanding while offering ongoing support resources."),
    makeScoreBand("mid", 72, 84, medicalNewsCriteria, [76, 80, 74], [
      {
        persona: "Are my labs back?",
        learner: "Yes — you have diabetes. We'll need to start treatment.",
      },
      {
        persona: "Already? How bad is it?",
        learner: "It's manageable. I'll prescribe metformin and you should change your diet.",
      },
      {
        persona: "Can you explain what that means day to day?",
        learner: "The pharmacy will have instructions. Schedule a follow-up in a month.",
      },
    ], "Diagnosis was clear but emotional space was limited. Expand on daily impact and verify comprehension."),
    makeScoreBand("low", 50, 62, medicalNewsCriteria, [50, 55, 48], [
      {
        persona: "I'm nervous about these results.",
        learner: "Labs confirm diabetes. You'll need to lose weight and take meds.",
      },
      {
        persona: "Is it serious? You seem rushed.",
        learner: "It's common. Many patients have it. We'll monitor annually.",
      },
      {
        persona: "Should I be worried?",
        learner: "Worry won't help. Just follow the prescription.",
      },
    ], "Clinical tone minimized patient anxiety. Lead with empathy and invite questions before closing."),
  ],
};

const performanceReviewCriteria = ["Balanced Feedback", "Specific Examples", "Actionable Plan"];

const performanceReview: DemoScenarioBase = {
  slug: "performance-review",
  title: "Conducting a Performance Review",
  category: "HR",
  audienceLevel: "manager",
  duration: "standard",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, performanceReviewCriteria, [94, 92, 95], [
      {
        persona: "I think this year went really well — three major releases!",
        learner:
          "Absolutely — your technical delivery has been outstanding, especially the checkout refactor. I also want to discuss collaboration: in the April incident retro, two teammates felt sidelined on decisions.",
      },
      {
        persona: "I was moving fast to hit the deadline.",
        learner:
          "Speed mattered, and so does inclusion. Going forward, I'd like you to lead design reviews before implementation and share credit explicitly in demos.",
      },
      {
        persona: "What does success look like?",
        learner:
          "Let's track peer feedback quarterly and aim for zero escalations to me on communication. I'll sponsor a facilitation workshop — agree to try that for Q2?",
      },
    ], "Balanced praise with specific examples and a measurable development plan Jamie could accept."),
    makeScoreBand("mid", 72, 84, performanceReviewCriteria, [78, 74, 80], [
      {
        persona: "Ready for my review?",
        learner: "You're a strong engineer but need to work on teamwork.",
      },
      {
        persona: "Teamwork how?",
        learner: "People say you're hard to work with sometimes.",
      },
      {
        persona: "That's vague.",
        learner: "Just try to communicate more. Overall you're meeting expectations.",
      },
    ], "Feedback lacked concrete examples and joint planning. Tie behaviors to specific incidents and co-create goals."),
    makeScoreBand("low", 50, 62, performanceReviewCriteria, [55, 48, 52], [
      {
        persona: "I shipped three big features this year.",
        learner: "True, but your attitude holds the team back.",
      },
      {
        persona: "What attitude?",
        learner: "You know — not being a team player.",
      },
      {
        persona: "That's not fair.",
        learner: "We need you to fix it or it'll affect your rating.",
      },
    ], "Judgmental language without evidence triggered defensiveness. Reframe around behaviors and support."),
  ],
};

const mediationCriteria = ["Active Listening", "Neutrality", "Resolution Focus"];

const workplaceConflict: DemoScenarioBase = {
  slug: "workplace-conflict",
  title: "Mediating a Workplace Conflict",
  category: "HR",
  audienceLevel: "manager",
  duration: "extended",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, mediationCriteria, [94, 93, 95], [
      {
        persona: "They humiliated me in front of the whole squad.",
        learner:
          "It sounds like you felt publicly undermined when your design was changed without discussion. That would be frustrating for anyone in your role.",
      },
      {
        persona: "Exactly. I don't need an apology — I need my expertise respected.",
        learner:
          "You want a process where design changes involve you before they're finalized. Would a agreed review checkpoint before sprint commitment work for both sides?",
      },
      {
        persona: "If it's enforced, yes.",
        learner:
          "Let's document that norm together in tomorrow's joint session and check in after two sprints to see if it's holding.",
      },
    ], "Strong reflective listening, neutral facilitation, and a concrete behavioral agreement with follow-up."),
    makeScoreBand("mid", 72, 84, mediationCriteria, [76, 78, 74], [
      {
        persona: "Engineering keeps overriding my designs.",
        learner: "Conflicts happen. Both sides need to compromise.",
      },
      {
        persona: "I'm tired of compromising on quality.",
        learner: "Maybe you could be more flexible in meetings.",
      },
      {
        persona: "That's putting it on me.",
        learner: "Let's try to get along better going forward.",
      },
    ], "Neutrality slipped toward advising Taylor to adapt. Focus on shared norms rather than individual adjustment."),
    makeScoreBand("low", 50, 62, mediationCriteria, [50, 48, 55], [
      {
        persona: "They were out of line in that meeting.",
        learner: "I've heard both sides. You're both somewhat at fault.",
      },
      {
        persona: "Somewhat? They attacked my work.",
        learner: "Passion runs high in product teams. Move on.",
      },
      {
        persona: "That's not mediation.",
        learner: "HR can't fix every disagreement. Drop it.",
      },
    ], "Dismissive tone undermined trust. Validate impact first, then facilitate structured resolution."),
  ],
};

const upsellingCriteria = ["Needs Discovery", "Value Articulation", "Low Pressure"];

const upsellingPremium: DemoScenarioBase = {
  slug: "upselling-premium",
  title: "Upselling Premium Features",
  category: "Sales",
  audienceLevel: "individual-contributor",
  duration: "quick",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, upsellingCriteria, [93, 95, 91], [
      {
        persona: "We're hitting usage caps and getting throttled. What's going on?",
        learner:
          "Thanks for flagging that, Priya. Before we talk plans — what workflows break when throttling kicks in, and what would smooth scaling look like for your ops team?",
      },
      {
        persona: "Reporting lag and failed automations. We can't pause growth.",
        learner:
          "Premium removes throttling and adds advanced automation plus SSO — typically saves teams like yours ~6 hours/week. Migration is config-only, no code changes.",
      },
      {
        persona: "What's the price delta?",
        learner:
          "About $400/month more. I can send an ROI worksheet and schedule a trial upgrade next week — no commitment until finance reviews.",
      },
    ], "Discovery-first approach connected premium features to Priya's scaling pain with a low-pressure next step."),
    makeScoreBand("mid", 72, 84, upsellingCriteria, [74, 78, 76], [
      {
        persona: "We keep hitting limits.",
        learner: "You should upgrade to Premium. It has more capacity.",
      },
      {
        persona: "How much more?",
        learner: "It's our best plan — analytics, SSO, the works.",
      },
      {
        persona: "I need numbers for finance.",
        learner: "I'll email pricing. Let me know if you want to upgrade.",
      },
    ], "Jumped to the pitch before quantifying pain. Tie features to Priya's workflow impact and timeline."),
    makeScoreBand("low", 50, 62, upsellingCriteria, [48, 50, 52], [
      {
        persona: "Usage limits are becoming a problem.",
        learner: "Premium is on sale this week only — great time to upgrade!",
      },
      {
        persona: "I didn't ask about sales.",
        learner: "You'll lose data if you don't upgrade soon.",
      },
      {
        persona: "That sounds like a threat.",
        learner: "Take it or leave it — offer expires Friday.",
      },
    ], "Pressure tactics eroded trust. Replace urgency gimmicks with discovery and ROI framing."),
  ],
};

const interviewCriteria = ["Honesty", "Culture Fit", "Engagement"];

const skepticalCandidate: DemoScenarioBase = {
  slug: "skeptical-candidate",
  title: "Interviewing a Skeptical Candidate",
  category: "Recruitment",
  audienceLevel: "manager",
  duration: "standard",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, interviewCriteria, [95, 92, 94], [
      {
        persona: "Glassdoor mentions crunch periods. How often does your team work late?",
        learner:
          "Honestly, we have two release windows a year where extra hours happen — roughly 2–3 weeks each. Outside that, I protect focus time and discourage heroics. What's worked or failed for you elsewhere?",
      },
      {
        persona: "My last PM role promised balance but shipped weekly.",
        learner:
          "That mismatch is exactly what I'd want to avoid. We plan quarterly and push back on scope rather than people. What signals would tell you we're walking the talk?",
      },
      {
        persona: "Talking to ICs without managers present.",
        learner:
          "Happy to arrange that. I'd also share our last retro notes on workload — transparency both ways helps us assess fit.",
      },
    ], "Transparent about tradeoffs, invited mutual assessment, and offered verifiable culture signals."),
    makeScoreBand("mid", 72, 84, interviewCriteria, [76, 74, 78], [
      {
        persona: "I'm concerned about burnout here.",
        learner: "We work hard but it's a great culture. Lots of perks.",
      },
      {
        persona: "Perks don't fix unsustainable pace.",
        learner: "Most people manage fine. You'll learn our rhythm.",
      },
      {
        persona: "Can I speak to the team?",
        learner: "Maybe later in the process.",
      },
    ], "Generic reassurance without specifics. Address workload patterns honestly and enable peer conversations."),
    makeScoreBand("low", 50, 62, interviewCriteria, [50, 48, 55], [
      {
        persona: "I've heard mixed things about management.",
        learner: "Reviews are often disgruntled employees. We're great.",
      },
      {
        persona: "I need honest answers.",
        learner: "If you're not a culture fit, this isn't the place.",
      },
      {
        persona: "That doesn't inspire confidence.",
        learner: "We have other candidates if you're hesitant.",
      },
    ], "Defensive responses damaged employer brand. Treat skepticism as a chance to demonstrate integrity."),
  ],
};

const productDelayCriteria = ["Accountability", "Transparency", "Mitigation"];

const productDelay: DemoScenarioBase = {
  slug: "product-delay",
  title: "Explaining a Product Delay",
  category: "Customer Success",
  audienceLevel: "manager",
  duration: "standard",
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
  scoreBands: [
    makeScoreBand("high", 90, 97, productDelayCriteria, [94, 93, 95], [
      {
        persona: "I built a board case on your Q2 commitment. What's the status?",
        learner:
          "Victoria, I owe you direct news: the feature moves to Q4. We underestimated integration complexity — that's on us, not on your team.",
      },
      {
        persona: "Q4 kills my internal timeline. What do I tell the board?",
        learner:
          "I'd recommend we co-present a revised plan. Interim, we can enable the API beta you asked about in April — live within three weeks — plus executive checkpoints biweekly.",
      },
      {
        persona: "Beta plus checkpoints might work. Put it in writing today.",
        learner:
          "You'll have a signed addendum by EOD with dates, owners, and escalation paths. I'll join your prep call if useful.",
      },
    ], "Owned the miss, explained clearly, and offered board-ready mitigation with written commitments."),
    makeScoreBand("mid", 72, 84, productDelayCriteria, [76, 78, 74], [
      {
        persona: "Where's the Q2 feature?",
        learner: "Engineering ran into issues. It's delayed to Q4.",
      },
      {
        persona: "That's unacceptable.",
        learner: "I understand. We're doing our best to speed things up.",
      },
      {
        persona: "I need something before Q4.",
        learner: "I'll ask the team about workarounds and get back to you.",
      },
    ], "Timeline update was clear but mitigation was vague. Propose specific interim deliverables with dates."),
    makeScoreBand("low", 50, 62, productDelayCriteria, [48, 52, 50], [
      {
        persona: "Status on the committed feature?",
        learner: "Third-party vendors slowed us down. These things happen.",
      },
      {
        persona: "Your contract didn't say Q4.",
        learner: "Legal would say timelines aren't guaranteed.",
      },
      {
        persona: "I'm escalating to your CEO.",
        learner: "Feel free. There's nothing more I can do.",
      },
    ], "Blame-shifting and legalistic tone eroded trust. Take ownership and lead with client-facing recovery options."),
  ],
};

const newHireCriteria = ["Rapport Building", "Expectation Setting", "Support Offered"];

const newHireCheckIn: DemoScenarioBase = {
  slug: "new-hire-check-in",
  title: "New Hire Check-in",
  category: "HR",
  audienceLevel: "manager",
  duration: "quick",
  tags: ["feedback", "management", "development"],
  learnerRole: "People Manager",
  situationContext:
    "A new hire is completing their fourth week. They seem overwhelmed but haven't asked for help.",
  learnerObjective: "Build trust, clarify expectations, and ensure they have the support needed to succeed.",
  introduction: "You've scheduled a 30-minute check-in with your newest team member.",
  persona: {
    name: "Casey Nguyen",
    roleTitle: "Junior Analyst",
    personalityTraits: "eager to impress, reluctant to admit struggles, thoughtful",
    mood: "anxious",
    difficulty: "easy",
    backgroundFacts: "First corporate role after university. Still learning internal tools and processes.",
    hiddenObjective: "Wants permission to ask questions without looking incompetent.",
    openingStyle: "polite",
  },
  criteria: [
    { name: "Rapport Building", description: "Creates a safe space for honest conversation." },
    { name: "Expectation Setting", description: "Clarifies priorities and success metrics for the role." },
    { name: "Support Offered", description: "Identifies blockers and commits to concrete help." },
  ],
  scoreBands: [
    makeScoreBand("high", 90, 97, newHireCriteria, [94, 92, 96], [
      {
        persona: "I think I'm getting the hang of things. Busy week!",
        learner:
          "Glad you're diving in. How are you really feeling — what's been energizing and what's felt harder than expected?",
      },
      {
        persona: "Honestly, the reporting tools are confusing. I don't want to bother anyone.",
        learner:
          "Asking questions is part of the job, not a bother. For week five, let's prioritize one dashboard and pair you with Jordan for a 45-minute walkthrough.",
      },
      {
        persona: "That would help a lot.",
        learner:
          "Success this month is learning the toolchain and shipping your first summary — not perfection. I'll check in again Friday; ping me anytime before that.",
      },
    ], "Created psychological safety, clarified realistic expectations, and assigned specific support."),
    makeScoreBand("mid", 72, 84, newHireCriteria, [76, 74, 78], [
      {
        persona: "Everything's fine, thanks for checking in.",
        learner: "Great. Make sure you're hitting your task list.",
      },
      {
        persona: "Some tasks take longer than I expected.",
        learner: "You'll speed up once you know the systems.",
      },
      {
        persona: "Okay.",
        learner: "Keep at it. Let me know if issues come up.",
      },
    ], "Accepted surface-level answers. Probe deeper and offer structured onboarding support."),
    makeScoreBand("low", 50, 62, newHireCriteria, [50, 48, 52], [
      {
        persona: "I'm still learning the ropes.",
        learner: "We hired you to perform. Other new hires ramp faster.",
      },
      {
        persona: "I'll try harder.",
        learner: "Make sure you're not falling behind — I need output.",
      },
      {
        persona: "Got it.",
        learner: "Good. Back to work then.",
      },
    ], "Pressure without support increases anxiety. Normalize learning curves and remove blockers proactively."),
  ],
};

const renewalCriteria = ["Discovery", "Value Reinforcement", "Commitment Secured"];

const atRiskRenewal: DemoScenarioBase = {
  slug: "at-risk-renewal",
  title: "Renewing an At-Risk Enterprise Contract",
  category: "Customer Success",
  audienceLevel: "manager",
  duration: "extended",
  tags: ["account-management", "trust", "customer-success"],
  learnerRole: "Enterprise Customer Success Director",
  situationContext:
    "A $2M annual contract is up for renewal in 60 days. Usage has dropped 30% and the champion left the company.",
  learnerObjective: "Rebuild executive alignment, demonstrate ongoing value, and secure renewal commitment.",
  introduction: "You're meeting the new interim VP who inherited the relationship.",
  persona: {
    name: "Richard Cole",
    roleTitle: "Interim VP of Operations",
    personalityTraits: "cost-focused, data-driven, skeptical of sunk spend",
    mood: "skeptical",
    difficulty: "hard",
    backgroundFacts: "Tasked with cutting SaaS spend 15%. Unfamiliar with your platform's history at the company.",
    hiddenObjective: "Needs proof the platform still drives ROI before signing another year.",
    openingStyle: "businesslike",
  },
  criteria: [
    { name: "Discovery", description: "Understands new stakeholder priorities and usage gaps." },
    { name: "Value Reinforcement", description: "Connects platform outcomes to business goals with evidence." },
    { name: "Commitment Secured", description: "Establishes a credible path to renewal or expansion." },
  ],
  scoreBands: [
    makeScoreBand("high", 90, 97, renewalCriteria, [93, 95, 92], [
      {
        persona: "Usage is down and I'm reviewing every vendor. Convince me.",
        learner:
          "Fair question. Before I share data — what outcomes matter most in your first 90 days, and where does this platform fit your cost review?",
      },
      {
        persona: "Warehouse throughput and labor cost. If we cut tools, this is on the list.",
        learner:
          "Your team still saves 1,200 labor hours quarterly on routing alone — $380K annualized. Usage dropped after your champion left, not because value disappeared. A 90-day re-enablement plan addresses that.",
      },
      {
        persona: "What does re-enablement look like?",
        learner:
          "Dedicated CSM, exec QBR in 30 days, and success metrics tied to your throughput goals. If we miss agreed targets by day 90, you can exit without penalty — renewal draft ready when you are.",
      },
    ], "Led with discovery, quantified ROI, and proposed a risk-reversed renewal path aligned to Richard's mandate."),
    makeScoreBand("mid", 72, 84, renewalCriteria, [74, 78, 76], [
      {
        persona: "Why renew if adoption dropped?",
        learner: "The platform is powerful — teams just need to use it more.",
      },
      {
        persona: "That's not an answer.",
        learner: "We have great features competitors lack. I can send a deck.",
      },
      {
        persona: "Send numbers I can defend to finance.",
        learner: "I'll pull usage stats and follow up next week.",
      },
    ], "Feature-led pitch without tying to Richard's cost/throughput goals. Lead with business outcomes and a joint plan."),
    makeScoreBand("low", 50, 62, renewalCriteria, [48, 50, 52], [
      {
        persona: "We're likely cutting this contract.",
        learner: "You can't — you're locked in until renewal anyway.",
      },
      {
        persona: "Legal says we have options.",
        learner: "Fine, but you'll lose all your configuration.",
      },
      {
        persona: "Sounds like a threat.",
        learner: "Take it or leave it. Renewal deadline is 60 days.",
      },
    ], "Adversarial tone accelerated churn risk. Partner on ROI proof and phased recommitment instead."),
  ],
};

function enrichScenario(
  scenario: Omit<DemoScenario, "description" | "playbook" | "rewardTiers">,
): DemoScenario {
  const brief = SCENARIO_BRIEFS[scenario.slug];
  if (!brief) {
    throw new Error(`Missing scenario brief for slug: ${scenario.slug}`);
  }
  return {
    ...scenario,
    description: brief.description,
    introduction: brief.introduction,
    situationContext: brief.situationContext,
    learnerObjective: brief.learnerObjective,
    playbook: brief.playbook,
    rewardTiers: brief.rewardTiers ?? DEFAULT_REWARD_TIERS,
    persona: { ...scenario.persona, ...brief.persona },
    criteria: brief.criteria,
  };
}

const BASE_SCENARIOS: Omit<DemoScenario, "description" | "playbook" | "rewardTiers">[] = [
  handlingAngryCustomer,
  negotiatingRaise,
  deliveringBadNews,
  coldCallSales,
  breakingMedicalNews,
  performanceReview,
  workplaceConflict,
  upsellingPremium,
  skepticalCandidate,
  productDelay,
  newHireCheckIn,
  atRiskRenewal,
];

export const DEMO_SCENARIOS: DemoScenario[] = BASE_SCENARIOS.map(enrichScenario);

export const DEMO_SCENARIO_TITLES = DEMO_SCENARIOS.map((s) => s.title);

export function getScoreBandContent(scenario: DemoScenario, band: ScoreBandId): ScoreBandContent | undefined {
  return scenario.scoreBands.find((b) => b.band === band);
}

export function pickScoreInBand(band: ScoreBandContent): number {
  const range = band.scoreMax - band.scoreMin;
  return band.scoreMin + Math.floor(Math.random() * (range + 1));
}

export function scoreToBand(score: number): ScoreBandId {
  if (score >= 90) return "high";
  if (score >= 70) return "mid";
  return "low";
}

export function getBandForTargetScore(scenario: DemoScenario, targetScore: number): ScoreBandContent {
  const bandId = scoreToBand(targetScore);
  const band = scenario.scoreBands.find((b) => b.band === bandId);
  if (band) return band;
  return scenario.scoreBands[1] ?? scenario.scoreBands[0];
}

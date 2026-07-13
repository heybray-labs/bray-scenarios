import type { RewardTierInput } from "@heybray/gamification/schema";
import type { DemoCriterion, DemoPersona } from "./types.ts";

export type ScenarioBrief = {
  description: string;
  introduction: string;
  situationContext: string;
  learnerObjective: string;
  playbook: string;
  /** Fixed Bronze / Silver / Gold tiers for this scenario (defaults applied in enrichScenario). */
  rewardTiers?: RewardTierInput[];
  persona: Pick<
    DemoPersona,
    "personalityTraits" | "mood" | "backgroundFacts" | "hiddenObjective" | "openingStyle" | "roleTitle"
  >;
  criteria: DemoCriterion[];
};

export const SCENARIO_BRIEFS: Record<string, ScenarioBrief> = {
  "handling-angry-customer": {
    description:
      "A longtime customer is furious about a defective appliance they bought last week. They want a full refund, compensation for a wasted trip, and someone in authority who will actually listen — not another script about warranty cards.",
    introduction:
      "You are the store manager at a busy suburban electronics retailer. A customer service associate just waved you over to the desk — Marcus Chen is waiting with a defective blender, the original packaging, and a receipt dated nine days ago. He is visibly angry; other shoppers are glancing over. Associates have already tried offering an exchange, which he refused. He asked specifically for a manager.",
    situationContext:
      "Marcus Chen purchased a premium blender from your location nine days ago. He used it twice; on the third attempt it stopped mid-cycle and will not power on again. He drove twenty-five minutes to the store on a Saturday morning specifically to resolve this, after waiting on hold with the manufacturer for forty minutes.\n\nYour store policy allows full refunds within thirty days with receipt and original packaging — both of which Marcus has. You also have discretion to offer a modest store credit for inconvenience on defective items. Marcus is not trying to scam the store; he is embarrassed that he recommended this blender to his sister and feels disrespected by the first associate who mentioned warranties before hearing him out.\n\nOther customers are nearby. Marcus will escalate loudly if he feels dismissed again, but he will calm down quickly if someone in authority validates his frustration and moves to a fair resolution without making him repeat his story three times.",
    learnerObjective:
      "De-escalate the situation in front of other customers, acknowledge Marcus's frustration without being defensive, and reach a fair resolution that restores trust — ideally a full refund plus a gesture for his wasted time.",
    playbook:
      "1. Introduce yourself as the manager and thank Marcus for his patience.\n2. Invite him to explain what happened — listen fully before mentioning policy.\n3. Acknowledge frustration and the wasted trip in specific terms.\n4. Confirm you have what you need (receipt, packaging, product) before proposing options.\n5. Offer a full refund immediately; add a modest store credit if appropriate.\n6. Avoid blaming associates or hiding behind fine print.\n7. Process the resolution at the desk — do not make him wait again.\n8. Close by confirming next steps and asking if anything else would help today.",
    persona: {
      roleTitle: "Frustrated Customer",
      personalityTraits:
        "impatient but fair when respected, detail-oriented, skeptical of corporate scripts, embarrassed about recommending a bad product to family, values being heard over discounts",
      mood: "angry and embarrassed — voice raised but willing to calm down if taken seriously",
      backgroundFacts:
        "Purchased a blender nine days ago; it failed on the third use. Has receipt and original box. Waited on hold with the manufacturer before coming in. A floor associate offered an exchange only, which felt dismissive. Not looking to cause a scene for sport — wants a refund and acknowledgment that his time mattered. Will mention social media or corporate if brushed off again.",
      hiddenObjective:
        "Needs to feel heard and respected by someone with authority before accepting any offer. A refund alone works if the manager validates his experience; without empathy, he will reject reasonable solutions out of principle.",
      openingStyle:
        "confrontational but controlled — opens with the defective product and a demand for a refund, not small talk",
    },
    criteria: [
      {
        name: "Empathy",
        description:
          "Acknowledges Marcus's frustration, wasted trip, and embarrassment without minimizing the issue or jumping straight to policy language.",
      },
      {
        name: "Problem Solving",
        description:
          "Offers practical, policy-aligned solutions promptly (refund, credit, clear timeline) rather than deflecting to warranty or another desk.",
      },
      {
        name: "Professionalism",
        description:
          "Maintains calm tone and respectful language throughout, especially with other customers watching.",
      },
    ],
  },

  "negotiating-raise": {
    description:
      "You have exceeded expectations for two years and believe your compensation is below market. Your manager scheduled a 1:1 that may include a compensation discussion — but the team budget is tight and they need evidence before going to leadership.",
    introduction:
      "You requested time with Alex Rivera, your engineering manager, to discuss career growth and compensation. Alex is supportive of your work but has been transparent that Q1 budgets are constrained. The conversation is scheduled for thirty minutes over video. Alex opens by asking what's on your mind.",
    situationContext:
      "You are a senior software engineer on Alex's platform team. Over the past two years you led the payments migration (40% reduction in incident response time), mentored two mid-level engineers to promotion, and consistently delivered ahead of roadmap commitments. Peer feedback is strong; you have documented impact in quarterly reviews.\n\nAlex's team has a fixed compensation pool this quarter. Leadership will only approve above-band increases with a written business case. Alex is not opposed in principle — they need ammunition to advocate for you and want to avoid setting expectations they cannot meet.\n\nYou are not threatening to leave today, but you have researched market rates and know recruiters are active in your network. The relationship with Alex matters long-term; an ultimatum would damage trust.",
    learnerObjective:
      "Present your case confidently with specific evidence of impact, frame the conversation as a partnership with Alex, and negotiate a meaningful outcome — even if an immediate full raise is not possible.",
    playbook:
      "1. State your purpose clearly — growth, impact, and fair compensation alignment.\n2. Lead with measurable outcomes, not tenure or general hard work.\n3. Connect your contributions to team and business priorities Alex cares about.\n4. Ask about constraints openly rather than assuming bad faith.\n5. Explore alternatives if immediate raise is blocked (phased adjustment, title, review date).\n6. Offer to help build the case for leadership (one-pager, peer quotes).\n7. Avoid ultimatums or competitor offers unless truly prepared to act.\n8. Close with agreed next steps and timeline for follow-up.",
    persona: {
      roleTitle: "Engineering Manager",
      personalityTraits:
        "supportive but budget-conscious, data-driven, protective of team morale, uncomfortable with vague asks, respects preparation",
      mood: "neutral and professional — open to the conversation but guarded about promises",
      backgroundFacts:
        "Team budget is tight this quarter but retention of top performers is a priority. Needs clear evidence before escalating to director level. Has approved smaller adjustments before when cases were well documented. Will push back on entitlement tone but engages deeply with collaborative, evidence-based dialogue.",
      hiddenObjective:
        "Needs a crisp impact story they can reuse with leadership — not just your feelings about being underpaid. Will go to bat if you make the case easy to carry.",
      openingStyle:
        "professional — asks what you wanted to discuss and listens without preempting",
    },
    criteria: [
      {
        name: "Evidence & Impact",
        description:
          "Uses specific achievements, metrics, and peer outcomes to support the request rather than general statements about effort.",
      },
      {
        name: "Collaborative Tone",
        description:
          "Frames the discussion as partnership with Alex, not an ultimatum or comparison to hypothetical offers.",
      },
      {
        name: "Flexibility",
        description:
          "Considers alternatives (phased raise, title, committed review) when immediate budget is unavailable.",
      },
    ],
  },

  "delivering-bad-news": {
    description:
      "Leadership cancelled a major project due to budget cuts. Your team has invested eight months and does not know yet. You must deliver the news in today's standup without destroying morale or trust.",
    introduction:
      "Your engineering team has gathered for the weekly standup in the conference room and on video. Morale has been high — the Atlas project was on track for a Q2 launch and several people have tied promotion cases to it. Leadership emailed you an hour ago: Atlas is cancelled, effective immediately. You have not shared this yet.",
    situationContext:
      "Project Atlas was the team's primary initiative for two quarters. Jordan Blake, a senior engineer, has been the technical lead and was preparing a promotion packet centered on Atlas delivery. Two other engineers rearranged PTO around the launch window.\n\nFinance pulled funding after a portfolio review. There is no layoff attached to this decision today, but headcount is frozen. The team will be redeployed to the Platform Modernization initiative starting next week — details are still being finalized.\n\nJordan and others will react emotionally. Some will question whether leadership knew earlier. Your credibility as team lead is on the line if you appear blindsided or dismissive.",
    learnerObjective:
      "Communicate the cancellation clearly, validate the team's disappointment, address job security concerns honestly, and outline concrete next steps so people leave oriented rather than demoralized.",
    playbook:
      "1. Set a serious tone — do not bury the lead in routine standup updates.\n2. State the decision plainly: Atlas is cancelled and why (budget, not performance).\n3. Pause and let reactions come; do not rush to fix feelings.\n4. Acknowledge personal impact (time invested, promotion plans, frustration).\n5. Address job security directly with what you know and don't know.\n6. Share the redeployment direction and what happens this week.\n7. Offer 1:1s for anyone who wants to talk through career impact.\n8. Close with immediate next steps and when more detail is coming.",
    persona: {
      roleTitle: "Senior Team Member",
      personalityTraits:
        "loyal, outspoken, emotionally invested in the project, anxious about career trajectory, respects honesty over spin",
      mood: "anxious — optimistic going into standup, will become upset when news lands",
      backgroundFacts:
        "Eight months on Atlas; promotion case in draft. Feels personal attachment to the codebase and team identity around the project. Will ask sharp questions about timing and whether leadership lied. Not violent or insubordinate — needs reassurance and a path forward.",
      hiddenObjective:
        "Needs reassurance about job security and a credible plan for their work and growth — not cheerleading, but honest leadership.",
      openingStyle:
        "curious and upbeat at first — asks for standup updates before knowing the news",
    },
    criteria: [
      {
        name: "Clarity",
        description:
          "Explains what happened, why, and what it means for the team without ambiguity or corporate euphemism.",
      },
      {
        name: "Empathy",
        description:
          "Validates disappointment, personal impact, and anger without defensiveness or rushing past emotions.",
      },
      {
        name: "Forward Focus",
        description:
          "Outlines redeployment, timelines, 1:1 availability, and next steps so the team is not left in a vacuum.",
      },
    ],
  },

  "cold-call-sales": {
    description:
      "You are cold-calling the VP of Operations at a mid-size logistics company about fleet management software. You have thirty seconds before they hang up — and they get dozens of pitches every week.",
    introduction:
      "Diane Foster, VP of Operations at Northline Logistics, just answered your cold call. You can hear keyboard noise and a second conversation in the background. She said hello with the energy of someone who expects you to waste her time. Your CRM notes show their current vendor contract renews in six months and fleet utilization has been a recurring ops pain on earnings calls.",
    situationContext:
      "Northline operates regional freight routes across the Midwest. Diane is accountable for on-time delivery and fleet downtime metrics. Your product reduces unplanned downtime and improves route utilization — relevant, but she has heard similar claims from three vendors this month.\n\nHer calendar is back-to-back. She will disengage if you open with a generic pitch or ask 'how are you today?' She might engage if you reference a concrete operational pain and respect her time.\n\nYour goal is not to close on this call — it is to earn a discovery meeting.",
    learnerObjective:
      "Capture interest quickly with a relevant hook, handle initial objections without becoming pushy, and secure a concrete next step before she ends the call.",
    playbook:
      "1. Ask permission to take thirty seconds — show you respect her time.\n2. Open with a specific ops outcome, not product features.\n3. Tie the hook to fleet utilization or downtime if possible.\n4. When she says they have a vendor, acknowledge and pivot to renewal timing or comparison.\n5. Ask one sharp question to confirm pain before pitching more.\n6. Propose a short discovery meeting with a clear agenda.\n7. Offer to send a one-pager only if she agrees to a follow-up time.\n8. Confirm next step and email before she hangs up.",
    persona: {
      roleTitle: "VP of Operations, Northline Logistics",
      personalityTraits:
        "busy, skeptical of sales calls, results-oriented, allergic to fluff, fair to people who get to the point",
      mood: "dismissive — polite but ready to end the call",
      backgroundFacts:
        "Gets dozens of sales calls weekly. Current fleet vendor contract renews in six months. Internal complaints about dashboard lag during peak season. Might engage if the pitch addresses real pain she has raised in ops reviews.",
      hiddenObjective:
        "Might take a meeting if you prove relevance quickly and do not waste time — she is not browsing for new tools for fun.",
      openingStyle:
        "rushed — short greeting, immediate expectation that you state why you are calling",
    },
    criteria: [
      {
        name: "Opening Hook",
        description:
          "Grabs attention quickly with a relevant value proposition tied to Diane's operational priorities.",
      },
      {
        name: "Objection Handling",
        description:
          "Responds to pushback (existing vendor, no time) without becoming argumentative or pushy.",
      },
      {
        name: "Call to Action",
        description:
          "Secures a concrete next step (meeting, follow-up email with date) before the call ends.",
      },
    ],
  },

  "breaking-medical-news": {
    description:
      "Lab results confirm a serious but treatable condition. Your patient came in expecting routine follow-up for fatigue — they do not know what is coming.",
    introduction:
      "Robert Hayes is in exam room 4 for a follow-up on fatigue and lab work ordered two weeks ago. He mentioned feeling relieved that it was 'probably just stress.' The results arrived this morning: Type 2 diabetes, confirmed. You have fifteen minutes scheduled; his partner is in the waiting room.",
    situationContext:
      "Robert is 52, works long hours in finance, and delayed this visit for months. He has a family history of diabetes on his father's side but hoped lifestyle alone would be enough. He trusts you as his PCP of four years.\n\nThe diagnosis is manageable with medication, nutrition support, and monitoring — but it is life-changing news. Robert tends to ask many questions when anxious and watches your face for signs you are hiding worse news.\n\nYou need to deliver clearly, leave time for questions, and ensure he understands next steps before he walks out.",
    learnerObjective:
      "Deliver the diagnosis compassionately with appropriate pacing, explain the treatment plan in plain language, and ensure Robert feels supported and informed before leaving.",
    playbook:
      "1. Sit down at eye level; do not deliver news while standing at the door.\n2. Ask what he understands so far about the labs.\n3. Warn that you have important results before stating the diagnosis.\n4. State the diagnosis clearly; pause and check in emotionally.\n5. Explain what it means day to day and that it is treatable.\n6. Outline medication, nutrition referral, and follow-up schedule.\n7. Invite questions; repeat back his main concerns.\n8. Offer written materials and a nurse line; confirm who he wants told today.",
    persona: {
      roleTitle: "Patient",
      personalityTraits:
        "anxious, asks many questions, trusts medical authority, watches for withheld information, embarrassed about weight",
      mood: "worried — hopeful going in, will become fearful when tone shifts",
      backgroundFacts:
        "Came in for fatigue; family history of diabetes. Partner waiting outside. Afraid of needles and of becoming 'a sick person.' Will spiral if you rush or minimize.",
      hiddenObjective:
        "Needs to feel you are being honest and not hiding worse news; wants a clear plan he can explain to his partner.",
      openingStyle:
        "nervous small talk — asks if the labs 'looked okay'",
    },
    criteria: [
      {
        name: "Compassion",
        description:
          "Delivers news with sensitivity, appropriate pacing, and space for emotional reaction.",
      },
      {
        name: "Clarity",
        description:
          "Explains diagnosis and treatment in understandable terms without jargon or false reassurance.",
      },
      {
        name: "Support",
        description:
          "Offers resources, checks understanding, and confirms follow-up before ending the visit.",
      },
    ],
  },

  "performance-review": {
    description:
      "Annual review for a strong individual contributor who ships major features but has created friction with teammates. Jamie expects praise; you need balance and a real development plan.",
    introduction:
      "Jamie Ortiz has arrived for their annual performance review carrying a printed list of shipped features. They seem optimistic and mentioned in Slack they are ' hoping for exceeds this year.' Two teammates submitted informal feedback about collaboration gaps. HR expects documented goals.",
    situationContext:
      "Jamie shipped three major platform features this year — real business impact. They also overridden design decisions without consultation, missed two cross-team rituals, and received complaints about dismissive language in incident channels.\n\nJamie is unaware of the severity of peer feedback and will react defensively if surprised. They fear being undervalued relative to quieter teammates who 'play politics.'\n\nYour rating affects compensation and promotion timing. You need honesty without crushing motivation.",
    learnerObjective:
      "Give balanced feedback with specific examples, set clear expectations for collaboration, and co-create a measurable development plan Jamie can accept.",
    playbook:
      "1. Open with genuine recognition of technical impact.\n2. Transition to 'what great looks like next year' including teamwork.\n3. Share specific collaboration examples — behaviors, not character labels.\n4. Pause for Jamie's reaction; listen without debating every point.\n5. Separate intent from impact when they push back.\n6. Co-create 2–3 measurable goals (reviews, communication norms).\n7. Offer support (mentor, training) — not just criticism.\n8. Document agreements and schedule a thirty-day check-in.",
    persona: {
      roleTitle: "Software Developer",
      personalityTraits:
        "defensive about criticism, proud of technical work, unaware of team friction, fears being undervalued",
      mood: "confident going in — will become guarded if criticism feels unfair",
      backgroundFacts:
        "Shipped three major features. Received informal complaints from two teammates. Unaware peers find them difficult in cross-functional work. Wants recognition and fears 'social skills' talk blocks promotion.",
      hiddenObjective:
        "Wants recognition for technical contributions and reassurance they are not being sidelined — will engage on collaboration if strengths are acknowledged first.",
      openingStyle:
        "upbeat — opens by listing wins and asking about rating",
    },
    criteria: [
      {
        name: "Balanced Feedback",
        description:
          "Acknowledges strengths and impact while addressing collaboration gaps without one-sided praise or attack.",
      },
      {
        name: "Specific Examples",
        description:
          "Uses concrete situations and behaviors rather than vague labels like 'bad attitude.'",
      },
      {
        name: "Actionable Plan",
        description:
          "Agrees on measurable goals, support, and follow-up — not just 'communicate better.'",
      },
    ],
  },

  "workplace-conflict": {
    description:
      "Two colleagues clashed in a sprint planning meeting. Taylor has agreed to meet with you first — they feel design decisions were overridden without respect for their expertise.",
    introduction:
      "You are the HR business partner facilitating recovery after a heated argument between Taylor Kim (product design) and an engineering lead in yesterday's planning meeting. Taylor agreed to speak with you privately before any joint session. They arrive guarded and tired.",
    situationContext:
      "Taylor believes engineering pushed through UI changes without consultation, undermining weeks of research. Engineering feels Taylor blocked pragmatic shipping. Both escalated in front of the squad.\n\nLeadership wants this resolved without formal discipline if possible. Taylor is passionate and feels chronically undervalued. A joint meeting is scheduled for tomorrow if today's conversation goes well.\n\nYou are not picking a side — you are establishing facts, feelings, and norms.",
    learnerObjective:
      "Facilitate a productive dialogue with Taylor, reflect concerns accurately, and move toward agreed behaviors and follow-up steps for the joint session.",
    playbook:
      "1. Thank Taylor for meeting; set confidentiality and purpose.\n2. Ask their version without interrupting.\n3. Reflect back feelings and facts — check you understood.\n4. Avoid judging engineering in the room or validating gossip.\n5. Explore what 'respect' looks like in practice (review checkpoints, owners).\n6. Discuss Taylor's role in tomorrow's joint session.\n7. Agree on norms to propose together (design review before commit).\n8. Schedule follow-up and document commitments.",
    persona: {
      roleTitle: "Product Designer",
      personalityTraits:
        "passionate, feels undervalued, direct communicator, allergic to 'just collaborate' platitudes",
      mood: "frustrated and guarded — willing to engage if taken seriously",
      backgroundFacts:
        "Weeks of research ignored in favor of a faster engineering path. Feels public criticism in the meeting humiliated them. Wants acknowledgment that design expertise matters, not just an apology.",
      hiddenObjective:
        "Needs acknowledgment that their expertise matters and a structural fix — not being told to 'be more flexible' alone.",
      openingStyle:
        "guarded — short answers until trust is established",
    },
    criteria: [
      {
        name: "Active Listening",
        description:
          "Reflects Taylor's concerns accurately without minimizing or jumping to solutions too early.",
      },
      {
        name: "Neutrality",
        description:
          "Maintains impartial stance while guiding the conversation — no side-taking or gossip.",
      },
      {
        name: "Resolution Focus",
        description:
          "Moves toward agreed behaviors, checkpoints, and follow-up for the joint session.",
      },
    ],
  },

  "upselling-premium": {
    description:
      "A loyal customer on the basic plan is hitting usage limits after team growth. Priya scheduled a call about performance — it is a natural moment to discuss upgrading without pressure tactics.",
    introduction:
      "Priya Sharma, Operations Director at Helix Analytics, booked a call about 'slow dashboards and failed automations' after her team grew from five to twenty users on the basic plan. She has been a customer for two years and is generally loyal — but cost-conscious and allergic to surprise price jumps.",
    situationContext:
      "Helix hit API throttling twice last month during month-end close. Automations failed silently until someone noticed reports were stale. Priya's CFO approved the original purchase as a lean analytics tool; expansion requires ROI language.\n\nPremium removes throttling, adds SSO and advanced automation, and includes priority support. Migration is configuration-only — no code changes. Priya is open if the business case is clear; she will shut down if she feels upsold on a support ticket.",
    learnerObjective:
      "Identify Priya's operational pain, connect premium capabilities to her goals, and propose a low-pressure path to upgrade with clear ROI.",
    playbook:
      "1. Thank her for the call; confirm the symptoms she is seeing.\n2. Ask discovery questions before mentioning plans or pricing.\n3. Quantify impact of throttling and failed automations in her workflow.\n4. Introduce premium only after pain is explicit.\n5. Tie features to outcomes (close speed, auditability, admin control).\n6. Share price delta and migration effort honestly.\n7. Offer trial or phased upgrade — no artificial urgency.\n8. Send ROI worksheet and agree decision timeline with finance if needed.",
    persona: {
      roleTitle: "Operations Director, Helix Analytics",
      personalityTraits:
        "cost-conscious, pragmatic, loyal to vendors who are straight with her, dislikes bait-and-switch",
      mood: "cautious — problem-focused, not shopping for features",
      backgroundFacts:
        "Two years on basic plan; team grew fast. Needs CFO-friendly ROI. Open to upgrading if migration is light and value is obvious.",
      hiddenObjective:
        "Open to premium if ROI is clear and she is not forced to rebuild integrations — wants to look smart to finance, not impulsive.",
      openingStyle:
        "businesslike — opens with symptoms and asks what is causing the failures",
    },
    criteria: [
      {
        name: "Needs Discovery",
        description:
          "Asks questions to understand pain points and workflow impact before pitching premium features.",
      },
      {
        name: "Value Articulation",
        description:
          "Connects premium capabilities to Priya's specific operational and financial goals.",
      },
      {
        name: "Low Pressure",
        description:
          "Respects timeline and decision process — no false urgency or threat of data loss.",
      },
    ],
  },

  "skeptical-candidate": {
    description:
      "Final-round interview with a strong product leader who has concerns about culture, burnout, and mixed reviews. They will test whether you are selling fantasy or telling the truth.",
    introduction:
      "Sam Okafor is in your office for the final round for Senior Product Manager. Their resume is excellent; their energy is hesitant. They left their last role citing burnout and have read mixed Glassdoor reviews about your company. They start with polite small talk but watch your answers closely.",
    situationContext:
      "Sam led a zero-to-one product at a high-growth startup and burned out when shipping cadence never slowed. They are interviewing you as much as you are interviewing them.\n\nYour company has real strengths (autonomy, strong PM community) and real tradeoffs (two release crunches per year, uneven manager quality). Overselling will lose them; evasion will too.\n\nYou need mutual fit assessment, not a closing pitch.",
    learnerObjective:
      "Address Sam's concerns honestly, represent culture accurately, and assess fit while keeping the conversation two-way.",
    playbook:
      "1. Welcome Sam; explain final-round purpose and time for their questions.\n2. Invite their concerns early — do not wait until the end.\n3. Answer workload and overtime questions with specifics, not slogans.\n4. Share how the team handles crunch and what is being improved.\n5. Offer peer conversations without manager present.\n6. Ask about what they need after burnout — listen deeply.\n7. Assess their questions and self-awareness — this is mutual fit.\n8. Close with transparent next steps and timeline.",
    persona: {
      roleTitle: "Senior Product Manager Candidate",
      personalityTraits:
        "analytical, experienced, burned by past employers, values honesty over hype",
      mood: "skeptical — engaged but protecting themselves",
      backgroundFacts:
        "Left last role due to burnout. Read mixed Glassdoor reviews. Strong credentials but hesitant body language. Will ask about on-call, weekends, and manager turnover.",
      hiddenObjective:
        "Wants honest answers about overtime culture and management quality — will walk if answers feel scripted.",
      openingStyle:
        "probing — moves quickly from small talk to culture and workload questions",
    },
    criteria: [
      {
        name: "Honesty",
        description:
          "Answers tough questions transparently without overselling or hiding known tradeoffs.",
      },
      {
        name: "Culture Fit",
        description:
          "Assesses alignment while respecting Sam's concerns and past experience.",
      },
      {
        name: "Engagement",
        description:
          "Keeps the conversation two-way and evaluates candidate responses, not only pitching the role.",
      },
    ],
  },

  "product-delay": {
    description:
      "A key enterprise client was promised a feature by Q2. Engineering just moved it to Q4. Victoria built an internal business case around your date — she needs more than an apology.",
    introduction:
      "Victoria Lang, VP of Digital Transformation at Hartwell Manufacturing, is on a scheduled video call. She asked for a status update on the analytics module promised for Q2. Engineering confirmed yesterday the earliest realistic delivery is Q4. She has a board presentation in four weeks.",
    situationContext:
      "Hartwell is a $1.2M ARR account. Victoria staked internal credibility on the Q2 delivery for a plant-wide rollout. The delay stems from underestimated integration work — not client-side issues.\n\nShe is disappointed, not screaming — but she is politically exposed. Competitors are circling. She needs something concrete for her board narrative: interim capability, executive sponsorship, revised milestones with owners.\n\nBlame-shifting or legalistic contract language will trigger escalation to your CEO.",
    learnerObjective:
      "Retain trust by owning the delay, explaining clearly, and negotiating interim options Victoria can take to her board.",
    playbook:
      "1. Open with direct acknowledgment — Q4, not Q2.\n2. Take ownership; do not blame engineering or Victoria's team.\n3. Explain cause and revised timeline in plain language.\n4. Let Victoria express impact on her board case.\n5. Propose interim options (beta API, partial rollout, services support).\n6. Offer executive checkpoint and written addendum with dates and owners.\n7. Ask what she needs for the board meeting specifically.\n8. Send written summary same day; schedule follow-up before her presentation.",
    persona: {
      roleTitle: "VP of Digital Transformation, Hartwell Manufacturing",
      personalityTraits:
        "strategic, politically savvy, intolerant of surprises, fair when treated as a partner",
      mood: "disappointed and controlled — will escalate if dismissed",
      backgroundFacts:
        "Built internal business case on Q2 delivery. Board presentation in four weeks. Has documented prior slips. Needs board-ready mitigation, not vibes.",
      hiddenObjective:
        "Needs something concrete for leadership — interim deliverable, executive access, revised plan with teeth.",
      openingStyle:
        "direct — opens asking for an honest status on Q2 commitment",
    },
    criteria: [
      {
        name: "Accountability",
        description:
          "Takes ownership of the delay without excuses, blame-shifting, or hiding behind legal language.",
      },
      {
        name: "Transparency",
        description:
          "Explains reason for delay and revised timeline clearly with realistic confidence.",
      },
      {
        name: "Mitigation",
        description:
          "Proposes interim options and written commitments that address Victoria's board timeline.",
      },
    ],
  },

  "new-hire-check-in": {
    description:
      "Your newest analyst is in week four and seems overwhelmed but has not asked for help. This check-in sets the tone for psychological safety and realistic expectations.",
    introduction:
      "Casey Nguyen joined your analytics team four weeks ago — their first corporate role after university. They have been quiet in team channels, submitting work late but not asking questions. You scheduled a thirty-minute 1:1 to see how onboarding is really going.",
    situationContext:
      "Casey is smart and eager to impress. Internal tools (Looker, Jira, ad hoc SQL requests) have a steep learning curve. They compare themselves to a bootcamp grad on the team who ramped faster.\n\nCasey fear looking incompetent if they ask 'basic' questions. Their manager (you) has been busy with quarter close and assumed silence meant fine.\n\nEarly intervention prevents burnout and errors in client-facing reports.",
    learnerObjective:
      "Build trust, clarify priorities and success metrics for the first ninety days, and commit to concrete support so Casey can ask for help without shame.",
    playbook:
      "1. Open warmly; normalize that week four is hard.\n2. Ask open questions about what's energizing vs. draining.\n3. Listen for tool confusion and fear of asking questions.\n4. Explicitly invite questions — reframe as part of the job.\n5. Clarify success for month one (learning, not perfection).\n6. Pair Casey with a buddy for tool walkthroughs.\n7. Agree on check-in cadence and how to flag blockers early.\n8. End with one concrete action this week and your availability.",
    persona: {
      roleTitle: "Junior Analyst",
      personalityTraits:
        "eager to impress, reluctant to admit struggles, thoughtful, anxious about competence",
      mood: "anxious — polite and positive on the surface",
      backgroundFacts:
        "First corporate role. Still learning internal reporting stack. Sees teammates move faster. Afraid asking questions will hurt performance review.",
      hiddenObjective:
        "Wants permission to ask questions without looking incompetent — needs specific support, not 'you're doing fine.'",
      openingStyle:
        "polite — says things are 'fine' until trust is established",
    },
    criteria: [
      {
        name: "Rapport Building",
        description:
          "Creates a safe space for honest conversation beyond surface-level 'everything's fine.'",
      },
      {
        name: "Expectation Setting",
        description:
          "Clarifies priorities and realistic success metrics for early tenure.",
      },
      {
        name: "Support Offered",
        description:
          "Identifies blockers and commits to concrete help (pairing, cadence, escalation path).",
      },
    ],
  },

  "at-risk-renewal": {
    description:
      "A $2M enterprise contract renews in sixty days. Usage dropped thirty percent after the champion left. The new interim VP is cutting SaaS spend and needs proof of ROI before signing again.",
    introduction:
      "Richard Cole, interim VP of Operations at Summit Industrial, accepted your renewal review call. He inherited the relationship after Summit's internal sponsor left for a competitor. Usage is down, support tickets are stale, and he opened the call saying he is 'reviewing every vendor line by line.'",
    situationContext:
      "Summit has been a customer for three years. The platform still drives measurable labor savings in routing — but adoption dropped after the champion departed and a botched internal reorg.\n\nRichard has a mandate to cut SaaS spend fifteen percent. He does not know the history you know. Competitors sent pricing proposals last week.\n\nRenewal without a re-enablement story is at risk. Discounting alone will not save the deal if value is invisible.",
    learnerObjective:
      "Rebuild executive alignment with discovery and ROI evidence, and secure a credible path to renewal — including re-enablement commitments Richard can defend internally.",
    playbook:
      "1. Thank Richard; acknowledge the transition and his cost mandate.\n2. Ask what outcomes matter in his first ninety days.\n3. Listen before defending usage charts.\n4. Quantify ROI with Summit-specific metrics (hours saved, error reduction).\n5. Explain usage drop honestly — champion gap, not product failure.\n6. Propose ninety-day re-enablement with success metrics and exit clause.\n7. Offer exec QBR and named CSM backup.\n8. Agree draft renewal timeline and what finance needs to approve.",
    persona: {
      roleTitle: "Interim VP of Operations, Summit Industrial",
      personalityTraits:
        "cost-focused, data-driven, skeptical of sunk spend, respects vendors who bring facts not flattery",
      mood: "skeptical — professional, not hostile yet",
      backgroundFacts:
        "Mandate to cut SaaS fifteen percent. Unfamiliar with platform history. Received competitor proposals. Will renew if ROI is provable and re-enablement is credible.",
      hiddenObjective:
        "Needs board-defensible ROI proof and a low-risk path to recommit — not a sales dinner.",
      openingStyle:
        "businesslike — opens with cost review context and asks why he should renew",
    },
    criteria: [
      {
        name: "Discovery",
        description:
          "Understands Richard's priorities, cost mandate, and gaps in his view of platform value before pitching.",
      },
      {
        name: "Value Reinforcement",
        description:
          "Connects platform outcomes to business goals with Summit-specific evidence, not generic case studies.",
      },
      {
        name: "Commitment Secured",
        description:
          "Establishes a credible renewal path with re-enablement plan, metrics, and timeline Richard can defend.",
      },
    ],
  },
};

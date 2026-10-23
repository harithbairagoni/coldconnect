import { NormalizedPersonInfo, PersonIntelligence } from "../../types/models";

/**
 * Intelligence Service
 * Synthesizes normalized background data into actionable networking intelligence:
 * career snapshots, strategic conversation hooks, recommended questions, and common ground.
 */
export class IntelligenceService {
  /**
   * Build structured person intelligence from normalized research data.
   */
  static synthesize(normalized: NormalizedPersonInfo): PersonIntelligence {
    const role = normalized.role || "Specialist";
    const company = normalized.company || "Leading Organization";
    const name = normalized.name || "Connection";

    // Build career snapshot
    let careerSnapshot = "";
    if (normalized.experience.length > 0) {
      const topExp = normalized.experience[0];
      const expSummary =
        typeof topExp === "string"
          ? topExp
          : `${topExp.role} at ${topExp.company}${topExp.duration ? ` (${topExp.duration})` : ""}`;
      careerSnapshot = `${name} is currently serving as ${expSummary}.`;
    } else if (normalized.headline) {
      careerSnapshot = `${name} is a ${normalized.headline}.`;
    } else {
      careerSnapshot = `${name} is active as ${role} at ${company}.`;
    }

    // Build current focus
    const currentFocus = normalized.headline
      ? `Driving initiatives in ${normalized.headline.toLowerCase()}.`
      : `Leading strategic growth, team alignment, and execution at ${company}.`;

    // Synthesize tailored conversation hooks
    const conversationHooks: string[] = [];
    if (normalized.company) {
      conversationHooks.push(
        `"I noticed ${normalized.company}'s recent industry focus. How has that shaped your team's strategic priorities this year?"`,
      );
    }
    if (normalized.skills.length > 0) {
      const topSkill = normalized.skills[0];
      conversationHooks.push(
        `"With your depth in ${topSkill}, how are you seeing the industry evolve over the next 12–18 months?"`,
      );
    }
    if (normalized.education.length > 0) {
      const topEdu = normalized.education[0];
      const schoolName = typeof topEdu === "string" ? topEdu : topEdu.school;
      conversationHooks.push(
        `"I saw your background from ${schoolName}—how did your experience there influence your career trajectory?"`,
      );
    }
    if (conversationHooks.length === 0) {
      conversationHooks.push(
        `"What are the most exciting strategic projects your team is currently working on?"`,
        `"What advice would you give someone looking to make a meaningful impact in your space?"`,
      );
    }

    // Synthesize recommended questions
    const recommendedQuestions: string[] = [
      `What has been the most fulfilling challenge in your transition to your current responsibilities at ${company}?`,
      `How do you balance high-level strategic roadmap planning with immediate operational execution?`,
      `What qualities distinguish the most effective collaborators and leaders in your field?`,
    ];

    // Common ground ideas
    const commonGround: string[] = [];
    if (normalized.interests.length > 0) {
      commonGround.push(...normalized.interests.slice(0, 3));
    }
    if (normalized.education.length > 0) {
      const eduName =
        typeof normalized.education[0] === "string"
          ? normalized.education[0]
          : normalized.education[0].school;
      commonGround.push(`Academic / Alumni network: ${eduName}`);
    }
    if (commonGround.length === 0) {
      commonGround.push("Professional networking & cross-functional leadership");
    }

    // Things to avoid / Nuances
    const thingsToAvoid: string[] = [
      "Avoid asking generic questions easily answered by their public bio; focus on strategic insights and lived experience.",
      "Keep conversational requests concise and respect their time constraints during initial reachouts.",
    ];

    // Calculate confidence score based on completeness of sources and data
    let confidence = 40;
    if (normalized.experience.length > 0) confidence += 20;
    if (normalized.education.length > 0) confidence += 15;
    if (normalized.skills.length > 0) confidence += 10;
    if (normalized.sources.length > 1) confidence += 15;
    confidence = Math.min(100, confidence);

    return {
      careerSnapshot,
      currentFocus,
      interests: normalized.interests,
      experience: normalized.experience,
      education: normalized.education,
      skills: normalized.skills,
      achievements: normalized.achievements,
      publications: normalized.publications,
      conversationHooks,
      recommendedQuestions,
      commonGround,
      thingsToAvoid,
      confidence,
    };
  }
}

import { IResearchProvider } from "./ResearchProvider";
import { ResearchRequest, RawResearchResult } from "../types/research";
import { ResearchRawSource } from "../../types/models";

/**
 * MockResearchProvider
 * Development-only deterministic test provider.
 * Simulates public person research for testing the pipeline before external API integration.
 * Never used automatically in production.
 */
export class MockResearchProvider implements IResearchProvider {
  readonly name = "MockResearchProvider";
  readonly isTestProvider = true;

  isAvailable(): boolean {
    return (
      process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_RESEARCH_PROVIDER === "true"
    );
  }

  async fetchPublicPersonData(request: ResearchRequest): Promise<RawResearchResult> {
    const timestamp = new Date().toISOString();
    const cleanName = request.name.trim();
    const cleanUrl = request.linkedinUrl.trim();

    // Check for simulated failure trigger in name (e.g. "Trigger Failure" or invalid URL)
    if (cleanName.toLowerCase().includes("fail") || cleanUrl.includes("fail-test")) {
      throw new Error(
        "Target profile is currently inaccessible or does not contain public background data.",
      );
    }

    const sources: ResearchRawSource[] = [
      {
        title: `${cleanName} - LinkedIn Public Profile`,
        url: cleanUrl,
        source: "LinkedIn",
        type: "professional",
        retrievedAt: timestamp,
        content: `Public professional profile snapshot for ${cleanName}.`,
      },
      {
        title: `${cleanName} - Public Industry Contributions`,
        url: `${cleanUrl}#activity`,
        source: "Public Activity & Articles",
        type: "publication",
        retrievedAt: timestamp,
        content: `Recent public articles and discussions authored by ${cleanName}.`,
      },
    ];

    const rawProfileData: Record<string, unknown> = {
      fullName: cleanName,
      headline: `Strategic Leader & Growth Specialist`,
      currentCompany: `Enterprise Solutions Group`,
      currentRole: `Senior Strategy Director`,
      location: `Greater New York Area`,
      about: `${cleanName} is a strategic enterprise leader specializing in scalable operational systems, cross-functional team mentorship, and high-velocity business transformation.`,
      experience: [
        {
          company: "Enterprise Solutions Group",
          role: "Senior Strategy Director",
          duration: "2022 - Present",
          startDate: "2022",
          description:
            "Leading cross-functional strategic growth initiatives, digital operations, and strategic partnerships.",
          highlights: [
            "Scaled enterprise partner network across North America",
            "Instituted cross-functional leadership frameworks for agile execution",
          ],
        },
        {
          company: "Global Consulting Partners",
          role: "Engagement Manager",
          duration: "2019 - 2022",
          startDate: "2019",
          endDate: "2022",
          description:
            "Managed strategy consulting engagements for enterprise technology and fintech leaders.",
          highlights: [
            "Directed multi-million dollar transformation advisory programs",
            "Mentored junior consultants into senior strategy tracks",
          ],
        },
      ],
      education: [
        {
          school: "Columbia Business School",
          degree: "Master of Business Administration (MBA)",
          fieldOfStudy: "Strategy & Finance",
          year: "2019",
          startDate: "2017",
          endDate: "2019",
        },
        {
          school: "University of Michigan",
          degree: "Bachelor of Science",
          fieldOfStudy: "Economics & Computer Science",
          year: "2015",
          startDate: "2011",
          endDate: "2015",
        },
      ],
      skills: [
        "Strategic Planning",
        "Business Transformation",
        "Cross-functional Leadership",
        "Market Expansion",
        "Enterprise Partnerships",
        "Team Mentorship",
      ],
      transitions: [
        {
          fromRole: "Engagement Manager",
          fromCompany: "Global Consulting Partners",
          toRole: "Senior Strategy Director",
          toCompany: "Enterprise Solutions Group",
          year: "2022",
          transitionType: "Industry Pivot from Advisory to Corporate Operator",
          description: "Transitioned from external consulting into executive corporate operations.",
        },
      ],
      activity: {
        posts: [
          {
            text: "Building resilient operational systems starts with empowering cross-functional teams to make high-conviction decisions.",
            snippet:
              "Building resilient operational systems starts with empowering cross-functional teams...",
            date: "2 weeks ago",
            engagement: "340+ reactions · 45 comments",
            topics: ["Operational Excellence", "Team Leadership"],
          },
        ],
        articles: [
          {
            title: "Strategic Scaling: Frameworks for Fast-Moving Organizations",
            publisher: "Enterprise Strategy Review",
            date: "2024",
            summary:
              "An overview of structural alignment and scalable governance for modern enterprises.",
            topics: ["Scaling", "Organizational Design"],
          },
        ],
        recurringTopics: [
          {
            topic: "Operational Systems Architecture",
            frequency: "Regular",
            relevance: "Primary focus of public articles and panel contributions.",
            evidence: ["Authored whitepaper on emerging market operations"],
          },
          {
            topic: "Cross-Functional Mentorship",
            frequency: "Frequent",
            relevance: "Recurring discussion topic across keynote sessions and LinkedIn posts.",
            evidence: ["Panelist at Global Operations Summit 2024"],
          },
        ],
      },
      publicSources: [
        {
          url: cleanUrl,
          sourceType: "linkedin_profile",
          title: `${cleanName} - LinkedIn Profile`,
          date: "2026",
          summary: `Primary verified public LinkedIn profile of ${cleanName}.`,
          relevance: "Canonical career history, educational credentials, and verified positions.",
        },
        {
          url: "https://enterprisestrategyreview.org/scaling-frameworks",
          sourceType: "article",
          title: "Strategic Scaling: Frameworks for Fast-Moving Organizations",
          date: "2024",
          summary: "In-depth article on architectural frameworks for modern operational scaling.",
          relevance: "Demonstrates core thought leadership and strategic operational philosophy.",
        },
        {
          url: "https://globaloperationssummit.org/speakers/2024",
          sourceType: "conference_speaker",
          title: "Global Operations Summit 2024 - Keynote Speaker Profile",
          date: "2024",
          summary: "Keynote presentation on building resilient leadership structures.",
          relevance: "Public conference speaking and industry domain authority.",
        },
      ],
      achievements: [
        "Spearheaded enterprise transformation driving 38% operational efficiency gain.",
        "Authored industry whitepaper on emerging market operations.",
      ],
      publications: ["Strategic Scaling: Frameworks for Fast-Moving Organizations (2024)"],
    };

    return {
      providerName: this.name,
      rawProfileData,
      sources,
    };
  }
}

import type { RawResearchResult } from "../types/research";
import type {
  NormalizedLinkedInProfile,
  NormalizedLinkedInExperience,
  NormalizedLinkedInEducation,
  NormalizedLinkedInSkill,
  NormalizedLinkedInCertification,
  NormalizedLinkedInProject,
  NormalizedLinkedInPublication,
  NormalizedLinkedInAward,
  NormalizedLinkedInLanguage,
  NormalizedLinkedInOrganization,
  NormalizedInterestItem,
  NormalizedPersonInfo,
  EducationItem,
  ExperienceItem,
  ResearchRawSource,
  StructuredResearchData,
  PublicProfessionalSource,
  PublicSourceType,
  ResearchActivityPost,
  ResearchActivityArticle,
  ResearchRecurringTopic,
  CareerTransition,
  ResearchEducationItem,
  ResearchSkillItem,
} from "../../types/models";
import { normalizeLinkedInUrl } from "../utils/linkedinUrl";

/**
 * Normalization Service for LinkedIn Profiles (Apify Output)
 * Converts raw Apify actor results into canonical ColdConnect research structure.
 * Implements sanitization, privacy guardrails, deduplication, and data minimization.
 */

function cleanStr(val: unknown, maxLen = 500): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "object") {
    // If it's a nested object with text/name/value
    const obj = val as Record<string, unknown>;
    const extracted = obj.text || obj.name || obj.value || obj.title;
    if (extracted && typeof extracted === "string") {
      const s = extracted.trim();
      if (s && s !== "undefined" && s !== "null") return s.slice(0, maxLen);
    }
  }
  const s = String(val).trim();
  if (!s || s === "undefined" || s === "null" || s === "[object Object]") return undefined;
  return s.slice(0, maxLen);
}

function parseLocation(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string") {
    return cleanStr(val, 150);
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if (obj.parsed && typeof obj.parsed === "object" && obj.parsed !== null) {
      const parsedText = (obj.parsed as Record<string, unknown>).text;
      if (parsedText) return cleanStr(parsedText, 150);
    }
    if (obj.linkedinText) return cleanStr(obj.linkedinText, 150);
    if (obj.text) return cleanStr(obj.text, 150);
    if (obj.name) return cleanStr(obj.name, 150);
    if (obj.city || obj.country) {
      return [cleanStr(obj.city, 80), cleanStr(obj.country, 80)].filter(Boolean).join(", ");
    }
  }
  return undefined;
}

function parseDateVal(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === "string" || typeof val === "number") {
    const trimmed = String(val).trim();
    return trimmed ? trimmed.slice(0, 50) : undefined;
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    const year = obj.year ? String(obj.year).trim() : "";
    const month = obj.month ? String(obj.month).trim() : "";
    if (year && month) return `${month}/${year}`;
    if (year) return year;
  }
  return undefined;
}

/**
 * Sanitize raw Apify result before storage to prevent bloating and personal data leakage
 */
export function sanitizeRawProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  const excludedKeys = new Set([
    "moreProfiles",
    "similarProfiles",
    "recommendationsGiven",
    "recommendationsReceived",
    "relatedProfiles",
    "allImages",
    "fullResolutionImages",
    "rawHtml",
    "pageHtml",
    "temporarySession",
    "executionMetadata",
    "proxyConfig",
  ]);

  for (const [key, value] of Object.entries(raw)) {
    if (excludedKeys.has(key)) continue;
    if (value === undefined || value === null) continue;

    if (typeof value === "string" && value.length > 5000) {
      sanitized[key] = value.slice(0, 5000);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Helper to normalize individual interest objects or strings
 */
function normalizeInterestItem(item: unknown): NormalizedInterestItem | null {
  if (!item) return null;
  if (typeof item === "string" && item.trim()) {
    return { name: item.trim().slice(0, 100) };
  }
  if (typeof item === "object" && item !== null) {
    const obj = item as Record<string, unknown>;
    const iName = cleanStr(obj.name || obj.title || obj.headline || obj.text, 100);
    if (!iName) return null;
    return {
      name: iName,
      description: cleanStr(obj.description || obj.subtitle || obj.occupation || obj.summary, 200),
      url: cleanStr(obj.url || obj.link || obj.linkedinUrl, 300),
    };
  }
  return null;
}

function normalizeInterestList(rawList: unknown): NormalizedInterestItem[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((item) => normalizeInterestItem(item))
    .filter((item): item is NormalizedInterestItem => Boolean(item))
    .slice(0, 25);
}

/**
 * Canonical LinkedIn profile normalizer as defined in ColdConnect Phase 3B specifications.
 */
export function normalizeLinkedInProfile(
  raw: Record<string, unknown>,
  fallbackUrl?: string,
): NormalizedLinkedInProfile {
  const retrievedAt = new Date().toISOString();

  // 1. Identity
  const rawFirstName = cleanStr(raw.firstName, 100) || "";
  const rawLastName = cleanStr(raw.lastName, 100) || "";
  const nameFromParts = [rawFirstName, rawLastName].filter(Boolean).join(" ");
  const name =
    cleanStr(raw.fullName, 150) ||
    cleanStr(raw.name, 150) ||
    (nameFromParts.length > 0 ? nameFromParts : "Professional");

  const headline = cleanStr(raw.headline || raw.tagline || raw.subHeadline, 250);

  const rawUrl =
    cleanStr(raw.linkedinUrl || raw.url || raw.publicIdentifier || raw.inputUrl) || fallbackUrl;
  const canonicalUrl = normalizeLinkedInUrl(rawUrl) || rawUrl || "https://www.linkedin.com";

  const location =
    parseLocation(raw.location) ||
    cleanStr(raw.formattedLocation || raw.city || raw.geoCountryName, 150);

  const about = cleanStr(raw.about || raw.summary || raw.description, 2000);

  // Profile photo: extract clean single URL
  let profilePhoto: string | undefined = undefined;
  if (typeof raw.profilePicture === "string" && raw.profilePicture.startsWith("http")) {
    profilePhoto = raw.profilePicture;
  } else if (typeof raw.profilePicture === "object" && raw.profilePicture !== null) {
    const picObj = raw.profilePicture as Record<string, unknown>;
    if (typeof picObj.url === "string" && picObj.url.startsWith("http")) {
      profilePhoto = picObj.url;
    } else if (
      typeof picObj.displayPictureUrl === "string" &&
      picObj.displayPictureUrl.startsWith("http")
    ) {
      profilePhoto = picObj.displayPictureUrl;
    }
  } else if (typeof raw.pictureUrl === "string" && raw.pictureUrl.startsWith("http")) {
    profilePhoto = raw.pictureUrl;
  } else if (typeof raw.photo === "string" && raw.photo.startsWith("http")) {
    profilePhoto = raw.photo;
  } else if (
    typeof raw.displayPictureUrl === "string" &&
    raw.displayPictureUrl.startsWith("http")
  ) {
    profilePhoto = raw.displayPictureUrl;
  }

  // 2. Experience Normalization
  const rawExperiences = Array.isArray(raw.experience)
    ? raw.experience
    : Array.isArray(raw.positions)
      ? raw.positions
      : Array.isArray(raw.experiences)
        ? raw.experiences
        : Array.isArray(raw.workExperience)
          ? raw.workExperience
          : [];

  const experience: NormalizedLinkedInExperience[] = [];

  for (const item of rawExperiences) {
    if (!item || typeof item !== "object") continue;
    const exp = item as Record<string, unknown>;

    const title = cleanStr(exp.position || exp.title || exp.role || exp.designation, 150) || "Role";
    const company =
      cleanStr(exp.companyName || exp.company || exp.organization || exp.company_name, 150) ||
      "Organization";

    const companyLinkedinUrl =
      normalizeLinkedInUrl(
        cleanStr(exp.companyLinkedinUrl || exp.companyUrl || exp.companyUrn, 300),
      ) || undefined;

    const expLocation = parseLocation(exp.location) || cleanStr(exp.geoCity, 100);
    const employmentType = cleanStr(exp.employmentType || exp.type, 50);
    const workplaceType = cleanStr(exp.workplaceType || exp.workType, 50);
    const duration = cleanStr(exp.duration || exp.timePeriod || exp.dateRange, 80);
    const description = cleanStr(exp.description || exp.summary, 1500);

    // Skills associated with this position
    let expSkills: string[] | undefined = undefined;
    if (Array.isArray(exp.skills)) {
      expSkills = exp.skills
        .map((s) =>
          typeof s === "string"
            ? s.trim()
            : typeof s === "object" && s && "name" in s
              ? String((s as { name: unknown }).name).trim()
              : "",
        )
        .filter(Boolean)
        .slice(0, 15);
    }

    const startDate = parseDateVal(exp.startDate || exp.start);
    const endDate = parseDateVal(exp.endDate || exp.end);

    experience.push({
      title,
      company,
      companyLinkedinUrl,
      location: expLocation,
      employmentType,
      workplaceType,
      duration,
      description,
      skills: expSkills && expSkills.length > 0 ? expSkills : undefined,
      startDate,
      endDate,
    });
  }

  // 3. Current Role Normalization
  let currentRole: NormalizedLinkedInProfile["currentRole"] = {};
  const curPosObj = Array.isArray(raw.currentPosition)
    ? raw.currentPosition[0]
    : typeof raw.currentPosition === "object" && raw.currentPosition !== null
      ? raw.currentPosition
      : null;

  if (curPosObj && typeof curPosObj === "object") {
    const cur = curPosObj as Record<string, unknown>;
    currentRole = {
      title: cleanStr(cur.position || cur.title || cur.role || cur.designation, 150),
      company: cleanStr(cur.companyName || cur.company || cur.organization, 150),
      companyLinkedinUrl:
        normalizeLinkedInUrl(cleanStr(cur.companyLinkedinUrl || cur.companyUrl, 300)) || undefined,
      location: parseLocation(cur.location) || cleanStr(cur.location, 100),
      employmentType: cleanStr(cur.employmentType || cur.type, 50),
      workplaceType: cleanStr(cur.workplaceType || cur.workType, 50),
      duration: cleanStr(cur.duration || cur.timePeriod, 80),
      startDate: parseDateVal(cur.startDate || cur.start),
      endDate: parseDateVal(cur.endDate || cur.end),
      description: cleanStr(cur.description || cur.summary, 1000),
    };
  } else if (experience.length > 0) {
    const first = experience[0];
    currentRole = {
      title: first.title,
      company: first.company,
      companyLinkedinUrl: first.companyLinkedinUrl,
      location: first.location,
      employmentType: first.employmentType,
      workplaceType: first.workplaceType,
      duration: first.duration,
      startDate: first.startDate,
      endDate: first.endDate,
      description: first.description,
    };
  } else {
    currentRole = {
      title: cleanStr(raw.currentRole || raw.role || raw.title, 150),
      company: cleanStr(raw.currentCompany || raw.company, 150),
      location,
    };
  }

  // 4. Education Normalization
  const rawEducations = Array.isArray(raw.education)
    ? raw.education
    : Array.isArray(raw.schools)
      ? raw.schools
      : Array.isArray(raw.educations)
        ? raw.educations
        : [];

  const education: NormalizedLinkedInEducation[] = [];

  for (const item of rawEducations) {
    if (!item || typeof item !== "object") continue;
    const edu = item as Record<string, unknown>;

    const institution =
      cleanStr(edu.schoolName || edu.institution || edu.school || edu.university, 150) ||
      "Educational Institution";
    const institutionLinkedinUrl =
      normalizeLinkedInUrl(cleanStr(edu.institutionLinkedinUrl || edu.schoolUrl, 300)) || undefined;
    const degree = cleanStr(edu.degree || edu.degreeName, 100);
    const fieldOfStudy = cleanStr(edu.fieldOfStudy || edu.fieldsOfStudy || edu.major, 100);
    const startDate = parseDateVal(edu.startDate || edu.start || edu.startYear);
    const endDate = parseDateVal(edu.endDate || edu.end || edu.endYear || edu.year);

    education.push({
      institution,
      institutionLinkedinUrl,
      degree,
      fieldOfStudy,
      startDate,
      endDate,
    });
  }

  // 5. Skills Normalization
  const rawSkills = Array.isArray(raw.skills) ? raw.skills : [];
  const skillsMap = new Map<string, string | undefined>();

  for (const item of rawSkills) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name && !skillsMap.has(name.toLowerCase())) {
        skillsMap.set(name.toLowerCase(), undefined);
      }
    } else if (typeof item === "object" && item !== null) {
      const skillObj = item as Record<string, unknown>;
      const name = cleanStr(skillObj.name || skillObj.title || skillObj.skill, 100);
      let associated = cleanStr(
        skillObj.associatedExperience || skillObj.associatedWith || skillObj.company,
        150,
      );
      if (!associated && Array.isArray(skillObj.positions) && skillObj.positions.length > 0) {
        const firstPos = skillObj.positions[0] as Record<string, unknown>;
        associated = cleanStr(firstPos?.companyName || firstPos?.company, 150);
      }
      if (name && !skillsMap.has(name.toLowerCase())) {
        skillsMap.set(name.toLowerCase(), associated);
      }
    }
  }

  // Also include skills associated with experiences
  for (const exp of experience) {
    if (exp.skills) {
      for (const s of exp.skills) {
        if (s && !skillsMap.has(s.toLowerCase())) {
          skillsMap.set(s.toLowerCase(), exp.company);
        }
      }
    }
  }

  const skills: NormalizedLinkedInSkill[] = Array.from(skillsMap.entries()).map(
    ([nameLower, associated]) => {
      // Find original casing
      let originalName = nameLower;
      for (const item of rawSkills) {
        const candidate = typeof item === "string" ? item : (item as Record<string, unknown>)?.name;
        if (typeof candidate === "string" && candidate.toLowerCase() === nameLower) {
          originalName = candidate.trim();
          break;
        }
      }
      return {
        name: originalName,
        associatedExperience: associated,
      };
    },
  );

  // 6. Certifications Normalization
  const rawCerts = Array.isArray(raw.certifications)
    ? raw.certifications
    : Array.isArray(raw.licensesAndCertifications)
      ? raw.licensesAndCertifications
      : [];
  const certifications: NormalizedLinkedInCertification[] = [];
  for (const item of rawCerts) {
    if (!item || typeof item !== "object") continue;
    const cert = item as Record<string, unknown>;
    const certName = cleanStr(cert.name || cert.title, 150);
    if (!certName) continue;
    certifications.push({
      name: certName,
      issuingOrganization: cleanStr(
        cert.issuingOrganization || cert.authority || cert.issuer || cert.companyName,
        150,
      ),
      issueDate: parseDateVal(cert.issueDate || cert.issuedAt || cert.date),
      expirationDate: parseDateVal(cert.expirationDate || cert.expiresAt),
      credentialUrl: cleanStr(cert.url || cert.credentialUrl || cert.link, 300),
    });
  }

  // 7. Projects Normalization
  const rawProjects = Array.isArray(raw.projects) ? raw.projects : [];
  const projects: NormalizedLinkedInProject[] = [];
  for (const item of rawProjects) {
    if (!item || typeof item !== "object") continue;
    const proj = item as Record<string, unknown>;
    const projTitle = cleanStr(proj.title || proj.name, 150);
    if (!projTitle) continue;
    projects.push({
      title: projTitle,
      description: cleanStr(proj.description || proj.summary, 1000),
      startDate: parseDateVal(proj.startDate || proj.start),
      endDate: parseDateVal(proj.endDate || proj.end),
      url: cleanStr(proj.url || proj.link, 300),
    });
  }

  // 8. Publications Normalization
  const rawPubs = Array.isArray(raw.publications) ? raw.publications : [];
  const publications: NormalizedLinkedInPublication[] = [];
  for (const item of rawPubs) {
    if (typeof item === "string" && item.trim()) {
      publications.push({ title: item.trim().slice(0, 200) });
    } else if (typeof item === "object" && item !== null) {
      const pub = item as Record<string, unknown>;
      const pubTitle = cleanStr(pub.title || pub.name, 200);
      if (pubTitle) {
        publications.push({
          title: pubTitle,
          publisher: cleanStr(pub.publisher || pub.journal, 150),
          publishedAt: parseDateVal(pub.publishedAt || pub.publicationDate || pub.date),
          url: cleanStr(pub.url || pub.link, 300),
          description: cleanStr(pub.description || pub.summary, 1000),
        });
      }
    }
  }

  // 9. Awards Normalization
  const rawAwards = Array.isArray(raw.honorsAndAwards)
    ? raw.honorsAndAwards
    : Array.isArray(raw.awards)
      ? raw.awards
      : Array.isArray(raw.honors)
        ? raw.honors
        : [];
  const awards: NormalizedLinkedInAward[] = [];
  for (const item of rawAwards) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const awardTitle = cleanStr(a.title || a.name, 150);
    if (!awardTitle) continue;
    awards.push({
      title: awardTitle,
      issuer: cleanStr(a.issuer || a.organization || a.authority, 150),
      issuedAt: parseDateVal(a.issuedAt || a.issueDate || a.date),
      description: cleanStr(a.description || a.summary, 1000),
    });
  }

  // 10. Languages Normalization
  const rawLangs = Array.isArray(raw.languages) ? raw.languages : [];
  const languages: NormalizedLinkedInLanguage[] = [];
  for (const item of rawLangs) {
    if (typeof item === "string" && item.trim()) {
      languages.push({ language: item.trim().slice(0, 50) });
    } else if (typeof item === "object" && item !== null) {
      const l = item as Record<string, unknown>;
      const langName = cleanStr(l.language || l.name, 50);
      if (langName) {
        languages.push({
          language: langName,
          proficiency: cleanStr(l.proficiency || l.level, 50),
        });
      }
    }
  }

  // 11. Organizations Normalization
  const rawOrgs = Array.isArray(raw.organizations)
    ? raw.organizations
    : Array.isArray(raw.volunteering)
      ? raw.volunteering
      : [];
  const organizations: NormalizedLinkedInOrganization[] = [];
  for (const item of rawOrgs) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const orgName = cleanStr(o.name || o.organization, 150);
    if (!orgName) continue;
    organizations.push({
      name: orgName,
      position: cleanStr(o.position || o.role || o.title, 100),
      startDate: parseDateVal(o.startDate || o.start),
      endDate: parseDateVal(o.endDate || o.end),
    });
  }

  // 12. Interests Normalization (Categorized signals)
  const interests: NormalizedLinkedInProfile["interests"] = {
    topVoices: [],
    companies: [],
    groups: [],
    newsletters: [],
    schools: [],
  };

  if (Array.isArray(raw.interests)) {
    // Array format: e.g. [ { interestName: "Groups", items: [...] }, { interestName: "Companies", items: [...] } ]
    for (const entry of raw.interests) {
      if (!entry || typeof entry !== "object") continue;
      const catObj = entry as Record<string, unknown>;
      const catName = String(
        catObj.interestName || catObj.category || catObj.name || "",
      ).toLowerCase();
      const items = catObj.items || catObj.list || catObj.values || [entry];

      if (catName.includes("group")) {
        interests.groups.push(...normalizeInterestList(items));
      } else if (catName.includes("compan")) {
        interests.companies.push(...normalizeInterestList(items));
      } else if (catName.includes("newsletter")) {
        interests.newsletters.push(...normalizeInterestList(items));
      } else if (catName.includes("school") || catName.includes("universit")) {
        interests.schools.push(...normalizeInterestList(items));
      } else if (catName.includes("voice") || catName.includes("influencer")) {
        interests.topVoices.push(...normalizeInterestList(items));
      } else {
        // Generic interest item
        const normItem = normalizeInterestItem(entry);
        if (normItem) interests.companies.push(normItem);
      }
    }
  } else if (raw.interests && typeof raw.interests === "object") {
    const rawInt = raw.interests as Record<string, unknown>;
    interests.topVoices = normalizeInterestList(rawInt.topVoices || rawInt.influencers);
    interests.companies = normalizeInterestList(rawInt.companies);
    interests.groups = normalizeInterestList(rawInt.groups);
    interests.newsletters = normalizeInterestList(rawInt.newsletters);
    interests.schools = normalizeInterestList(rawInt.schools);
  }

  // Fallback to top level categories if available
  if (interests.topVoices.length === 0 && (raw.topVoices || raw.influencers)) {
    interests.topVoices = normalizeInterestList(raw.topVoices || raw.influencers);
  }
  if (interests.companies.length === 0 && raw.companies) {
    interests.companies = normalizeInterestList(raw.companies);
  }
  if (interests.groups.length === 0 && raw.groups) {
    interests.groups = normalizeInterestList(raw.groups);
  }
  if (interests.newsletters.length === 0 && raw.newsletters) {
    interests.newsletters = normalizeInterestList(raw.newsletters);
  }
  if (interests.schools.length === 0 && (raw.schools || raw.schoolsFollowed)) {
    interests.schools = normalizeInterestList(raw.schools || raw.schoolsFollowed);
  }

  // 13. Source Tracking
  const sources = [
    {
      source: "LinkedIn",
      url: canonicalUrl,
      retrievedAt,
    },
  ];

  return {
    identity: {
      name,
      headline,
      linkedinUrl: canonicalUrl,
      location,
    },
    currentRole,
    experience,
    education,
    skills,
    certifications,
    projects,
    publications,
    awards,
    languages,
    organizations,
    interests,
    about,
    profilePhoto,
    sources,
  };
}

/**
 * Validates and maps a source into a canonical PublicProfessionalSource
 */
function sanitizePublicSource(item: unknown, defaultUrl: string): PublicProfessionalSource | null {
  if (!item || typeof item !== "object") return null;
  const src = item as Record<string, unknown>;

  const rawUrl = cleanStr(src.url || src.link || src.uri, 500);
  const url =
    rawUrl && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) ? rawUrl : defaultUrl;
  if (!url) return null;

  const title =
    cleanStr(src.title || src.headline || src.name || "Public Professional Source", 200) ||
    "Public Professional Source";
  const rawType = String(src.sourceType || src.type || "")
    .toLowerCase()
    .trim();

  let sourceType: PublicSourceType = "other_professional";
  if (rawType.includes("linkedin_post") || rawType.includes("post") || rawType.includes("update")) {
    sourceType = "linkedin_post";
  } else if (
    rawType.includes("linkedin_profile") ||
    rawType.includes("profile") ||
    (url.includes("linkedin.com/in") && !url.includes("/posts/"))
  ) {
    sourceType = "linkedin_profile";
  } else if (
    rawType.includes("interview") ||
    rawType.includes("talk") ||
    rawType.includes("fireside")
  ) {
    sourceType = "interview";
  } else if (
    rawType.includes("podcast") ||
    rawType.includes("audio") ||
    rawType.includes("episode")
  ) {
    sourceType = "podcast";
  } else if (
    rawType.includes("conference") ||
    rawType.includes("speaker") ||
    rawType.includes("keynote")
  ) {
    sourceType = "conference_speaker";
  } else if (
    rawType.includes("company_bio") ||
    rawType.includes("bio") ||
    rawType.includes("team") ||
    rawType.includes("about_us")
  ) {
    sourceType = "company_bio";
  } else if (
    rawType.includes("personal_website") ||
    rawType.includes("website") ||
    rawType.includes("portfolio") ||
    rawType.includes("blog")
  ) {
    sourceType = "personal_website";
  } else if (rawType.includes("press") || rawType.includes("news") || rawType.includes("mention")) {
    sourceType = "press_mention";
  } else if (
    rawType.includes("article") ||
    rawType.includes("publication") ||
    rawType.includes("paper")
  ) {
    sourceType = "article";
  }

  const date = parseDateVal(src.date || src.publishedAt || src.publishedDate || src.year);
  const summary =
    cleanStr(src.summary || src.description || src.content || src.snippet, 600) ||
    `Public professional information from ${title}.`;
  const relevance =
    cleanStr(src.relevance || src.relevanceSummary || src.reason, 300) ||
    `Provides public evidence of professional background and expertise.`;

  return {
    url,
    sourceType,
    title,
    date,
    summary,
    relevance,
  };
}

/**
 * Normalizes raw researched data into the Stage 1 canonical StructuredResearchData object.
 * Strictly adheres to schema:
 * {
 *   identity: {},
 *   career: {},
 *   education: [],
 *   skills: [],
 *   activity: { posts: [], articles: [], recurringTopics: [] },
 *   publicSources: [],
 *   researchMetadata: { researchedAt: "", sourceCount: 0, status: "" }
 * }
 */
export function normalizeStructuredResearch(
  raw: Record<string, unknown>,
  fallbackUrl?: string,
  fallbackName?: string,
  providerName: string = "ColdConnectResearchEngine",
): StructuredResearchData {
  const researchedAt = new Date().toISOString();
  const normProfile = normalizeLinkedInProfile(raw, fallbackUrl);

  // 1. Identity
  const fullName =
    cleanStr(raw.fullName || raw.name, 150) ||
    normProfile.identity.name ||
    fallbackName ||
    "Professional";
  const name = cleanStr(raw.name, 100) || fullName.split(" ")[0] || "Professional";
  const headline = cleanStr(raw.headline || raw.tagline, 250) || normProfile.identity.headline;
  const linkedinUrl = normProfile.identity.linkedinUrl;
  const location =
    cleanStr(raw.location || raw.formattedLocation, 150) || normProfile.identity.location;
  const about = cleanStr(raw.about || raw.summary, 2500) || normProfile.about;
  const profilePhoto = normProfile.profilePhoto;
  const currentCompany =
    normProfile.currentRole.company || cleanStr(raw.currentCompany || raw.company, 150);
  const currentTitle =
    normProfile.currentRole.title || cleanStr(raw.currentRole || raw.role || raw.title, 150);

  // Websites
  const websites: Array<{ url: string; label?: string }> = [];
  if (Array.isArray(raw.websites)) {
    for (const w of raw.websites) {
      if (typeof w === "string" && w.startsWith("http")) {
        websites.push({ url: w });
      } else if (typeof w === "object" && w !== null) {
        const wObj = w as Record<string, unknown>;
        const wUrl = cleanStr(wObj.url || wObj.link, 300);
        if (wUrl && (wUrl.startsWith("http://") || wUrl.startsWith("https://"))) {
          websites.push({
            url: wUrl,
            label: cleanStr(wObj.label || wObj.title || wObj.name, 50),
          });
        }
      }
    }
  } else if (typeof raw.website === "string" && raw.website.startsWith("http")) {
    websites.push({ url: raw.website, label: "Personal Website" });
  }

  const identity: StructuredResearchData["identity"] = {
    name,
    fullName,
    headline,
    linkedinUrl,
    location,
    about,
    profilePhoto,
    currentCompany,
    currentTitle,
    websites: websites.length > 0 ? websites : undefined,
  };

  // 2. Career (Current Role, Previous Roles, Transitions, Experience Years, Industry Specialties)
  const currentRole: StructuredResearchData["career"]["currentRole"] = {
    title: normProfile.currentRole.title || currentTitle,
    company: normProfile.currentRole.company || currentCompany,
    companyLinkedinUrl: normProfile.currentRole.companyLinkedinUrl,
    location: normProfile.currentRole.location,
    startDate: normProfile.currentRole.startDate,
    duration: normProfile.currentRole.duration,
    description: normProfile.currentRole.description,
    highlights: Array.isArray(raw.currentRoleHighlights)
      ? (raw.currentRoleHighlights as string[]).map((s) => String(s).slice(0, 300))
      : undefined,
  };

  const previousRoles: StructuredResearchData["career"]["previousRoles"] = [];
  const rawExperiences = normProfile.experience;

  // If first experience is identical to currentRole, start previousRoles from index 1
  const startIndex =
    rawExperiences.length > 0 &&
    rawExperiences[0].title === currentRole.title &&
    rawExperiences[0].company === currentRole.company
      ? 1
      : 0;

  for (let i = startIndex; i < rawExperiences.length; i++) {
    const exp = rawExperiences[i];
    previousRoles.push({
      title: exp.title,
      company: exp.company,
      companyLinkedinUrl: exp.companyLinkedinUrl,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate,
      duration: exp.duration,
      description: exp.description,
      highlights: undefined,
    });
  }

  // Transitions: Extract explicitly supplied transitions or derive chronologically
  const transitions: CareerTransition[] = [];
  if (Array.isArray(raw.transitions) && raw.transitions.length > 0) {
    for (const t of raw.transitions) {
      if (!t || typeof t !== "object") continue;
      const tObj = t as Record<string, unknown>;
      const toRole = cleanStr(tObj.toRole || tObj.role || tObj.toTitle, 150) || "Advanced Role";
      const toCompany =
        cleanStr(tObj.toCompany || tObj.company || tObj.toOrg, 150) || "Organization";
      transitions.push({
        fromRole: cleanStr(tObj.fromRole || tObj.fromTitle, 150),
        fromCompany: cleanStr(tObj.fromCompany || tObj.fromOrg, 150),
        toRole,
        toCompany,
        year: parseDateVal(tObj.year || tObj.date),
        transitionType: cleanStr(tObj.transitionType || tObj.type, 100) || "Career Advancement",
        description:
          cleanStr(tObj.description || tObj.context, 400) ||
          `Transitioned to ${toRole} at ${toCompany}.`,
      });
    }
  } else if (rawExperiences.length >= 2) {
    for (let i = 0; i < rawExperiences.length - 1; i++) {
      const current = rawExperiences[i];
      const previous = rawExperiences[i + 1];
      if (current.company !== previous.company || current.title !== previous.title) {
        const isPromotion = current.company === previous.company;
        transitions.push({
          fromRole: previous.title,
          fromCompany: previous.company,
          toRole: current.title,
          toCompany: current.company,
          year: current.startDate || current.duration || undefined,
          transitionType: isPromotion
            ? "Internal Promotion / Role Expansion"
            : "Company & Domain Shift",
          description: isPromotion
            ? `Advanced from ${previous.title} to ${current.title} at ${current.company}.`
            : `Transitioned from ${previous.title} at ${previous.company} to ${current.title} at ${current.company}.`,
        });
      }
    }
  }

  // Specialties
  const industrySpecialties: string[] = [];
  if (Array.isArray(raw.industrySpecialties)) {
    industrySpecialties.push(
      ...raw.industrySpecialties.map((s) => String(s).trim().slice(0, 100)).filter(Boolean),
    );
  } else if (Array.isArray(raw.specialties)) {
    industrySpecialties.push(
      ...raw.specialties.map((s) => String(s).trim().slice(0, 100)).filter(Boolean),
    );
  }

  const career: StructuredResearchData["career"] = {
    currentRole,
    previousRoles,
    transitions,
    totalExperienceYears:
      typeof raw.totalExperienceYears === "number" ? raw.totalExperienceYears : undefined,
    industrySpecialties: industrySpecialties.length > 0 ? industrySpecialties : undefined,
  };

  // 3. Education
  const education: ResearchEducationItem[] = normProfile.education.map((e) => ({
    institution: e.institution,
    degree: e.degree,
    fieldOfStudy: e.fieldOfStudy,
    startDate: e.startDate,
    endDate: e.endDate,
    year: [e.startDate, e.endDate].filter(Boolean).join(" - ") || undefined,
  }));

  // 4. Skills
  const skills: Array<ResearchSkillItem | string> = [];
  for (const s of normProfile.skills) {
    if (s.associatedExperience) {
      skills.push({
        name: s.name,
        category: s.associatedExperience,
      });
    } else {
      skills.push(s.name);
    }
  }

  // 5. Activity (Posts, Articles, Recurring Topics)
  const posts: ResearchActivityPost[] = [];
  const articles: ResearchActivityArticle[] = [];
  const recurringTopics: ResearchRecurringTopic[] = [];

  const rawActivity =
    typeof raw.activity === "object" && raw.activity !== null
      ? (raw.activity as Record<string, unknown>)
      : {};

  // Extract Posts
  const rawPosts = Array.isArray(rawActivity.posts)
    ? rawActivity.posts
    : Array.isArray(raw.posts)
      ? raw.posts
      : Array.isArray(raw.recentPosts)
        ? raw.recentPosts
        : [];

  for (const p of rawPosts) {
    if (!p) continue;
    if (typeof p === "string" && p.trim()) {
      posts.push({
        text: p.trim().slice(0, 1000),
        snippet: p.trim().slice(0, 150),
      });
    } else if (typeof p === "object") {
      const pObj = p as Record<string, unknown>;
      const text = cleanStr(pObj.text || pObj.content || pObj.body || pObj.snippet, 1500);
      if (!text) continue;
      posts.push({
        title: cleanStr(pObj.title, 150),
        snippet: cleanStr(pObj.snippet, 200) || text.slice(0, 150),
        text,
        url: cleanStr(pObj.url || pObj.link, 300),
        date: parseDateVal(pObj.date || pObj.postedAt || pObj.time),
        engagement: cleanStr(pObj.engagement || pObj.reactions || pObj.likes, 100),
        topics: Array.isArray(pObj.topics)
          ? (pObj.topics as string[]).map((t) => String(t).slice(0, 50))
          : undefined,
      });
    }
  }

  // Extract Articles & Publications
  const rawArticles = Array.isArray(rawActivity.articles)
    ? rawActivity.articles
    : Array.isArray(raw.articles)
      ? raw.articles
      : normProfile.publications;

  for (const a of rawArticles) {
    if (!a) continue;
    if (typeof a === "string" && a.trim()) {
      articles.push({
        title: a.trim().slice(0, 200),
      });
    } else if (typeof a === "object") {
      const aObj = a as Record<string, unknown>;
      const title = cleanStr(aObj.title || aObj.name, 200);
      if (!title) continue;
      articles.push({
        title,
        url: cleanStr(aObj.url || aObj.link, 300),
        date: parseDateVal(aObj.date || aObj.publishedAt || aObj.publicationDate),
        publisher: cleanStr(aObj.publisher || aObj.journal || aObj.source, 150),
        summary: cleanStr(aObj.summary || aObj.description, 600),
        topics: Array.isArray(aObj.topics)
          ? (aObj.topics as string[]).map((t) => String(t).slice(0, 50))
          : undefined,
      });
    }
  }

  // Extract Recurring Topics
  const rawRecurring = Array.isArray(rawActivity.recurringTopics)
    ? rawActivity.recurringTopics
    : Array.isArray(raw.recurringTopics)
      ? raw.recurringTopics
      : [];

  for (const rt of rawRecurring) {
    if (!rt) continue;
    if (typeof rt === "string" && rt.trim()) {
      recurringTopics.push({
        topic: rt.trim().slice(0, 100),
        relevance: `Recurring area of professional focus.`,
      });
    } else if (typeof rt === "object") {
      const rtObj = rt as Record<string, unknown>;
      const topic = cleanStr(rtObj.topic || rtObj.name || rtObj.theme, 100);
      if (!topic) continue;
      recurringTopics.push({
        topic,
        frequency:
          typeof rtObj.frequency === "number" || typeof rtObj.frequency === "string"
            ? rtObj.frequency
            : "Regular",
        relevance:
          cleanStr(rtObj.relevance || rtObj.why, 250) ||
          `Focus area evidenced in public work and discussions.`,
        evidence: Array.isArray(rtObj.evidence)
          ? (rtObj.evidence as string[]).map((e) => String(e).slice(0, 200))
          : undefined,
      });
    }
  }

  // If recurringTopics is empty, derive from top skill / interest themes
  if (recurringTopics.length === 0) {
    const topSkills = normProfile.skills.slice(0, 3);
    for (const sk of topSkills) {
      recurringTopics.push({
        topic: sk.name,
        frequency: "Regular",
        relevance: `Key professional competency and core focus area.`,
      });
    }
  }

  const activity: StructuredResearchData["activity"] = {
    posts,
    articles,
    recurringTopics,
  };

  // 6. Public Sources (Attributable external sources)
  const publicSourcesMap = new Map<string, PublicProfessionalSource>();

  // Add LinkedIn primary profile source
  publicSourcesMap.set(linkedinUrl, {
    url: linkedinUrl,
    sourceType: "linkedin_profile",
    title: `${fullName} - LinkedIn Profile`,
    date: parseDateVal(raw.retrievedAt) || new Date().getFullYear().toString(),
    summary: `Verified public LinkedIn profile containing employment record and credentials for ${fullName}.`,
    relevance:
      "Primary authoritative source for career chronology, titles, and educational background.",
  });

  // Parse raw.publicSources
  const rawSourcesList = Array.isArray(raw.publicSources)
    ? raw.publicSources
    : Array.isArray(raw.sources)
      ? raw.sources
      : [];

  for (const s of rawSourcesList) {
    const sanitized = sanitizePublicSource(s, linkedinUrl);
    if (sanitized && !publicSourcesMap.has(sanitized.url)) {
      publicSourcesMap.set(sanitized.url, sanitized);
    }
  }

  // Include personal websites
  for (const site of websites) {
    if (!publicSourcesMap.has(site.url)) {
      publicSourcesMap.set(site.url, {
        url: site.url,
        sourceType: "personal_website",
        title: site.label ? `${fullName} - ${site.label}` : `${fullName} - Personal Website`,
        summary: `Public website / portfolio associated with ${fullName}.`,
        relevance: "Directly attributable professional portfolio and public works.",
      });
    }
  }

  // Include article sources
  for (const art of articles) {
    if (art.url && !publicSourcesMap.has(art.url)) {
      publicSourcesMap.set(art.url, {
        url: art.url,
        sourceType: "article",
        title: art.title,
        date: art.date,
        summary: art.summary || `Public article published by ${fullName}.`,
        relevance: "Public writing illustrating subject matter depth and industry focus.",
      });
    }
  }

  const publicSources = Array.from(publicSourcesMap.values());

  // 7. Research Metadata
  const researchMetadata: StructuredResearchData["researchMetadata"] = {
    researchedAt,
    sourceCount: publicSources.length,
    status: publicSources.length > 0 ? "completed" : "partial",
    provider: providerName,
    version: "2.0",
  };

  return {
    identity,
    career,
    education,
    skills,
    activity,
    publicSources,
    researchMetadata,
  };
}

/**
 * Backward compatibility helper for legacy format normalization
 */
export class NormalizationService {
  static normalize(rawResult: RawResearchResult, originalName: string): NormalizedPersonInfo {
    const raw = rawResult.rawProfileData || {};
    const norm = normalizeLinkedInProfile(raw, rawResult.sources[0]?.url);

    const education: EducationItem[] = norm.education.map((e) => ({
      school: e.institution,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      year: [e.startDate, e.endDate].filter(Boolean).join(" - ") || undefined,
    }));

    const experience: ExperienceItem[] = norm.experience.map((e) => ({
      company: e.company,
      role: e.title,
      duration: e.duration || [e.startDate, e.endDate].filter(Boolean).join(" - ") || undefined,
      description: e.description,
    }));

    const skills: string[] = norm.skills.map((s) => s.name);
    const achievements: string[] = norm.awards.map((a) =>
      a.issuer ? `${a.title} (${a.issuer})` : a.title,
    );
    const publications: string[] = norm.publications.map((p) => p.title);

    // Interest signals
    const allInterestSignals: string[] = [
      ...norm.interests.companies.map((c) => c.name),
      ...norm.interests.groups.map((g) => g.name),
      ...norm.interests.newsletters.map((n) => n.name),
      ...norm.interests.topVoices.map((v) => v.name),
    ];

    const sources: ResearchRawSource[] = norm.sources.map((s) => ({
      title: `${norm.identity.name} - LinkedIn Profile`,
      url: s.url,
      source: s.source,
      type: "professional",
      retrievedAt: s.retrievedAt,
    }));

    return {
      name: originalName || norm.identity.name,
      education,
      experience,
      skills,
      interests: allInterestSignals,
      achievements,
      publications,
      sources,
    };
  }
}

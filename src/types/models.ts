export interface UserProfile {
  fullName: string;
  headline: string;
  location: string;
  photoURL?: string;
  linkedinURL?: string;
  instagramHandle?: string;
  email?: string;
  website?: string;
  about?: string;
  careerGoals?: string;
  networkingGoals?: string;
  conversationStyle?: string;
  interests?: string[];
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    period?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    fieldOfStudy?: string;
    year?: string;
  }>;
  profileHighlights?: string[];
  completenessScore?: number;
  updatedAt?: string;

  linkedinImported?: boolean;
  linkedinResearchStatus?: "researching" | "completed" | "failed";
  linkedinImportedAt?: string;
  linkedinResearchData?: unknown;
  profileCompleteness?: number;

  currentFocus?: string;
  whatImLookingFor?: string[];

  pitchDNA?: {
    whoIAm?: string;
    whatIDo?: string;
    whatIveBuilt?: string[];
    strongestProofPoints?: string[];
    skills?: string[];
    industries?: string[];
    currentFocus?: string;
    whatImLookingFor?: string[];
    credibleDifferentiators?: string[];
    story?: string;
  };
  education?: Array<{
    school: string;
    degree: string;
    year?: string;
  }>;
  profileHighlights?: string[];
  completenessScore?: number;
  updatedAt?: string;
}

export type ResearchStatus =
  | "not_started"
  | "not_researched"
  | "queued"
  | "researching"
  | "analyzing"
  | "completed"
  | "failed";

export interface ResearchSource {
  source: string;
  url?: string;
  retrievedAt: string;
  type?: string;
}

export interface ResearchRawSource {
  title: string;
  url: string;
  source: string;
  type: "professional" | "company" | "publication" | "social" | "web" | string;
  retrievedAt: string;
  content?: string;
}

export type PublicSourceType =
  | "linkedin_profile"
  | "linkedin_post"
  | "article"
  | "interview"
  | "podcast"
  | "conference_speaker"
  | "company_bio"
  | "personal_website"
  | "press_mention"
  | "other_professional";

export interface PublicProfessionalSource {
  url: string;
  sourceType: PublicSourceType;
  title: string;
  date?: string;
  summary: string;
  relevance: string;
}

export interface ResearchActivityPost {
  title?: string;
  snippet?: string;
  text: string;
  url?: string;
  date?: string;
  engagement?: string;
  topics?: string[];
}

export interface ResearchActivityArticle {
  title: string;
  url?: string;
  date?: string;
  publisher?: string;
  summary?: string;
  topics?: string[];
}

export interface ResearchRecurringTopic {
  topic: string;
  frequency?: string | number;
  relevance: string;
  evidence?: string[];
}

export interface ResearchActivity {
  posts: ResearchActivityPost[];
  articles: ResearchActivityArticle[];
  recurringTopics: ResearchRecurringTopic[];
}

export interface CareerTransition {
  fromRole?: string;
  fromCompany?: string;
  toRole: string;
  toCompany: string;
  year?: string;
  transitionType?: string;
  description?: string;
}

export interface ResearchCareerInfo {
  currentRole: {
    title?: string;
    company?: string;
    companyLinkedinUrl?: string;
    location?: string;
    startDate?: string;
    duration?: string;
    description?: string;
    highlights?: string[];
  };
  previousRoles: Array<{
    title: string;
    company: string;
    companyLinkedinUrl?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    duration?: string;
    description?: string;
    highlights?: string[];
  }>;
  transitions: CareerTransition[];
  totalExperienceYears?: number;
  industrySpecialties?: string[];
}

export interface ResearchIdentity {
  name: string;
  fullName: string;
  headline?: string;
  linkedinUrl: string;
  location?: string;
  about?: string;
  profilePhoto?: string;
  currentCompany?: string;
  currentTitle?: string;
  websites?: Array<{ url: string; label?: string }>;
}

export interface ResearchEducationItem {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  year?: string;
  activities?: string;
  honors?: string[];
}

export interface ResearchSkillItem {
  name: string;
  category?: string;
  endorsementCount?: number;
}

export interface StructuredResearchData {
  identity: ResearchIdentity;
  career: ResearchCareerInfo;
  education: ResearchEducationItem[];
  skills: Array<ResearchSkillItem | string>;
  activity: ResearchActivity;
  publicSources: PublicProfessionalSource[];
  researchMetadata: {
    researchedAt: string;
    sourceCount: number;
    status: "completed" | "partial" | "failed" | string;
    provider?: string;
    version?: string;
  };
}

export interface EducationItem {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  year?: string;
}

export interface ExperienceItem {
  company: string;
  role: string;
  duration?: string;
  description?: string;
}

export interface NormalizedLinkedInExperience {
  title: string;
  company: string;
  companyLinkedinUrl?: string;
  location?: string;
  employmentType?: string;
  workplaceType?: string;
  duration?: string;
  description?: string;
  skills?: string[];
  startDate?: string;
  endDate?: string;
}

export interface NormalizedLinkedInEducation {
  institution: string;
  institutionLinkedinUrl?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
}

export interface NormalizedLinkedInSkill {
  name: string;
  associatedExperience?: string;
}

export interface NormalizedLinkedInCertification {
  name: string;
  issuingOrganization?: string;
  issueDate?: string;
  expirationDate?: string;
  credentialUrl?: string;
}

export interface NormalizedLinkedInProject {
  title: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface NormalizedLinkedInPublication {
  title: string;
  publisher?: string;
  publishedAt?: string;
  url?: string;
  description?: string;
}

export interface NormalizedLinkedInAward {
  title: string;
  issuer?: string;
  issuedAt?: string;
  description?: string;
}

export interface NormalizedLinkedInLanguage {
  language: string;
  proficiency?: string;
}

export interface NormalizedLinkedInOrganization {
  name: string;
  position?: string;
  startDate?: string;
  endDate?: string;
}

export interface NormalizedInterestItem {
  name: string;
  description?: string;
  url?: string;
}

export interface NormalizedLinkedInInterests {
  topVoices: NormalizedInterestItem[];
  companies: NormalizedInterestItem[];
  groups: NormalizedInterestItem[];
  newsletters: NormalizedInterestItem[];
  schools: NormalizedInterestItem[];
}

export interface NormalizedLinkedInProfile {
  identity: {
    name: string;
    headline?: string;
    linkedinUrl: string;
    location?: string;
  };
  currentRole: {
    title?: string;
    company?: string;
    companyLinkedinUrl?: string;
    location?: string;
    employmentType?: string;
    workplaceType?: string;
    startDate?: string;
    description?: string;
  };
  experience: NormalizedLinkedInExperience[];
  education: NormalizedLinkedInEducation[];
  skills: NormalizedLinkedInSkill[];
  certifications: NormalizedLinkedInCertification[];
  projects: NormalizedLinkedInProject[];
  publications: NormalizedLinkedInPublication[];
  awards: NormalizedLinkedInAward[];
  languages: NormalizedLinkedInLanguage[];
  organizations: NormalizedLinkedInOrganization[];
  interests: NormalizedLinkedInInterests;
  about?: string;
  profilePhoto?: string;
  sources: Array<{
    source: string;
    url: string;
    retrievedAt: string;
  }>;
}

export interface NormalizedPersonInfo {
  name: string;
  headline?: string;
  company?: string;
  role?: string;
  location?: string;
  education: Array<EducationItem | string>;
  experience: Array<ExperienceItem | string>;
  skills: string[];
  interests: string[];
  achievements: string[];
  publications: string[];
  sources: ResearchRawSource[];
}

export interface RelevantInterestItem {
  label: string;
  interest?: string;
  reason?: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  category?: "professional" | "priority" | "intellectual" | "theme" | string;
}

export interface CommonGroundItem {
  point: string;
  connection?: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface BestOpeningItem {
  opening: string;
  why: string;
  evidence: string;
  tone?: string;
}

export interface ConversationHookItem {
  topic: string;
  hook?: string;
  observation?: string;
  question?: string;
  why: string;
  whyItWorks?: string;
  whyItMatters?: string;
  suggestedApproach?: string;
  evidence: string;
  confidence?: "high" | "medium" | "low";
}

export interface RecommendedQuestionItem {
  question: string;
  reason: string;
  category: string;
  ladderLevel?: 1 | 2 | 3 | 4 | 5 | number;
  objective?: string;
  followUps?: string[];
}

export interface YourAngleItem {
  positioning: string;
  relevance: string;
  whyRelevant?: string;
  value: string;
  valueYouCanOffer?: string;
}

export interface CareerTransitionItem {
  from: string;
  to: string;
  transitionType: string;
  context: string;
  mentorshipOpportunity: string;
  suggestedQuestion: string;
}

export interface MentorshipFitData {
  whyThisPerson: string;
  whatYouCanLearn: string[];
  whyTheyWouldHelp: string;
  mostRelevantExperience: string;
  uniquelyQualifiedAsk: string;
}

export interface WhatTheyCareAboutData {
  coreProfessionalInterests: string[];
  currentPriorities: string[];
  intellectualInterests: string[];
  careerThemes: string[];
}

export interface MentorshipQuestionLadder {
  level1Warmup: { question: string; reason: string; objective: string };
  level2Experience: { question: string; reason: string; objective: string };
  level3Decision: { question: string; reason: string; objective: string };
  level4Insight: { question: string; reason: string; objective: string };
  level5Advice: { question: string; reason: string; objective: string };
}

export interface CandidateIntroductionData {
  spokenPitch: string;
  structure: {
    whoIAm: string;
    currentFocus: string;
    whyThisExpert: string;
    learningGoal: string;
  };
}

export interface OutreachMessageData {
  text: string;
  wordCount?: number;
}

export interface PersonIntelligenceData {
  careerSnapshot: {
    summary: string;
    keyPoints: string[];
  };
  whatTheyCareAbout?: WhatTheyCareAboutData;
  currentFocus: {
    summary: string;
    evidence: string[];
  };
  careerTransitions?: CareerTransitionItem[];
  mentorshipFit?: MentorshipFitData;
  relevantInterests: RelevantInterestItem[];
  commonGround: CommonGroundItem[];
  bestOpening: BestOpeningItem;
  questionLadder?: MentorshipQuestionLadder;
  conversationHooks: ConversationHookItem[];
  recommendedQuestions: RecommendedQuestionItem[];
  candidateIntroduction?: CandidateIntroductionData;
  outreachMessage?: OutreachMessageData;
  thingsToAvoid: string[];
  whyConnect: string;
  yourAngle: YourAngleItem;
  meetingStrategy?: {
    opening: string;
    middle: string;
    closing: string;
  };
}

export type IntelligenceStatus =
  "not_started" | "generating" | "analyzing" | "completed" | "failed";

// ================= STAGE 2: PERSON INTELLIGENCE SCHEMA =================
export interface IntelligenceProfessionalIdentity {
  summary: string;
  expertise: string[];
  industries: string[];
}

export interface IntelligenceCurrentFocus {
  summary: string;
  evidence: string[];
}

export interface IntelligenceInterest {
  topic: string;
  confidence: "high" | "medium";
  evidence: string[];
}

export interface IntelligenceRecurringTheme {
  theme: string;
  description: string;
  confidence: "high" | "medium";
  evidence: string[];
}

export interface IntelligenceCareerTransition {
  from: string;
  to: string;
  whyItMatters: string;
  evidence: string[];
}

export interface IntelligenceKeyExpertise {
  area: string;
  description: string;
  confidence: "high" | "medium";
  evidence: string[];
}

export interface IntelligenceProfessionalSignal {
  signal: string;
  description: string;
  confidence: "high" | "medium";
  evidence: string[];
}

export interface IntelligenceMentorshipValue {
  area: string;
  whyCandidateCouldLearnFromThem: string;
  evidence: string[];
}

export interface IntelligenceResearchQuality {
  confidence: "high" | "medium" | string;
  sourceCount: number;
  limitations: string[];
}

export interface StructuredPersonIntelligence {
  professionalIdentity: IntelligenceProfessionalIdentity;
  currentFocus: IntelligenceCurrentFocus;
  interests: IntelligenceInterest[];
  recurringThemes: IntelligenceRecurringTheme[];
  careerTransitions: IntelligenceCareerTransition[];
  keyExpertise: IntelligenceKeyExpertise[];
  professionalSignals: IntelligenceProfessionalSignal[];
  mentorshipValue: IntelligenceMentorshipValue[];
  researchQuality: IntelligenceResearchQuality;
}

export interface PersonIntelligence {
  careerSnapshot: string;
  currentFocus: string;
  interests: string[];
  experience: Array<string | ExperienceItem>;
  education: Array<string | EducationItem>;
  skills: string[];
  achievements: string[];
  publications: string[];
  conversationHooks: string[];
  recommendedQuestions: string[];
  commonGround: string[];
  thingsToAvoid: string[];
  confidence: number;
}

export interface ResearchData {
  rawProfile?: Record<string, unknown>;
  normalizedProfile?: NormalizedLinkedInProfile;
  rawSources?: ResearchRawSource[];
  normalizedInformation?: NormalizedPersonInfo;
  structuredResearch?: StructuredResearchData;
  sourceCount?: number;
}

export interface Connection {
  id?: string;
  // User-provided core fields
  name: string;
  company?: string;
  role?: string;
  linkedinURL?: string;
  linkedinUrl?: string; // alias for compatibility
  instagramHandle?: string;
  email?: string;
  profileImage?: string;
  meetingPurpose?: string;
  relationshipStatus?: "new" | "requested" | "connected" | "met" | "warm" | "strong" | string;
  notes?: string[] | string;
  interests?: string[];
  tags?: string[];

  // Field source attribution (user vs AI)
  fieldSources?: Record<string, "user" | "ai">;

  // AI-enriched research fields
  careerSnapshot?: string;
  currentFocus?: string;
  education?: Array<string | EducationItem>;
  experience?: Array<string | ExperienceItem>;
  skills?: string[];
  achievements?: string[];
  publications?: string[];
  conversationHooks?: string[];
  recommendedQuestions?: string[];
  commonGround?: string[];
  thingsToAvoid?: string[];

  // Structured Research & Intelligence objects
  structuredResearch?: StructuredResearchData;
  researchData?: ResearchData;
  intelligence?: StructuredPersonIntelligence | PersonIntelligence;
  structuredIntelligence?: StructuredPersonIntelligence;
  intelligenceData?: PersonIntelligenceData;
  intelligenceStatus?: IntelligenceStatus;
  intelligenceGeneratedAt?: string;
  intelligenceVersion?: string;
  intelligenceError?: string;

  // Research tracking metadata
  researchStatus?: ResearchStatus;
  researchStartedAt?: string;
  researchCompletedAt?: string;
  researchError?: string;
  researchSources?: ResearchSource[];
  lastResearchUpdatedAt?: string;

  // Mentorship Match fields (Stage 3)
  mentorshipMatch?: MentorshipMatch;
  mentorshipStatus?: MentorshipStatus;
  mentorshipGeneratedAt?: string;
  mentorshipError?: string;

  // Personalized Conversation Strategy fields (Stage 4)
  conversationStrategy?: ConversationStrategy;
  conversationStatus?: ConversationStatus;
  conversationGeneratedAt?: string;
  conversationError?: string;

  lastInteractionAt?: string;
  nextFollowupAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Meeting {
  id?: string;
  connectionId: string;
  connectionName?: string;
  connectionRole?: string;
  connectionCompany?: string;
  connectionImage?: string;
  title: string;
  scheduledAt: string;
  location?: string;
  purpose?: string;
  notes?: string;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
  preparationScore?: number;
  preparationItems?: {
    personResearched?: boolean;
    questionsPrepared?: boolean;
    pitchPracticed?: boolean;
    conversationPlanPrepared?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Interaction {
  id?: string;
  connectionId: string;
  type: string;
  channel: string;
  notes: string;
  rating?: "great" | "good" | "okay" | "not_great" | string;
  occurredAt: string;
  createdAt?: string;
}

export interface PitchCoachScores {
  overall: number;
  personalization: number;
  relevance: number;
  clarity: number;
  credibility: number;
  memorability: number;
  conversational: number;
}

export interface PitchCoachWhatWorked {
  point: string;
  evidence: string;
}

export interface PitchCoachImprovement {
  issue: string;
  whyItMatters: string;
  fix: string;
}

export interface PitchCoachMissedOpportunity {
  point: string;
  reason: string;
}

export interface PitchCoachAnalysisResult {
  scores: PitchCoachScores;
  durationSeconds: number;
  summary: string;
  whatWorked: PitchCoachWhatWorked[];
  improvements: PitchCoachImprovement[];
  missedOpportunity: PitchCoachMissedOpportunity;
  strongestElement: string;
  strongerPitch: string;
  nextPracticeFocus: string;
}

export interface PitchSession {
  id?: string;
  userId?: string;
  connectionId: string;
  connectionName?: string;
  targetPersonName?: string;
  meetingId?: string;
  meetingPurpose?: string;
  createdAt: string;
  transcript: string;
  durationSeconds: number;
  scores: PitchCoachScores;
  overallScore?: number; // legacy & convenience getter
  summary: string;
  whatWorked: PitchCoachWhatWorked[];
  improvements: PitchCoachImprovement[];
  missedOpportunity: PitchCoachMissedOpportunity;
  strongestElement: string;
  strongerPitch: string;
  nextPracticeFocus: string;
  isSaved?: boolean;
  audioURL?: string;
}

export interface Followup {
  id?: string;
  connectionId: string;
  channel: string;
  message: string;
  scheduledAt: string;
  status: "draft" | "scheduled" | "sent";
  sentAt?: string;
  createdAt?: string;
}

// ================= STAGE 3: MENTORSHIP MATCH =================
export type MentorshipStatus = "not_started" | "generating" | "analyzing" | "completed" | "failed";

export interface MentorshipFit {
  score: number;
  level: "high" | "medium" | "low";
  reason: string;
}

export interface WhatCandidateCanLearn {
  area: string;
  reason: string;
  expertEvidence: string;
  candidateRelevance: string;
}

export interface MentorshipSharedGround {
  topic: string;
  reason: string;
}

export interface MentorshipComplementaryExperience {
  expertExperience: string;
  candidateNeed: string;
  value: string;
}

export interface MentorshipBestEntryPoint {
  topic: string;
  reason: string;
  suggestedApproach: string;
}

export interface MentorshipMatch {
  matchSummary: string;
  mentorshipFit: MentorshipFit;
  whyThisPerson: string;
  whatCandidateCanLearn: WhatCandidateCanLearn[];
  sharedGround: MentorshipSharedGround[];
  complementaryExperience: MentorshipComplementaryExperience[];
  bestEntryPoint: MentorshipBestEntryPoint;
  candidateAngle: string;
  mentorshipOpportunity: string;
  relationshipPotential: string;
  limitations: string[];
  generatedAt?: string;
  meetingPurpose?: string;
}

// ================= STAGE 4: CONVERSATION INTELLIGENCE =================
export type ConversationStatus =
  "not_started" | "generating" | "analyzing" | "completed" | "failed";

export interface ConversationStrategyMeta {
  coreObjective: string;
  bestEntryPoint: string;
  whyThisEntryPoint: string;
}

export interface ConversationBestOpening {
  text: string;
  whyItWorks: string;
}

export interface CandidateIntroductionData {
  text?: string;
  whyItWorks?: string;
  spokenPitch?: string;
  structure?: {
    whoIAm: string;
    currentFocus: string;
    whyThisExpert: string;
    learningGoal: string;
  };
}

export interface ConversationHook {
  topic: string;
  observation: string;
  question: string;
  whyItMatters: string;
}

export interface QuestionLadderItem {
  level: 1 | 2 | 3 | 4 | 5;
  question: string;
  intent: string;
}

export interface FollowUpQuestionGroup {
  trigger: string;
  followUps: string[];
}

export interface MentorshipQuestionItem {
  question: string;
  intent?: string;
}

export interface QuestionToAvoidItem {
  avoid: string;
  reason: string;
  betterAlternative?: string;
}

export interface ConversationStrategy {
  conversationStrategy: {
    coreObjective: string;
    bestEntryPoint: string;
    whyThisEntryPoint: string;
  };
  bestOpening: {
    text: string;
    whyItWorks: string;
  };
  candidateIntroduction: {
    text: string;
    whyItWorks: string;
  };
  conversationHooks: ConversationHook[];
  questionLadder: QuestionLadderItem[];
  followUpQuestions: FollowUpQuestionGroup[];
  mentorshipQuestions: Array<string | MentorshipQuestionItem>;
  questionsToAvoid: Array<string | QuestionToAvoidItem>;
  candidateAngle: string;
  mentorshipAsk: string;
  closingStrategy: string;
  generatedAt?: string;
  meetingPurpose?: string;
}

const content = $input.first().json.choices?.[0]?.message?.content;
if (typeof content !== 'string' || !content.trim()) {
  throw new Error('The model response did not contain report content');
}
let report;
try {
  report = JSON.parse(content);
} catch (error) {
  throw new Error(`The model returned invalid JSON: ${error.message}`);
}
const required = ['company_background', 'recent_news', 'role_requirements', 'experience_match', 'projects_to_highlight', 'skill_gaps', 'interview_questions'];
for (const field of required) {
  if (!(field in report)) throw new Error(`Report is missing required section: ${field}`);
}
for (const field of ['recent_news', 'experience_match', 'projects_to_highlight', 'skill_gaps', 'interview_questions']) {
  if (!Array.isArray(report[field])) throw new Error(`Report section ${field} must be an array`);
}
if (report.interview_questions.length !== 5 || report.interview_questions.some((q) => typeof q?.question !== 'string' || typeof q?.based_on !== 'string' || !q.based_on.trim())) {
  throw new Error('Report must contain exactly five interview questions, each with question and based_on');
}
if (typeof report.company_background !== 'object' || report.company_background === null || typeof report.company_background.summary !== 'string') {
  throw new Error('Report section company_background must contain a summary');
}

const normalizeUrl = (url) => String(url ?? '').trim().toLowerCase().replace(/#.*$/, '').replace(/\/+$/, '');
// Compare only letters and numbers, and rejoin words split across lines in PDF text
const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/-\s*\n\s*/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const extracted = $('Parse Requirements').first().json;
report.role_requirements = extracted.requirements.map(({ track, requirement, priority }) => ({ track, requirement, priority }));
const requirementTexts = new Set(extracted.requirements.map((r) => normalizeText(r.requirement)));

const research = $('Company Research').first().json;
const researchUrls = new Set((Array.isArray(research.results) ? research.results : []).map((r) => normalizeUrl(r.url)));
const newsResponse = $('Find Recent News').first().json;
const newsUrls = new Set((Array.isArray(newsResponse.articles) ? newsResponse.articles : []).map((a) => normalizeUrl(a.url)));
const evidence = $('Build Candidate Evidence').first().json;
const candidateText = normalizeText(evidence.candidate_text);
const repositoryUrls = new Set(evidence.github_repositories.map((repo) => normalizeUrl(repo.url)));
const data_notes = [...(evidence.data_notes ?? [])];
if (!Array.isArray(research.results)) data_notes.push('Company research was unavailable, so the company background is limited.');
if (!Array.isArray(newsResponse.articles)) data_notes.push('The news service was unavailable, so no news is included.');
const removed_claims = [];
const remove = (section, reason, value) => removed_claims.push({ section, reason, value: value ?? '' });

const background = report.company_background;
const backgroundUrls = Array.isArray(background.source_urls) ? background.source_urls : [];
background.source_urls = backgroundUrls.filter((url) => {
  const ok = researchUrls.has(normalizeUrl(url));
  if (!ok) remove('company_background', 'Source URL was not in the search results', url);
  return ok;
});
if (background.source_urls.length === 0) {
  background.summary = 'Public information about this company is limited.';
  background.why_it_matters = '';
}

report.recent_news = report.recent_news.filter((news) => {
  const ok = newsUrls.has(normalizeUrl(news?.url));
  if (!ok) remove('recent_news', 'News URL was not in the news results', news?.url);
  return ok;
}).slice(0, 3);

const repositoryNames = new Set(evidence.github_repositories.map((repo) => normalizeText(String(repo.url ?? '').split('/').filter(Boolean).pop())));
const hasEvidence = (claim) => {
  if (claim?.evidence_source === 'github') {
    const repoName = normalizeText(String(claim.evidence_url ?? '').split('/').filter(Boolean).pop());
    return repositoryUrls.has(normalizeUrl(claim.evidence_url)) || (repoName.length > 0 && repositoryNames.has(repoName));
  }
  if (claim?.evidence_source === 'candidate_text') {
    const quote = normalizeText(claim.evidence_quote || claim.evidence || claim.project);
    return quote.length >= 8 && candidateText.includes(quote);
  }
  return false;
};
const matchedRequirements = new Set();
report.experience_match = report.experience_match.filter((claim) => {
  if (!requirementTexts.has(normalizeText(claim?.requirement))) {
    remove('experience_match', 'Requirement was not one of the extracted requirements', claim?.requirement);
    return false;
  }
  if (!['Strong', 'Partial'].includes(claim?.strength)) {
    remove('experience_match', 'Strength must be Strong or Partial', claim?.requirement);
    return false;
  }
  if (typeof claim?.match_reason !== 'string' || !claim.match_reason.trim()) {
    remove('experience_match', 'Missing match_reason', claim?.requirement);
    return false;
  }
  if (!hasEvidence(claim)) {
    remove('experience_match', 'Evidence could not be traced to the CV, candidate text, or GitHub', claim?.requirement);
    return false;
  }
  matchedRequirements.add(normalizeText(claim.requirement));
  return true;
});
report.projects_to_highlight = report.projects_to_highlight.filter((claim) => {
  const ok = hasEvidence(claim);
  if (!ok) remove('projects_to_highlight', 'Evidence could not be traced to the CV, candidate text, or GitHub', claim?.project);
  return ok;
});

const gapTexts = new Set(report.skill_gaps.map((g) => normalizeText(g?.gap)));
for (const r of extracted.requirements) {
  const key = normalizeText(r.requirement);
  if (r.priority === 'Must-have' && !matchedRequirements.has(key) && !gapTexts.has(key)) {
    report.skill_gaps.push({ gap: r.requirement, priority: r.priority, how_to_prepare: 'No evidence was found for this requirement. Prepare a concrete example or a plan to learn it.' });
    data_notes.push(`A Must-have requirement had no match or gap, so it was added to skill_gaps: ${r.requirement}`);
  }
}

// Safe debug numbers only: no personal text from the CV
const original = JSON.parse(content);
const employerUrls = new Set(($('Find Similar Employers').first().json.results ?? []).map(r => r.url));
const targetCompany = normalizeText($('Prepare Job Input').first().json.company_name);
const employerResults = new Map(($('Find Similar Employers').first().json.results ?? []).map(r => [r.url, normalizeText(`${r.title} ${r.content}`)]));
report.similar_employers = (report.similar_employers ?? []).filter((e) => {
  const name = normalizeText(e?.name);
  // The link must come from the search, and the company name must appear in that same result
  const ok = employerUrls.has(e?.source_url) && name.length > 1 && name !== targetCompany && (employerResults.get(e.source_url) ?? '').includes(name);
  if (!ok) remove('similar_employers', 'Employer could not be traced to its search result', e?.name);
  return ok;
}).slice(0, 2);
report.star_stories = (Array.isArray(report.star_stories) ? report.star_stories : []).filter((story) => {
  const parts = ['question', 'situation', 'task', 'action', 'result'].every((k) => typeof story?.[k] === 'string' && story[k].trim());
  // Every number in the story (like 35% or 4,000) must also appear in the CV
  const numbers = ['situation', 'task', 'action', 'result'].map((k) => story?.[k] ?? '').join(' ').match(/\d[\d.,]*/g) ?? [];
  const cvDigits = String(evidence.candidate_text ?? '').replace(/[.,]/g, '');
  const numbersOk = numbers.every((n) => cvDigits.includes(n.replace(/[.,]/g, '')));
  const ok = parts && hasEvidence(story) && numbersOk;
  if (!ok) remove('star_stories', numbersOk ? 'STAR answer could not be traced to the CV or GitHub' : 'STAR answer contains a number that is not in the CV', story?.question);
  return ok;
}).slice(0, 2);
return [{ json: { report, validation: { removed_claims, data_notes }, debug: {
  candidate_text_chars: evidence.candidate_text.length,
  repositories_found: evidence.github_repositories.length,
  ai_matches_before_check: (original.experience_match ?? []).length,
  ai_projects_before_check: (original.projects_to_highlight ?? []).length
} } }];
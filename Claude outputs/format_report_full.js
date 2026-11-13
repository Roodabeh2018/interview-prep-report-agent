// Turn the checked report into a clean, readable HTML page for the form window
const { report, validation } = $input.first().json;
const company = $('Prepare Job Input').first().json.company_name;
const role = $('Parse Requirements').first().json.role_title;

// Safety: escape all text, and only allow real web links
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (url, label) => /^https?:\/\//i.test(url ?? '') ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label || url)}</a>` : esc(label);
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };
const day = (d) => String(d ?? '').slice(0, 10);
const list = (items, render, empty) => items?.length ? `<ul>${items.map((x) => `<li>${render(x)}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;
const tag = (text, kind) => `<span class="tag ${kind}">${esc(text)}</span>`;

const cb = report.company_background ?? {};
const html = `
<style>
  .r { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; color: #1e2522; line-height: 1.55; text-align: left; max-width: 720px; margin: 0 auto; }
  .r h1 { font-size: 24px; margin: 0 0 2px; }
  .r .sub { color: #5c6661; margin: 0 0 16px; }
  .r h2 { font-size: 17px; margin: 22px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #e2eee7; }
  .r ul { margin: 6px 0; padding-left: 20px; }
  .r li { margin: 4px 0; }
  .r a { color: #2f6b4f; }
  .r p, .r li, .r .muted, .r .sub { font-size: 14px !important; }
  .r .muted { color: #5c6661; font-size: 14px; }
  .r .tag { display: inline-block; font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; margin-left: 4px; }
  .r .must { background: #fbe3d6; color: #8a3a12; }
  .r .nice { background: #e8ecef; color: #3d4a54; }
  .r .strong { background: #dff1e6; color: #1f6b43; }
  .r .partial { background: #fbf0d6; color: #7a5a10; }
  .r .quote { color: #5c6661; font-style: italic; }
  .r ol li { margin: 6px 0; }
  .r .note { background: #f4f5f1; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: #5c6661; margin-top: 20px; }
  .r .actions { margin-top: 28px; text-align: center; }
  .r .print-btn { display: inline-block; padding: 12px 24px; background: #17233B; color: #FFFFFF; border: 0; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
  @media print { .r .actions { display: none; } }
</style>
<div class="r">
  <h1>Interview prep: ${esc(role || 'your role')} at ${esc(company)}</h1>
  <p class="sub">Your one-page brief. Every company fact links to its source, and every match quotes your CV.</p>

  <h2>🏢 Company background</h2>
  <p>${esc(cb.summary)}</p>
  ${cb.why_it_matters ? `<p><strong>Why it matters for you:</strong> ${esc(cb.why_it_matters)}</p>` : ''}
  ${cb.source_urls?.length ? `<p class="muted">Sources: ${cb.source_urls.map((u) => link(u, host(u))).join(' · ')}</p>` : ''}

  <h2>📰 Recent news</h2>
  ${list(report.recent_news, (n) => `<strong>${link(n.url, n.title)}</strong> <span class="muted">(${esc(day(n.date))})</span><br>${esc(n.why_it_matters || n.summary)}`, 'No relevant news found in the last 30 days.')}

  <h2>📋 What the role needs</h2>
  ${list(report.role_requirements, (r) => `${esc(r.requirement)} ${tag(r.priority, r.priority === 'Must-have' ? 'must' : 'nice')}`, 'No requirements could be read.')}

  <h2>✅ Your match</h2>
  ${list(report.experience_match, (m) => `<strong>${esc(m.requirement)}</strong> ${tag(m.strength, m.strength === 'Strong' ? 'strong' : 'partial')}<br><span class="quote">“${esc(m.evidence_quote || m.evidence)}”</span>${m.evidence_url ? ` ${link(m.evidence_url, 'repository')}` : ''}<br>${esc(m.match_reason)}`, 'No requirement could be matched to your CV or GitHub.')}

  <h2>⭐ Projects to highlight</h2>
  ${list(report.projects_to_highlight, (p) => `<strong>${p.evidence_url ? link(p.evidence_url, p.project) : esc(p.project)}</strong>: ${esc(p.talking_point)}`, esc(report.projects_note || 'No matching project found.'))}

  <h2>🎯 Prepare before the interview</h2>
  ${list(report.skill_gaps, (g) => `<strong>${esc(g.gap)}</strong><br>${esc(g.how_to_prepare)}`, 'No gaps found for this role.')}

  <h2>💬 Likely interview questions</h2>
  <ol>${(report.interview_questions ?? []).map((q) => `<li>${esc(q.question)} <span class="muted">(${esc(q.based_on)})</span></li>`).join('')}</ol>

  <h2>🔎 Similar employers in Germany</h2>
  ${list(report.similar_employers, (e) => `<strong>${link(e.source_url, e.name)}</strong><br>${esc(e.why_similar)}`, 'No similar employers found in the search results.')}

  ${(validation?.data_notes?.length || validation?.removed_claims?.length) ? `<div class="note"><strong>Quality check:</strong> ${validation.removed_claims?.length ? `${validation.removed_claims.length} unverified statement(s) were removed. ` : ''}${(validation.data_notes ?? []).map(esc).join(' ')}</div>` : ''}

  <div class="actions">
    <button class="print-btn" onclick="window.print()">🖨️ Save as PDF</button>
    <p class="muted">In the print window, choose "Save as PDF" as the printer.</p>
  </div>
</div>`;

return [{ json: { html } }];
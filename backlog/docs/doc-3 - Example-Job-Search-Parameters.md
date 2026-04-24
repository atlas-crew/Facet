---
id: doc-3
title: Example  Job Search  Parameters
type: other
created_date: '2026-03-10 21:37'
---

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Job Search Parameters — Alex Example</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0a0e14;
  --surface: #0f1319;
  --surface2: #151a22;
  --border: #1e2630;
  --border-bright: #2a3544;
  --text: #c8d3de;
  --text-bright: #e8eef4;
  --text-dim: #6b7d8f;
  --accent: #3b9eff;
  --accent-dim: rgba(59, 158, 255, 0.12);
  --green: #2dd4a0;
  --green-dim: rgba(45, 212, 160, 0.12);
  --amber: #f0b429;
  --amber-dim: rgba(240, 180, 41, 0.12);
  --red: #ef5350;
  --red-dim: rgba(239, 83, 80, 0.1);
  --purple: #a78bfa;
  --purple-dim: rgba(167, 139, 250, 0.1);
  --mono: 'JetBrains Mono', monospace;
  --sans: 'Source Sans 3', -apple-system, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.65;
  font-size: 14px;
}

.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
}

/* NAV */
nav {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

nav .nav-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--accent);
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}

nav .nav-subtitle {
  font-size: 10px;
  color: var(--text-dim);
  font-family: var(--mono);
  padding: 0 16px;
  margin-top: 4px;
  margin-bottom: 12px;
  display: block;
}

.nav-group { margin-bottom: 16px; }

.nav-group-label {
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  padding: 6px 16px 4px;
}

.nav-link {
  display: block;
  padding: 4px 16px 4px 24px;
  color: var(--text-dim);
  text-decoration: none;
  font-size: 13px;
  transition: all 0.15s;
  border-left: 2px solid transparent;
}
.nav-link:hover { color: var(--text-bright); background: var(--accent-dim); border-left-color: var(--accent); }

/* MAIN */
main {
  padding: 32px 48px 80px;
  max-width: 900px;
}

h1 {
  font-family: var(--sans);
  font-size: 28px;
  font-weight: 300;
  color: var(--text-bright);
  margin-bottom: 4px;
}

.page-subtitle {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 32px;
}

h2 {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--accent);
  margin-top: 40px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-bright);
  margin-top: 20px;
  margin-bottom: 8px;
}

/* CARDS */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 12px;
}
.card:hover { border-color: var(--border-bright); }

.card-title {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-bright);
  margin-bottom: 6px;
}

.card p, .card li {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}

/* CONSTRAINT BOX */
.constraint-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.constraint {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px 16px;
}

.constraint .label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.constraint .value {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-bright);
}

.constraint .note {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}

/* SKILL TABLES */
.skill-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.skill-table th {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.skill-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  vertical-align: top;
}

.skill-table tr:hover { background: var(--accent-dim); }

/* DEPTH INDICATORS */
.depth {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  display: inline-block;
  white-space: nowrap;
}

.depth-expert { background: var(--green-dim); color: var(--green); }
.depth-strong { background: var(--accent-dim); color: var(--accent); }
.depth-working { background: var(--amber-dim); color: var(--amber); }
.depth-basic { background: var(--purple-dim); color: var(--purple); }
.depth-avoid { background: var(--red-dim); color: var(--red); }

/* TAGS */
.tag {
  font-family: var(--mono);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  display: inline-block;
  margin: 2px 4px 2px 0;
}

.tag-green { background: var(--green-dim); color: var(--green); }
.tag-blue { background: var(--accent-dim); color: var(--accent); }
.tag-amber { background: var(--amber-dim); color: var(--amber); }
.tag-red { background: var(--red-dim); color: var(--red); }

/* VECTOR CARDS */
.vector-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 16px;
  border-left: 3px solid var(--accent);
}

.vector-card.high-priority { border-left-color: var(--green); }
.vector-card.med-priority { border-left-color: var(--amber); }

.vector-card .vector-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-bright);
  margin-bottom: 4px;
}

.vector-card .vector-subtitle {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.vector-card p {
  font-size: 13px;
  line-height: 1.65;
  margin-bottom: 8px;
}

.vector-card .keywords {
  margin-top: 10px;
}

/* FILTER SECTION */
.filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.filter-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
}

.filter-box .filter-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.filter-box.include .filter-title { color: var(--green); }
.filter-box.exclude .filter-title { color: var(--red); }

.filter-box ul {
  list-style: none;
  padding: 0;
}

.filter-box li {
  font-size: 13px;
  padding: 3px 0;
  color: var(--text);
}

.filter-box.include li::before { content: "✓ "; color: var(--green); font-weight: 600; }
.filter-box.exclude li::before { content: "✗ "; color: var(--red); font-weight: 600; }

/* TIMELINE BANNER */
.timeline-banner {
  background: var(--red-dim);
  border: 1px solid rgba(239, 83, 80, 0.25);
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-banner .icon {
  font-size: 20px;
  flex-shrink: 0;
}

.timeline-banner .content .headline {
  font-weight: 600;
  color: var(--red);
  font-size: 14px;
}

.timeline-banner .content .detail {
  font-size: 13px;
  color: var(--text);
}

/* PROSE */
p { margin-bottom: 10px; }
ul { padding-left: 20px; margin-bottom: 10px; }
li { margin-bottom: 4px; font-size: 13px; }

.muted { color: var(--text-dim); }
.bright { color: var(--text-bright); }
.mono { font-family: var(--mono); }

@media (max-width: 768px) {
  .layout { grid-template-columns: 1fr; }
  nav { display: none; }
  main { padding: 20px; }
  .constraint-grid, .filter-grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div class="layout">
<nav>
  <div class="nav-title">Search Params</div>
  <span class="nav-subtitle">Alex Example</span>

  <div class="nav-group">
    <div class="nav-group-label">Parameters</div>
    <a href="#constraints" class="nav-link">Constraints</a>
    <a href="#filters" class="nav-link">Include / Exclude</a>
  </div>
  <div class="nav-group">
    <div class="nav-group-label">Skills Catalog</div>
    <a href="#languages" class="nav-link">Languages</a>
    <a href="#platforms" class="nav-link">Platforms & Infra</a>
    <a href="#build-release" class="nav-link">Build & Release</a>
    <a href="#security" class="nav-link">Security</a>
    <a href="#data" class="nav-link">Data & Messaging</a>
    <a href="#observability" class="nav-link">Observability</a>
    <a href="#linux" class="nav-link">Linux</a>
    <a href="#networking" class="nav-link">Networking</a>
    <a href="#cloud" class="nav-link">Cloud (AWS)</a>
    <a href="#iac" class="nav-link">IaC & Config Mgmt</a>
    <a href="#frontend" class="nav-link">Frontend</a>
    <a href="#soft-skills" class="nav-link">Soft Skills</a>
  </div>
  <div class="nav-group">
    <div class="nav-group-label">Search Vectors</div>
    <a href="#vectors" class="nav-link">Attack Angles</a>
    <a href="#search-terms" class="nav-link">Search Keywords</a>
  </div>
  <div class="nav-group">
    <div class="nav-group-label">Reference</div>
    <a href="#interview" class="nav-link">Interview Criteria</a>
    <a href="#work-history" class="nav-link">Work History Summary</a>
    <a href="#open-questions" class="nav-link">Open Questions</a>
  </div>
</nav>

<main>
<h1>Job Search Parameters</h1>
<p class="page-subtitle">Formalized reference for search, filtering, and research tasks &middot; Updated Feb 2026</p>

<div class="timeline-banner">
  <div class="icon">⏱</div>
  <div class="content">
    <div class="headline">Tight Window: Need offer by end of March 2026</div>
    <div class="detail">~4 weeks. Prioritize conversion speed. Builder-friendly processes (take-homes, paid trials) can compress timelines. Avoid 5+ round interview gauntlets.</div>
  </div>
</div>

<!-- ========== CONSTRAINTS ========== -->
<h2 id="constraints">Hard Constraints</h2>
<div class="constraint-grid">
  <div class="constraint">
    <div class="label">Comp Floor</div>
    <div class="value">$145K base</div>
    <div class="note">Current salary. Target: $170K–$200K+. Don't anchor low.</div>
  </div>
  <div class="constraint">
    <div class="label">Location</div>
    <div class="value">Remote preferred</div>
    <div class="note">Hybrid ok in greater Denver Metro. No relocation.</div>
  </div>
  <div class="constraint">
    <div class="label">Clearance</div>
    <div class="value">None — Exclude</div>
    <div class="note">No roles requiring security clearance.</div>
  </div>
  <div class="constraint">
    <div class="label">Company Size</div>
    <div class="value">No preference</div>
    <div class="note">Startup to enterprise. Role and process matter more.</div>
  </div>
  <div class="constraint">
    <div class="label">Title</div>
    <div class="value">Flexible</div>
    <div class="note">Senior Platform, Senior Infra, Senior Build/Release, Staff, DevOps, Security Engineer — all fine if the work fits.</div>
  </div>
  <div class="constraint">
    <div class="label">Education</div>
    <div class="value">AAS — Glen Hollow Community College, 2020</div>
    <div class="note">BAS in progress, leave off resume. May filter out roles with strict degree requirements.</div>
  </div>
</div>

<!-- ========== FILTERS ========== -->
<h2 id="filters">Include / Exclude Filters</h2>
<div class="filter-grid">
  <div class="filter-box include">
    <div class="filter-title">Prioritize</div>
    <ul>
      <li>Builder-friendly interviews (take-homes, paid trials, portfolio reviews, pair programming on real problems)</li>
      <li>AI-augmented development culture (expect or allow AI tooling)</li>
      <li>"Hiring Without Whiteboards" companies</li>
      <li>Roles requiring cross-platform (Windows + Linux)</li>
      <li>Roles requiring Python + C# together</li>
      <li>Release engineering / build systems focus</li>
      <li>Security + platform engineering hybrid roles</li>
      <li>Small teams where one engineer has outsized impact</li>
      <li>Roles valuing documentation / technical writing</li>
    </ul>
  </div>
  <div class="filter-box exclude">
    <div class="filter-title">Avoid</div>
    <ul>
      <li>Kubernetes admin roles (building around k8s is fine, being a k8s admin is not)</li>
      <li>Microsoft-only shops (unless almost guaranteed win)</li>
      <li>Deep Rust required (limited to &lt;1 year)</li>
      <li>Deep eBPF / kernel programming required</li>
      <li>Jenkins-centric roles</li>
      <li>Security clearance required</li>
      <li>5+ round leetcode interview gauntlets</li>
      <li>Roles where the primary job is writing React</li>
      <li>Pure AWS architect / cloud consultant roles</li>
      <li>Deep ClickHouse expertise required</li>
    </ul>
  </div>
</div>

<!-- ========== LANGUAGES ========== -->
<h2 id="languages">Languages</h2>
<table class="skill-table">
  <thead>
    <tr><th>Language</th><th>Depth</th><th>Context</th><th>Search Signal</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">Python</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Primary language at Helios Security/A10. Platform backends, automation, tooling, custom Ansible modules, Flask apps. Daily driver.</td>
      <td>Strong match signal. List first.</td>
    </tr>
    <tr>
      <td class="bright">C# / .NET / ASP.NET</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>3+ years at Northwind. Full platform in C#/ASP.NET/SQL Server. OOP development was 75%+ of tenure. Build systems, tooling, web interfaces.</td>
      <td>Strong match signal, especially with Python. Rare combo.</td>
    </tr>
    <tr>
      <td class="bright">PowerShell</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Extensive use at Northwind for build automation, CLI tools, pipeline management. Cross-platform. Daily driver alongside Python.</td>
      <td>Signals Windows release engineering depth.</td>
    </tr>
    <tr>
      <td class="bright">SQL</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>All join types, views, schema design, normalization. SQL Server at Northwind, PostgreSQL at Helios Security.</td>
      <td>Standard. Don't oversell.</td>
    </tr>
    <tr>
      <td class="bright">Bash</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Daily use for Linux administration, automation, scripting. Shell is a primary tool, not an afterthought.</td>
      <td>Expected for Linux roles.</td>
    </tr>
    <tr>
      <td class="bright">TypeScript</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>&lt;1 year. Used for A10 platform projects (Apparatus, Crucible, Chimera). AI-augmented development.</td>
      <td>Can claim working proficiency. Not a TS role primary.</td>
    </tr>
    <tr>
      <td class="bright">Rust</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>&lt;1 year. Synapse edge protection sensor, Kafka reference implementations, eBPF endpoint agent (AI-assisted). Working proficiency — builds production systems in Rust with AI augmentation, not writing unsafe blocks from scratch.</td>
      <td>Can mention. Avoid "deep Rust required" roles.</td>
    </tr>
    <tr>
      <td class="bright">C++</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>License management library extraction at Northwind. Can read and modify, not leading C++ projects.</td>
      <td>Don't lead with this.</td>
    </tr>
    <tr>
      <td class="bright">Go</td>
      <td><span class="depth depth-basic">Minimal</span></td>
      <td>Minimal use. Willing to learn. Not a blocker.</td>
      <td>Can apply to Go roles if other signals are strong. Flag as "ramping."</td>
    </tr>
  </tbody>
</table>

<!-- ========== PLATFORMS & INFRA ========== -->
<h2 id="platforms">Platforms & Infrastructure</h2>
<table class="skill-table">
  <thead>
    <tr><th>Technology</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">Docker</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Daily use. Multi-stage builds, custom images, compose, registries. Used across all roles.</td>
    </tr>
    <tr>
      <td class="bright">Kubernetes (EKS)</td>
      <td><span class="depth depth-strong">Strong user</span></td>
      <td>Deployed to and worked with EKS. <strong>Not a k8s admin</strong>. Building platforms around it is fine. Don't want to be the k8s person.</td>
    </tr>
    <tr>
      <td class="bright">Fargate / ECS</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Rearchitected Helios Security sensor fleet from EC2 to shared Fargate clusters. Production operations.</td>
    </tr>
    <tr>
      <td class="bright">VMware / KVM / QEMU</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>VMware at Northwind (cluster telemetry, build farms). KVM/QEMU deep experience for Linux virtualization — near-expert. Shipped a VMware appliance for a customer.</td>
    </tr>
  </tbody>
</table>

<!-- ========== BUILD & RELEASE ========== -->
<h2 id="build-release">Build & Release Engineering</h2>
<p style="margin-bottom: 16px;">This is a primary differentiator. 3+ years as a dedicated build/release engineer at Northwind, then CI/CD ownership at Helios Security and A10.</p>
<table class="skill-table">
  <thead>
    <tr><th>Capability</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">Cross-platform build systems</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Built framework shipping $50M/yr across Windows (EV code signing, drivers, QT), macOS, iOS, Android, embedded Linux, ASP.NET Core. Self-bootstrapping reproducible builds with task-based DSL.</td>
    </tr>
    <tr>
      <td class="bright">Pipeline design & management</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>600+ pipelines at Northwind. Pipeline diff/merge tools, orchestration, self-service portal. Designed hybrid CI/CD (AWS control plane + on-prem agents).</td>
    </tr>
    <tr>
      <td class="bright">GoCD</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Administered at Northwind. Primary CI/CD system for 3+ years.</td>
    </tr>
    <tr>
      <td class="bright">GitHub Actions</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Administered at Helios Security/A10. Production CI/CD workflows.</td>
    </tr>
    <tr>
      <td class="bright">GitLab CI/CD</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Administered GitLab instance at Northwind. Used for Android project subset.</td>
    </tr>
    <tr>
      <td class="bright">Windows release engineering</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>EV code signing, driver signing, MSI/installer workflows, Windows build toolchains. Rare skill combined with Linux.</td>
    </tr>
    <tr>
      <td class="bright">Build promotion / artifact management</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Built database-backed promotion system replacing folder-based approach. Akamai CDN integration. NuGet feeds. Automated cleanup.</td>
    </tr>
    <tr>
      <td class="bright">Jenkins</td>
      <td><span class="depth depth-avoid">Avoid</span></td>
      <td>Brief use at Helios Security. Specifically does not want Jenkins-centric roles.</td>
    </tr>
  </tbody>
</table>

<!-- ========== SECURITY ========== -->
<h2 id="security">Security</h2>
<p style="margin-bottom: 16px;">Not a traditional security engineer (no certs, not a pentester). Strength is building security <em>platforms</em> and understanding security at the infrastructure level.</p>
<table class="skill-table">
  <thead>
    <tr><th>Capability</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">WAF / Edge protection systems</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>4+ years at Helios Security (WAF company). Built fleet management for sensor infrastructure. Architected edge protection sensor (Synapse). Deep understanding of how WAFs work operationally.</td>
    </tr>
    <tr>
      <td class="bright">Threat intelligence platforms</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Built Signal Horizon — central management platform for distributed sensor fleet. Cross-deployment threat intelligence, privacy-preserving multi-tenant sharing (HMAC-SHA256), fleet operations.</td>
    </tr>
    <tr>
      <td class="bright">Attack simulation / security tooling</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Built Crucible (119 scenarios: OWASP, APT, HIPAA, PCI, nation-state). Built Chimera (vulnerable app platform). Built Apparatus (AI-augmented red/blue team platform).</td>
    </tr>
    <tr>
      <td class="bright">Security-aware infrastructure</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>SELinux, tenant isolation (VPC Peering, PrivateLink), ransomware mitigation (migrated Northwind to AWS before attack), network security fundamentals.</td>
    </tr>
    <tr>
      <td class="bright">eBPF endpoint agent</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Built Linux agent as production proof of concept for cross-platform endpoint agent architecture (5 platforms). AI-assisted development — did not hand-write BPF programs. Verified behavior through QA loop. Unlocked enterprise segment.</td>
    </tr>
  </tbody>
</table>

<!-- ========== DATA ========== -->
<h2 id="data">Data & Messaging</h2>
<table class="skill-table">
  <thead>
    <tr><th>Technology</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">PostgreSQL</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Helios Security/A10 platforms. Schema design, normalization, all join types, views.</td>
    </tr>
    <tr>
      <td class="bright">SQL Server</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Northwind platform backend. C#/ASP.NET + SQL Server stack.</td>
    </tr>
    <tr>
      <td class="bright">Kafka (AWS MSK)</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Managed clusters. Wrote Rust reference implementations for producers/consumers. Troubleshooted production issues. Developers owned topic architecture.</td>
    </tr>
    <tr>
      <td class="bright">MongoDB</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>More than average dev. Can write aggregation pipelines correctly (knows not to sort at the front).</td>
    </tr>
    <tr>
      <td class="bright">ClickHouse</td>
      <td><span class="depth depth-basic">Basic</span></td>
      <td>Used for Signal Horizon analytics. Limited operational depth.</td>
    </tr>
    <tr>
      <td class="bright">REST API design</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>172 API endpoints across A10 platforms. Designed APIs as the interface layer for all platforms.</td>
    </tr>
    <tr>
      <td class="bright">WebSocket</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Signal Horizon tunnel broker for secure remote sensor access.</td>
    </tr>
  </tbody>
</table>

<!-- ========== OBSERVABILITY ========== -->
<h2 id="observability">Observability</h2>
<table class="skill-table">
  <thead>
    <tr><th>Technology</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">Grafana</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Designed and built dashboards from scratch at Northwind. Used at Helios Security/A10. Custom metrics, alerting.</td>
    </tr>
    <tr>
      <td class="bright">InfluxDB</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Primary time-series DB at Northwind. VMware telemetry, build metrics, custom instrumentation.</td>
    </tr>
    <tr>
      <td class="bright">Prometheus</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Consumer — uses it, exports metrics to it (Synapse sensor has Prometheus export). Has not designed a Prometheus architecture from scratch.</td>
    </tr>
    <tr>
      <td class="bright">Observability system design</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Designed monitoring ground-up at Northwind: chose instrumentation points, built dashboards, defined alerting policies, used data to justify resource requests and identify root causes.</td>
    </tr>
    <tr>
      <td class="bright">ELK / Loki</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Used in production environments.</td>
    </tr>
  </tbody>
</table>

<!-- ========== LINUX ========== -->
<h2 id="linux">Linux Administration</h2>
<table class="skill-table">
  <thead>
    <tr><th>Capability</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">systemd</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Custom services, unit files, dynamic conntrack sizing via systemd services. Deep understanding of service lifecycle.</td>
    </tr>
    <tr>
      <td class="bright">RHEL / Ubuntu</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Production use across all roles. Package management, system administration.</td>
    </tr>
    <tr>
      <td class="bright">SELinux</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Policy configuration and troubleshooting in production.</td>
    </tr>
    <tr>
      <td class="bright">KVM / QEMU</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Deep Linux virtualization experience. Production and development environments.</td>
    </tr>
    <tr>
      <td class="bright">Linux TCP/IP tuning</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>The Wayfair engagement: conntrack table exhaustion diagnosis, TCP stack tuning, kernel parameter optimization under 150K+ RPS load.</td>
    </tr>
    <tr>
      <td class="bright">Linux kernel programming</td>
      <td><span class="depth depth-basic">Basic</span></td>
      <td>Limited to the eBPF agent (AI-assisted). Not a kernel developer.</td>
    </tr>
  </tbody>
</table>

<!-- ========== NETWORKING ========== -->
<h2 id="networking">Networking</h2>
<table class="skill-table">
  <thead>
    <tr><th>Capability</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">TCP/IP, HTTP/S, TLS/SSL, DNS</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Operational understanding. Knows why DPI is expensive and how it relates to TLS. Conntrack tuning. Load balancing.</td>
    </tr>
    <tr>
      <td class="bright">Nginx / Pingora</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Optimized Nginx configs for Fargate sensor fleet. Pingora experience from Synapse sensor design.</td>
    </tr>
    <tr>
      <td class="bright">netfilter / iptables</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Knows direction (IN/OUT) and actions (ALLOW/DROP/DENY). Reads the manpage before use. Not writing rules from memory.</td>
    </tr>
    <tr>
      <td class="bright">Open vSwitch</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Virtual networking experience.</td>
    </tr>
    <tr>
      <td class="bright">VLANs, LACP, bonded interfaces</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Setup on both virtual and physical devices. Mirror ports.</td>
    </tr>
    <tr>
      <td class="bright">tcpdump / packet analysis</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Knows when to reach for it, reads the manpage for syntax. Not a pcap wizard.</td>
    </tr>
    <tr>
      <td class="bright">Subnetting / IP math</td>
      <td><span class="depth depth-basic">Lookup</span></td>
      <td>Needs a reference. Not doing it in interviews by hand.</td>
    </tr>
  </tbody>
</table>

<!-- ========== CLOUD ========== -->
<h2 id="cloud">Cloud (AWS)</h2>
<div class="card" style="margin-bottom: 16px;">
  <p><strong>Honest framing:</strong> Production AWS user for 5 years. Not an AWS consultant or solutions architect. Knows the services he's used well, looks up instance types and reads docs for new services. Strongest in event-driven / serverless patterns and container orchestration (Fargate/ECS). It's a tool, not an identity.</p>
</div>
<table class="skill-table">
  <thead>
    <tr><th>Service</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr><td class="bright">EC2 / Fargate / ECS</td><td><span class="depth depth-strong">Strong</span></td><td>Rearchitected fleet from EC2 to Fargate. Production operations.</td></tr>
    <tr><td class="bright">VPC / Peering / PrivateLink</td><td><span class="depth depth-strong">Strong</span></td><td>Consolidated per-customer VPCs into shared architecture. Tenant isolation.</td></tr>
    <tr><td class="bright">MSK (Kafka)</td><td><span class="depth depth-strong">Strong</span></td><td>Managed production clusters.</td></tr>
    <tr><td class="bright">EKS</td><td><span class="depth depth-working">Working</span></td><td>Deployed to. Not a k8s admin.</td></tr>
    <tr><td class="bright">Lambda / Step Functions / Serverless</td><td><span class="depth depth-strong">Strong</span></td><td>Event-driven architecture. Demo platform at Black Hat. Comfortable with serverless patterns and Step Functions orchestration.</td></tr>
    <tr><td class="bright">CloudFront</td><td><span class="depth depth-working">Working</span></td><td>CDN configuration and distribution management.</td></tr>
    <tr><td class="bright">SNS / SQS / SES</td><td><span class="depth depth-working">Working</span></td><td>Event-driven messaging patterns, email services.</td></tr>
    <tr><td class="bright">SSM (Systems Manager)</td><td><span class="depth depth-working">Working</span></td><td>Parameter store, session management, fleet operations.</td></tr>
    <tr><td class="bright">Route 53</td><td><span class="depth depth-working">Working</span></td><td>DNS management, hosted zones.</td></tr>
    <tr><td class="bright">IAM, S3, CloudWatch, etc.</td><td><span class="depth depth-working">Working</span></td><td>Standard usage. Nothing exotic.</td></tr>
  </tbody>
</table>

<!-- ========== IAC ========== -->
<h2 id="iac">IaC & Configuration Management</h2>
<table class="skill-table">
  <thead>
    <tr><th>Technology</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">Ansible</td>
      <td><span class="depth depth-expert">Expert</span></td>
      <td>Custom Python modules. Linux and Windows targets. Build farms + WAF sensor farms. Hundreds of hosts. Collections/roles, group vars, proper inventory management. <strong>Genuinely declining skill in market — leverage this.</strong></td>
    </tr>
    <tr>
      <td class="bright">Terraform</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Complex module hierarchies (50-100 modules at a time), remote state, Terragrunt for DRY. No custom providers.</td>
    </tr>
    <tr>
      <td class="bright">Helm</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Chart creation and deployment.</td>
    </tr>
    <tr>
      <td class="bright">Flux / GitOps</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>GitOps workflows.</td>
    </tr>
  </tbody>
</table>

<!-- ========== FRONTEND ========== -->
<h2 id="frontend">Frontend</h2>
<table class="skill-table">
  <thead>
    <tr><th>Technology</th><th>Depth</th><th>Context</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">React</td>
      <td><span class="depth depth-basic">Basic</span></td>
      <td>&lt;1 year. 500+ components across A10 platforms, built with heavy AI augmentation. Can modify and extend existing components. Not designing architectures or managing complex state from scratch.</td>
    </tr>
    <tr>
      <td class="bright">HTML / CSS</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Can center a div. Knows flexbox and grid, selector scoping, specificity (!important usage), CSS variables. More depth here than in React — can build functional layouts and style them correctly.</td>
    </tr>
    <tr>
      <td class="bright">JavaScript (vanilla)</td>
      <td><span class="depth depth-working">Working</span></td>
      <td>Can get what's needed rendered from an MVC app. DOM manipulation, event handling, fetch/async. Not writing SPAs from scratch.</td>
    </tr>
    <tr>
      <td class="bright">ASP.NET Core (web)</td>
      <td><span class="depth depth-strong">Strong+</span></td>
      <td>Northwind platforms, web frontends for internal tools. MVC pattern, API controllers, middleware. Production web applications in C#.</td>
    </tr>
    <tr>
      <td class="bright">Flask</td>
      <td><span class="depth depth-strong">Strong</span></td>
      <td>Chimera platform backend. Python web apps.</td>
    </tr>
  </tbody>
</table>

<!-- ========== SOFT SKILLS ========== -->
<h2 id="soft-skills">Differentiating Soft Skills</h2>
<table class="skill-table">
  <thead>
    <tr><th>Skill</th><th>Evidence</th></tr>
  </thead>
  <tbody>
    <tr>
      <td class="bright">Technical documentation</td>
      <td>Authored all published docs across Helios Security and A10 eras. ADRs, runbooks, API refs, onboarding guides. Built docs-as-code platform (Antora, Vale). "If it isn't documented, it doesn't exist."</td>
    </tr>
    <tr>
      <td class="bright">Build the system, hand it off</td>
      <td>Pattern repeats: position created at Northwind, built IDP then handed off. Built SOC tooling at Helios Security, mentored team member to ownership. Delivered four platforms at A10 in 11 months. The through-line is identifying bottlenecks, building the system that removes them, then enabling others to own it.</td>
    </tr>
    <tr>
      <td class="bright">Pre-sales / professional services</td>
      <td>Recognized the need and created the professional services capability at Helios Security. 4 enterprise engagements. Microsoft-ecosystem integrations, VMware appliance for customer that wouldn't run Linux containers, pre-sales technical translation that opened new market segments.</td>
    </tr>
    <tr>
      <td class="bright">AI-augmented development</td>
      <td>Multi-LLM QA workflow gating changes behind tests, linters, and multi-perspective analysis. Behavioral test gap analysis identifying missing scenarios based on expected behavior, not just coverage. Delivered four production platforms in 11 months. This is the workflow companies are trying to institutionalize.</td>
    </tr>
    <tr>
      <td class="bright">Post-acquisition integration</td>
      <td>Twice: Northwind (3 new product lines from merged teams) and Helios Security→A10 (acquisition).</td>
    </tr>
    <tr>
      <td class="bright">Cost optimization with receipts</td>
      <td>$60K/month AWS reduction (50% of bill). Data-driven resource requests at Northwind.</td>
    </tr>
    <tr>
      <td class="bright">Mentoring without authority</td>
      <td>Mentored SOC team member to platform ownership. 1-on-1 interviews and surveys with 80%+ response rates at Northwind.</td>
    </tr>
  </tbody>
</table>

<!-- ========== SEARCH VECTORS ========== -->
<h2 id="vectors">Search Vectors (Attack Angles)</h2>
<p style="margin-bottom: 16px;">These are the angles where the combination of skills creates an <strong>unfair advantage</strong> — not just a match, but a position where most other candidates literally can't compete.</p>

<div class="vector-card high-priority">
  <div class="vector-title">Vector 1: Security Platform Engineer</div>
  <div class="vector-subtitle">Highest priority — deepest moat</div>
  <p>Most platform engineers don't understand security. Most security engineers can't build platforms from scratch. You've done both at a WAF company for 4+ years, built threat intelligence platforms, attack simulation tools, and an eBPF endpoint agent. You also identified an unaddressed gap in API authorization observability and built the MVP. Companies building security products need engineers who think in both dimensions simultaneously.</p>
  <p><strong>Target roles:</strong> Platform Engineer at security companies, Security Infrastructure Engineer, Detection Engineering (platform side), Security Tooling Engineer.</p>
  <div class="keywords">
    <span class="tag tag-green">WAF</span>
    <span class="tag tag-green">threat intelligence</span>
    <span class="tag tag-green">sensor fleet</span>
    <span class="tag tag-green">security platform</span>
    <span class="tag tag-green">OWASP</span>
    <span class="tag tag-green">edge protection</span>
    <span class="tag tag-blue">detection engineering</span>
    <span class="tag tag-blue">security tooling</span>
    <span class="tag tag-blue">API authorization</span>
  </div>
</div>

<div class="vector-card high-priority">
  <div class="vector-title">Vector 2: Release / Build Engineer (Cross-Platform)</div>
  <div class="vector-subtitle">High priority — rare skill combo</div>
  <p>Windows release engineering is a dying art. Combining it with Linux, modern CI/CD, and actual software development (not just scripting) is extremely rare. The Northwind story is 3+ years of shipping $50M/year of software across every major platform with EV code signing, driver signing, and a self-built task DSL. Most "DevOps" engineers have never touched Windows build toolchains.</p>
  <p><strong>Target roles:</strong> Senior Build Engineer, Senior Release Engineer, Build Platform Engineer, Developer Productivity Engineer (at companies shipping desktop/cross-platform software).</p>
  <div class="keywords">
    <span class="tag tag-green">release engineering</span>
    <span class="tag tag-green">build systems</span>
    <span class="tag tag-green">Windows + Linux</span>
    <span class="tag tag-green">cross-platform</span>
    <span class="tag tag-green">code signing</span>
    <span class="tag tag-blue">developer productivity</span>
    <span class="tag tag-blue">CI/CD</span>
    <span class="tag tag-blue">build platform</span>
  </div>
</div>

<div class="vector-card high-priority">
  <div class="vector-title">Vector 3: Python + C# Platform Engineer</div>
  <div class="vector-subtitle">High priority — uncommon language pairing</div>
  <p>Most engineers live in one ecosystem. Having production-grade depth in both Python and C#/.NET — plus having built full platforms in each — means you can speak to .NET shops, Python shops, and the rare companies that use both. This is especially powerful at companies with mixed stacks or those doing Windows + Linux tooling.</p>
  <p><strong>Target roles:</strong> Any platform/infra role at companies using .NET + Python, developer tools companies, companies with mixed Windows/Linux estates.</p>
  <div class="keywords">
    <span class="tag tag-green">Python</span>
    <span class="tag tag-green">C#</span>
    <span class="tag tag-green">.NET</span>
    <span class="tag tag-green">ASP.NET</span>
    <span class="tag tag-blue">mixed stack</span>
    <span class="tag tag-blue">cross-platform tooling</span>
  </div>
</div>

<div class="vector-card med-priority">
  <div class="vector-title">Vector 4: Internal Developer Platform Builder</div>
  <div class="vector-subtitle">Medium priority — broad applicability but more competition</div>
  <p>The "infrastructure as product" narrative is strong: you've built IDPs from scratch twice, at two different companies, with measurable impact (toil reduction, self-service, cost savings). More importantly, the pattern includes handoff — building the system then enabling others to own it. The IDP/platform engineering space is hot, but competition is higher here than in the more niche vectors above.</p>
  <p><strong>Target roles:</strong> Platform Engineer, Developer Experience Engineer, Internal Tools Engineer.</p>
  <div class="keywords">
    <span class="tag tag-blue">internal developer platform</span>
    <span class="tag tag-blue">developer experience</span>
    <span class="tag tag-blue">platform engineering</span>
    <span class="tag tag-blue">self-service</span>
    <span class="tag tag-blue">developer productivity</span>
  </div>
</div>

<div class="vector-card med-priority">
  <div class="vector-title">Vector 5: Ansible + Linux Infrastructure</div>
  <div class="vector-subtitle">Medium priority — declining skill with persistent demand</div>
  <p>Ansible expertise is genuinely declining as the industry moves toward Terraform-for-everything. But plenty of companies still run large fleets managed by Ansible — and finding someone who's written custom modules, managed hundreds of hosts across Linux AND Windows, and actually knows proper collection/role structure is getting harder. Especially combined with your broader Linux admin skills (KVM, systemd, SELinux, networking).</p>
  <p><strong>Target roles:</strong> Infrastructure Engineer, Linux Systems Engineer, Site Reliability Engineer (at companies with config management needs).</p>
  <div class="keywords">
    <span class="tag tag-amber">Ansible</span>
    <span class="tag tag-amber">Linux administration</span>
    <span class="tag tag-amber">configuration management</span>
    <span class="tag tag-amber">fleet management</span>
    <span class="tag tag-blue">KVM</span>
    <span class="tag tag-blue">systemd</span>
    <span class="tag tag-blue">SELinux</span>
  </div>
</div>

<!-- ========== SEARCH TERMS ========== -->
<h2 id="search-terms">Search Keywords for Job Boards</h2>
<div class="card">
  <div class="card-title">High-signal keyword combinations</div>
  <p class="muted" style="margin-bottom: 12px;">Use these as search queries. The combinations are what create signal — individual keywords match too broadly.</p>
  <table class="skill-table">
    <thead><tr><th>Query</th><th>Vector</th><th>Expected Noise Level</th></tr></thead>
    <tbody>
      <tr><td class="mono">"platform engineer" + security</td><td>V1</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"build engineer" + (Windows OR cross-platform)</td><td>V2</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"release engineer" + Linux</td><td>V2</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"platform engineer" + (Python AND C#)</td><td>V3</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"developer platform" OR "developer productivity" + remote</td><td>V4</td><td><span class="tag tag-amber">Medium</span></td></tr>
      <tr><td class="mono">"security tooling" OR "detection engineering" + platform</td><td>V1</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">Ansible + (Linux AND Windows)</td><td>V5</td><td><span class="tag tag-amber">Medium</span></td></tr>
      <tr><td class="mono">"build systems" + (Python OR C#)</td><td>V2/V3</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"WAF" OR "web application firewall" + engineer</td><td>V1</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"API security" OR "authorization" + platform engineer</td><td>V1</td><td><span class="tag tag-green">Low</span></td></tr>
      <tr><td class="mono">"infrastructure engineer" + (Terraform AND Ansible)</td><td>V5</td><td><span class="tag tag-amber">Medium</span></td></tr>
    </tbody>
  </table>
</div>

<!-- ========== INTERVIEW CRITERIA ========== -->
<h2 id="interview">Interview Process Criteria</h2>
<div class="filter-grid">
  <div class="filter-box include">
    <div class="filter-title">Strong Fit Signals</div>
    <ul>
      <li>Take-home assignments (your strength)</li>
      <li>Paid work trials / SuperDays</li>
      <li>Portfolio / project review</li>
      <li>Pair programming on real problems</li>
      <li>AI tool use allowed or encouraged</li>
      <li>"Hiring Without Whiteboards" listed</li>
      <li>Async-first / text-based interviews</li>
      <li>System design discussions (not whiteboard puzzles)</li>
      <li>Code review exercises</li>
    </ul>
  </div>
  <div class="filter-box exclude">
    <div class="filter-title">Red Flags</div>
    <ul>
      <li>Multiple rounds of leetcode</li>
      <li>Timed algorithm puzzles</li>
      <li>5+ interview rounds</li>
      <li>"Brain teaser" or trick questions</li>
      <li>Processes taking 4+ weeks (timeline constraint)</li>
      <li>No clear process documentation (slow orgs)</li>
    </ul>
  </div>
</div>

<!-- ========== WORK HISTORY ========== -->
<h2 id="work-history">Work History Summary (Quick Reference)</h2>
<table class="skill-table">
  <thead><tr><th>Company</th><th>Title</th><th>Dates</th><th>Key Narrative</th></tr></thead>
  <tbody>
    <tr>
      <td class="bright">Contoso Networks</td>
      <td>Senior Platform Engineer</td>
      <td>Feb 2025 – Present</td>
      <td>Post-acquisition. 4 production platforms in 11 months. Edge protection sensor (4,400× latency improvement, 99.8% OWASP), Signal Horizon fleet management, security tooling suite, eBPF endpoint agent. AI-augmented development methodology. API authorization intelligence gap identification.</td>
    </tr>
    <tr>
      <td class="bright">Helios Security</td>
      <td>Senior Platform Engineer</td>
      <td>Jan 2022 – Feb 2025</td>
      <td>WAF company. Fleet management (built, then handed off to SOC team), ~$60K/mo AWS savings, Kafka/MSK, Wayfair engagement ($1M contract), docs-as-code platform, created professional services capability, Black Hat demo.</td>
    </tr>
    <tr>
      <td class="bright">Northwind</td>
      <td>Senior Platform / Build Engineer</td>
      <td>Oct 2018 – Dec 2021</td>
      <td>Position created after meeting leadership. C#/.NET IDP from scratch. $50M/yr software across 6 platforms. 600+ pipelines. Cross-platform builds (Windows EV signing, macOS, iOS, Android, Linux). Post-acquisition integrations. Ransomware resilience. Reverse-engineered legacy license system.</td>
    </tr>
  </tbody>
</table>

<!-- ========== OPEN SOURCE ========== -->
<h3 style="margin-top: 20px;">Open Source Projects (Public, Complete)</h3>
<table class="skill-table">
  <thead><tr><th>Project</th><th>What It Is</th><th>Stack</th><th>Status</th></tr></thead>
  <tbody>
    <tr>
      <td class="bright">Apparatus</td>
      <td>AI-augmented network security platform. Red/blue teams, visual scenario builder, chaos engineering, LLM honeypots.</td>
      <td>TypeScript</td>
      <td><span class="tag tag-green">Public + README + CI</span></td>
    </tr>
    <tr>
      <td class="bright">Crucible</td>
      <td>Attack simulation + compliance engine. 119 scenarios (OWASP, APT, HIPAA, PCI, nation-state).</td>
      <td>TypeScript</td>
      <td><span class="tag tag-green">Public + README + CI</span></td>
    </tr>
    <tr>
      <td class="bright">Chimera</td>
      <td>Vulnerable app platform. 22 verticals, 13 web apps, 450 endpoints. OWASP LLM teaching env.</td>
      <td>Python Flask + TS</td>
      <td><span class="tag tag-green">Public + README + CI</span></td>
    </tr>
  </tbody>
</table>
<p class="muted" style="margin-top: 8px; font-size: 12px;">Note: Projects are complete with READMEs, licenses, and CI/CD pipelines. Commit history may not reflect full development process (single-push).</p>

<!-- ========== OPEN QUESTIONS ========== -->
<h2 id="open-questions">Open Questions / Gaps to Address</h2>
<div class="card" style="border-left: 3px solid var(--amber);">
  <div class="card-title" style="color: var(--amber);">For Future Research Tasks</div>
  <ul style="margin-top: 8px;">
    <li><strong>Prior research staleness:</strong> The "20 High-Advantage Targets" and deep research docs were created ~Feb 23, 2026. Some roles may have closed. Need to re-validate open positions before applying.</li>
    <li><strong>Degree filter risk:</strong> AAS only (BAS in progress, left off). Some companies auto-filter on "Bachelor's required." Worth checking if target companies have this filter.</li>
    <li><strong>Denver Metro hybrid options:</strong> No research done on local hybrid roles. Could be a parallel track — lower comp but faster hiring at smaller companies.</li>
    <li><strong>Go ramp-up story:</strong> Several high-value targets (Spacelift, Grafana, Teleport) use Go. If applying, need a credible "I'll ramp fast" narrative backed by the Python→Rust→Go trajectory.</li>
    <li><strong>Commit history on OSS projects:</strong> Hiring managers may notice single-push history. Consider whether this needs addressing in cover letters or portfolio deck.</li>
    <li><strong>Salary negotiation anchor:</strong> Current $145K is well below market for this profile. Research suggests $170K-$200K+ is realistic. Need to practice not anchoring to current comp.</li>
  </ul>
</div>

</main>
</div>
</body>
</html>
```

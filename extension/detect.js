// Finds the job advert on the page the person is looking at. Runs inside that page only
// when the panel asks, and returns text, never anything else from the page. In order:
// 1. what they highlighted; 2. on LinkedIn, the job they opened, read by its id from
//    LinkedIn's own job page (founder, round 29: on a list of jobs the panel read the whole
//    list); 3. the page's own job data (schema.org JobPosting, which most job boards
//    publish); 4. the job box on sites we know, inside the open job's pane; 5. the block of
//    the page that reads most like a job advert, never a block that holds a list of jobs.
// It also lists big images, for adverts posted as flyers.
// Self-contained: it is sent into the page as one function.
export async function detectJob() {
  const clean = (s) =>
    String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();
  const textOf = (el) => (el ? clean(el.innerText || el.textContent || "") : "");
  const htmlToText = (html) => {
    // DOMParser never runs scripts or loads images, unlike innerHTML.
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
    doc.querySelectorAll("p, li, div, h1, h2, h3, h4, tr").forEach((b) => b.append("\n"));
    return clean(doc.body ? doc.body.textContent : "");
  };
  const JOB_WORDS = /responsibilit|requirement|qualification|what you('|’)ll do|what we('|’)re looking for|about the role|job description|key duties|duties|skills|years of experience|experience in|apply|deadline|salary|benefits|we are looking for|you will|must have|nice to have|full[- ]?time|part[- ]?time|contract|remote|hybrid|on[- ]?site/gi;
  const hits = (t) => (String(t).match(JOB_WORDS) || []).length;

  const out = { url: location.href, host: location.hostname.replace(/^www\./, ""), title: "", company: "", location: "", text: "", source: "none", jobLike: false, images: [] };

  // 1. Highlighted text wins: the person chose it.
  const picked = clean(String(window.getSelection() || ""));
  if (picked.length > 150) {
    out.text = picked;
    out.source = "selection";
  }

  // 2. LinkedIn: the job that is open, by its id, from the same page a signed-out visitor
  //    sees. On a list of jobs, the id is in the address (currentJobId), so this is exactly
  //    the job the person clicked, however LinkedIn draws its list.
  if (!out.text && /(^|\.)linkedin\.com$/.test(location.hostname)) {
    const u = new URL(location.href);
    const q = u.searchParams.get("currentJobId") || u.searchParams.get("jobId");
    const m = u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/);
    const id = (q && /^\d{6,}$/.test(q) ? q : "") || (m ? m[1] : "");
    if (id) {
      try {
        const res = await fetch(`/jobs-guest/jobs/api/jobPosting/${id}`, { credentials: "include", signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const doc = new DOMParser().parseFromString(await res.text(), "text/html");
          const pick = (root, sel) => clean((root.querySelector(sel) || {}).textContent || "").split("\n")[0];
          const title = pick(doc, ".top-card-layout__title") || pick(doc, "h2");
          const company = pick(doc, ".topcard__org-name-link") || pick(doc, ".topcard__flavor");
          const place = pick(doc, ".topcard__flavor--bullet");
          const desc = doc.querySelector(".show-more-less-html__markup") || doc.querySelector(".description__text");
          const body = desc ? htmlToText(desc.innerHTML) : "";
          const criteria = [...doc.querySelectorAll(".description__job-criteria-item")].map((li) => [pick(li, "h3"), pick(li, "span")].filter(Boolean).join(": ")).filter(Boolean);
          if (title && body.length > 80) {
            out.title = title.slice(0, 160);
            out.company = company.slice(0, 120);
            out.location = place.slice(0, 120);
            out.text = clean([title, company && `Employer: ${company}`, place && `Location: ${place}`, body, criteria.join("\n")].filter(Boolean).join("\n\n"));
            out.source = "linkedin";
          }
        }
      } catch {
        // LinkedIn didn't answer: read the open job's pane below.
      }
    }
  }

  // 3. Structured job data.
  if (!out.text) {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent || "null");
        const items = [].concat(data || [], (data && data["@graph"]) || []).flat();
        const jp = items.find((x) => x && (x["@type"] === "JobPosting" || (Array.isArray(x["@type"]) && x["@type"].includes("JobPosting"))));
        if (jp) {
          const org = jp.hiringOrganization && (jp.hiringOrganization.name || jp.hiringOrganization);
          const loc = [].concat(jp.jobLocation || [])[0];
          const addr = loc && loc.address ? [loc.address.addressLocality, loc.address.addressRegion, loc.address.addressCountry && (loc.address.addressCountry.name || loc.address.addressCountry)].filter(Boolean).join(", ") : "";
          out.title = clean(jp.title || "");
          out.company = typeof org === "string" ? clean(org) : "";
          out.location = clean(addr || (jp.jobLocationType === "TELECOMMUTE" ? "Remote" : ""));
          const head = [out.title, out.company && `Employer: ${out.company}`, out.location && `Location: ${out.location}`, jp.employmentType && `Type: ${[].concat(jp.employmentType).join(", ")}`, jp.validThrough && `Closing date: ${String(jp.validThrough).slice(0, 10)}`].filter(Boolean).join("\n");
          out.text = clean(`${head}\n\n${htmlToText(jp.description)}`);
          out.source = "structured";
          break;
        }
      } catch {
        // Not valid JSON: try the next way.
      }
    }
  }

  // 4. Job boards we know. `pane` is the open job's pane on boards that show a list beside
  //    it; everything is read inside it, so the list is never part of the job.
  const SITES = [
    {
      host: /linkedin\.com$/,
      pane: [".scaffold-layout__detail", ".jobs-search__job-details--wrapper", ".jobs-search__job-details", ".jobs-details", ".job-view-layout"],
      title: [".job-details-jobs-unified-top-card__job-title", ".top-card-layout__title", ".jobs-unified-top-card__job-title", "h1", "h2"],
      company: [".job-details-jobs-unified-top-card__company-name", ".topcard__org-name-link", ".jobs-unified-top-card__company-name"],
      body: ["#job-details", ".jobs-description__content", ".jobs-description-content__text", ".jobs-box__html-content", ".show-more-less-html__markup", ".description__text"],
    },
    { host: /indeed\./, title: ["[data-testid='jobsearch-JobInfoHeader-title']", "h1"], company: ["[data-testid='inlineHeader-companyName']", "[data-company-name='true']"], body: ["#jobDescriptionText"] },
    { host: /greenhouse\.io$/, title: [".job__title h1", "h1.app-title", "h1"], company: [".company-name"], body: [".job__description", "#content"] },
    { host: /lever\.co$/, title: [".posting-headline h2"], company: [".main-header-logo img[alt]"], body: [".posting-page .content", ".section-wrapper.page-full-width"] },
    { host: /myworkdayjobs\.com$/, title: ["[data-automation-id='jobPostingHeader']"], company: [], body: ["[data-automation-id='jobPostingDescription']"] },
    { host: /ashbyhq\.com$/, title: ["h1"], company: [], body: ["[class*='_descriptionText']", "[class*='description']"] },
    { host: /jobberman\.com$/, title: ["h1"], company: ["h2 a[href*='/company']"], body: [".job__details", "article"] },
    { host: /myjobmag\.com$/, title: ["h1"], company: [".job-key-info a", ".read-h1 + span"], body: [".job-details", "#printable"] },
    { host: /glassdoor\./, title: ["[data-test='job-title']", "h1"], company: ["[data-test='employer-name']"], body: ["[class*='JobDetails_jobDescription']", "#JobDescriptionContainer"] },
  ];
  const site = SITES.find((x) => x.host.test(location.hostname));
  if (site) {
    const pane = (site.pane || []).map((sel) => document.querySelector(sel)).find(Boolean) || null;
    const within = (selectors) => {
      for (const sel of selectors) {
        const t = textOf((pane || document).querySelector(sel));
        if (t) return t;
      }
      return "";
    };
    out.title = out.title || within(site.title).split("\n")[0].slice(0, 160);
    out.company = out.company || within(site.company).split("\n")[0].slice(0, 120);
    if (!out.text) {
      // The description box, or the whole open-job pane when the box has a new name.
      const body = within(site.body) || (pane ? textOf(pane) : "");
      if (body.length > 200) {
        out.text = clean([out.title, out.company && `Employer: ${out.company}`, body].filter(Boolean).join("\n\n"));
        out.source = "site";
      }
    }
  }

  // 5. The block that reads most like a job advert: job words count most, length helps up to
  //    a point, and menus, footers and link lists count against it. A block with links to
  //    three or more different jobs is a list of jobs, never one advert, so it is skipped.
  const JOB_LINK = /\/jobs?\/(?:view\/)?[^/?#]*\d{5,}|[?&](?:jk|vjk|currentJobId|jobId|job_id|jobid)=|\/viewjob|\/job-listing|\/vacanc/i;
  const jobLinks = (el) => new Set([...el.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || "").filter((h) => JOB_LINK.test(h))).size;
  if (!out.text) {
    let best = null;
    let bestScore = 0;
    const blocks = document.querySelectorAll("main, article, section, [role='main'], div");
    let looked = 0;
    for (const el of blocks) {
      if (looked++ > 4000) break;
      if (el.closest("nav, header, footer, aside, [role='navigation'], [aria-hidden='true']")) continue;
      const t = el.innerText || "";
      if (t.length < 400 || t.length > 25000) continue;
      const linkText = [...el.querySelectorAll("a")].reduce((n, a) => n + (a.innerText || "").length, 0);
      const linkRatio = linkText / t.length;
      if (linkRatio > 0.5) continue;
      if (jobLinks(el) >= 3) continue;
      const score = hits(t) * 120 + Math.min(t.length, 6000) / 25 - linkRatio * 900 - Math.max(0, t.length - 9000) / 10;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      out.text = textOf(best);
      out.source = "page";
    }
  }

  if (!out.title) {
    const h1 = textOf(document.querySelector("h1")).split("\n")[0];
    out.title = (h1 && h1.length < 140 ? h1 : document.title.split(/[|\-–]/)[0] || "").trim().slice(0, 160);
  }
  // Many job pages name the employer in the tab title: "Job Application for X at Company".
  if (!out.company) {
    const m = document.title.match(/\bat ([^|–\-]{2,60})(?:[|–\-]|$)/i);
    if (m) out.company = m[1].trim();
  }
  out.text = out.text.slice(0, 40000);
  out.jobLike = out.text.length >= 300 && hits(out.text) >= 2;

  // Big pictures on the page, in case the advert is a flyer.
  const imgs = [...document.images]
    .filter((im) => im.naturalWidth >= 320 && im.naturalHeight >= 320 && /^https?:/.test(im.currentSrc || im.src))
    .map((im) => ({ src: im.currentSrc || im.src, alt: (im.alt || "").slice(0, 120), area: im.naturalWidth * im.naturalHeight }))
    .sort((a, b) => b.area - a.area)
    .slice(0, 4)
    .map(({ src, alt }) => ({ src, alt }));
  out.images = imgs;
  return out;
}

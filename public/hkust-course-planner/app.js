const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_NAMES = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat" };
const START_MIN = 8 * 60;
const END_MIN = 21 * 60 + 30;
const SLOT = 30;
const COMPONENT_LABELS = { L: "Lecture", T: "Tutorial", LA: "Lab", R: "Research" };
const MODES = {
  chill: "Spread classes across weekdays with a balanced daily load.",
  harsh: "Pack classes into 2-3 days and protect days off.",
  night: "Avoid 09:00 starts and allow later finishes.",
  morning: "Prefer early classes and avoid 18:00 finishes.",
  grade: "Warn about weak USTspace grading ratings while keeping a balanced week.",
};

let allCourses = [];
let currentPayload = null;
let currentTerm = localValue("hkust-term") || window.HKUST_COURSE_DATA?.term_code || "2610";
let selected = loadSelection();
let history = loadArray("hkust-course-history");
let ratings = { ...(window.USTSPACE_RATINGS || {}), ...loadObject("hkust-course-ratings") };
let recommendationMode = localValue("hkust-recommendation-mode") || "chill";
let planNotice = "";

const byId = (id) => document.getElementById(id);
const els = {
  search: byId("searchInput"), subject: byId("subjectFilter"), level: byId("levelFilter"),
  availability: byId("availabilityFilter"), term: byId("termSelect"), reload: byId("reloadButton"),
  source: byId("sourceNote"), list: byId("courseList"), selected: byId("selectedList"),
  hint: byId("selectedHint"), calendar: byId("calendar"), alerts: byId("alerts"),
  credits: byId("creditTotal"), sections: byId("sectionTotal"), clear: byId("clearButton"),
  optimizePlan: byId("optimizePlanButton"), modeControl: byId("modeControl"),
  modeDescription: byId("modeDescription"), subtitle: byId("termSubtitle"),
  historyButton: byId("historyButton"), historyCount: byId("historyCount"),
  dialog: byId("historyDialog"), historyInput: byId("historyInput"), historyResult: byId("historyResult"),
  historyList: byId("historyList"), ratingsInput: byId("ratingsInput"), ratingsResult: byId("ratingsResult"),
  ratingsList: byId("ratingsList"),
};

initializeTerms();
wireEvents();
loadTerm(currentTerm);

function initializeTerms() {
  const terms = window.HKUST_TERMS?.length ? window.HKUST_TERMS : [{
    code: window.HKUST_COURSE_DATA?.term_code || "2610",
    name: window.HKUST_COURSE_DATA?.term || "2026-27 Fall",
    file: `data/courses-${window.HKUST_COURSE_DATA?.term_code || "2610"}.js`,
  }];
  if (!terms.some((term) => term.code === currentTerm)) currentTerm = terms[0].code;
  els.term.innerHTML = terms.map((term) => `<option value="${escapeHtml(term.code)}">${escapeHtml(term.name)}</option>`).join("");
  els.term.value = currentTerm;
}

function wireEvents() {
  els.search.addEventListener("input", renderCourseList);
  [els.subject, els.level, els.availability].forEach((control) => control.addEventListener("change", renderCourseList));
  els.term.addEventListener("change", () => switchTerm(els.term.value));
  els.reload.addEventListener("click", () => loadTerm(currentTerm, true));
  els.clear.addEventListener("click", () => {
    selected = [];
    planNotice = "Draft timetable cleared.";
    saveSelection();
    render();
  });
  els.optimizePlan.addEventListener("click", optimizeWholePlan);
  els.modeControl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    recommendationMode = button.dataset.mode;
    saveLocal("hkust-recommendation-mode", recommendationMode);
    planNotice = `${button.textContent} recommendation mode selected. Optimize the plan to rebuild all sections.`;
    renderMode();
    renderAlerts(currentConflicts());
  });
  els.historyButton.addEventListener("click", () => {
    renderProfile();
    els.dialog.showModal();
  });
  document.querySelectorAll("[data-profile-tab]").forEach((button) => button.addEventListener("click", () => showProfileTab(button.dataset.profileTab)));
  byId("importHistoryButton").addEventListener("click", importHistory);
  byId("clearHistoryButton").addEventListener("click", clearHistory);
  byId("importRatingsButton").addEventListener("click", importRatings);
  byId("clearRatingsButton").addEventListener("click", clearRatings);
  byId("historyFile").addEventListener("change", (event) => readUpload(event, els.historyInput));
  byId("ratingsFile").addEventListener("change", (event) => readUpload(event, els.ratingsInput));

  const planner = document.querySelector(".planner");
  planner.addEventListener("dragover", (event) => { event.preventDefault(); planner.classList.add("dropReady"); });
  planner.addEventListener("dragleave", (event) => { if (!planner.contains(event.relatedTarget)) planner.classList.remove("dropReady"); });
  planner.addEventListener("drop", (event) => {
    event.preventDefault();
    planner.classList.remove("dropReady");
    const payload = safeJson(event.dataTransfer.getData("application/json"));
    const course = allCourses.find((item) => item.code === payload?.courseCode);
    const section = course?.sections.find((item) => item.id === payload?.sectionId);
    if (course && section) addCourseBundle(course, section);
  });
}

async function readUpload(event, target) {
  const file = event.target.files?.[0];
  if (!file) return;
  target.value = await file.text();
  event.target.value = "";
}

async function switchTerm(termCode) {
  currentTerm = termCode;
  saveLocal("hkust-term", termCode);
  selected = loadSelection();
  planNotice = "";
  await loadTerm(termCode);
}

async function loadTerm(termCode, force = false) {
  els.source.textContent = "Loading course data...";
  try {
    let payload = !force && window.HKUST_TERM_DATA?.[termCode];
    if (!payload && window.HKUST_COURSE_DATA?.term_code === termCode) payload = window.HKUST_COURSE_DATA;
    if (!payload) {
      const term = window.HKUST_TERMS?.find((item) => item.code === termCode);
      await loadScript(term?.file || `data/courses-${termCode}.js`, force);
      payload = window.HKUST_TERM_DATA?.[termCode];
    }
    if (!payload && location.protocol !== "file:") {
      const response = await fetch(`data/courses-${termCode}.json`, { cache: force ? "reload" : "default" });
      if (response.ok) payload = await response.json();
    }
    if (!payload) throw new Error("No semester data file");
    currentPayload = payload;
    allCourses = payload.courses || [];
    selected = loadSelection();
    migrateSelectionIds();
    hydrateFilters();
    els.subtitle.textContent = `${payload.term} timetable builder from HKUST's public Class Schedule & Quota pages.`;
    const refreshed = payload.generated_at ? new Date(payload.generated_at).toLocaleString() : "unknown";
    els.source.innerHTML = `${allCourses.length.toLocaleString()} courses and ${(payload.section_count || 0).toLocaleString()} sections &middot; refreshed ${escapeHtml(refreshed)} &middot; <a href="${escapeHtml(payload.source)}" target="_blank" rel="noreferrer">official source</a>`;
    render();
  } catch {
    allCourses = [];
    els.source.textContent = "This semester has not been downloaded yet. Run the all-semester refresh script to add it.";
    render();
  }
}

function loadScript(src, force) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${src}${force && location.protocol !== "file:" ? `?t=${Date.now()}` : ""}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

function hydrateFilters() {
  const previous = els.subject.value;
  els.subject.innerHTML = '<option value="">All subjects</option>';
  [...new Set(allCourses.map((course) => course.subject))].sort().forEach((subject) => {
    els.subject.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`);
  });
  if ([...els.subject.options].some((option) => option.value === previous)) els.subject.value = previous;
}

function render() {
  renderMode();
  renderCourseList();
  renderSelected();
  renderCalendar();
  els.historyCount.textContent = history.length;
}

function renderMode() {
  els.modeControl.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.mode === recommendationMode));
  els.modeDescription.textContent = MODES[recommendationMode];
}

function renderCourseList() {
  const query = els.search.value.trim().toLowerCase();
  const courses = allCourses
    .filter((course) => !els.subject.value || course.subject === els.subject.value)
    .filter((course) => !els.level.value || levelOf(course.number) === els.level.value)
    .filter((course) => matchesAvailability(course, els.availability.value))
    .filter((course) => matchesCourse(course, query))
    .slice(0, 60);
  els.list.innerHTML = "";
  if (!courses.length) {
    els.list.innerHTML = '<div class="empty">No courses match this search.</div>';
    return;
  }

  courses.forEach((course) => {
    const groups = courseComponents(course);
    const selectedIds = new Set(selected.filter((item) => item.courseCode === course.code).map((item) => item.id));
    const courseSelected = selectedIds.size > 0;
    const exactSearch = query && normalizeSearch(course.code) === normalizeSearch(query);
    const eligibility = eligibilityFor(course);
    const rating = ratings[normalizeCourseCode(course.code)];
    const node = document.createElement("article");
    node.className = `course ${courseSelected ? "courseSelected" : ""}`;
    node.dataset.courseCode = course.code;
    node.innerHTML = `
      <div class="courseHeader">
        <div>
          <div class="courseCode">${escapeHtml(course.code)}</div>
          <div class="courseTitle">${escapeHtml(course.title)}</div>
          <div class="courseFlags">
            <span>${escapeHtml([...groups.keys()].map(componentLabel).join(" + "))}</span>
            ${course.matching_required ? '<span class="matchingFlag">Matched sections required</span>' : ""}
            ${rating ? `<span class="gradeFlag ${isBadGrade(rating.grade) ? "badGrade" : ""}">USTspace grading ${escapeHtml(rating.grade)}</span>` : ""}
          </div>
          ${eligibility.message ? `<div class="eligibility ${eligibility.level}">${escapeHtml(eligibility.message)}</div>` : ""}
          ${course.prerequisite ? `<div class="requirementLine"><strong>Prerequisite:</strong> ${escapeHtml(course.prerequisite)}</div>` : ""}
          ${course.exclusion ? `<div class="requirementLine"><strong>Exclusion:</strong> ${escapeHtml(course.exclusion)}</div>` : ""}
        </div>
        <div class="courseHeaderActions">
          <div class="creditsBadge">${course.credits || 0} cr</div>
          <button class="bestFitButton" data-action="best-fit" type="button" onclick="handleCourseButtonClick(this)">${courseSelected ? "Optimize" : "Add best fit"}</button>
        </div>
      </div>
      <details class="sectionDetails" ${exactSearch || courses.length <= 3 || courseSelected ? "open" : ""}>
        <summary>Choose a section <span>${course.sections.length} classes</span></summary>
        <div class="sectionRows"></div>
      </details>`;
    const rows = node.querySelector(".sectionRows");
    groups.forEach((sections, component) => {
      rows.insertAdjacentHTML("beforeend", `<div class="componentHeading"><span>${escapeHtml(componentLabel(component))}</span><small>Choose one</small></div>`);
      sections.forEach((section) => rows.append(renderSectionRow(course, section, selectedIds, courseSelected)));
    });
    els.list.append(node);
  });
}

function renderSectionRow(course, section, selectedIds, courseSelected) {
  const selectedAlready = selectedIds.has(section.id);
  const conflicts = conflictsForSection(section, course.code);
  const isFull = section.avail !== null && Number(section.avail) <= 0;
  const row = document.createElement("div");
  row.className = ["sectionRow", selectedAlready && "isSelected", conflicts.length && "hasConflict", isFull && "isFull"].filter(Boolean).join(" ");
  row.draggable = !selectedAlready;
  const quota = quotaSummary(section);
  row.innerHTML = `
    <div class="sectionInfo">
      <div class="sectionTitleLine"><strong>${escapeHtml(section.section)}</strong><span class="sectionStatus ${isFull ? "fullStatus" : "availabilityStatus"}">${escapeHtml(quota.primary)}</span></div>
      <div class="sectionMeta quotaMeta">${escapeHtml(quota.detail)}</div>
      ${conflicts.length ? `<div class="sectionMeta conflictText">Clashes with ${escapeHtml(conflicts.join(", "))}</div>` : ""}
      ${selectedAlready ? '<div class="sectionMeta selectedText">Selected in current plan</div>' : ""}
      <div class="sectionMeta">${escapeHtml(timeSummary(section))}</div>
      <div class="sectionMeta">${escapeHtml(section.room || "Room TBA")} &middot; ${escapeHtml(section.instructor || "Instructor TBA")}</div>
    </div>
    <button class="addButton" data-action="choose-section" data-section-id="${escapeHtml(section.id)}" type="button" onclick="handleCourseButtonClick(this)" ${selectedAlready ? "disabled" : ""}>${selectedAlready ? "Selected" : courseSelected ? "Switch" : "Choose"}</button>`;
  row.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("application/json", JSON.stringify({ courseCode: course.code, sectionId: section.id }));
    event.dataTransfer.effectAllowed = "copy";
  });
  return row;
}

function quotaSummary(section) {
  const quota = numberOrNull(section.quota);
  const enrol = numberOrNull(section.enrol);
  const avail = numberOrNull(section.avail);
  const wait = numberOrNull(section.wait) || 0;
  if (avail === null) return { primary: "Availability unknown", detail: `Quota ${quota ?? "?"} | Enrolled ${enrol ?? "?"} | Waitlist ${wait}` };
  const full = avail <= 0;
  return {
    primary: full ? `Full | ${wait} waiting` : `Open | ${avail} seats`,
    detail: `${enrol ?? "?"}/${quota ?? "?"} enrolled | ${avail} available | ${wait} on waitlist`,
  };
}

function renderSelected() {
  els.selected.innerHTML = "";
  const enriched = selected.map(resolveSelected).filter(Boolean);
  const courseCodes = [...new Set(enriched.map((item) => item.course.code))];
  els.credits.textContent = courseCodes.reduce((sum, code) => sum + (Number(allCourses.find((course) => course.code === code)?.credits) || 0), 0);
  els.sections.textContent = enriched.length;
  els.hint.textContent = enriched.length ? `${courseCodes.length} courses with ${enriched.length} required class sections.` : "Add a best-fit course bundle to start building your week.";
  if (!enriched.length) {
    els.selected.innerHTML = '<div class="empty">Nothing selected yet.</div>';
    return;
  }
  courseCodes.forEach((code) => {
    const course = allCourses.find((item) => item.code === code);
    const sections = enriched.filter((item) => item.course.code === code).map((item) => item.section);
    const eligibility = eligibilityFor(course);
    const rating = ratings[normalizeCourseCode(code)];
    const item = document.createElement("article");
    item.className = "selectedItem";
    item.innerHTML = `
      <div class="selectedCourseHeader"><div><strong>${escapeHtml(code)}</strong><span>${course.credits || 0} cr</span></div><div class="selectedMeta">${escapeHtml(course.title)}</div></div>
      <div class="selectedSections">${sections.map((section) => {
        const quota = quotaSummary(section);
        return `<div class="selectedSectionLine"><span>${escapeHtml(componentLabel(componentType(section)))}</span><strong>${escapeHtml(section.section)}</strong><small>${escapeHtml(timeSummary(section))}</small><em class="${section.avail <= 0 ? "fullText" : "openText"}">${escapeHtml(quota.primary)}</em></div>`;
      }).join("")}</div>
      ${eligibility.message ? `<div class="bundleWarning ${eligibility.level}">${escapeHtml(eligibility.message)}</div>` : ""}
      ${rating && isBadGrade(rating.grade) ? `<div class="bundleWarning danger">USTspace grading rating is ${escapeHtml(rating.grade)}${rating.review_count ? ` from ${rating.review_count} reviews` : ""}.</div>` : ""}
      <div class="selectedActions"><button class="optimizeButton" data-action="optimize" data-course-code="${escapeHtml(code)}" type="button" onclick="handlePlannedButtonClick(this)">Optimize sections</button><button class="removeButton" data-action="remove-course" data-course-code="${escapeHtml(code)}" type="button" onclick="handlePlannedButtonClick(this)">Remove course</button></div>`;
    els.selected.append(item);
  });
}

function handleCourseButtonClick(button) {
  const course = allCourses.find((item) => item.code === button.closest(".course")?.dataset.courseCode);
  if (!course) return;
  if (button.dataset.action === "best-fit") addCourseBundle(course);
  if (button.dataset.action === "choose-section") addCourseBundle(course, course.sections.find((section) => section.id === button.dataset.sectionId));
}

function handlePlannedButtonClick(button) {
  const course = allCourses.find((item) => item.code === button.dataset.courseCode);
  if (button.dataset.action === "optimize" && course) addCourseBundle(course);
  if (button.dataset.action === "remove-course") removeCourse(button.dataset.courseCode);
}

function addCourseBundle(course, preferredSection = null, quiet = false) {
  const solution = findBestBundle(course, preferredSection);
  if (!solution.length) {
    planNotice = `No valid section combination was found for ${course.code}.`;
    if (!quiet) render();
    return false;
  }
  selected = selected.filter((item) => item.courseCode !== course.code);
  selected.push(...solution.map((section) => ({ id: section.id, courseCode: course.code })));
  saveSelection();
  if (!quiet) {
    const names = solution.map((section) => section.section).join(" + ");
    const conflicts = conflictsForBundle(solution, course.code);
    const full = solution.filter((section) => Number(section.avail) <= 0);
    if (conflicts.length) planNotice = `Added ${course.code} ${names}, with a clash against ${conflicts.join(", ")}.`;
    else if (full.length) planNotice = `Added ${course.code} ${names}. ${full.map((section) => `${section.section} is full with ${section.wait || 0} waiting`).join("; ")}.`;
    else planNotice = `Added ${course.code} ${names} using ${recommendationMode} mode.`;
    render();
  }
  return true;
}

function optimizeWholePlan() {
  const codes = [...new Set(selected.map((item) => item.courseCode))];
  if (!codes.length) {
    planNotice = "Add courses before optimizing the plan.";
    renderAlerts([]);
    return;
  }
  for (let pass = 0; pass < 3; pass += 1) {
    codes.forEach((code) => {
      const course = allCourses.find((item) => item.code === code);
      if (course) addCourseBundle(course, null, true);
    });
  }
  planNotice = `Rebuilt ${codes.length} courses using ${recommendationMode} mode. Full sections and waitlists were avoided where possible.`;
  saveSelection();
  render();
}

function removeCourse(code) {
  selected = selected.filter((item) => item.courseCode !== code);
  planNotice = `Removed ${code} and all of its class sections.`;
  saveSelection();
  render();
}

function findBestBundle(course, preferredSection = null) {
  const groups = [...courseComponents(course).entries()].map(([component, sections]) => ({
    component, sections: preferredSection && componentType(preferredSection) === component ? [preferredSection] : sections,
  }));
  let best = null;
  let bestScore = null;
  function visit(index, bundle) {
    if (index === groups.length) {
      if (course.matching_required && !isMatchingBundle(bundle)) return;
      const score = scoreBundle(bundle, course.code);
      if (!bestScore || compareScores(score, bestScore) < 0) { best = [...bundle]; bestScore = score; }
      return;
    }
    groups[index].sections.forEach((section) => {
      const next = [...bundle, section];
      if (!course.matching_required || isMatchingBundle(next)) visit(index + 1, next);
    });
  }
  visit(0, []);
  return best || [];
}

function scoreBundle(bundle, courseCode) {
  const existing = selected.map(resolveSelected).filter(Boolean).filter((item) => item.course.code !== courseCode).map((item) => item.section);
  const sections = [...existing, ...bundle];
  const closed = bundle.filter((section) => numberOrNull(section.avail) !== null && Number(section.avail) <= 0).length;
  const conflictMinutes = conflictMinutesForBundle(bundle, courseCode);
  const tba = bundle.filter((section) => !section.meetings.length).length;
  const waiting = bundle.reduce((sum, section) => sum + (Number(section.wait) || 0), 0);
  const mode = modeScore(sections);
  const seats = bundle.map((section) => numberOrNull(section.avail)).filter((value) => value !== null);
  return [closed, conflictMinutes, tba, ...mode, waiting, -(seats.length ? Math.min(...seats) : 0), bundle.map((section) => section.section).join("|")];
}

function modeScore(sections) {
  const meetings = sections.flatMap((section) => section.meetings);
  const active = new Map();
  meetings.forEach((meeting) => {
    if (!active.has(meeting.day)) active.set(meeting.day, []);
    active.get(meeting.day).push(meeting);
  });
  const weekdays = ["Mo", "Tu", "We", "Th", "Fr"].filter((day) => active.has(day)).length;
  const dailyMinutes = [...active.values()].map((items) => items.reduce((sum, item) => sum + item.end - item.start, 0));
  const variance = dailyMinutes.length ? Math.max(...dailyMinutes) - Math.min(...dailyMinutes) : 0;
  const early = meetings.reduce((sum, item) => sum + Math.max(0, 10 * 60 + 30 - item.start), 0);
  const late = meetings.reduce((sum, item) => sum + Math.max(0, item.end - 18 * 60), 0);
  const startTotal = meetings.reduce((sum, item) => sum + item.start, 0);
  const gaps = [...active.values()].reduce((total, items) => {
    const sorted = [...items].sort((a, b) => a.start - b.start);
    return total + sorted.slice(1).reduce((sum, item, index) => sum + Math.max(0, item.start - sorted[index].end), 0);
  }, 0);
  if (recommendationMode === "harsh") return [weekdays, gaps];
  if (recommendationMode === "night") return [early, -late, weekdays];
  if (recommendationMode === "morning") return [late, startTotal, weekdays];
  return [Math.abs(5 - weekdays), variance, gaps];
}

function compareScores(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

function renderCalendar() {
  els.calendar.innerHTML = '<div class="dayHead"></div>';
  DAYS.forEach((day) => els.calendar.insertAdjacentHTML("beforeend", `<div class="dayHead">${DAY_NAMES[day]}</div>`));
  const slots = Math.ceil((END_MIN - START_MIN) / SLOT);
  for (let row = 0; row < slots; row += 1) {
    els.calendar.insertAdjacentHTML("beforeend", `<div class="timeCell">${formatTime(START_MIN + row * SLOT)}</div>`);
    DAYS.forEach(() => els.calendar.insertAdjacentHTML("beforeend", '<div class="gridCell"></div>'));
  }
  const meetings = selected.map(resolveSelected).filter(Boolean).flatMap(({ course, section }) => section.meetings.map((meeting) => ({ course, section, meeting })));
  const conflicts = findConflicts(meetings);
  renderAlerts(conflicts);
  meetings.forEach(({ course, section, meeting }) => {
    if (!DAYS.includes(meeting.day)) return;
    const event = document.createElement("div");
    const conflict = conflicts.some((pair) => pair.ids.includes(section.id) && pair.day === meeting.day);
    event.className = `event ${sectionType(section.section)} ${conflict ? "conflict" : ""}`;
    event.style.gridColumn = String(DAYS.indexOf(meeting.day) + 2);
    event.style.gridRow = `${Math.max(2, Math.floor((meeting.start - START_MIN) / SLOT) + 2)} / span ${Math.max(1, Math.ceil((meeting.end - meeting.start) / SLOT))}`;
    event.innerHTML = `<strong>${escapeHtml(course.code)} ${escapeHtml(section.section)}</strong><br>${escapeHtml(formatRange(meeting))}<br>${escapeHtml(section.room || "TBA")}`;
    els.calendar.append(event);
  });
}

function currentConflicts() {
  return findConflicts(selected.map(resolveSelected).filter(Boolean).flatMap(({ course, section }) => section.meetings.map((meeting) => ({ course, section, meeting }))));
}

function renderAlerts(conflicts) {
  els.alerts.innerHTML = planNotice ? `<div class="alert planNotice">${escapeHtml(planNotice)}</div>` : "";
  conflicts.forEach((conflict) => els.alerts.insertAdjacentHTML("beforeend", `<div class="alert">Time clash on ${DAY_NAMES[conflict.day]}: ${escapeHtml(conflict.labels.join(" overlaps with "))}.</div>`));
}

function importHistory() {
  const records = parseHistory(els.historyInput.value);
  if (!records.length) {
    els.historyResult.textContent = "No course-history rows were found. Include the course, term, grade, units and status columns.";
    return;
  }
  const merged = new Map(history.map((item) => [`${item.code}-${item.term}-${item.status}`, item]));
  records.forEach((item) => merged.set(`${item.code}-${item.term}-${item.status}`, item));
  history = [...merged.values()];
  saveLocal("hkust-course-history", JSON.stringify(history));
  els.historyInput.value = "";
  els.historyResult.textContent = `Imported ${records.length} rows. ${history.length} records saved.`;
  renderProfile();
  render();
}

function parseHistory(text) {
  const rows = [];
  const pattern = /\b([A-Z]{3,5})\s*([A-Z]?\d{3,4}[A-Z]?)\b\s+(.+?)\s+(20\d{2}-\d{2}\s+(?:Fall|Spring|Summer|Winter))\s+([A-Z][A-Z+\-]*)\s+(\d+(?:\.\d+)?)\s+(Taken|Transferred|In Progress)\b/gim;
  let match;
  while ((match = pattern.exec(text)) !== null) rows.push({ code: `${match[1].toUpperCase()} ${match[2].toUpperCase()}`, title: match[3].trim(), term: match[4], grade: match[5], units: Number(match[6]), status: match[7] });
  return rows;
}

function clearHistory() {
  history = [];
  saveLocal("hkust-course-history", "[]");
  els.historyResult.textContent = "Course history cleared.";
  renderProfile();
  render();
}

function importRatings() {
  const parsed = parseRatings(els.ratingsInput.value);
  if (!Object.keys(parsed).length) {
    els.ratingsResult.textContent = "No ratings found. Use lines such as COMP 2011 B-, or paste exported JSON.";
    return;
  }
  ratings = { ...ratings, ...parsed };
  saveLocal("hkust-course-ratings", JSON.stringify(ratings));
  els.ratingsInput.value = "";
  els.ratingsResult.textContent = `Imported ${Object.keys(parsed).length} course ratings.`;
  renderProfile();
  render();
}

function parseRatings(text) {
  const json = safeJson(text);
  const output = {};
  if (json && typeof json === "object") {
    const entries = Array.isArray(json) ? json : Object.entries(json).map(([code, value]) => ({ code, ...(typeof value === "string" ? { grade: value } : value) }));
    entries.forEach((item) => {
      const code = normalizeCourseCode(item.code || item.course_code);
      const grade = item.grade || item.grading_grade || item.GradingGrade;
      if (code && grade) output[code] = { grade: String(grade).toUpperCase(), review_count: Number(item.review_count || item.ReviewCount) || 0, source: "USTspace" };
    });
    return output;
  }
  const pattern = /\b([A-Z]{3,5})\s*([A-Z]?\d{3,4}[A-Z]?)\s+([A-EF][+\-]?)(?=\s|$)/gim;
  let match;
  while ((match = pattern.exec(text)) !== null) output[`${match[1].toUpperCase()}${match[2].toUpperCase()}`] = { grade: match[3].toUpperCase(), review_count: 0, source: "USTspace" };
  return output;
}

function clearRatings() {
  ratings = {};
  saveLocal("hkust-course-ratings", "{}");
  els.ratingsResult.textContent = "Imported ratings cleared.";
  renderProfile();
  render();
}

function renderProfile() {
  els.historyCount.textContent = history.length;
  els.historyList.innerHTML = history.length ? history.slice().reverse().map((item) => `<div><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.term)} &middot; ${escapeHtml(item.grade)} &middot; ${escapeHtml(item.status)}</span></div>`).join("") : '<div class="empty">No history imported.</div>';
  const ratingEntries = Object.entries(ratings).sort();
  els.ratingsList.innerHTML = ratingEntries.length ? ratingEntries.map(([code, item]) => `<div><strong>${escapeHtml(formatCourseCode(code))}</strong><span>Grading ${escapeHtml(item.grade)}${item.review_count ? ` &middot; ${item.review_count} reviews` : ""}</span></div>`).join("") : '<div class="empty">No USTspace ratings imported.</div>';
}

function showProfileTab(name) {
  document.querySelectorAll("[data-profile-tab]").forEach((button) => button.classList.toggle("active", button.dataset.profileTab === name));
  document.querySelectorAll("[data-profile-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.profilePanel === name));
}

function eligibilityFor(course) {
  if (!history.length) return { level: "", message: "" };
  const completed = new Set(history.filter((item) => ["Taken", "Transferred", "In Progress"].includes(item.status)).map((item) => normalizeCourseCode(item.code)));
  const own = history.find((item) => normalizeCourseCode(item.code) === normalizeCourseCode(course.code));
  if (own) return { level: "warning", message: `${own.status === "In Progress" ? "Already in progress" : "Already taken"}: ${own.term} (${own.grade}).` };
  const exclusions = extractCourseCodes(course.exclusion);
  const excluded = exclusions.find((code) => completed.has(code));
  if (excluded) return { level: "danger", message: `Exclusion warning: your history contains ${formatCourseCode(excluded)}.` };
  if (!course.prerequisite) return { level: "ok", message: "No listed course prerequisite." };
  const required = extractCourseCodes(course.prerequisite);
  if (!required.length) return { level: "warning", message: "Prerequisite needs a manual check against your program or standing." };
  const hasOr = /\bOR\b/i.test(course.prerequisite);
  const met = hasOr ? required.some((code) => completed.has(code)) : required.every((code) => completed.has(code));
  if (met) return { level: "ok", message: "Course-code prerequisites appear satisfied by your history." };
  const missing = required.filter((code) => !completed.has(code)).map(formatCourseCode);
  return { level: "danger", message: `Prerequisite warning: history does not show ${hasOr ? "any of " : ""}${missing.join(", ")}. Manual approval may still apply.` };
}

function isBadGrade(grade) { return ["C+", "C", "C-", "D+", "D", "D-", "E+", "E", "F"].includes(String(grade).toUpperCase()); }
function extractCourseCodes(value) { return [...String(value || "").matchAll(/\b([A-Z]{3,5})\s*([A-Z]?\d{3,4}[A-Z]?)\b/g)].map((match) => `${match[1]}${match[2]}`); }
function normalizeCourseCode(value) { const match = String(value || "").toUpperCase().match(/([A-Z]{3,5})\s*([A-Z]?\d{3,4}[A-Z]?)/); return match ? `${match[1]}${match[2]}` : ""; }
function formatCourseCode(value) { return String(value).replace(/^([A-Z]{3,5})([A-Z]?\d)/, "$1 $2"); }
function matchesAvailability(course, filter) { if (!filter) return true; const open = course.sections.some((section) => Number(section.avail) > 0); return filter === "open" ? open : !open || course.sections.some((section) => Number(section.wait) > 0); }
function courseComponents(course) { const groups = new Map(); course.sections.forEach((section) => { const type = componentType(section); if (!groups.has(type)) groups.set(type, []); groups.get(type).push(section); }); return groups; }
function componentType(section) { const name = typeof section === "string" ? section : section?.section || ""; if (/^LA/i.test(name)) return "LA"; if (/^L/i.test(name)) return "L"; if (/^T/i.test(name)) return "T"; if (/^R/i.test(name)) return "R"; return (name.match(/^[A-Z]+/i)?.[0] || "SECTION").toUpperCase(); }
function componentLabel(component) { return COMPONENT_LABELS[component] || "Section"; }
function isMatchingBundle(bundle) { const numbers = bundle.map((section) => String(Number(String(section.section || "").match(/^(?:LA|L|T|R)0*(\d+)/i)?.[1] || 0))).filter((item) => item !== "0"); return new Set(numbers).size <= 1; }
function conflictsForSection(section, exclude = "") { const labels = new Set(); selected.map(resolveSelected).filter(Boolean).forEach(({ course, section: chosen }) => { if (course.code !== exclude && sectionsOverlap(section, chosen)) labels.add(`${course.code} ${chosen.section}`); }); return [...labels]; }
function conflictsForBundle(bundle, code) { const labels = new Set(); bundle.forEach((section) => conflictsForSection(section, code).forEach((label) => labels.add(label))); for (let i = 0; i < bundle.length; i += 1) for (let j = i + 1; j < bundle.length; j += 1) if (sectionsOverlap(bundle[i], bundle[j])) labels.add(`${code} internal section clash`); return [...labels]; }
function conflictMinutesForBundle(bundle, code) { const existing = selected.map(resolveSelected).filter(Boolean).filter((item) => item.course.code !== code); let minutes = 0; bundle.forEach((section) => existing.forEach((item) => { minutes += overlapMinutes(section, item.section); })); for (let i = 0; i < bundle.length; i += 1) for (let j = i + 1; j < bundle.length; j += 1) minutes += overlapMinutes(bundle[i], bundle[j]); return minutes; }
function sectionsOverlap(a, b) { return overlapMinutes(a, b) > 0; }
function overlapMinutes(a, b) { let total = 0; (a.meetings || []).forEach((left) => (b.meetings || []).forEach((right) => { if (left.day === right.day) total += Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start)); })); return total; }
function resolveSelected(item) { const course = allCourses.find((candidate) => candidate.code === item.courseCode); const section = course?.sections.find((candidate) => candidate.id === item.id); return course && section ? { course, section } : null; }
function migrateSelectionIds() { const valid = selected.filter((item) => allCourses.some((course) => course.code === item.courseCode && course.sections.some((section) => section.id === item.id))); if (valid.length !== selected.length) { selected = valid; saveSelection(); } }
function matchesCourse(course, query) { if (!query) return true; const haystack = [course.code, course.title, course.subject, course.prerequisite, course.exclusion, ...course.sections.flatMap((section) => [section.section, section.instructor, section.ta, section.room])].join(" ").toLowerCase(); return haystack.includes(query) || normalizeSearch(haystack).includes(normalizeSearch(query)); }
function normalizeSearch(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function levelOf(number) { const first = String(number || "")[0]; return Number(first) >= 6 ? "6" : first; }
function sectionType(name) { return /^L\d/i.test(name) ? "lecture" : "tutorial"; }
function timeSummary(section) { return section.meetings?.length ? section.meetings.map(formatRange).join("; ") : "No weekly meeting time"; }
function formatRange(meeting) { return `${meeting.day} ${formatTime(meeting.start)}-${formatTime(meeting.end)}`; }
function formatTime(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function findConflicts(meetings) { const conflicts = []; for (let i = 0; i < meetings.length; i += 1) for (let j = i + 1; j < meetings.length; j += 1) { const a = meetings[i], b = meetings[j]; if (a.section.id !== b.section.id && a.meeting.day === b.meeting.day && a.meeting.start < b.meeting.end && b.meeting.start < a.meeting.end) conflicts.push({ day: a.meeting.day, ids: [a.section.id, b.section.id], labels: [`${a.course.code} ${a.section.section}`, `${b.course.code} ${b.section.section}`] }); } return conflicts; }
function saveSelection() { saveLocal(`hkust-selected-sections-${currentTerm}`, JSON.stringify(selected)); }
function loadSelection() {
  const termKey = `hkust-selected-sections-${currentTerm}`;
  if (localValue(termKey) !== null) return loadArray(termKey);
  return currentTerm === "2610" ? loadArray("hkust-selected-sections") : [];
}
function localValue(key) { try { return localStorage.getItem(key); } catch { return null; } }
function saveLocal(key, value) { try { localStorage.setItem(key, value); } catch { planNotice = "This browser could not save the draft locally."; } }
function loadArray(key) { const value = safeJson(localValue(key) || "[]"); return Array.isArray(value) ? value : []; }
function loadObject(key) { const value = safeJson(localValue(key) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function numberOrNull(value) { return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function safeJson(value) { try { return JSON.parse(value); } catch { return null; } }

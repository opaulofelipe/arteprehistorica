"use strict";

const STORAGE_KEY = "quiz-arte-pre-historica:v1";
const GENERIC_IMAGE_ALT = "Imagem da obra a identificar. A descrição será revelada depois da resposta.";
const GENERIC_SITE_IMAGE_ALT = "Imagem do sítio arqueológico a identificar. A descrição será revelada depois da resposta.";
const CONTINENT_ORDER = ["África", "América", "Ásia", "Oceania", "Europa"];

const elements = {
  startScreen: document.querySelector("#start-screen"),
  quizScreen: document.querySelector("#quiz-screen"),
  finishScreen: document.querySelector("#finish-screen"),
  errorScreen: document.querySelector("#error-screen"),
  startButton: document.querySelector("#start-button"),
  newSessionButton: document.querySelector("#new-session-button"),
  restartButton: document.querySelector("#restart-button"),
  homeButton: document.querySelector("#home-button"),
  playAgainButton: document.querySelector("#play-again-button"),
  questionTotal: document.querySelector("#question-total"),
  progressLabel: document.querySelector("#progress-label"),
  scoreLabel: document.querySelector("#score-label"),
  progressBar: document.querySelector(".progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  continentBadge: document.querySelector("#continent-badge"),
  typeBadge: document.querySelector("#type-badge"),
  unseenLabel: document.querySelector("#unseen-label"),
  questionTitle: document.querySelector("#question-title"),
  questionHint: document.querySelector("#question-hint"),
  questionCard: document.querySelector("#question-card"),
  artworkFigure: document.querySelector("#artwork-figure"),
  carouselFrame: document.querySelector("#carousel-frame"),
  imageButton: document.querySelector("#image-button"),
  artworkImage: document.querySelector("#artwork-image"),
  imageFallback: document.querySelector("#image-fallback"),
  fallbackLink: document.querySelector("#fallback-link"),
  carouselPrevious: document.querySelector("#carousel-previous"),
  carouselNext: document.querySelector("#carousel-next"),
  carouselMeta: document.querySelector("#carousel-meta"),
  carouselDots: document.querySelector("#carousel-dots"),
  carouselCount: document.querySelector("#carousel-count"),
  imageNote: document.querySelector("#image-note"),
  imageCredit: document.querySelector("#image-credit"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  feedbackIcon: document.querySelector("#feedback-icon"),
  feedbackStatus: document.querySelector("#feedback-status"),
  feedbackTitle: document.querySelector("#feedback-title"),
  factDate: document.querySelector("#fact-date"),
  factPlace: document.querySelector("#fact-place"),
  explanation: document.querySelector("#explanation"),
  sourceLink: document.querySelector("#source-link"),
  nextButton: document.querySelector("#next-button"),
  finalScore: document.querySelector("#final-score"),
  finalTotal: document.querySelector("#final-total"),
  resultMessage: document.querySelector("#result-message"),
  continentResults: document.querySelector("#continent-results-list"),
  imageDialog: document.querySelector("#image-dialog"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogCaption: document.querySelector("#dialog-caption"),
  dialogClose: document.querySelector("#dialog-close"),
  announcement: document.querySelector("#announcement"),
  particles: document.querySelector("#particles")
};

let dataVersion = "";
let questions = [];
let questionsById = new Map();
let state = null;
let activeQuestion = null;
let activeSlide = 0;
let activeQuestionAnswered = false;
let swipeState = null;
let suppressDialogUntil = 0;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();

  try {
    const response = await fetch("questions.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Falha ao carregar questions.json (${response.status})`);

    const data = await response.json();
    validateQuestionBank(data);

    dataVersion = data.version;
    questions = data.questions;
    questionsById = new Map(questions.map((question) => [question.id, question]));
    elements.questionTotal.textContent = String(questions.length);
    elements.finalTotal.textContent = String(questions.length);
    state = loadState();
    renderStart();
  } catch (error) {
    console.error(error);
    showScreen(elements.errorScreen);
  }
}

function bindEvents() {
  elements.startButton.addEventListener("click", () => {
    if (!state) state = createSession();
    state.index >= questions.length ? renderFinish() : renderQuestion({ focusHeading: true });
  });

  elements.newSessionButton.addEventListener("click", () => startFreshSession(true));
  elements.restartButton.addEventListener("click", () => startFreshSession(true));
  elements.playAgainButton.addEventListener("click", () => startFreshSession(false));
  elements.homeButton.addEventListener("click", renderStart);
  elements.nextButton.addEventListener("click", goToNextQuestion);
  elements.imageButton.addEventListener("click", (event) => {
    if (Date.now() < suppressDialogUntil) {
      event.preventDefault();
      return;
    }
    openImageDialog();
  });
  elements.carouselPrevious.addEventListener("click", () => moveCarousel(-1, true));
  elements.carouselNext.addEventListener("click", () => moveCarousel(1, true));
  elements.carouselFrame.addEventListener("keydown", handleCarouselKeydown);
  elements.imageButton.addEventListener("pointerdown", beginCarouselSwipe);
  elements.imageButton.addEventListener("pointermove", updateCarouselSwipe);
  elements.imageButton.addEventListener("pointerup", finishCarouselSwipe);
  elements.imageButton.addEventListener("pointercancel", cancelCarouselSwipe);
  elements.dialogClose.addEventListener("click", () => elements.imageDialog.close());
  elements.imageDialog.addEventListener("click", (event) => {
    if (event.target === elements.imageDialog) elements.imageDialog.close();
  });

  elements.artworkImage.addEventListener("load", () => {
    elements.imageButton.classList.remove("is-loading");
    elements.imageButton.hidden = false;
    elements.imageFallback.hidden = true;
  });

  elements.artworkImage.addEventListener("error", () => {
    elements.imageButton.classList.remove("is-loading");
    elements.imageButton.hidden = true;
    elements.imageFallback.hidden = false;
  });
}

function validateQuestionBank(data) {
  if (!data || typeof data.version !== "string" || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error("Banco de questões inválido.");
  }

  const ids = new Set();
  for (const question of data.questions) {
    const requiredStrings = [
      question.id,
      question.continent,
      question.prompt,
      question.answer,
      question.date,
      question.place,
      question.country,
      question.explanation,
      question.sourceUrl
    ];

    if (requiredStrings.some((value) => typeof value !== "string" || value.trim() === "")) {
      throw new Error(`Questão incompleta: ${question.id || "sem id"}`);
    }

    if (ids.has(question.id)) throw new Error(`ID duplicado: ${question.id}`);
    ids.add(question.id);

    const kind = question.kind || "artwork";
    if (!['artwork', 'site'].includes(kind)) throw new Error(`Tipo inválido: ${question.id}`);

    const questionImages = getQuestionImages(question);
    if (kind === "site" && questionImages.length < 2) {
      throw new Error(`O sítio ${question.id} precisa de um carrossel com várias imagens.`);
    }

    if (
      questionImages.length === 0 ||
      questionImages.some((image) =>
        !image ||
        typeof image.url !== "string" || image.url.trim() === "" ||
        typeof image.altAfterAnswer !== "string" || image.altAfterAnswer.trim() === "" ||
        typeof image.credit !== "string" ||
        typeof image.creditUrl !== "string" ||
        typeof image.license !== "string"
      )
    ) {
      throw new Error(`Imagem inválida: ${question.id}`);
    }

    if (!Array.isArray(question.choices) || question.choices.length !== 4 || new Set(question.choices).size !== 4) {
      throw new Error(`A questão ${question.id} precisa de quatro opções únicas.`);
    }

    if (!question.choices.includes(question.answer)) {
      throw new Error(`A resposta de ${question.id} não está entre as opções.`);
    }
  }
}

function createSession() {
  const order = shuffle(questions.map((question) => question.id));
  const optionOrders = Object.fromEntries(
    questions.map((question) => [question.id, shuffle(question.choices)])
  );

  const session = {
    version: dataVersion,
    order,
    optionOrders,
    index: 0,
    score: 0,
    answers: {},
    startedAt: Date.now()
  };

  saveState(session);
  return session;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const saved = JSON.parse(raw);
    const currentIds = new Set(questions.map((question) => question.id));
    const validOrder =
      Array.isArray(saved.order) &&
      saved.order.length === questions.length &&
      new Set(saved.order).size === questions.length &&
      saved.order.every((id) => currentIds.has(id));

    if (saved.version !== dataVersion || !validOrder || typeof saved.answers !== "object") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    saved.index = Math.max(0, Math.min(Number(saved.index) || 0, questions.length));
    saved.optionOrders ||= {};

    for (const question of questions) {
      const optionOrder = saved.optionOrders[question.id];
      if (
        !Array.isArray(optionOrder) ||
        optionOrder.length !== 4 ||
        optionOrder.some((choice) => !question.choices.includes(choice))
      ) {
        saved.optionOrders[question.id] = shuffle(question.choices);
      }
    }

    saved.score = Object.values(saved.answers).filter((answer) => answer && answer.correct === true).length;
    saveState(saved);
    return saved;
  } catch (error) {
    console.warn("Não foi possível restaurar o progresso.", error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveState(nextState = state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.warn("Não foi possível salvar o progresso.", error);
  }
}

function renderStart() {
  elements.restartButton.hidden = true;
  elements.startButton.disabled = false;
  elements.newSessionButton.hidden = !state;

  const buttonLabel = elements.startButton.querySelector("span");
  if (!state) {
    buttonLabel.textContent = "Começar o percurso";
  } else if (state.index >= questions.length) {
    buttonLabel.textContent = "Rever meu resultado";
  } else {
    buttonLabel.textContent = `Continuar — item ${state.index + 1} de ${questions.length}`;
  }

  showScreen(elements.startScreen);
}

function renderQuestion({ focusHeading = false } = {}) {
  if (!state) state = createSession();
  if (state.index >= questions.length) {
    renderFinish();
    return;
  }

  const question = getCurrentQuestion();
  const savedAnswer = state.answers[question.id] || null;
  const currentNumber = state.index + 1;
  const remainingAfter = questions.length - currentNumber;
  const isSite = (question.kind || "artwork") === "site";

  elements.restartButton.hidden = false;
  elements.progressLabel.textContent = `Item ${currentNumber} de ${questions.length}`;
  elements.scoreLabel.textContent = String(state.score);
  elements.progressBar.setAttribute("aria-valuemax", String(questions.length));
  elements.progressBar.setAttribute("aria-valuenow", String(currentNumber));
  elements.progressFill.style.width = `${(currentNumber / questions.length) * 100}%`;
  elements.continentBadge.textContent = question.continent;
  elements.typeBadge.textContent = isSite ? "Sítio arqueológico" : "Obra";
  elements.unseenLabel.textContent = remainingAfter === 0
    ? "Último item inédito"
    : `${remainingAfter} ${remainingAfter === 1 ? "inédito" : "inéditos"} depois deste`;
  elements.questionTitle.textContent = question.prompt;
  elements.questionHint.textContent = isSite
    ? "Arraste para o lado ou use as setas para explorar as imagens. Toque para ampliar."
    : "Toque na imagem para ampliar.";

  resetQuestionCard();
  loadArtwork(question, Boolean(savedAnswer));
  renderOptions(question, savedAnswer);

  if (savedAnswer) revealFeedback(question, savedAnswer, { animate: false, moveFocus: false });

  elements.nextButton.querySelector("span").textContent = currentNumber === questions.length
    ? "Ver resultado"
    : "Próximo item";

  showScreen(elements.quizScreen);
  preloadNextImage();

  if (focusHeading) focusElement(elements.questionTitle);
}

function resetQuestionCard() {
  activeSlide = 0;
  swipeState = null;
  elements.questionCard.classList.remove("answer-correct", "answer-wrong");
  elements.feedback.classList.remove("is-error");
  elements.feedback.hidden = true;
  elements.options.replaceChildren();
  elements.carouselDots.replaceChildren();
  elements.carouselMeta.hidden = true;
  elements.carouselPrevious.hidden = true;
  elements.carouselNext.hidden = true;
  elements.carouselFrame.classList.remove("is-draggable", "is-dragging");
  elements.carouselFrame.style.removeProperty("--carousel-drag-x");
  elements.imageFallback.hidden = true;
  elements.imageButton.hidden = false;
  elements.imageButton.classList.add("is-loading");
  elements.artworkImage.alt = GENERIC_IMAGE_ALT;
  elements.dialogImage.alt = GENERIC_IMAGE_ALT;
}

function loadArtwork(question, hasBeenAnswered) {
  activeQuestion = question;
  activeQuestionAnswered = hasBeenAnswered;
  activeSlide = 0;
  loadCarouselSlide(0);
}

function loadCarouselSlide(index, moveFocus = false) {
  if (!activeQuestion) return;

  const images = getQuestionImages(activeQuestion);
  activeSlide = Math.max(0, Math.min(index, images.length - 1));
  const image = images[activeSlide];
  const isSite = (activeQuestion.kind || "artwork") === "site";
  const genericAlt = isSite ? GENERIC_SITE_IMAGE_ALT : GENERIC_IMAGE_ALT;

  elements.imageFallback.hidden = true;
  elements.imageButton.hidden = false;
  elements.imageButton.classList.add("is-loading");
  elements.artworkImage.removeAttribute("src");
  elements.dialogImage.removeAttribute("src");
  elements.artworkImage.alt = activeQuestionAnswered ? image.altAfterAnswer : genericAlt;
  elements.dialogImage.alt = elements.artworkImage.alt;
  elements.imageCredit.href = image.creditUrl;
  elements.imageCredit.textContent = `${image.credit} · ${image.license}`;
  elements.imageCredit.title = `${image.credit} — ${image.license}`;
  elements.imageNote.textContent = image.note || (isSite
    ? `Imagem ${activeSlide + 1} de ${images.length} do sítio arqueológico`
    : "Imagem real de acervo ou sítio arqueológico");
  elements.fallbackLink.href = image.creditUrl;
  elements.imageButton.setAttribute(
    "aria-label",
    `Ampliar imagem ${activeSlide + 1} de ${images.length}${isSite ? " do sítio" : " da obra"}`
  );
  elements.dialogCaption.textContent = activeQuestionAnswered
    ? `${activeQuestion.answer} — imagem ${activeSlide + 1} de ${images.length}`
    : `Imagem ${activeSlide + 1} de ${images.length} do item a identificar`;

  renderCarouselControls(images, moveFocus);

  requestAnimationFrame(() => {
    elements.artworkImage.src = image.url;
    elements.dialogImage.src = image.url;
  });
}

function renderCarouselControls(images, moveFocus) {
  const hasCarousel = images.length > 1;
  elements.carouselMeta.hidden = !hasCarousel;
  elements.carouselPrevious.hidden = !hasCarousel;
  elements.carouselNext.hidden = !hasCarousel;
  elements.carouselFrame.classList.toggle("is-draggable", hasCarousel);
  elements.carouselPrevious.disabled = activeSlide === 0;
  elements.carouselNext.disabled = activeSlide === images.length - 1;
  elements.carouselCount.textContent = `${activeSlide + 1} de ${images.length}`;

  elements.carouselDots.replaceChildren();
  if (!hasCarousel) return;

  const fragment = document.createDocumentFragment();
  images.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", `Ir para imagem ${index + 1} de ${images.length}`);
    if (index === activeSlide) dot.setAttribute("aria-current", "true");
    dot.addEventListener("click", () => loadCarouselSlide(index, true));
    fragment.append(dot);
  });
  elements.carouselDots.append(fragment);

  if (moveFocus) {
    const currentDot = elements.carouselDots.children[activeSlide];
    if (currentDot) currentDot.focus({ preventScroll: true });
  }
}

function moveCarousel(direction, moveFocus = false) {
  if (!activeQuestion) return;
  const images = getQuestionImages(activeQuestion);
  const target = Math.max(0, Math.min(activeSlide + direction, images.length - 1));
  if (target === activeSlide) return;
  loadCarouselSlide(target, moveFocus);
}

function handleCarouselKeydown(event) {
  if (!activeQuestion || getQuestionImages(activeQuestion).length < 2) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveCarousel(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveCarousel(1);
  }
}

function beginCarouselSwipe(event) {
  if (!activeQuestion || getQuestionImages(activeQuestion).length < 2 || event.button !== 0) return;
  swipeState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    deltaX: 0,
    horizontal: false
  };
  elements.imageButton.setPointerCapture?.(event.pointerId);
}

function updateCarouselSwipe(event) {
  if (!swipeState || swipeState.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - swipeState.startX;
  const deltaY = event.clientY - swipeState.startY;

  if (!swipeState.horizontal && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
    swipeState.horizontal = true;
    elements.carouselFrame.classList.add("is-dragging");
  }

  if (!swipeState.horizontal) return;
  swipeState.deltaX = deltaX;
  const resistance =
    (activeSlide === 0 && deltaX > 0) ||
    (activeSlide === getQuestionImages(activeQuestion).length - 1 && deltaX < 0)
      ? 0.32
      : 1;
  const limitedDelta = Math.max(-140, Math.min(deltaX * resistance, 140));
  elements.carouselFrame.style.setProperty("--carousel-drag-x", `${limitedDelta}px`);
}

function finishCarouselSwipe(event) {
  if (!swipeState || swipeState.pointerId !== event.pointerId) return;
  const { deltaX, horizontal } = swipeState;
  const threshold = Math.min(72, elements.carouselFrame.clientWidth * 0.16);
  cancelCarouselSwipe(event);

  if (!horizontal) return;
  suppressDialogUntil = Date.now() + 350;
  if (Math.abs(deltaX) >= threshold) moveCarousel(deltaX < 0 ? 1 : -1);
}

function cancelCarouselSwipe(event) {
  if (swipeState && event?.pointerId === swipeState.pointerId && elements.imageButton.hasPointerCapture?.(event.pointerId)) {
    elements.imageButton.releasePointerCapture(event.pointerId);
  }
  swipeState = null;
  elements.carouselFrame.classList.remove("is-dragging");
  elements.carouselFrame.style.removeProperty("--carousel-drag-x");
}

function renderOptions(question, savedAnswer) {
  const optionOrder = state.optionOrders[question.id];
  const fragment = document.createDocumentFragment();

  optionOrder.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.dataset.choice = choice;

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.setAttribute("aria-hidden", "true");
    letter.textContent = String.fromCharCode(65 + index);

    const label = document.createElement("span");
    label.className = "option-text";
    label.textContent = choice;

    const result = document.createElement("span");
    result.className = "option-result";
    result.setAttribute("aria-hidden", "true");

    button.append(letter, label, result);
    button.addEventListener("click", () => answerQuestion(choice));
    fragment.append(button);
  });

  elements.options.append(fragment);
  if (savedAnswer) markOptions(question, savedAnswer);
}

function answerQuestion(choice) {
  const question = getCurrentQuestion();
  if (state.answers[question.id]) return;

  const correct = choice === question.answer;
  const answer = { choice, correct, answeredAt: Date.now() };
  state.answers[question.id] = answer;
  if (correct) state.score += 1;
  saveState();
  elements.scoreLabel.textContent = String(state.score);

  markOptions(question, answer);
  revealFeedback(question, answer, { animate: true, moveFocus: true });
  announce(correct ? "Resposta correta." : `Resposta incorreta. A resposta é ${question.answer}.`);

  elements.questionCard.classList.add(correct ? "answer-correct" : "answer-wrong");
  if (correct) createParticleBurst();
}

function markOptions(question, answer) {
  const buttons = elements.options.querySelectorAll(".option-button");
  buttons.forEach((button) => {
    const result = button.querySelector(".option-result");
    const isCorrectChoice = button.dataset.choice === question.answer;
    const isSelectedWrong = button.dataset.choice === answer.choice && !answer.correct;
    button.disabled = true;

    if (isCorrectChoice) {
      button.classList.add("is-correct");
      result.textContent = "✓";
      button.setAttribute("aria-label", `${button.dataset.choice}, resposta correta`);
    } else if (isSelectedWrong) {
      button.classList.add("is-wrong");
      result.textContent = "×";
      button.setAttribute("aria-label", `${button.dataset.choice}, sua resposta, incorreta`);
    } else {
      button.classList.add("is-muted");
    }
  });
}

function revealFeedback(question, answer, { animate, moveFocus }) {
  elements.feedback.hidden = false;
  elements.feedback.classList.toggle("is-error", !answer.correct);
  elements.feedbackIcon.textContent = answer.correct ? "✓" : "!";
  elements.feedbackStatus.textContent = answer.correct ? "Você acertou" : "A resposta correta é";
  elements.feedbackTitle.textContent = question.answer;
  elements.factDate.textContent = question.date;
  elements.factPlace.textContent = `${question.place} — ${question.country}`;
  elements.explanation.textContent = question.explanation;
  elements.sourceLink.href = question.sourceUrl;
  elements.sourceLink.setAttribute("aria-label", `Consultar fonte: ${question.sourceLabel}`);
  activeQuestionAnswered = true;
  const currentImage = getQuestionImages(question)[activeSlide];
  elements.artworkImage.alt = currentImage.altAfterAnswer;
  elements.dialogImage.alt = currentImage.altAfterAnswer;
  elements.dialogCaption.textContent = `${question.answer} — imagem ${activeSlide + 1} de ${getQuestionImages(question).length}`;

  if (!animate) elements.feedback.style.animation = "none";
  requestAnimationFrame(() => {
    elements.feedback.style.animation = "";
    if (moveFocus) focusElement(elements.feedbackTitle);
  });
}

function goToNextQuestion() {
  const question = getCurrentQuestion();
  if (!state.answers[question.id]) return;

  state.index += 1;
  saveState();

  if (state.index >= questions.length) {
    renderFinish();
  } else {
    renderQuestion({ focusHeading: true });
  }
}

function renderFinish() {
  if (!state) return renderStart();

  elements.restartButton.hidden = true;
  elements.finalScore.textContent = String(state.score);
  elements.finalTotal.textContent = String(questions.length);
  elements.resultMessage.textContent = getResultMessage(state.score / questions.length);
  renderContinentResults();
  showScreen(elements.finishScreen);
  focusElement(document.querySelector("#finish-title"));
}

function renderContinentResults() {
  elements.continentResults.replaceChildren();

  for (const continent of CONTINENT_ORDER) {
    const continentQuestions = questions.filter((question) => question.continent === continent);
    const correct = continentQuestions.filter((question) => state.answers[question.id]?.correct).length;
    const row = document.createElement("div");
    row.className = "continent-result";

    const name = document.createElement("span");
    name.textContent = continent;

    const track = document.createElement("span");
    track.className = "continent-result-track";
    const fill = document.createElement("i");
    fill.style.width = `${(correct / continentQuestions.length) * 100}%`;
    track.append(fill);

    const score = document.createElement("strong");
    score.textContent = `${correct}/${continentQuestions.length}`;

    row.append(name, track, score);
    elements.continentResults.append(row);
  }
}

function getResultMessage(ratio) {
  if (ratio === 1) return "Olhar de arqueólogo: você reconheceu todas as obras e sítios e atravessou milênios sem perder uma pista.";
  if (ratio >= 0.8) return "Excelente leitura visual. Você percebeu materiais, estilos e gestos de culturas muito distantes entre si.";
  if (ratio >= 0.6) return "Bom percurso. As explicações já formam um mapa sólido para uma segunda visita ao acervo.";
  if (ratio >= 0.4) return "Você abriu boas trilhas. Em uma nova ordem, observe primeiro material, técnica e paisagem antes de escolher.";
  return "Este foi o primeiro contato com um mundo enorme. Refaça sem pressa: reconhecer arte também se aprende olhando.";
}

function startFreshSession(askForConfirmation) {
  const hasActiveProgress = state && state.index < questions.length && Object.keys(state.answers).length > 0;
  if (askForConfirmation && hasActiveProgress) {
    const confirmed = window.confirm("Começar de novo? O progresso desta rodada será substituído por uma nova ordem aleatória.");
    if (!confirmed) return;
  }

  state = createSession();
  renderQuestion({ focusHeading: true });
}

function getCurrentQuestion() {
  return questionsById.get(state.order[state.index]);
}

function getQuestionImages(question) {
  if (Array.isArray(question?.images)) return question.images;
  return question?.image ? [question.image] : [];
}

function preloadNextImage() {
  const nextId = state.order[state.index + 1];
  const nextQuestion = questionsById.get(nextId);
  if (!nextQuestion) return;
  const image = new Image();
  image.referrerPolicy = "no-referrer";
  image.src = getQuestionImages(nextQuestion)[0]?.url || "";
}

function openImageDialog() {
  if (!elements.artworkImage.complete || elements.artworkImage.naturalWidth === 0) return;
  if (typeof elements.imageDialog.showModal === "function") {
    elements.imageDialog.showModal();
  } else {
    window.open(elements.artworkImage.src, "_blank", "noopener,noreferrer");
  }
}

function showScreen(target) {
  [elements.startScreen, elements.quizScreen, elements.finishScreen, elements.errorScreen].forEach((screen) => {
    screen.hidden = screen !== target;
    screen.classList.remove("screen-enter");
  });

  target.classList.add("screen-enter");
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function focusElement(element) {
  if (!element) return;
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => element.focus({ preventScroll: true }));
}

function announce(message) {
  elements.announcement.textContent = "";
  window.setTimeout(() => {
    elements.announcement.textContent = message;
  }, 40);
}

function createParticleBurst() {
  if (prefersReducedMotion()) return;

  const colors = ["#9d4e34", "#d29b54", "#326348", "#f0d29b", "#6b3827"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 26; index += 1) {
    const angle = (Math.PI * 2 * index) / 26 + Math.random() * 0.2;
    const distance = 90 + Math.random() * Math.min(window.innerWidth * 0.34, 220);
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--r", `${Math.round(Math.random() * 540 - 270)}deg`);
    particle.style.setProperty("--particle-color", colors[index % colors.length]);
    particle.style.animationDelay = `${Math.random() * 90}ms`;
    fragment.append(particle);
  }

  elements.particles.append(fragment);
  window.setTimeout(() => elements.particles.replaceChildren(), 1100);
}

function shuffle(values) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function randomInteger(maximum) {
  if (window.crypto?.getRandomValues) {
    const range = 0x100000000;
    const limit = range - (range % maximum);
    const array = new Uint32Array(1);
    do window.crypto.getRandomValues(array); while (array[0] >= limit);
    return array[0] % maximum;
  }
  return Math.floor(Math.random() * maximum);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

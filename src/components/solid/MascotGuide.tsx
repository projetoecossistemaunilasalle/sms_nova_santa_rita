import { onCleanup, onMount } from "solid-js";
import { ASSETS } from "../../config/site";
import {
  chooseOcclusionStrategy,
  clamp,
  cubicBezierPoint,
  dualHandoff,
  gentleEase,
  isFullyOccluded,
  paperFrame,
  sampleScene,
  selectScene,
  stagingCurve,
  smoothstep,
  transitionScrollWindow,
} from "./mascot-route.js";

type Pose = "classico" | "movimento" | "papel-a" | "papel-b";
type Side = "left" | "right";

interface Point {
  x: number;
  y: number;
}

interface Curve {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

interface DocumentRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface BaseScene {
  id: string;
  start: number;
  end: number;
  curve: Curve;
  scaleStart: number;
  scaleEnd: number;
}

interface TravelScene extends BaseScene {
  kind: "travel";
  pose: Pose | "papel";
}

interface TransitionScene extends BaseScene {
  kind: "transition";
  fromPose: Pose;
  toPose: Pose;
  strategy: "simple" | "dual";
  outgoingCurve: Curve;
  incomingCurve: Curve;
  curtain: DocumentRect;
}

type Scene = TravelScene | TransitionScene;

interface ActorState {
  x: number;
  y: number;
  scale: number;
  pose: Pose;
  visible: boolean;
  direction: 1 | -1;
}

interface ActorRefs {
  element?: HTMLDivElement;
  bounce?: HTMLDivElement;
  flip?: HTMLDivElement;
  images: Partial<Record<Pose, HTMLImageElement>>;
}

const MOBILE_QUERY = "(max-width: 45rem)";
const TABLET_QUERY = "(max-width: 64rem)";
const OVERLAP_START = 0.25;
const OVERLAP_END = 0.85;

function documentRect(element: Element): DocumentRect {
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  return {
    left: rect.left,
    right: rect.right,
    top,
    bottom: top + rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function curveBetween(start: Point, end: Point, arc: number): Curve {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    p0: start,
    p1: {
      x: start.x + dx * 0.28,
      y: start.y + dy * 0.18 - arc,
    },
    p2: {
      x: start.x + dx * 0.72,
      y: start.y + dy * 0.82 + arc * 0.55,
    },
    p3: end,
  };
}

function transitionWindow(rect: DocumentRect, viewportHeight: number, maxScroll: number) {
  const center = rect.top + rect.height * 0.52;
  return transitionScrollWindow(center, viewportHeight, maxScroll);
}

function cardCenterAt(rect: DocumentRect, scrollY: number, size: number): number {
  return rect.top - scrollY + rect.height * 0.52 - size / 2;
}

function transitionPoints(
  rect: DocumentRect,
  start: number,
  end: number,
  size: number,
  entry: Side,
) {
  const gap = Math.max(10, size * 0.08);
  const startY = cardCenterAt(rect, start, size);
  const endY = cardCenterAt(rect, end, size);
  const midScroll = (start + end) / 2;
  const hidden: Point = {
    x: rect.left + rect.width / 2 - size / 2,
    y: cardCenterAt(rect, midScroll, size),
  };

  const approach: Point = {
    x: entry === "left" ? rect.left - size - gap : rect.right + gap,
    y: startY,
  };
  const exit: Point = {
    x: entry === "left" ? rect.right + gap : rect.left - size - gap,
    y: endY,
  };

  const crossCurve: Curve = {
    p0: approach,
    p1: {
      x: entry === "left" ? rect.left + size * 0.25 : rect.right - size * 1.25,
      y: startY - size * 0.14,
    },
    p2: {
      x: entry === "left" ? rect.right - size * 1.25 : rect.left + size * 0.25,
      y: endY + size * 0.12,
    },
    p3: exit,
  };

  return {
    approach,
    exit,
    hidden,
    crossCurve,
    outgoingCurve: curveBetween(approach, hidden, size * 0.12),
    incomingCurve: curveBetween(hidden, exit, -size * 0.1),
  };
}

function directionAt(curve: Curve, progress: number): 1 | -1 {
  const before = cubicBezierPoint(curve, clamp(progress - 0.01));
  const after = cubicBezierPoint(curve, clamp(progress + 0.01));
  return after.x >= before.x ? 1 : -1;
}

function actorBounds(point: Point, size: number) {
  return {
    left: point.x,
    top: point.y,
    right: point.x + size,
    bottom: point.y + size,
  };
}

function curtainBoundsAt(rect: DocumentRect, scrollY: number) {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top - scrollY,
    bottom: rect.bottom - scrollY,
  };
}

function buildRoute(origin: DocumentRect, size: number, mobile: boolean): Scene[] | null {
  const introElement = document.querySelector('[data-mascot-curtain="intro"]');
  const paperInElement = document.querySelector('[data-mascot-curtain="paper-in"]');
  const paperOutElement = document.querySelector('[data-mascot-curtain="paper-out"]');
  const identityElement = document.querySelector('[data-mascot-curtain="identity"]');
  const dockElement = document.querySelector("[data-mascot-dock]");
  const footerElement = document.querySelector(".site-footer");
  if (
    !introElement ||
    !paperInElement ||
    !paperOutElement ||
    !identityElement ||
    !dockElement ||
    !footerElement
  ) {
    return null;
  }

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return null;

  const curtains = [
    {
      id: "intro",
      rect: documentRect(introElement),
      from: "classico" as Pose,
      to: "movimento" as Pose,
      entry: "left" as Side,
    },
    {
      id: "paper-in",
      rect: documentRect(paperInElement),
      from: "movimento" as Pose,
      to: "papel-a" as Pose,
      entry: "left" as Side,
    },
    {
      id: "paper-out",
      rect: documentRect(paperOutElement),
      from: "papel-b" as Pose,
      to: "movimento" as Pose,
      entry: "right" as Side,
    },
    {
      id: "identity",
      rect: documentRect(identityElement),
      from: "movimento" as Pose,
      to: "classico" as Pose,
      entry: "right" as Side,
    },
  ];

  const transitions = curtains.map((item) => {
    const scrollWindow = transitionWindow(item.rect, window.innerHeight, maxScroll);
    const points = transitionPoints(
      item.rect,
      scrollWindow.start,
      scrollWindow.end,
      size,
      item.entry,
    );
    let strategy = chooseOcclusionStrategy(item.rect, size, Math.max(8, size * 0.06), mobile);

    if (strategy === "simple") {
      const middleScroll = (scrollWindow.start + scrollWindow.end) / 2;
      const middlePoint = cubicBezierPoint(points.crossCurve, 0.5);
      const contained = isFullyOccluded(
        actorBounds(middlePoint, size),
        curtainBoundsAt(item.rect, middleScroll),
        Math.max(5, size * 0.035),
      );
      if (!contained) strategy = "dual";
    }

    const scene: TransitionScene = {
      id: item.id,
      kind: "transition",
      start: scrollWindow.start,
      end: scrollWindow.end,
      curve: points.crossCurve,
      outgoingCurve: points.outgoingCurve,
      incomingCurve: points.incomingCurve,
      scaleStart: 1,
      scaleEnd: 1,
      fromPose: item.from,
      toPose: item.to,
      strategy,
      curtain: item.rect,
    };
    return { scene, approach: points.approach, exit: points.exit };
  });

  for (let index = 1; index < transitions.length; index += 1) {
    const previous = transitions[index - 1];
    const current = transitions[index];
    if (!previous || !current || current.scene.start <= previous.scene.end + 80) return null;
  }

  const intro = transitions[0];
  const paperIn = transitions[1];
  const paperOut = transitions[2];
  const identity = transitions[3];
  if (!intro || !paperIn || !paperOut || !identity) return null;

  const travelArc = mobile ? 18 : 44;
  const originPoint = { x: origin.left, y: origin.top };
  const initialScale = origin.width / size;
  const departureEnd = Math.min(intro.scene.start * 0.32, window.innerHeight * 0.74);
  const departurePoint = {
    x: mobile
      ? window.innerWidth - size - 18
      : clamp(window.innerWidth * 0.58 - size / 2, 30, window.innerWidth - size - 30),
    y: mobile
      ? window.innerHeight - size - 34
      : Math.min(origin.top + 90, window.innerHeight - size - 70),
  };
  const dock = documentRect(dockElement);
  const footer = documentRect(footerElement);
  const footerTopAtEnd = footer.top - maxScroll;
  const dockY = clamp(
    dock.top - maxScroll + Math.max(0, (dock.height - size) / 2),
    mobile ? 150 : 110,
    footerTopAtEnd - size - 18,
  );
  const dockPoint = {
    x: clamp(dock.left + dock.width / 2 - size / 2, 14, window.innerWidth - size - 14),
    y: dockY,
  };

  const scenes: Scene[] = [
    {
      id: "saida-hero-classico",
      kind: "travel",
      start: 0,
      end: departureEnd,
      curve: curveBetween(originPoint, departurePoint, travelArc * 0.55),
      scaleStart: initialScale,
      scaleEnd: mobile ? 1.16 : 1.22,
      pose: "classico",
    },
    {
      id: "aproximacao-intro-classico",
      kind: "travel",
      start: departureEnd,
      end: intro.scene.start,
      curve: curveBetween(departurePoint, intro.approach, -travelArc),
      scaleStart: mobile ? 1.16 : 1.22,
      scaleEnd: 1,
      pose: "classico",
    },
    intro.scene,
    {
      id: "missoes-movimento",
      kind: "travel",
      start: intro.scene.end,
      end: paperIn.scene.start,
      curve: curveBetween(intro.exit, paperIn.approach, -travelArc),
      scaleStart: 1,
      scaleEnd: 1,
      pose: "movimento",
    },
    paperIn.scene,
    {
      id: "observando-papel",
      kind: "travel",
      start: paperIn.scene.end,
      end: paperOut.scene.start,
      curve: stagingCurve(
        paperIn.exit,
        paperOut.approach,
        window.innerWidth - size - (mobile ? 14 : 42),
        mobile ? 10 : 24,
      ),
      scaleStart: 1,
      scaleEnd: 1,
      pose: "papel",
    },
    paperOut.scene,
    {
      id: "publico-seguranca-movimento",
      kind: "travel",
      start: paperOut.scene.end,
      end: identity.scene.start,
      curve: curveBetween(paperOut.exit, identity.approach, travelArc),
      scaleStart: 1,
      scaleEnd: 1,
      pose: "movimento",
    },
    identity.scene,
    {
      id: "contato-classico",
      kind: "travel",
      start: identity.scene.end,
      end: maxScroll,
      curve: curveBetween(identity.exit, dockPoint, -travelArc * 0.65),
      scaleStart: 1,
      scaleEnd: 1,
      pose: "classico",
    },
  ];

  return scenes.every((scene) => scene.end > scene.start && Number.isFinite(scene.start))
    ? scenes
    : null;
}

function setPose(refs: ActorRefs, pose: Pose) {
  for (const [key, image] of Object.entries(refs.images)) {
    image?.classList.toggle("ativa", key === pose);
  }
  refs.element?.setAttribute("data-pose", pose);
}

function renderActor(refs: ActorRefs, state: ActorState, bounce: number, rotation: number) {
  if (!refs.element || !refs.bounce || !refs.flip) return;
  refs.element.style.opacity = state.visible ? "1" : "0";
  refs.element.style.visibility = state.visible ? "visible" : "hidden";
  refs.element.style.transform = `translate3d(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${state.scale.toFixed(4)})`;
  refs.bounce.style.transform = `translate3d(0, ${bounce.toFixed(1)}px, 0)`;
  refs.flip.style.transform = `scaleX(${state.pose === "movimento" ? state.direction : 1})`;
  setPose(refs, state.pose);
}

function actorStateFromScene(scene: Scene, scrollY: number): ActorState {
  const sampled = sampleScene(
    scene,
    scrollY,
    scene.kind === "transition" ? gentleEase : smoothstep,
  );
  const pose =
    scene.kind === "travel"
      ? scene.pose === "papel"
        ? (paperFrame(sampled.progress, true) ?? "papel-a")
        : scene.pose
      : sampled.progress < 0.5
        ? scene.fromPose
        : scene.toPose;

  return {
    x: sampled.x,
    y: sampled.y,
    scale: sampled.scale,
    pose,
    visible: true,
    direction: directionAt(scene.curve, sampled.eased),
  };
}

function dualActorStates(scene: TransitionScene, scrollY: number) {
  const duration = Math.max(scene.end - scene.start, 1);
  const progress = clamp((scrollY - scene.start) / duration);
  const handoff = dualHandoff(progress, scene.fromPose, scene.toPose, OVERLAP_START, OVERLAP_END);
  const outgoingProgress = gentleEase(clamp(progress / OVERLAP_END));
  const incomingProgress = gentleEase(clamp((progress - OVERLAP_START) / (1 - OVERLAP_START)));
  const outgoing = cubicBezierPoint(scene.outgoingCurve, outgoingProgress);
  const incoming = cubicBezierPoint(scene.incomingCurve, incomingProgress);
  const afterHandoff = handoff.phase === "after";

  return {
    primary: {
      x: afterHandoff ? incoming.x : outgoing.x,
      y: afterHandoff ? incoming.y : outgoing.y,
      scale: 1,
      pose: handoff.primaryPose as Pose,
      visible: true,
      direction: directionAt(
        afterHandoff ? scene.incomingCurve : scene.outgoingCurve,
        afterHandoff ? incomingProgress : outgoingProgress,
      ),
    } satisfies ActorState,
    secondary: {
      x: incoming.x,
      y: incoming.y,
      scale: 1,
      pose: handoff.secondaryPose as Pose,
      visible: handoff.secondaryVisible,
      direction: directionAt(scene.incomingCurve, incomingProgress),
    } satisfies ActorState,
    phase: handoff.phase,
  };
}

export default function MascotGuide() {
  let root: HTMLDivElement | undefined;
  const primary: ActorRefs = { images: {} };
  const secondary: ActorRefs = { images: {} };

  onMount(() => {
    if (!root || !primary.element || !primary.bounce || !primary.flip || !secondary.element) {
      return;
    }

    const element = root;
    const originalParent = element.parentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    const tabletQuery = window.matchMedia(TABLET_QUERY);
    let scenes: Scene[] | null = null;
    let targetScroll = window.scrollY;
    let currentScroll = targetScroll;
    let frame = 0;
    let rebuildFrame = 0;
    let active = false;

    const loadSprites = () => {
      for (const image of element.querySelectorAll<HTMLImageElement>("img[data-src]")) {
        image.src = image.dataset.src ?? "";
        image.removeAttribute("data-src");
      }
    };

    const travelSize = () => {
      if (mobileQuery.matches) return 112;
      if (tabletQuery.matches) return 148;
      return 190;
    };

    const applyFrame = (scrollY: number, lag: number) => {
      if (!scenes) return;
      const scene = selectScene(scenes, scrollY);
      const moving = scene.kind === "travel" && scene.end - scene.start > 1;
      const amplitude = moving ? Math.min(5, Math.abs(lag) * 0.035) : 0;
      const bounce = -Math.abs(Math.sin(scrollY * 0.017)) * amplitude;
      const rotation = moving ? Math.sin(scrollY * 0.008) * Math.min(1.8, amplitude * 0.38) : 0;

      element.dataset.scene = scene.id;
      element.dataset.occlusion = scene.kind === "transition" ? scene.strategy : "none";
      primary.element?.classList.toggle("em-repouso", scrollY < 3 && Math.abs(lag) < 0.1);

      if (scene.kind === "transition" && scene.strategy === "dual") {
        const states = dualActorStates(scene, scrollY);
        element.dataset.handoff = states.phase;
        renderActor(primary, states.primary, 0, 0);
        renderActor(secondary, states.secondary, 0, 0);
        return;
      }

      delete element.dataset.handoff;
      renderActor(primary, actorStateFromScene(scene, scrollY), bounce, rotation);
      renderActor(
        secondary,
        {
          x: 0,
          y: 0,
          scale: 1,
          pose: "classico",
          visible: false,
          direction: 1,
        },
        0,
        0,
      );
    };

    const tick = () => {
      frame = 0;
      const lag = targetScroll - currentScroll;
      if (Math.abs(lag) < 0.12) {
        currentScroll = targetScroll;
        applyFrame(currentScroll, 0);
        return;
      }

      currentScroll += lag * 0.14;
      applyFrame(currentScroll, lag);
      frame = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!frame && active) frame = requestAnimationFrame(tick);
    };

    const rebuild = () => {
      rebuildFrame = 0;
      if (!active) return;
      const originElement = document.querySelector("[data-mascot-origin]");
      if (!originElement) {
        scenes = null;
        return;
      }

      const size = travelSize();
      element.style.setProperty("--mascot-size", `${size}px`);
      scenes = buildRoute(documentRect(originElement), size, mobileQuery.matches);
      targetScroll = window.scrollY;
      currentScroll = targetScroll;
      if (scenes) {
        element.style.visibility = "visible";
        applyFrame(currentScroll, 0);
      } else {
        element.style.visibility = "hidden";
      }
    };

    const scheduleRebuild = () => {
      if (rebuildFrame) cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(rebuild);
    };

    const activate = () => {
      if (active || !originalParent) return;
      active = true;
      loadSprites();
      element.style.visibility = "hidden";
      element.classList.add("is-fixed");
      document.body.classList.add("mascot-scroll-active");
      document.body.append(element);
      rebuild();
    };

    const deactivate = () => {
      if (!active || !originalParent) return;
      active = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      scenes = null;
      element.style.visibility = "hidden";
      document.body.classList.remove("mascot-scroll-active");
      originalParent.append(element);
      element.classList.remove("is-fixed");
      element.removeAttribute("style");
      primary.element?.classList.remove("em-repouso");
      setPose(primary, "classico");
      if (primary.element) {
        primary.element.style.removeProperty("transform");
        primary.element.style.removeProperty("opacity");
        primary.element.style.removeProperty("visibility");
      }
      if (primary.bounce) primary.bounce.style.removeProperty("transform");
      if (primary.flip) primary.flip.style.removeProperty("transform");
      if (secondary.element) {
        secondary.element.style.opacity = "0";
        secondary.element.style.visibility = "hidden";
      }
      element.style.visibility = "visible";
    };

    const updateMotionPreference = () => {
      if (reducedMotion.matches) deactivate();
      else activate();
    };

    const onScroll = () => {
      targetScroll = window.scrollY;
      schedule();
    };

    const resizeObserver = new ResizeObserver(scheduleRebuild);
    for (const marker of document.querySelectorAll(
      "[data-mascot-origin], [data-mascot-curtain], [data-mascot-dock]",
    )) {
      resizeObserver.observe(marker);
    }

    updateMotionPreference();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleRebuild);
    window.addEventListener("load", scheduleRebuild);
    reducedMotion.addEventListener("change", updateMotionPreference);
    mobileQuery.addEventListener("change", scheduleRebuild);
    tabletQuery.addEventListener("change", scheduleRebuild);

    onCleanup(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleRebuild);
      window.removeEventListener("load", scheduleRebuild);
      reducedMotion.removeEventListener("change", updateMotionPreference);
      mobileQuery.removeEventListener("change", scheduleRebuild);
      tabletQuery.removeEventListener("change", scheduleRebuild);
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (rebuildFrame) cancelAnimationFrame(rebuildFrame);
      document.body.classList.remove("mascot-scroll-active");
      if (originalParent && element.parentElement !== originalParent)
        originalParent.append(element);
    });
  });

  return (
    <div id="mascote-guia" ref={root}>
      <div
        class="mascote-ator principal"
        ref={(element) => (primary.element = element)}
        data-pose="classico"
      >
        <div class="mascote-flip" ref={(element) => (primary.flip = element)}>
          <div class="mascote-bounce" ref={(element) => (primary.bounce = element)}>
            <img
              ref={(element) => (primary.images.classico = element)}
              class="ativa"
              src={ASSETS.mascot.classico}
              alt="Caramelito, o cachorrinho mascote do PSE Nova Santa Rita, acenando com mochila e escova de dentes"
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              fetchpriority="high"
              decoding="async"
            />
            <img
              ref={(element) => (primary.images.movimento = element)}
              data-src={ASSETS.mascot.movimento}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
            <img
              ref={(element) => (primary.images["papel-a"] = element)}
              data-src={ASSETS.mascot.papelA}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
            <img
              ref={(element) => (primary.images["papel-b"] = element)}
              data-src={ASSETS.mascot.papelB}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
          </div>
        </div>
      </div>

      <div
        class="mascote-ator secundario"
        ref={(element) => (secondary.element = element)}
        aria-hidden="true"
      >
        <div class="mascote-flip" ref={(element) => (secondary.flip = element)}>
          <div class="mascote-bounce" ref={(element) => (secondary.bounce = element)}>
            <img
              ref={(element) => (secondary.images.classico = element)}
              data-src={ASSETS.mascot.classico}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
            <img
              ref={(element) => (secondary.images.movimento = element)}
              data-src={ASSETS.mascot.movimento}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
            <img
              ref={(element) => (secondary.images["papel-a"] = element)}
              data-src={ASSETS.mascot.papelA}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
            <img
              ref={(element) => (secondary.images["papel-b"] = element)}
              data-src={ASSETS.mascot.papelB}
              alt=""
              width={ASSETS.mascot.width}
              height={ASSETS.mascot.height}
              draggable="false"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

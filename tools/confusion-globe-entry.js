import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";

const FRONT = new THREE.Vector3(0, 0, 1);

function fibonacciPoints(count) {
  const points = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = goldenAngle * index;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius,
    ));
  }
  return points;
}

function distributedPoints(count) {
  if (count <= 1) return [FRONT.clone()];
  if (count === 2) return [FRONT.clone(), FRONT.clone().negate()];
  if (count === 3) {
    return [0, 1, 2].map((index) => {
      const angle = index * Math.PI * 2 / 3;
      return new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    });
  }
  if (count === 4) {
    const ringRadius = (2 * Math.sqrt(2)) / 3;
    return [
      FRONT.clone(),
      ...[0, 1, 2].map((index) => {
        const angle = index * Math.PI * 2 / 3;
        return new THREE.Vector3(
          Math.cos(angle) * ringRadius,
          Math.sin(angle) * ringRadius,
          -1 / 3,
        );
      }),
    ];
  }
  return fibonacciPoints(count);
}

function orientCurrentWord(points, currentIndex) {
  const current = points[currentIndex] ?? points[0] ?? FRONT;
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    current.clone().normalize(),
    FRONT,
  );
  return points.map((point) => point.clone().applyQuaternion(rotation));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function smoothstep(edge0, edge1, value) {
  const range = Math.max(0.0001, edge1 - edge0);
  const normalized = THREE.MathUtils.clamp((value - edge0) / range, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function spherePoint(latitude, longitude, radius = 1.006) {
  const ringRadius = Math.cos(latitude) * radius;
  return new THREE.Vector3(
    Math.sin(longitude) * ringRadius,
    Math.sin(latitude) * radius,
    Math.cos(longitude) * ringRadius,
  );
}

function createSphereGridGeometry({
  longitudeCount = 16,
  latitudeCount = 8,
  segmentCount = 72,
} = {}) {
  const positions = [];
  const pushSegment = (from, to) => {
    positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
  };

  for (let latitudeIndex = 1; latitudeIndex < latitudeCount; latitudeIndex += 1) {
    const latitude = -Math.PI / 2 + Math.PI * latitudeIndex / latitudeCount;
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const fromLongitude = Math.PI * 2 * segment / segmentCount;
      const toLongitude = Math.PI * 2 * (segment + 1) / segmentCount;
      pushSegment(
        spherePoint(latitude, fromLongitude),
        spherePoint(latitude, toLongitude),
      );
    }
  }

  for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
    const longitude = Math.PI * 2 * longitudeIndex / longitudeCount;
    for (let segment = 0; segment < segmentCount / 2; segment += 1) {
      const fromLatitude = -Math.PI / 2 + Math.PI * segment / (segmentCount / 2);
      const toLatitude = -Math.PI / 2 + Math.PI * (segment + 1) / (segmentCount / 2);
      pushSegment(
        spherePoint(fromLatitude, longitude),
        spherePoint(toLatitude, longitude),
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

function create(options = {}) {
  const container = options.container;
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("A globe container is required.");
  }

  const words = Array.isArray(options.words) ? options.words : [];
  const currentIndex = Math.max(
    0,
    words.findIndex((word) => word.id === options.currentWordId),
  );
  const points = orientCurrentWord(distributedPoints(words.length), currentIndex);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.45);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = "confusion-globe-canvas";

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "confusion-globe-labels";

  const globe = new THREE.Group();
  scene.add(globe);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.MeshStandardMaterial({
      color: 0xe7f0ed,
      roughness: 0.62,
      metalness: 0.02,
      transparent: true,
      opacity: 0.94,
    }),
  );
  globe.add(sphere);

  const grid = new THREE.LineSegments(
    createSphereGridGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x0f766e,
      transparent: true,
      opacity: 0.18,
    }),
  );
  globe.add(grid);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 48, 36),
    new THREE.MeshBasicMaterial({
      color: 0xeab65a,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.08,
    }),
  );
  globe.add(halo);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x91a9a2, 1.75));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(-2.5, 3.5, 4.5);
  scene.add(keyLight);
  const warmLight = new THREE.DirectionalLight(0xffcf7a, 0.55);
  warmLight.position.set(3, -2, 2.5);
  scene.add(warmLight);

  const labelEntries = words.map((word, index) => {
    const anchor = document.createElement("div");
    anchor.className = "confusion-globe-word-anchor";
    const marker = document.createElement("span");
    marker.className = "confusion-globe-word-marker";
    marker.setAttribute("aria-hidden", "true");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "confusion-globe-word";
    button.dataset.wordId = word.id;
    const label = document.createElement("span");
    label.className = "confusion-globe-word-label";
    label.textContent = word.word;
    button.append(label);
    anchor.append(marker, button);
    button.classList.toggle("is-current", word.id === options.currentWordId);
    button.setAttribute("aria-label", `打开 ${word.word} 的单词卡片`);

    const object = new CSS2DObject(anchor);
    object.position.copy(points[index].clone().multiplyScalar(1.065));
    globe.add(object);

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onSelect?.({
        wordId: word.id,
        element: button,
        rect: button.getBoundingClientRect(),
      });
    });
    return { word, anchor, marker, button, label, object, point: points[index] };
  });

  container.replaceChildren(renderer.domElement, labelRenderer.domElement);
  container.tabIndex = 0;
  container.setAttribute("role", "application");
  container.setAttribute("aria-label", "易混词球体");

  let width = 1;
  let height = 1;
  let animationFrame = 0;
  let destroyed = false;
  const activePointers = new Map();
  let lastGesture = null;
  let velocityX = 0;
  let velocityY = 0;
  let velocityRoll = 0;
  let lastFrameAt = performance.now();
  let focusAnimation = null;
  const paintWaiters = new Set();
  let presentationProgress = THREE.MathUtils.clamp(
    Number.isFinite(options.presentationProgress)
      ? options.presentationProgress
      : 1,
    0,
    1,
  );
  const targetQuaternion = globe.quaternion.clone();

  function resize() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 1 ? 4.7 : 3.45;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  setPresentationProgress(presentationProgress);

  function setPresentationProgress(value) {
    presentationProgress = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    const depthProgress = smoothstep(0, 1, presentationProgress);
    globe.scale.z = 0.06 + depthProgress * 0.94;
    sphere.material.opacity = 0.94 * presentationProgress;
    grid.material.opacity = 0.18 * presentationProgress;
    halo.material.opacity = 0.08 * presentationProgress;
    updateLabelVisibility();
  }

  function updateLabelVisibility() {
    globe.updateMatrixWorld(true);
    labelEntries.forEach(({ anchor, marker, button, object }) => {
      const surfacePoint = object.position.clone().applyQuaternion(globe.quaternion);
      const depth = THREE.MathUtils.clamp(
        (surfacePoint.z / 1.065 + 1) / 2,
        0,
        1,
      );
      const facing = smoothstep(-0.48, 0.12, surfacePoint.z);
      const scale = 0.5 + Math.pow(depth, 0.82) * 0.5;
      const opacity = presentationProgress * (
        0.025 + facing * (0.2 + Math.pow(depth, 1.55) * 0.775)
      );
      button.style.setProperty("--globe-word-scale", scale.toFixed(4));
      button.style.opacity = opacity.toFixed(4);
      button.style.filter = `blur(${((1 - depth) * 0.42).toFixed(3)}px)`;
      marker.style.opacity = opacity.toFixed(4);
      marker.style.filter = button.style.filter;
      marker.style.setProperty("--globe-word-scale", scale.toFixed(4));
      button.style.pointerEvents =
        surfacePoint.z > -0.08 && presentationProgress > 0.92 ? "auto" : "none";
      anchor.style.zIndex = String(Math.round(depth * 100));
    });
  }

  function renderFrame(now) {
    if (destroyed) return;
    const elapsedSeconds = THREE.MathUtils.clamp(
      (now - lastFrameAt) / 1000,
      1 / 240,
      0.05,
    );
    const frameScale = elapsedSeconds * 60;
    lastFrameAt = now;
    if (focusAnimation) {
      const elapsed = now - focusAnimation.startedAt;
      const progress = Math.min(1, elapsed / focusAnimation.duration);
      globe.quaternion.slerpQuaternions(
        focusAnimation.from,
        focusAnimation.to,
        easeOutCubic(progress),
      );
      if (progress >= 1) {
        const resolve = focusAnimation.resolve;
        targetQuaternion.copy(focusAnimation.to);
        focusAnimation = null;
        resolve();
      }
    } else {
      if (activePointers.size === 0 && !reducedMotion) {
        velocityX *= Math.pow(0.92, frameScale);
        velocityY *= Math.pow(0.92, frameScale);
        velocityRoll *= Math.pow(0.9, frameScale);
        if (
          Math.abs(velocityX) > 0.00005 ||
          Math.abs(velocityY) > 0.00005 ||
          Math.abs(velocityRoll) > 0.00005
        ) {
          rotateTarget(
            velocityX * frameScale,
            velocityY * frameScale,
            velocityRoll * frameScale,
          );
        }
      }
      const response = reducedMotion ? 1 : 1 - Math.exp(
        -(activePointers.size > 0 ? 22 : 13) * elapsedSeconds,
      );
      globe.quaternion.slerp(targetQuaternion, response).normalize();
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    updateLabelVisibility();
    if (paintWaiters.size) {
      const waiters = [...paintWaiters];
      paintWaiters.clear();
      waiters.forEach((resolve) => resolve(true));
    }
    animationFrame = window.requestAnimationFrame(renderFrame);
  }

  function nextPaint() {
    if (destroyed) return Promise.resolve(false);
    return new Promise((resolve) => paintWaiters.add(resolve));
  }

  function rotateTarget(deltaX, deltaY, deltaRoll = 0) {
    const yaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      deltaX,
    );
    const pitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      deltaY,
    );
    const roll = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      deltaRoll,
    );
    targetQuaternion
      .premultiply(yaw)
      .premultiply(pitch)
      .premultiply(roll)
      .normalize();
  }

  function gestureSnapshot() {
    const pointers = [...activePointers.values()];
    if (!pointers.length) return null;
    const centerX = pointers.reduce((sum, point) => sum + point.x, 0) /
      pointers.length;
    const centerY = pointers.reduce((sum, point) => sum + point.y, 0) /
      pointers.length;
    const angle = pointers.length >= 2
      ? Math.atan2(
          pointers[1].y - pointers[0].y,
          pointers[1].x - pointers[0].x,
        )
      : null;
    return { count: pointers.length, centerX, centerY, angle };
  }

  function normalizedAngleDelta(value) {
    let result = value;
    while (result > Math.PI) result -= Math.PI * 2;
    while (result < -Math.PI) result += Math.PI * 2;
    return result;
  }

  function cancelFocusAnimation() {
    if (!focusAnimation) return;
    const resolve = focusAnimation.resolve;
    focusAnimation = null;
    resolve();
  }

  function onPointerDown(event) {
    if (
      event.target instanceof Element &&
      event.target.closest(".confusion-globe-word")
    ) return;
    cancelFocusAnimation();
    targetQuaternion.copy(globe.quaternion);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastGesture = gestureSnapshot();
    velocityX = 0;
    velocityY = 0;
    velocityRoll = 0;
    container.classList.add("is-dragging");
    try {
      container.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events used by assistive tools may not be capturable.
    }
  }

  function onPointerMove(event) {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureSnapshot();
    if (!gesture || !lastGesture || gesture.count !== lastGesture.count) {
      lastGesture = gesture;
      return;
    }

    const deltaX = gesture.centerX - lastGesture.centerX;
    const deltaY = gesture.centerY - lastGesture.centerY;
    const deltaRoll = gesture.count >= 2
      ? normalizedAngleDelta(gesture.angle - lastGesture.angle)
      : 0;
    lastGesture = gesture;
    velocityX = deltaX * 0.0072;
    velocityY = deltaY * 0.0058;
    const directRoll = -deltaRoll;
    velocityRoll = directRoll * 0.08;
    rotateTarget(velocityX, velocityY, directRoll);
  }

  function onPointerUp(event) {
    if (!activePointers.has(event.pointerId)) return;
    try {
      container.releasePointerCapture?.(event.pointerId);
    } catch {
      // The browser may already have released a cancelled touch pointer.
    }
    activePointers.delete(event.pointerId);
    lastGesture = gestureSnapshot();
    if (activePointers.size === 0) container.classList.remove("is-dragging");
  }

  function onKeyDown(event) {
    const amount = event.shiftKey ? 0.28 : 0.14;
    if (event.key === "ArrowLeft") rotateTarget(-amount, 0);
    else if (event.key === "ArrowRight") rotateTarget(amount, 0);
    else if (event.key === "ArrowUp") rotateTarget(0, -amount);
    else if (event.key === "ArrowDown") rotateTarget(0, amount);
    else return;
    event.preventDefault();
  }

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);
  container.addEventListener("keydown", onKeyDown);
  animationFrame = window.requestAnimationFrame(renderFrame);

  function focusWord(wordId, duration = 420) {
    const entry = labelEntries.find(({ word }) => word.id === wordId);
    if (!entry) return Promise.resolve();
    cancelFocusAnimation();
    velocityX = 0;
    velocityY = 0;
    velocityRoll = 0;
    const target = new THREE.Quaternion().setFromUnitVectors(
      entry.point.clone().normalize(),
      FRONT,
    );
    if (reducedMotion || duration <= 0) {
      globe.quaternion.copy(target);
      targetQuaternion.copy(target);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      focusAnimation = {
        from: globe.quaternion.clone(),
        to: target,
        duration,
        startedAt: performance.now(),
        resolve,
      };
    });
  }

  function visualRect() {
    const stageRect = container.getBoundingClientRect();
    const center = new THREE.Vector3(0, 0, 0).project(camera);
    const edgeX = new THREE.Vector3(1.035, 0, 0).project(camera);
    const edgeY = new THREE.Vector3(0, 1.035, 0).project(camera);
    const centerX = (center.x * 0.5 + 0.5) * width;
    const centerY = (-center.y * 0.5 + 0.5) * height;
    const radius = Math.max(
      Math.abs((edgeX.x - center.x) * width * 0.5),
      Math.abs((edgeY.y - center.y) * height * 0.5),
    );
    return {
      left: stageRect.left + centerX - radius,
      top: stageRect.top + centerY - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  function wordElement(wordId) {
    return labelEntries.find(({ word }) => word.id === wordId)?.button ?? null;
  }

  function destroy() {
    destroyed = true;
    window.cancelAnimationFrame(animationFrame);
    paintWaiters.forEach((resolve) => resolve(false));
    paintWaiters.clear();
    resizeObserver.disconnect();
    activePointers.forEach((_, pointerId) => {
      try {
        container.releasePointerCapture?.(pointerId);
      } catch {
        // Ignore pointers already released during teardown.
      }
    });
    activePointers.clear();
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerUp);
    container.removeEventListener("keydown", onKeyDown);
    renderer.dispose();
    sphere.geometry.dispose();
    sphere.material.dispose();
    grid.geometry.dispose();
    grid.material.dispose();
    halo.geometry.dispose();
    halo.material.dispose();
    container.replaceChildren();
  }

  return Object.freeze({
    destroy,
    focusWord,
    nextPaint,
    setPresentationProgress,
    visualRect,
    wordElement,
  });
}

window.SenseVocabConfusionGlobe = Object.freeze({ create });

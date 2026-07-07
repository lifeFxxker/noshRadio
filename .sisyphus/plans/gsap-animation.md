# GSAP Animation Integration

## TL;DR
> **Quick Summary**: Add GSAP to nosh-radio's Three.js album gallery for smooth entry animation, scroll inertia, card hover, collapse transition, and modal open/close. GSAP drives Three.js object properties; Three.js rAF loop handles rendering.
>
> **Deliverables**:
> - GSAP (free tier) installed as local file `lib/gsap.min.js`
> - Staggered entry animation replacing manual cubic easeOut
> - Scroll momentum/inertia replacing lerp
> - Card hover scale + z-shift
> - Collapse/expand timeline
> - Modal spring animation
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Add GSAP library → Entry animation → Scroll logic → Hover + Collapse + Modal (parallel Wave 3)

---

## Context

### Original Request
"加入更多丝滑的动画和转场" with GSAP. User wants smoother animations on: entry, scroll, hover, collapse, modal.

### Current State (pre-GSAP)
- **Entry**: Manual `easeOutCubic` in rAF loop, cards burst from center with zBurst
- **Scroll**: `lerp(current, target, 0.1)` — sticky feel, no momentum
- **Hover**: Just cursor change (just added)
- **Collapse**: `opacity: 0` CSS transition (0.25s ease)
- **Modal**: `classList.add/remove('open')` with CSS transition — basic

### GSAP Approach
- GSAP animates Three.js Object3D properties (`position`, `scale`, `quaternion`) — same approach as shopify.design
- Three.js `_animate()` loop continues to run GSAP-updated values
- GSAP `timeline()` for sequenced multi-card animations
- GSAP for DOM modal animation (non-Three.js)
- Use GSAP's `gsap.to()`, `gsap.timeline()`, `gsap.set()` — free tier is sufficient

---

## Work Objectives

### Core Objective
Integrate GSAP into the Three.js album gallery for professional-grade animations across 5 touchpoints: entry, scroll, hover, collapse, modal.

### Concrete Deliverables
- `lib/gsap.min.js` — local GSAP UMD build (free tier, ~30KB gzipped)
- GSAP-powered entry animation with stagger + overshoot
- Scroll momentum system (GSAP-driven inertia)
- Card hover micro-interaction
- Timeline-driven collapse transition
- Modal open/close spring animation

### Must Have
- [ ] Entry: stagger timeline, easeOutBack/elastic feel, all cards quickly visible
- [ ] Scroll: natural momentum deceleration, spring-back at boundaries
- [ ] Hover: scale 1.05 + z-shift toward camera, smooth 200ms tween
- [ ] Collapse: timeline with multiple steps (shrink + fade + camera move)
- [ ] Modal: backdrop fade → modal spring-in on open; reverse on close

### Must NOT Have
- GSAP premium plugins (ScrollTrigger, MotionPath, MorphSVG) — not needed, not purchased
- GSAP replacing Three.js render loop — Three.js rAF stays, GSAP only drives property values
- Physics engines — GSAP `power.out` + `overshoot` is sufficient
- Any CSS change to non-GSAP styled components

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification via agent-executed browser tests.
> Evidence saved to `.sisyphus/evidence/`.

### Test Decision
- **Infrastructure exists**: NO (no test suite)
- **Automated tests**: NO
- **QA Method**: Playwright + interactive_bash (tmux) for all scenarios

### QA Policy
Each task includes agent-executed QA scenarios using Playwright to open the page, trigger animations, and verify visual behavior via screenshot diffs and console state checks.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - foundation):
├── Task 1: Download GSAP to lib/gsap.min.js (+ script tag in HTML)
├── Task 2: Stub GSAP integration in AlbumGallery (initGSAP method, timeline placeholder)

Wave 2 (After Wave 1 - core animation systems):
├── Task 3: Entry animation — GSAP stagger timeline
├── Task 4: Scroll inertia — GSAP-driven momentum
├── Task 5: Card hover — gsap.to() micro-interactions

Wave 3 (After Wave 2 - polish + DOM):
├── Task 6: Collapse/expand timeline (camera + gallery group)
├── Task 7: Modal open/close spring animation (GSAP for DOM)
├── Task F1: Full integration test — all animations chain correctly
```

---

## TODOs

- [ ] 1. Download GSAP + add script tag

  **What to do**:
  - Download GSAP free tier UMD bundle (production minified) to `lib/gsap.min.js`
    - Source: `npm pack gsap` then extract `gsap/umd/gsap.js` and minify, OR
    - Download via: `curl -o lib/gsap.min.js https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
  - Add `<script src="lib/gsap.min.js"></script>` in HTML `<head>`, after `three.min.js`
  - Verify `typeof gsap !== 'undefined'` in browser console

  **Must NOT do**:
  - Do NOT install premium plugins
  - Do NOT use `npm install` if package.json isn't used for serving

  **Recommended Agent Profile**: `quick`
  **Skills**: none

  **Parallelization**: Wave 1 | Blocks: Tasks 2-7 | Blocked By: None

  **References**: `lib/three.min.js` — pattern for local lib loading

  **Acceptance Criteria**:
  - [ ] `lib/gsap.min.js` exists
  - [ ] Script tag present after three.min.js
  - [ ] Page loads without GSAP errors

  **QA Scenarios**:
  ```
  Scenario: GSAP loads
    Tool: Playwright
    Steps:
      1. Open nosh-music-ai.html
      2. Evaluate: typeof gsap !== 'undefined'
    Expected: true
    Evidence: .sisyphus/evidence/task-1-gsap-loads.txt
  ```

  **Commit**: YES (with Task 2)
  - Message: `feat: add GSAP library (free tier)`
  - Files: `lib/gsap.min.js`, `nosh-music-ai.html`

---

- [ ] 2. Stub GSAP integration in AlbumGallery

  **What to do**:
  - Add `this.gsapTimeline = null` property to AlbumGallery defaults
  - Create `_setupGSAP()` method (called in `init()` after renderer setup)
  - Create `_killAnimations()` helper: kills all GSAP tweens on gallery meshes
  - In `stop()`, call `this._killAnimations()` before `_cleanupCards()`

  **Must NOT do**:
  - Do NOT start animations — infrastructure only
  - Do NOT modify `_animate()` loop yet

  **Recommended Agent Profile**: `unspecified-low`
  **Skills**: none

  **Parallelization**: Wave 1 (after Task 1) | Blocks: 3-7 | Blocked By: 1

  **References**: AlbumGallery defaults (~line 9520), `init()` (~9542), `stop()` (~10030)

  **Acceptance Criteria**:
  - [ ] `_setupGSAP()` runs without error
  - [ ] `stop()` calls `_killAnimations()` before cleanup

  **Commit**: YES (groups with Task 1)

---

- [ ] 3. Entry animation — GSAP stagger timeline

  **What to do**:
  - Replace the manual entry burst block in `_animate()` (lines ~9943-9987) with GSAP timeline
  - After `this._items` is populated and gallery activated, build timeline
  - For each card: `gsap.set` to origin → timeline `to()` for position+scale with `back.out(1.2)` ease
  - Stagger: `i * 0.015s` delay per card
  - Set `item.entryProgress = 1` for all items (bypass old entry code)
  - Remove the `// === Entry burst ===` block from `_animate()`
  - Set `isActive = true` after timeline starts

  **Recommended Agent Profile**: `visual-engineering`
  **Skills**: none

  **Parallelization**: Wave 2 | Blocked By: 1-2

  **References**: Current entry code at lines ~9943-9987

  **Acceptance Criteria**:
  - [ ] All ~48 cards stagger-animate from center with back.out ease
  - [ ] No old entry code remains in `_animate()`
  - [ ] Timeline killed in `stop()`

  **QA Scenarios**:
  ```
  Scenario: Entry plays correctly
    Tool: Playwright
    Steps:
      1. Load page, trigger gallery
      2. Wait 2s, take screenshot
      3. Check console for GSAP errors
    Expected: All cards visible, no errors
    Evidence: .sisyphus/evidence/task-3-entry.png
  ```

  **Commit**: YES
  - Message: `feat: GSAP stagger entry animation`
  - Files: `nosh-music-ai.html`

---

- [ ] 4. Scroll inertia — GSAP-driven momentum

  **What to do**:
  - Replace the lerp-based scroll in `_animate()` with GSAP momentum
  - Remove the manual lerp lines:
    ```javascript
    this.scrollY.current += (this.scrollY.target - this.scrollY.current) * 0.1;
    this.scrollY.speedCurrent += (this.scrollY.speedTarget - this.scrollY.speedCurrent) * 0.1;
    ```
  - On wheel event, set a GSAP tween on `this.scrollY.current`:
    ```javascript
    gsap.killTweensOf(this.scrollY, 'current');
    gsap.to(this.scrollY, {
      current: this.scrollY.target,
      duration: 0.8,
      ease: 'power3.out',
      overwrite: 'auto'
    });
    ```
  - Same approach for `speedCurrent` → `speedTarget`
  - When idle (no wheel input for 1s), tween `speedTarget` toward 0 with `power2.out`
  - Use `gsap.delayedCall(1, decelerateFn)` for idle detection
  - Keep `this.scrollY.target += 0.002` auto-advance

  **Must NOT do**:
  - Do NOT use GSAP physics plugin (not available in free tier)
  - Do NOT create per-frame tweens (too many GSAP objects)

  **Recommended Agent Profile**: `unspecified-high`
  **Skills**: none

  **Parallelization**: Wave 2 | Blocked By: 1-2

  **References**: Current scroll code at lines ~9924-9929, wheel handler at ~9579-9587

  **Acceptance Criteria**:
  - [ ] Wheel scroll has natural deceleration (not sticky lerp)
  - [ ] Auto-advance still works alongside GSAP scroll
  - [ ] No GSAP errors during rapid scrolling

  **QA Scenarios**:
  ```
  Scenario: Scroll decelerates naturally
    Tool: Playwright
    Steps:
      1. Open gallery (albums visible)
      2. Trigger wheel event on container
      3. Measure scrollY.current change over 1s
    Expected: Smooth deceleration, not instant stop
    Evidence: .sisyphus/evidence/task-4-scroll.txt

  Scenario: No GSAP tween leaks
    Tool: Playwright
    Steps:
      1. Rapidly scroll 10 times
      2. Check gsap.getTweensOf().length
    Expected: No orphaned tweens
  ```

  **Commit**: YES
  - Message: `feat: GSAP scroll inertia`
  - Files: `nosh-music-ai.html`

---

- [ ] 5. Card hover — GSAP micro-interaction

  **What to do**:
  - In `_handleHover()`, when raycaster detects a card hit:
    - `gsap.killTweensOf(hit.object.scale)`
    - `gsap.to(hit.object.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.2, ease: 'power2.out' })`
    - `gsap.to(hit.object.position, { z: currentZ + 8, duration: 0.25, ease: 'back.out(1)' })`
  - When raycaster detects NO hit (was hovering, now not):
    - Revert the last hovered card:
    - `gsap.to(lastHovered.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.out' })`
    - `gsap.to(lastHovered.position, { z: originalZ, duration: 0.3, ease: 'power2.out' })`
  - Track `this._hoveredMesh` (the currently hovered card mesh)
  - Track original Z position per mesh: `mesh.userData.origZ`
  - Skip hover tween for entry animation phase

  **Must NOT do**:
  - Do NOT hover-tween cards that are invisible (z > 30)
  - Do NOT tween every frame — only on hover enter/leave

  **Recommended Agent Profile**: `visual-engineering`
  **Skills**: none

  **Parallelization**: Wave 2 | Blocked By: 1-2

  **References**: `_handleHover()` (~line 9640), existing cursor pointer code

  **Acceptance Criteria**:
  - [ ] Hovered card scales 1.05 and shifts +8 in Z toward camera
  - [ ] Unhovered card reverts smoothly
  - [ ] Works for all visible cards

  **QA Scenarios**:
  ```
  Scenario: Card responds to hover
    Tool: Playwright
    Steps:
      1. Open gallery
      2. Move mouse over a visible card
      3. Capture screenshot before + after hover
    Expected: Card scale increases, position shifts
    Evidence: .sisyphus/evidence/task-5-hover.png
  ```

  **Commit**: YES
  - Message: `feat: GSAP card hover micro-interaction`
  - Files: `nosh-music-ai.html`

---

- [ ] 6. Collapse/expand timeline

  **What to do**:
  - Replace the current `collapseTo()` that just sets `opacity: 0` with a GSAP timeline:
  ```javascript
  collapseTo() {
    this.isActive = false;
    const tl = gsap.timeline({
      onComplete: () => {
        this.container.style.opacity = '0';
      }
    });
    // Phase 1: camera pulls back + gallery rotates
    tl.to(this.camera.position, { z: this.camera.position.z + 400, duration: 0.6, ease: 'power2.in' }, 0);
    // Phase 2: gallery group fades + shrinks
    tl.to(this.galleryGroup.position, { y: -200, duration: 0.5, ease: 'power2.in' }, 0.2);
    tl.to(this.galleryGroup.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 0.5, ease: 'power2.in' }, 0.2);
    tl.to(this.renderer.domElement, { opacity: 0, duration: 0.4 }, 0.3);
    tl.play();
    this._collapseTL = tl;
  }
  ```
  - For expand (re-open), reverse the timeline or create a new one
  - Store timeline reference, kill in `stop()` if active
  - Set camera back to (0, 0, dist) on expand

  **Must NOT do**:
  - Do NOT hide cards individually — collapse is a global camera+motion effect
  - Do NOT modify the container's display/visibility in the middle of animation

  **Recommended Agent Profile**: `visual-engineering`
  **Skills**: none

  **Parallelization**: Wave 3 | Blocked By: 1-3

  **References**: Current `collapseTo()` at ~line 10020, `stop()` at ~10030

  **Acceptance Criteria**:
  - [ ] Collapse: camera pulls back, gallery shrinks + fades over ~0.8s
  - [ ] Expand: gallery grows back, camera returns
  - [ ] Timeline is killed on `stop()`

  **QA Scenarios**:
  ```
  Scenario: Collapse animates correctly
    Tool: Playwright
    Steps:
      1. Open gallery
      2. Trigger collapse (e.g., switch view)
      3. Capture at 0s, 0.4s, 0.8s
    Expected: Smooth multi-phase collapse
    Evidence: .sisyphus/evidence/task-6-collapse.png
  ```

  **Commit**: YES
  - Message: `feat: GSAP collapse/expand timeline`
  - Files: `nosh-music-ai.html`

---

- [ ] 7. Modal open/close — GSAP spring animation

  **What to do**:
  - In `openAlbumSongsModal()`, replace the plain `classList.add('open')` with GSAP:
  ```javascript
  modal.style.display = 'flex';
  const backdrop = modal.querySelector('.modal-backdrop') || modal;
  const content = modal.querySelector('.album-songs-modal-content') || modal.querySelector('.modal-content');
  // Backdrop fade in
  gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
  // Content spring in
  gsap.fromTo(content, {
    scale: 0.85, opacity: 0, y: 30
  }, {
    scale: 1, opacity: 1, y: 0,
    duration: 0.4, ease: 'back.out(1.5)',
    clearProps: 'transform' // restore CSS after
  });
  ```
  - In `closeAlbumSongsModal()`, reverse the animation:
  ```javascript
  gsap.to(backdrop, { opacity: 0, duration: 0.2 });
  gsap.to(content, {
    scale: 0.9, opacity: 0, y: 20,
    duration: 0.2, ease: 'power2.in',
    onComplete: () => { modal.style.display = ''; }
  });
  ```
  - Identify the correct CSS selectors for backdrop and content from the modal HTML

  **Must NOT do**:
  - Do NOT use CSS transitions for the animated properties — GSAP must be the sole animation driver
  - Do NOT fade in the list items individually (scope creep)

  **Recommended Agent Profile**: `visual-engineering`
  **Skills**: none

  **Parallelization**: Wave 3 | Blocked By: 1-2

  **References**: `openAlbumSongsModal()` at ~line 10076, `closeAlbumSongsModal()` at ~10158, modal HTML at ~line 3289

  **Acceptance Criteria**:
  - [ ] Modal backdrop fades in over 0.25s
  - [ ] Content scales from 0.85 → 1 with back.out(1.5) ease
  - [ ] Close reverses with fade + scale down
  - [ ] No CSS/display conflicts

  **QA Scenarios**:
  ```
  Scenario: Modal opens with spring
    Tool: Playwright
    Steps:
      1. Click an album card
      2. Capture modal opening (first frame, mid, end)
    Expected: Content springs in from slightly smaller, backdrop fades
    Evidence: .sisyphus/evidence/task-7-modal-open.png

  Scenario: Modal closes smoothly
    Tool: Playwright
    Steps:
      1. Open modal → click close
      2. Verify modal display goes to none after animation
    Expected: Modal disappears after GSAP animation completes
  ```

  **Commit**: YES
  - Message: `feat: GSAP modal spring animation`
  - Files: `nosh-music-ai.html`

---

## Final Verification Wave

- [ ] F1. **Full Integration Test** — Run the page, trigger all animations in sequence
  1. Load page → gallery opens with GSAP stagger entry
  2. Scroll through albums → momentum feels natural
  3. Hover over cards → scale + z-shift
  4. Click card → modal springs open
  5. Close modal → smooth reverse
  6. Collapse gallery → multi-phase timeline
  7. Re-open → expand animation
  - Check console for Zero GSAP errors, Zero orphaned tweens
  - **VERDICT**: PASS only if ALL 7 steps work without visual glitches

---

## Commit Strategy

- Task 1+2: `feat: add GSAP library (free tier)` — `lib/gsap.min.js`, `nosh-music-ai.html`
- Task 3: `feat: GSAP stagger entry animation` — `nosh-music-ai.html`
- Task 4: `feat: GSAP scroll inertia` — `nosh-music-ai.html`
- Task 5: `feat: GSAP card hover micro-interaction` — `nosh-music-ai.html`
- Task 6: `feat: GSAP collapse/expand timeline` — `nosh-music-ai.html`
- Task 7: `feat: GSAP modal spring animation` — `nosh-music-ai.html`

---

## Success Criteria

### Verification Commands
```bash
# Open page and test each animation
start nosh-music-ai.html
# Check GSAP loaded
# Open DevTools → console → typeof gsap
```

### Final Checklist
- [ ] GSAP loaded from local file, no network/CDN dependency
- [ ] Entry: 48 cards stagger in with back.out overshoot (0.8s)
- [ ] Scroll: wheel decelerates naturally (power3.out)
- [ ] Hover: card scales 1.05 + shifts +8 in Z (0.2s)
- [ ] Collapse: camera pullback + gallery shrink + fade (0.8s)
- [ ] Modal: backdrop fade + content spring (0.4s)
- [ ] All GSAP tweens killed on stop() — zero memory leaks
- [ ] No breakage of existing click/hover/wheel UX
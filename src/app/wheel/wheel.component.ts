import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { WheelItem } from '../interfaces/wheel-item';
import { softenWheelColor } from '../utils/wheel-palette';
import { DarkModeService } from '../services/dark-mode-service/dark-mode.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state-service/game-state.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SoundFxHandle, SoundFxService } from '../services/sound-fx-service/sound-fx.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PendingSpinService } from '../services/pending-spin-service/pending-spin.service';
import { SettingsService } from '../services/settings-service/settings.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-wheel',
  imports: [
    CommonModule,
    TranslatePipe
  ],
  templateUrl: './wheel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './wheel.component.css'
})
export class WheelComponent implements AfterViewInit, OnChanges {

  wheelCanvas!: HTMLCanvasElement;
  wheelCtx!: CanvasRenderingContext2D;
  pointerCanvas!: HTMLCanvasElement;
  pointerCtx!: CanvasRenderingContext2D;

  /**
   * Pre-rendered wheel (all wedges + dividers + labels + gold ring) at rotation 0.
   * The wheel is geometrically rigid during a spin — only its rotation changes — so
   * we draw it once here and each animation frame just rotates and blits this bitmap
   * (one drawImage) instead of re-tracing every slice + label 60×/sec. Rebuilt only
   * when the inputs actually change: items (ngOnChanges) or canvas size (resize).
   * The centre hub is drawn separately on top, unrotated, so its pokéball stays upright.
   */
  private wheelBitmap: HTMLCanvasElement | null = null;
  private wheelBitmapCtx: CanvasRenderingContext2D | null = null;

  /**
   * Above this slice count per-slice labels are dropped entirely. Past ~48 slices the
   * arc under each label is so narrow (≈20px on the 340px wheel, far less on the
   * 151-slice catch wheel) that the text overlaps into an unreadable smear — no font
   * is both large enough to read and small enough not to collide. The live "current
   * segment" readout and the result chip below the wheel cover what the player landed on.
   */
  private static readonly LABEL_SLICE_LIMIT = 48;
  @Input() items: WheelItem[] = [];
  @Output() selectedItemEvent = new EventEmitter<number>();
  @ViewChild('wheel') wheelCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pointer') pointerCanvasRef!: ElementRef<HTMLCanvasElement>;
  spinning = false;
  darkMode!: Observable<boolean>;

  canvasHeight: number;
  wheelWidth: number;
  cursorWidth: number;
  fontSize: number;
  currentRotation = 0;
  startTime = 0;
  totalRotations!: number;
  duration = Math.floor(Math.random() * (2000)) + 3000;
  finalRotation = 0;
  winningNumber!: number;
  currentSegment: string = '-';
  /** Index of the resolved winning item; null while unspun/spinning. Drives the result chip. */
  resolvedIndex: number | null = null;
  clickAudio!: SoundFxHandle;

  private translatedItems: WheelItem[] = [];
  private readonly mobileBreakpoint = 768;
  private destroyRef = inject(DestroyRef);

  /** The winning item once a spin has resolved (null otherwise). */
  get resolvedItem(): WheelItem | null {
    return this.resolvedIndex !== null ? this.items[this.resolvedIndex] ?? null : null;
  }

  constructor(
    private darkModeService: DarkModeService,
    private themeService: ThemeService,
    private gameStateService: GameStateService,
    private translateService: TranslateService,
    private soundFxService: SoundFxService,
    private modalService: NgbModal,
    private pendingSpinService: PendingSpinService,
    private settingsService: SettingsService
  ) {
    this.clickAudio = this.soundFxService.createClickSoundFx();
    this.darkMode = this.themeService.isDark$;
    this.canvasHeight = 0;
    this.wheelWidth = 0;
    this.cursorWidth = 40;
    this.fontSize = 0;
    this.updateWheelDimensions();
  }

  ngAfterViewInit(): void {
    this.wheelCanvas = this.wheelCanvasRef.nativeElement;
    this.wheelCtx = this.wheelCanvas.getContext('2d')!;
    this.pointerCanvas = this.pointerCanvasRef.nativeElement;
    this.pointerCtx = this.pointerCanvas.getContext('2d')!;

    // Wait for translations to be ready
    this.translateService.get('wheel.spin').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.preprocessTranslations();
      this.drawWheelBitmap();
      this.drawWheel();
      this.drawPointer();
      this.resolvePendingSpinIfAny();
    });
  }

  /**
   * If the page was reloaded mid-spin, a previous spinWheel() call already committed
   * a winning outcome before the reveal animation could finish. Resolve it immediately
   * (no animation) instead of presenting a fresh, unspun wheel — the result was already
   * locked in the moment it was clicked.
   */
  private resolvePendingSpinIfAny(): void {
    const pendingWinningText = this.pendingSpinService.consumePendingSpin();
    if (pendingWinningText === null) {
      return;
    }

    const resolvedIndex = this.items.findIndex(item => item.text === pendingWinningText);
    if (resolvedIndex === -1) {
      return;
    }

    this.winningNumber = resolvedIndex;
    // Defer the chip reveal by one microtask: this method runs synchronously
    // inside ngAfterViewInit's change-detection pass, and flipping the
    // template-bound resolvedIndex mid-pass would trigger NG0100.
    queueMicrotask(() => this.resolvedIndex = resolvedIndex);
    this.spinning = false;
    this.selectedItemEvent.emit(this.winningNumber);
    this.gameStateService.setWheelSpinning(false);
  }

  @HostListener('window:resize')
  handleResize(): void {
    this.updateWheelDimensions();

    if (this.wheelCtx && this.pointerCtx) {
      this.drawWheelBitmap();
      this.drawWheel(this.currentRotation);
      this.drawPointer();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && !changes['items'].firstChange) {
      // New odds = new roll: clear the previous result chip and live readout.
      this.resolvedIndex = null;
      this.currentSegment = '-';
      this.translateService.get('wheel.spin').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.preprocessTranslations();
        this.drawWheelBitmap();
        this.drawWheel();
        this.drawPointer();
      });
    }
  }

  private preprocessTranslations(): void {
    this.translatedItems = this.items.map(item => ({
      ...item,
      text: this.translateService.instant(item.text)
    }));
  }

  private updateWheelDimensions(): void {
    const viewportMin = Math.min(window.innerHeight, window.innerWidth);
    // Slightly smaller than the pre-card era (0.70/0.50): the wheel now sits
    // inside a padded card, often with a projected header above it.
    const wheelScale = window.innerWidth <= this.mobileBreakpoint ? 0.62 : 0.42;

    // Hard cap so the card matches the 480px status-header/adventure cards:
    // 480 card − 2×22 padding = 436 inner, minus the 40px pointer canvas and
    // the 40px centering margin (.canvas-container) leaves ~356 — cap at 340.
    this.canvasHeight = Math.min(viewportMin * wheelScale, 340);
    this.wheelWidth = this.canvasHeight;
    this.fontSize = this.wheelWidth / 24;

    // Tiered caps: crowded wheels need progressively smaller labels so
    // neighbouring slice texts stop overlapping. Only counts up to
    // LABEL_SLICE_LIMIT are labelled at all (see drawWheelBitmap), so there's
    // no tier beyond that — those wheels render label-free.
    const count = this.items.length;
    if (count > 40) {
      this.fontSize = Math.min(this.fontSize, 8);
    } else if (count >= 32) {
      this.fontSize = Math.min(this.fontSize, 10);
    } else if (count >= 16) {
      this.fontSize = Math.min(this.fontSize, 14);
    }
  }

  /**
   * Paint the current frame: clear, blit the pre-rendered wheel bitmap rotated by
   * `rotation`, then stamp the hub on top (unrotated). O(1) per frame regardless of
   * slice count — the per-slice tracing lives in drawWheelBitmap, run once off-frame.
   */
  private drawWheel(rotation = 0): void {
    if (!this.wheelBitmap) {
      return;
    }
    const w = this.wheelCanvas.width;
    const h = this.wheelCanvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = w / 2;

    this.wheelCtx.clearRect(0, 0, w, h);
    this.wheelCtx.save();
    this.wheelCtx.translate(centerX, centerY);
    this.wheelCtx.rotate(rotation);
    this.wheelCtx.drawImage(this.wheelBitmap, -centerX, -centerY);
    this.wheelCtx.restore();

    // Hub stamped fresh each frame so the pokéball glyph never rotates with the wheel.
    this.drawHub(centerX, centerY, radius);
  }

  /**
   * Render the static wheel (wedges + dividers + highlights + labels + gold ring) into
   * an offscreen bitmap at rotation 0. Expensive — traces every slice and rasterizes
   * every label — so it runs only when the geometry changes (items / canvas size), not
   * per animation frame. drawWheel then rotates and blits this bitmap.
   */
  private drawWheelBitmap(): void {
    const w = this.wheelCanvas.width;
    const h = this.wheelCanvas.height;
    if (w === 0 || h === 0) {
      return;
    }

    if (!this.wheelBitmap) {
      this.wheelBitmap = document.createElement('canvas');
      this.wheelBitmapCtx = this.wheelBitmap.getContext('2d');
    }
    if (this.wheelBitmap.width !== w || this.wheelBitmap.height !== h) {
      this.wheelBitmap.width = w;
      this.wheelBitmap.height = h;
    }
    const ctx = this.wheelBitmapCtx;
    if (!ctx) {
      return;
    }

    const centerX = w / 2;
    const centerY = h / 2;
    const radius = w / 2;
    const s = radius / 112;           // scale factor vs. the 260px design prototype
    const segRadius = 102 * s;        // segments run almost to the gold ring

    const totalWeight = this.getTotalWeights();
    const arcSize = (2 * Math.PI) / (totalWeight);
    const drawLabels = this.translatedItems.length <= WheelComponent.LABEL_SLICE_LIMIT;
    ctx.clearRect(0, 0, w, h);

    let startAngle = 0;
    for (let index = 0; index < this.translatedItems.length; index++) {
      const item = this.translatedItems[index];
      const segmentSize = arcSize * item.weight;
      const endAngle = startAngle + segmentSize;

      /** Draw the segment */
      ctx.beginPath();
      ctx.arc(centerX, centerY, segRadius, startAngle, endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = softenWheelColor(item.fillStyle);
      ctx.fill();

      // Subtle divider between slices (reads especially on the interleaved battle wheels)
      ctx.lineWidth = Math.max(1, s);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      // Type-bias visual feedback (V2 B3): gold outline on slices being boosted
      // toward — so the effect reads before spinning.
      if (item.highlighted) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFD700';
        ctx.stroke();
      }

      if (drawLabels) {
        /** Draw the text: thin black outline first keeps labels legible over any fill */
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + segmentSize / 2);
        ctx.font = '700 ' + this.fontSize + 'px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.lineWidth = Math.max(1, this.fontSize * 0.09);
        ctx.strokeStyle = '#000';
        ctx.lineJoin = 'round';
        ctx.strokeText(item.text, segRadius - 6 * s, this.fontSize * 0.32);
        ctx.fillStyle = '#fff';
        ctx.fillText(item.text, segRadius - 6 * s, this.fontSize * 0.32);
        ctx.restore();
      }

      startAngle = endAngle;
    }

    // Ring drawn AFTER segments so the gold stroke sits on top of slice edges.
    // (A centred circle, so it's rotation-invariant when the bitmap spins.)
    // The hub is NOT baked in here — it's stamped per frame in drawWheel so it
    // stays upright (WHEEL-01/WHEEL-02).
    this.drawBorderRing(ctx, centerX, centerY, radius);
  }

  private drawBorderRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    const s = radius / 112;

    // Single flat gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 3 * s, 0, Math.PI * 2);
    ctx.lineWidth = 5 * s;
    ctx.strokeStyle = '#f9ca24';
    ctx.stroke();

    // Hairline outer edge
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(51, 51, 51, 0.5)';
    ctx.stroke();
  }

  /**
   * Center hub badge: white backing disc with a gold accent ring sitting flush
   * against it (ring inner edge lands exactly on the disc edge — no gap), flat
   * pokeball glyph inside. Radii are fixed ratios of the 112px design-prototype
   * radius, so mobile and desktop wheels get proportionally identical hubs.
   */
  private drawHub(cx: number, cy: number, radius: number): void {
    const ctx = this.wheelCtx;
    const s = radius / 112;
    const hubR = 28 * s;
    const ringLW = 4 * s;

    // Gold accent ring, flush against the disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, hubR + ringLW / 2, 0, Math.PI * 2);
    ctx.lineWidth = ringLW;
    ctx.strokeStyle = '#f9ca24';
    ctx.shadowColor = 'rgba(249, 202, 36, 0.55)';
    ctx.shadowBlur = 10 * s;
    ctx.stroke();
    ctx.restore();

    // White backing disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6 * s;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = '#333333';
    ctx.stroke();

    // Flat pokeball glyph
    const r = 15 * s;
    ctx.beginPath();                          // top half, red
    ctx.arc(cx, cy, r, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.beginPath();                          // bottom half, white
    ctx.arc(cx, cy, r, 0, Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#000000';                // belt band
    ctx.fillRect(cx - r, cy - 1.5 * s, r * 2, 3 * s);
    ctx.beginPath();                          // glyph outline
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = '#333333';
    ctx.stroke();
    ctx.beginPath();                          // center button
    ctx.arc(cx, cy, 4.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s);
    ctx.strokeStyle = '#333333';
    ctx.stroke();
  }

  drawPointer(): void {
    const ctx = this.pointerCtx;
    ctx.clearRect(0, 0, this.pointerCanvas.width, this.pointerCanvas.height);
    ctx.save();

    const pw = this.pointerCanvas.width;   // cursorWidth = 40
    const midY = this.pointerCanvas.height / 2;

    ctx.beginPath();
    ctx.moveTo(2, midY);                   // tip, pointing left into the wheel
    ctx.lineTo(pw * 0.75, midY - 13);
    ctx.lineTo(pw * 0.75, midY + 13);
    ctx.closePath();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#f9ca24';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  spinWheel(): void {
    if (this.spinning) {
      return;
    }

    // Recompute per spin so Fast Spin's shortened reveal applies only while the
    // setting is on: a plain `if (fastSpin) this.duration = 400` (with no else)
    // permanently clobbered the field, so every later spin stayed 400ms even
    // after the player turned Fast Spin back off. winningNumber/finalRotation
    // math below is untouched, so the wheel still visibly eases onto the right
    // segment either way.
    this.duration = this.settingsService.currentSettings.fastSpin
      ? 400
      : Math.floor(Math.random() * 2000) + 3000;

    this.spinning = true;
    this.resolvedIndex = null;
    this.gameStateService.setWheelSpinning(this.spinning);


    this.startTime = performance.now();
    const totalWeight = this.getTotalWeights();
    const arcSize = (2 * Math.PI) / (totalWeight);

    this.winningNumber = this.getRandomWeightedIndex();
    if (!environment.production) {
      const forced = (window as unknown as { __devForceWheelIndex?: (items: WheelItem[]) => number | null })
        .__devForceWheelIndex?.(this.items);
      if (typeof forced === 'number' && forced >= 0 && forced < this.items.length) {
        this.winningNumber = forced;
      }
    }
    // Lock the outcome in immediately, before the reveal animation plays — a reload
    // mid-animation must resolve to this same result, not offer a fresh roll.
    this.pendingSpinService.commitPendingSpin(this.items[this.winningNumber].text);

    this.totalRotations = Math.floor(Math.random() * 4) + 1;

    let winningAngle = 0;
    const winningSegmentSize = arcSize * this.items[this.winningNumber].weight;

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      winningAngle += arcSize * item.weight;
      if (index === this.winningNumber) {
        break;
      }
    }

    const offset = Math.random() * winningSegmentSize;
    this.finalRotation = this.totalRotations * 2 * Math.PI + (2 * Math.PI - winningAngle + offset);

    requestAnimationFrame(this.animate.bind(this));
  }

  private animate(currentTime: number): void {
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    this.currentRotation = easedProgress * this.finalRotation;

    this.drawWheel(this.currentRotation);

    if (progress < 1) {
      requestAnimationFrame(this.animate.bind(this));
    } else {
      this.spinning = false;
      this.resolvedIndex = this.winningNumber;
      this.selectedItemEvent.emit(this.winningNumber);
      this.gameStateService.setWheelSpinning(false);
      this.pendingSpinService.clearPendingSpin();
    }

    const segment = this.getCurrentSegment();

    if (segment !== this.currentSegment) {
      this.currentSegment = segment;
      void this.soundFxService.playSoundFx(this.clickAudio, 1.0, { preventOverlap: true });
    }
  }

  private getCurrentSegment(): string {
    const totalWeight = this.getTotalWeights();

    const currentAngle = (2 * Math.PI - (this.currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    let accumulatedWeight = 0;

    for (const item of this.translatedItems) {
      accumulatedWeight += item.weight;
      const segmentEnd = (accumulatedWeight / totalWeight) * 2 * Math.PI;

      if (currentAngle <= segmentEnd) {
        return item.text;
      }
    }
    return '-';
  }

  private getTotalWeights(): number {
    return this.translatedItems.reduce((sum, item) => sum + item.weight, 0);
  }

  getRandomWeightedIndex(): number {
    const totalWeight = this.getTotalWeights();
    let random = Math.random() * totalWeight;
    let accumulatedWeight = 0;

    for (let i = 0; i < this.translatedItems.length; i++) {
      accumulatedWeight += this.translatedItems[i].weight;
      if (random < accumulatedWeight) {
        return i;
      }
    }
    return this.translatedItems.length - 1;
  }

  @HostListener('window:keydown.space', ['$event'])
  handleSpacebar(event: Event): void {
    const activeElement = document.activeElement;
    const isInputOrButtonFocused = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLButtonElement ||
      activeElement?.getAttribute('role') === 'button';

    if (!this.spinning && !this.modalService.hasOpenModals() && !isInputOrButtonFocused) {
      event.preventDefault();
      this.spinWheel();
    }
  }
}

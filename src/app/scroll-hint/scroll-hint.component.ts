import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

const NEAR_BOTTOM_PX = 32;
const SCROLLABLE_MIN_PX = 8;

/**
 * App-root-mounted "more content below" hint. Shows a bouncing pill at the
 * bottom of the viewport whenever the page is taller than the viewport and
 * the user hasn't scrolled to (near) the bottom yet — works on every screen
 * without each one wiring it up individually. Rechecks on scroll, window
 * resize, and body size changes (route/content swaps resize <body> itself
 * since nothing sets an explicit height on it).
 */
@Component({
  selector: 'app-scroll-hint',
  imports: [TranslatePipe],
  templateUrl: './scroll-hint.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './scroll-hint.component.css',
})
export class ScrollHintComponent implements OnInit, OnDestroy {
  visible = false;

  private resizeObserver: ResizeObserver | null = null;
  private readonly onScrollOrResize = () => this.check();

  ngOnInit(): void {
    window.addEventListener('scroll', this.onScrollOrResize, { passive: true });
    window.addEventListener('resize', this.onScrollOrResize);
    this.resizeObserver = new ResizeObserver(this.onScrollOrResize);
    this.resizeObserver.observe(document.body);
    this.check();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScrollOrResize);
    window.removeEventListener('resize', this.onScrollOrResize);
    this.resizeObserver?.disconnect();
  }

  scrollDown(): void {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }

  private check(): void {
    const scrollable = document.documentElement.scrollHeight - document.documentElement.clientHeight > SCROLLABLE_MIN_PX;
    const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
    this.visible = scrollable && !nearBottom;
  }
}

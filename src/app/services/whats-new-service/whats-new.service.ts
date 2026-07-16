import { Injectable } from '@angular/core';
import { ModalQueueService } from '../modal-queue-service/modal-queue.service';
import {
  CURRENT_VERSION,
  RELEASE_NOTES,
  ReleaseNotes,
  compareVersions,
} from '../../data/release-notes';
import { WhatsNewComponent } from '../../whats-new/whats-new.component';

@Injectable({ providedIn: 'root' })
export class WhatsNewService {
  private readonly STORAGE_KEY = 'pokemon-roulette-last-seen-version';
  pendingEntries: ReleaseNotes[] = [];

  constructor(private modalQueue: ModalQueueService) {}

  private getLastSeen(): string {
    return localStorage.getItem(this.STORAGE_KEY) ?? '';
  }

  private setLastSeen(v: string): void {
    localStorage.setItem(this.STORAGE_KEY, v);
  }

  maybeShowOnStartup(): void {
    // Treat a first-time visitor (no stored version) as having last seen 0.0.0,
    // so the current release notes show once. openModal() stamps the current
    // version on close, so it won't reappear on later loads.
    const last = this.getLastSeen() || '0.0.0';
    const toShow = RELEASE_NOTES.filter(
      (n) => compareVersions(n.version, last) > 0
    );
    if (toShow.length === 0) return;
    this.openModal(toShow);
  }

  showWhatsNew(): void {
    this.openModal(RELEASE_NOTES);
  }

  private async openModal(entries: ReleaseNotes[]): Promise<void> {
    this.pendingEntries = entries;
    const ref = await this.modalQueue.open(WhatsNewComponent, {
      centered: true,
      size: 'lg',
      scrollable: true,
    });
    ref.result.finally(() => this.setLastSeen(CURRENT_VERSION));
  }
}

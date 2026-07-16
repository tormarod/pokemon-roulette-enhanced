import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { WhatsNewService } from '../services/whats-new-service/whats-new.service';
import { ThemeService } from '../services/theme-service/theme.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-whats-new',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './whats-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './whats-new.component.css',
})
export class WhatsNewComponent {
  darkMode: Observable<boolean>;

  constructor(
    public activeModal: NgbActiveModal,
    public whatsNew: WhatsNewService,
    themeService: ThemeService
  ) {
    this.darkMode = themeService.isDark$;
  }

  get entries() {
    return this.whatsNew.pendingEntries;
  }

  close(): void {
    this.activeModal.dismiss();
  }
}

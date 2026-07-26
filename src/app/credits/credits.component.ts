import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { PageNavComponent } from "../page-nav/page-nav.component";
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-credits',
  imports: [
    CommonModule,
    PageNavComponent,
    TranslatePipe
],
  templateUrl: './credits.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './credits.component.css'
})
export class CreditsComponent {

}

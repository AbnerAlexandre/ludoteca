import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackHost } from './shared/feedback-host';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FeedbackHost],
  template: `
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <router-outlet />
    <lt-feedback-host />
  `,
})
export class App {}

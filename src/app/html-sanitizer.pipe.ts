import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'htmlSanitizer',
})
export class HtmlSanitizerPipe implements PipeTransform {
  constructor(private domSanitizer: DomSanitizer) {}

  transform(html: string | undefined): string | null {
    if (html) {
      return this.domSanitizer.sanitize(SecurityContext.HTML, html);
    } else return null;
  }
}

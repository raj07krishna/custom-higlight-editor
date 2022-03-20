import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HighlightEditorComponent } from './highlight-editor.component';
import { HighlightHtmlPipe } from '../highlight-html.pipe';
import { HtmlSanitizerPipe } from '../html-sanitizer.pipe';


@NgModule({
  declarations: [
    HighlightEditorComponent,
    HighlightHtmlPipe,
    HtmlSanitizerPipe
  ],
  imports: [
    CommonModule
  ],
  providers:[HighlightHtmlPipe, HtmlSanitizerPipe],
  exports:[HighlightEditorComponent]
})
export class HighlightEditorModule { }

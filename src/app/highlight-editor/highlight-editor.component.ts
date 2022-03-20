import {
  Attribute,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  Renderer2,
  SecurityContext,
  Self,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { HighlightHtmlPipe } from '../highlight-html.pipe';
import {
  IEditorData,
  IEditorProperties,
  INodeData,
} from './highlight-editor.model';
import { debounceTime, take } from 'rxjs/operators';
import {
  MAT_FORM_FIELD,
  MatFormField,
  MatFormFieldControl,
} from '@angular/material/form-field';
import {
  AbstractControl,
  ControlContainer,
  ControlValueAccessor,
  FormControl,
  FormControlDirective,
  NgControl,
} from '@angular/forms';
import { FocusMonitor } from '@angular/cdk/a11y';
import { ErrorStateMatcher } from '@angular/material/core';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

@Component({
  selector: 'app-highlight-editor',
  templateUrl: './highlight-editor.component.html',
  styleUrls: ['./highlight-editor.component.scss'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: HighlightEditorComponent,
    },
  ],
})
export class HighlightEditorComponent
  implements
    OnInit,
    OnChanges,
    OnDestroy,
    MatFormFieldControl<any>,
    ControlValueAccessor
{
  @Input() properties: IEditorProperties = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '3.5rem',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    sanitize: true,
    outline: true,
  };
  // @Input() id = '';
  @Input() id!: string;
  isStartNodeIndexAtStart: boolean = true;
  @Input()
  get placeholder(): string {
    return this.properties.placeholder ? this.properties.placeholder : '';
  }
  set placeholder(value: string) {
    this.properties.placeholder = value;
    this.stateChanges.next();
  }
  @Input()
  formControlName: string = '';
  @Input() tabIndex: number | null = null;
  @ViewChild('editor', { static: true }) textArea!: ElementRef;
  @ViewChild('placeholder', { static: true }) placeholderRef!: ElementRef;
  @ViewChild('viewcontainer', { read: ViewContainerRef, static: true })
  viewcontainer!: ViewContainerRef;
  @ViewChild(FormControlDirective, { static: true })
  formControlDirective!: FormControlDirective;
  @Input() set value(value: string) {
    this.htmlAsString = value;
    this.stateChanges.next();
  }
  get value() {
    return this.htmlAsString;
  }
  private htmlAsString = '';
  caretPosition: any;
  nodeArray: INodeData[] = [];
  modifiedNodeArray: INodeData[] = [];
  lastIndex: number = 0;
  previousValue = '';
  regex: RegExp | null = null;
  isRefreshView = false;
  isBackspace = false;
  startIndexForNode = 0;
  endIndexForNode = 0;
  isNewNodeArray = true;
  /** emits `blur` event when focused out from the textarea */
  // eslint-disable-next-line @angular-eslint/no-output-native, @angular-eslint/no-output-rename
  @Output('blur') blurEvent: EventEmitter<FocusEvent> =
    new EventEmitter<FocusEvent>();

  /** emits `focus` event when focused in to the textarea */
  // eslint-disable-next-line @angular-eslint/no-output-rename, @angular-eslint/no-output-native
  @Output('focus') focusEvent: EventEmitter<FocusEvent> =
    new EventEmitter<FocusEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-rename, @angular-eslint/no-output-native
  @Output('click') clickEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() data: EventEmitter<IEditorData> = new EventEmitter<IEditorData>();
  @HostBinding('attr.tabindex') tabindex = -1;

  // @HostListener('focus')
  // onFocus() {
  //   this.focus();
  // }

  editorValueMap: Map<string, any> = new Map();
  htmlContent: string = '';
  private subject: Subject<string | undefined> = new Subject();
  errorCount = 0;
  sanitisedHtml: SafeHtml | null = null;

  constructor(
    @Attribute('tabindex') defaultTabIndex: string,
    private sanitizer: DomSanitizer,
    private highLightHtmlPipe: HighlightHtmlPipe,
    private renderer: Renderer2,
    private focusMonitor: FocusMonitor,
    private controlContainer: ControlContainer,
    @Optional() @Self() public ngControl: NgControl
  ) {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    const parsedTabIndex = Number(defaultTabIndex);
    this.tabIndex =
      parsedTabIndex || parsedTabIndex === 0 ? parsedTabIndex : null;
  }
  writeValue(value: string): void {
    this.htmlAsString = value;
  }
  get control() {
    return this.controlContainer.control?.get(this.formControlName);
  }
  onChange = (value: string) => {};
  onToutch = () => {};

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onToutch = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.setDisableProperties(isDisabled);
    this.stateChanges.next();
  }

  setDisableProperties(isDisabled: boolean) {
    const div = this.textArea.nativeElement;
    const action = isDisabled ? 'addClass' : 'removeClass';
    this.renderer[action](div, 'disabled');
    this.properties.editable = !isDisabled;
    this.textArea.nativeElement.style.pointerEvents = 'none';
  }

  stateChanges = new Subject<void>();

  focused = false;
  touched = false;
  get empty(): boolean {
    return this.extractTextFromHTML(this.htmlAsString)?.trim().length
      ? false
      : true;
  }
  @HostBinding('class.floating')
  get shouldLabelFloat() {
    // console.log(this.focused, !this.empty);
    return (this.focused || !this.empty) && !this.disabled;
  }
  @Input()
  get required() {
    return this._required;
  }
  set required(req) {
    this._required = coerceBooleanProperty(req);
    this.stateChanges.next();
  }
  public _required = false;

  @Input()
  get disabled() {
    return this._disabled;
  }
  set disabled(req) {
    this._disabled = coerceBooleanProperty(req);
    if (this._disabled) {
      this.setDisableProperties(this._disabled);
    }
    this.stateChanges.next();
  }
  @Input() _disabled = false;

  get errorState(): boolean {
    return this.extractTextFromHTML(this.htmlAsString)?.trim().length === 0 &&
      this.touched &&
      !this.disabled
      ? true
      : false;
  }

  @HostBinding('attr.aria-describedby') describedBy = '';
  setDescribedByIds(ids: string[]): void {
    this.describedBy = ids.join(' ');
  }
  onContainerClick(event: any): void {
    this.focusMonitor.focusVia(this.textArea, 'program');
    this.textArea.nativeElement.focus();
    event.stopPropagation();
  }

  ngOnChanges() {
    // console.log('triggered');
    this.applyHighlight(this.extractTextFromHTML(this.htmlAsString));
    if (this.isNewNodeArray) {
      this.refreshView(this.sanitisedHtml as string);
    } else {
      this.replaceNodes(this.startIndexForNode, this.endIndexForNode);
    }
    this.onContentChange();
    this.SetCaretPosition(this.textArea.nativeElement, this.caretPosition[1]);
  }

  ngOnInit() {
    this.regex = new RegExp("[^0-9a-zA-Z:,/'?.+\\-()\\r\\n *]", 'gm');
    this.control;
    this.subject.pipe(debounceTime(1000)).subscribe(() => {
      this.triggerStartProcessing();
    });
    this.focusMonitor.monitor(this.textArea).subscribe((focused) => {
      this.focused = !!focused;
      this.renderer.setStyle(
        this.placeholderRef.nativeElement,
        'display',
        this.empty && this.focused && !this.focused ? 'inline-block' : 'none'
      );
      this.stateChanges.next();
    });
    this.applyHighlight(this.extractTextFromHTML(this.htmlAsString));
  }

  onKeyUp(searchTextValue: any) {
    this.subject.next(searchTextValue);
  }

  onContentChange() {
    let innerText = this.textArea.nativeElement?.innerText;
    if (innerText.length > 0) {
      this.renderer.setStyle(
        this.placeholderRef.nativeElement,
        'display',
        'none'
      );
    } else {
      this.renderer.setStyle(
        this.placeholderRef.nativeElement,
        'display',
        'inline-block'
      );
    }
    this.data.emit({
      html: this.htmlAsString,
      text: innerText,
      errorCount: this.errorCount,
    });
  }

  triggerStartProcessing() {
    this.startProcessing();
    if (this.isNewNodeArray) {
      this.refreshView(this.sanitisedHtml as string);
    } else {
      this.replaceNodes(this.startIndexForNode, this.endIndexForNode);
    }
    if (
      this.caretPosition[1] === this.textArea.nativeElement.innerText.length
    ) {
      this.SetCaretPosition(this.textArea.nativeElement, this.caretPosition[1]);
    } else {
      this.SetCaretPosition(this.textArea.nativeElement, this.caretPosition[1]);
    }
    this.lastIndex = this.caretPosition[0];
  }

  startProcessing(): void {
    this.caretPosition = this.getCaretPosition(this.textArea.nativeElement);
    console.log(this.caretPosition);
    let html = '';
    html = this.textArea.nativeElement?.innerHTML;
    let innerText = this.textArea.nativeElement?.innerText;
    if (!html || html === '<br>') {
      innerText = '';
    }
    this.properties.sanitize || this.properties.sanitize === undefined
      ? this.sanitizer.sanitize(SecurityContext.HTML, html)
      : html;
    this.applyHighlight(innerText);
  }

  extractTextFromHTML(html: any) {
    return new DOMParser().parseFromString(html, 'text/html').documentElement
      .textContent;
  }

  findNodesForProcessing(currentValue: string) {
    let previousValueArray = this.splitText(this.previousValue);
    let currentValueArray = this.splitText(currentValue);
    let leftPointer = 0;
    let rightPointerForCurrent = currentValueArray.length - 1;
    let rightPointerForPrevious = previousValueArray.length - 1;
    let startNodeIndex = 0;
    let endNodeIndex = rightPointerForPrevious;
    let rightFound = false;
    let isStartNodeIndexAtStart = false;
    while (
      currentValueArray[leftPointer] &&
      previousValueArray[leftPointer] &&
      currentValueArray[leftPointer] === previousValueArray[leftPointer]
    ) {
      leftPointer++;
    }

    startNodeIndex = leftPointer;

    while (leftPointer <= rightPointerForPrevious && !rightFound) {
      if (
        currentValueArray[rightPointerForCurrent] !==
          previousValueArray[rightPointerForPrevious] &&
        !rightFound
      ) {
        endNodeIndex = rightPointerForPrevious;
        rightFound = true;
      } else if (!rightFound) {
        rightPointerForPrevious--;
        rightPointerForCurrent--;
      }
    }

    if (rightPointerForPrevious < 0) {
      endNodeIndex = 0;
      rightPointerForCurrent++;
      rightPointerForPrevious++;
    } else if (previousValueArray.length-1 === endNodeIndex) {
      //index at last node - no change
    } else {
      endNodeIndex++;
      rightPointerForCurrent++;
      rightPointerForPrevious++;
    }

    if (previousValueArray.length === startNodeIndex) {
      //reduce index as startNodeIndex is at undefined position
      startNodeIndex--;
    } else if (startNodeIndex - 1 < 0) {
      //new charachter is typed at start
      startNodeIndex = 0;
      isStartNodeIndexAtStart = true;
    } else {
      //all other scenarios move startIndex one index back to handle on HTMLnode
      startNodeIndex--;
    }

    let unProcessedStringCurrent = '';
    for (let i = startNodeIndex; i <= rightPointerForCurrent; i++) {
      if (currentValueArray[i]) {
        unProcessedStringCurrent += currentValueArray[i];
      }
    }
    let unProcessedStringPrevious = '';
    for (let i = startNodeIndex; i <= rightPointerForPrevious; i++) {
      if (previousValueArray[i]) {
        unProcessedStringPrevious += previousValueArray[i];
      }
    }
    
    return {
      startNodeIndex,
      endNodeIndex,
      isStartNodeIndexAtStart,
      unProcessedStringCurrent,
      unProcessedStringPrevious,
    };
  }

  splitText(text: string) {
    const words = [];
    let newWord = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char.trim().length === 0 && newWord.trim().length === 0) {
        newWord += char;
      } else if (
        char.trim().length === 0 &&
        newWord.length > 0 &&
        newWord.trim().length > 0
      ) {
        i--;
        words.push(newWord);
        newWord = '';
        continue;
      } else if (
        char.trim().length !== 0 &&
        newWord.length > 0 &&
        newWord.trim().length === 0
      ) {
        i--;
        words.push(newWord);
        newWord = '';
        continue;
      } else {
        newWord += char;
      }
    }
    words.push(newWord);
    return words;
  }

  applyHighlight(htmlValue: any) {
    const text = this.extractTextFromHTML(htmlValue);
    let htmlContent = '';
    if (text) {
      let dataForProcessing = this.findNodesForProcessing(htmlValue);
      console.log(dataForProcessing);
      if (
        (this.regex &&
          dataForProcessing.unProcessedStringCurrent.match(this.regex) &&
          dataForProcessing.unProcessedStringCurrent.match(this.regex)
            ?.length !== 0) ||
        (this.regex &&
          dataForProcessing.unProcessedStringPrevious.match(this.regex) &&
          dataForProcessing.unProcessedStringPrevious.match(this.regex)
            ?.length !== 0)
      ) {
        this.editorValueMap = this.highLightHtmlPipe.transform(
          dataForProcessing.unProcessedStringCurrent,
          'X',
          dataForProcessing.startNodeIndex,
          dataForProcessing.endNodeIndex,
          dataForProcessing.isStartNodeIndexAtStart,
          this.nodeArray
        );
        htmlContent = `${this.editorValueMap.get('highlightedValue')}`;
        this.nodeArray = this.editorValueMap.get('nodeArray');
        this.modifiedNodeArray = this.editorValueMap.get('modifiedNodeArray');
        this.startIndexForNode = dataForProcessing.startNodeIndex;
        this.endIndexForNode = dataForProcessing.endNodeIndex;
        this.isStartNodeIndexAtStart =
          dataForProcessing.isStartNodeIndexAtStart;
        console.log(this.editorValueMap.get('modifiedNodeArray'));
        // console.log(this.editorValueMap.get('isNewNodeArray'));
        this.previousValue = htmlValue;
        this.isRefreshView = true;
        this.isNewNodeArray = this.editorValueMap.get('isNewNodeArray');
      } else {
        this.isRefreshView = false;
        this.htmlAsString = this.textArea.nativeElement.innerText;
        // console.log('not not triggered');
        return;
      }
    } else {
      this.editorValueMap.set('highlightedValue', '');
      this.editorValueMap.set('totalErrorCount', '0');
      htmlContent = ``;
    }

    this.sanitisedHtml = this.sanitizer.sanitize(
      SecurityContext.HTML,
      htmlContent
    );
    this.errorCount = parseInt(
      this.editorValueMap.get('totalErrorCount') as string,
      10
    );
  }

  setFocus() {
    let range = document.createRange(); //Create a range (a range is a like the selection but invisible)
    range.selectNodeContents(this.textArea.nativeElement); //Select the entire contents of the element with the range
    range.collapse(false); //collapse the range to the end point. false means collapse to end rather than the start
    let selection = window.getSelection(); //get the selection object (allows you to change selection)
    selection?.removeAllRanges(); //remove any selections already made
    selection?.addRange(range);
    // this.textArea.nativeElement.focus();
  }

  onTextAreaBlur(event: FocusEvent) {
    this.startProcessing();
    if (this.isNewNodeArray) {
      this.refreshView(this.sanitisedHtml as string);
    } else {
      this.replaceNodes(this.startIndexForNode, this.endIndexForNode);
    }
    this.blurEvent.emit(event);
    this.focused = false;
    window.getSelection()?.removeAllRanges();
  }

  onTextAreaFocus(event: FocusEvent): void {
    this.focused = true;
    this.focusEvent.emit(event);
    if (!this.touched) {
      this.touched = true;
    }
    event.stopPropagation();
  }

  onPaste(event: ClipboardEvent) {
    console.log('onPaste', event);
  }

  onClick(event: any) {
    this.clickEvent.emit(event);
  }

  replaceNodes(startIndex: number, endIndex: number) {
    if (this.isRefreshView) {
      console.log('replceNodes triggerd')
      let allChildren = [...this.textArea.nativeElement.children];
      // allChildren.forEach((n) => console.log(n.innerHTML));
      for (let index = 0; index < this.modifiedNodeArray.length; index++) {
        let newChild = document
          .createRange()
          .createContextualFragment(
            this.modifiedNodeArray[index].html
          ).firstChild;
        // console.log(newChild);
        // console.log(this.textArea.nativeElement);
        if (this.textArea.nativeElement.children[startIndex + 1]) {
          this.renderer.insertBefore(
            this.textArea.nativeElement,
            newChild,
            this.textArea.nativeElement.children[startIndex++]
          );
        } else {
          this.renderer.insertBefore(
            newChild,
            this.textArea.nativeElement,
            null
          );
        }
      }
      for (
        let index = startIndex;
        index <= endIndex + this.modifiedNodeArray.length;
        index++
      ) {
        // console.log(this.textArea.nativeElement.children[index]);
        this.renderer.removeChild(
          this.textArea.nativeElement,
          this.textArea.nativeElement.children[index]
        );
        allChildren.splice(index, 1);
      }
    }
  }

  addLastChild() {
    const emtyString = '';
    let lastChild = document
      .createRange()
      .createContextualFragment(
        `<span class="no-highlight">${emtyString}</span>`
      ).firstChild;
    this.renderer.insertBefore(this.textArea.nativeElement, lastChild, null);
  }
  refreshView(htmlValue: string): void {
    if (this.isRefreshView) {
      console.log('replceNodes triggerd')
      this.htmlAsString = htmlValue === null ? '' : htmlValue;
      this.renderer.setProperty(
        this.textArea.nativeElement,
        'innerHTML',
        this.htmlAsString
      );
      this.addLastChild();
      // this.renderer.removeChild(this.textArea.nativeElement, )
    }
  }
  ngOnDestroy(): void {
    this.focusMonitor.stopMonitoring(this.textArea);
    this.stateChanges.complete();
  }

  nodeWalk(node: ChildNode | null, func: Function) {
    var result = func(node);
    if (node) {
      for (
        node = node.firstChild;
        result !== false && node;
        node = node.nextSibling
      )
        result = this.nodeWalk(node, func);
    }
    return result;
  }

  // getCaretPosition: return [start, end] as offsets to elem.textContent that
  //   correspond to the selected portion of text
  //   (if start == end, caret is at given position and no text is selected)
  getCaretPosition(elem: HTMLElement) {
    var sel = window.getSelection();
    var cum_length = [0, 0];

    if (sel?.anchorNode == elem)
      cum_length = [sel!.anchorOffset, sel!.focusOffset];
    else {
      var nodes_to_find = [sel?.anchorNode, sel?.focusNode];
      if (!elem.contains(sel!.anchorNode) || !elem.contains(sel!.focusNode))
        return undefined;
      else {
        var found = [false, false];
        var i;
        this.nodeWalk(elem, (node: HTMLElement) => {
          for (i = 0; i < 2; i++) {
            if (node == nodes_to_find[i]) {
              found[i] = true;
              if (found[i == 0 ? 1 : 0]) return false; // all done
            }
          }

          if (node.textContent && !node.firstChild) {
            for (i = 0; i < 2; i++) {
              if (!found[i]) cum_length[i] += node.textContent.length;
            }
          }
          return;
        });
        cum_length[0] += sel!.anchorOffset;
        cum_length[1] += sel!.focusOffset;
      }
    }
    if (cum_length[0] <= cum_length[1]) return cum_length;
    return [cum_length[1], cum_length[0]];
  }

  SetCaretPosition(el: any, pos: number) {
    // Loop through all child nodes
    for (var node of el.childNodes) {
      if (node.nodeType == 3) {
        // we have a text node
        if (node.length >= pos) {
          // finally add our range
          var range = document.createRange(),
            sel = window.getSelection();
          range.setStart(node, pos);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
          return -1; // we are done
        } else {
          pos -= node.length;
        }
      } else {
        pos = this.SetCaretPosition(node, pos);
        if (pos == -1) {
          return -1; // no need to finish the for loop
        }
      }
    }
    return pos; // needed because of recursion stuff
  }
}

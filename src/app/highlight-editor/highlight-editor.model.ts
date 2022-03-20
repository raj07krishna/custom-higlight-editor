import { SafeHtml } from "@angular/platform-browser";

export interface IEditorProperties {
    editable?: boolean;
    spellcheck?: boolean;
    height?: 'auto' | string;
    minHeight?: '0' | string;
    maxHeight?: 'auto' | string;
    width?: 'auto' | string;
    minWidth?: '0' | string;
    placeholder?: string;
    defaultParagraphSeparator?: string;
    sanitize?: boolean;
    outline?: boolean;
    rawPaste?: boolean;
  }

  export interface IEditorData {
      html: string | SafeHtml,
      text: string,
      errorCount: number,
  }

  export interface INodeData {
      html: string,
      startIndex: number,
      endIndex: number,
  }

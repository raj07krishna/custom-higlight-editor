import { Pipe, PipeTransform } from '@angular/core';
import { INodeData } from './highlight-editor/highlight-editor.model';

export interface IHighlightObj {
  highlightedValue: string;
  totalErrorCount: string;
}

@Pipe({
  name: 'highlightHtml',
})
export class HighlightHtmlPipe implements PipeTransform {
  highlightedObject: Map<string, any> = new Map();
  val = '';
  transform(
    value: string,
    args: string,
    startIndex: number,
    endIndex: number,
    isStartNodeIndexAtStart:boolean,
    nodeArray: INodeData[]
  ): Map<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const space = '&nbsp;'; //use this to remove warning text at end
    let regex: RegExp | null;
    const invalidvalues = new Set<string>();
    console.log('pipe triggered');
    if (args === 'X') {
      regex = new RegExp("[^0-9a-zA-Z:,/'?.+\\-()\\r\\n *]", 'gm');
    } else {
      regex = new RegExp(
        '[^0-9a-zA-Z:,/\'?.+\\-()=@#&{};<>_!"%\\r\\n *]',
        'gm'
      );
    }
    let totalErrorCount = 0;
    // const invalidCharactersArray = value.match(regex);
    // if (!invalidCharactersArray) {
    //   if (value && value.length) {
    //     this.highlightedObject.set('highlightedValue', value);
    //     this.highlightedObject.set(
    //       'totalErrorCount',
    //       totalErrorCount.toString()
    //     );
    //     return this.highlightedObject;
    //   } else {
    //     return new Map();
    //   }
    // }
    let valueArray: string[] | null = [];
    valueArray = this.splitText(value);
    this.highlightedObject = new Map();
    const match = value.match(regex);
    if (!match) {
      if (value && value.length) {
        this.highlightedObject.set('highlightedValue', value);
        this.highlightedObject.set(
          'totalErrorCount',
          totalErrorCount.toString()
        );
        return this.highlightedObject;
      } else {
        return new Map();
      }
    }
    valueArray = this.splitText(value);
    value = '';
    this.highlightedObject = new Map();
    if (valueArray !== null) {
      if (startIndex === endIndex && nodeArray.length === startIndex) {
        this.createAllNodes(
          valueArray,
          regex,
          nodeArray,
          startIndex,
          endIndex + valueArray.length
        );
        this.highlightedObject.set('nodeArray', nodeArray);
        this.highlightedObject.set('modifiedNodeArray', nodeArray);
        this.highlightedObject.set('isNewNodeArray', true);
      } else {
        let newNodeArray: INodeData[] = [];
        for (let index = 0; index < startIndex; index++) {
          newNodeArray[index] = { ...nodeArray[index] };
        }
        this.createAllNodes(
          valueArray,
          regex,
          newNodeArray,
          startIndex,
          startIndex + valueArray.length
        );
        this.highlightedObject.set(
          'modifiedNodeArray',
          newNodeArray.slice(startIndex)
        );
        this.highlightedObject.set('isNewNodeArray', false);
        for (
          let index = newNodeArray.length;
          nodeArray[++endIndex] !== undefined;
          index++
        ) {
          newNodeArray[index] = { ...nodeArray[endIndex] };
        }
        this.highlightedObject.set('nodeArray', newNodeArray);
      }
    }
    value = this.createHtmlFromAllNodes(
      this.highlightedObject.get('nodeArray')
    );
    // value = `${value}<span class="no-highlight">${emtyString}</span>`;
    this.val = value;
    totalErrorCount = this.val.split('</font>').length - 1;
    this.highlightedObject.set('highlightedValue', value);
    this.highlightedObject.set('totalErrorCount', totalErrorCount.toString());
    return this.highlightedObject;
  }

  createHtmlFromAllNodes(allNodes: INodeData[]) {
    let htmlAsString = '';
    allNodes.forEach((node) => {
      htmlAsString += node.html;
    });
    return htmlAsString;
  }

  createAllNodes(
    valueArray: RegExpMatchArray | null,
    regex: RegExp | null,
    nodeArray: INodeData[],
    startIndex: number,
    endIndex: number
  ) {
    if (valueArray) {
      let htmlAsString = '';
      let indexCount = 0;
      let valueArrayIndex = 0;
      for (let i = startIndex; i < endIndex; i++) {
        const element = valueArray[valueArrayIndex++];
        let val = '';
        if (
          regex &&
          element.match(regex) &&
          element.match(regex)?.length !== 0
        ) {
          const illegalCharsInWord = element.match(regex);
          const allValidWords = element.split(regex);
          val += `<span class='highlight'>`;
          for (let i = 0; i < allValidWords.length; i++) {
            const word = allValidWords[i];
            val += word;
            if (illegalCharsInWord && i < illegalCharsInWord?.length) {
              val += `<font class='color-highlight'>${illegalCharsInWord[i]}</font>`;
            }
          }
          val += '</span>';
        } else {
          val = `<span>${element}</span>`;
        }
        htmlAsString += val;
        nodeArray[i] = {
          html: val,
          startIndex: indexCount,
          endIndex: indexCount + element.length - 1,
        };
        indexCount += element.length;
      }
    }
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
}

import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { IEditorData } from './highlight-editor/highlight-editor.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  value = '<span>abc</span>';
  form!: FormGroup;
  constructor() {}
  ngOnInit(): void {
    this.form = new FormGroup({
      test: new FormControl('', Validators.required),
    });
    // this.form.get('test')?.disable()
  }
  text(event: any) {
    // console.log('text')
  }

  print(data: IEditorData) {
    this.form.get('test')?.setValue(data.text)
  }
}

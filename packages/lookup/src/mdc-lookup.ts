import { customElement, useView, inject, PLATFORM, bindingMode } from 'aurelia-framework';
import { DiscardablePromise } from './discardable-promise';
import { MdcDefaultLookupConfiguration } from './mdc-lookup-configuration';
import { bindable } from "aurelia-typed-observable-plugin";
import { MdcMenu, IMdcMenuItemComponentEvent } from "@aurelia-mdc-web/menu";

const UP = 38;
const DOWN = 40;
const inputEvents = ['click', 'input', 'keydown'];

@inject(Element, MdcDefaultLookupConfiguration)
@customElement('mdc-lookup')
@useView(PLATFORM.moduleName('./mdc-lookup.html'))
export class MdcLookup implements EventListenerObject {
  constructor(private root: HTMLElement, private defaultConfiguration: MdcDefaultLookupConfiguration) {
    defineMdcLookupElementApis(this.root);
  }


  public anchor: { left: number, top: string | undefined, bottom: string | undefined, maxHeight: number, width: number } | null;
  public isOpen: boolean = false;
  public isWrapperOpen: boolean = false;
  public optionsArray: unknown[];
  public focusedOption: unknown = undefined;
  public searching: boolean = false;
  public errorMessage: string | undefined = undefined;
  public notFound: boolean = false;
  public menu: MdcMenu;

  @bindable
  public input?: HTMLInputElement;

  @bindable.booleanAttr
  twoLine: boolean;

  @bindable
  displayField: ((option: unknown) => string) | string | undefined;
  displayFieldChanged() {
    if (this.displayField instanceof Function) {
      this.getDisplay = this.displayField;
    } else if (typeof this.displayField === 'string') {
      this.getDisplay = option => (option as any)[this.displayField as string];
    } else {
      this.getDisplay = option => (option as any).toString();
    }
  }

  getDisplay: (option: unknown) => string = option => (option as any).toString();

  @bindable
  valueField: ((option: unknown) => unknown) | string | undefined;
  valueFieldChanged() {
    if (this.valueField instanceof Function) {
      this.getValue = this.valueField;
    } else if (typeof this.valueField === 'string') {
      this.getValue = option => (option as any)[this.valueField as string];
    } else {
      this.getValue = option => option;
    }
  }

  getValue: (option: unknown) => unknown = option => option;

  @bindable
  options: ((filter: string, value: unknown) => Promise<unknown[]>) | unknown[] | undefined;
  optionsChanged() {
    if (this.options instanceof Function) {
      this.getOptions = this.options;
    } else {
      this.getOptions = this.getOptionsDefault;
    }
  }

  @bindable.booleanAttr({ defaultBindingMode: bindingMode.oneTime })
  hoistToBody: boolean;

  getOptions: (filter: string | undefined, value: unknown) => Promise<unknown[]>;

  async getOptionsDefault(filter: string, value: unknown): Promise<unknown[]> {
    const options = this.options as unknown[];
    if (value) {
      return Promise.resolve([options.find(x => this.getValue(x) === value)]);
    } else {
      return Promise.resolve(options.filter(x => this.getDisplay(x).toUpperCase().includes((filter || '').toUpperCase())));
    }
  }

  @bindable({ defaultBindingMode: bindingMode.twoWay })
  value: unknown;
  suppressValueChanged: boolean;
  async valueChanged() {
    if (this.suppressValueChanged) {
      this.suppressValueChanged = false;
      return;
    }
    await this.updateFilterBasedOnValue();
    this.root.dispatchEvent(new CustomEvent('change', { detail: { value: this.value } }));
  }
  setValue(value: unknown) {
    if (this.value === value) {
      return;
    }
    this.suppressValueChanged = true;
    this.value = value;
  }

  @bindable.number
  debounce: number = this.defaultConfiguration.debounce;

  @bindable.booleanAttr
  preloadOptions: boolean;

  bind() {
    this.valueFieldChanged();
    this.displayFieldChanged();
    this.optionsChanged();
  }

  attached() {
    if (this.input) {
      inputEvents.forEach(x => this.input!.addEventListener(x, this));
    }
    this.valueChanged();
    if (!this.value && this.preloadOptions) {
      this.loadOptions().catch();
    }
  }

  detached() {
    if (this.input) {
      inputEvents.forEach(x => this.input!.removeEventListener(x, this));
    }
  }

  async open() {
    if (this.isOpen) {
      return;
    }
    this.menu.open = true;
  }

  close() {
    this.isOpen = false;
    this.menu.open = false;
  }

  handleEvent(evt: Event): void {
    switch (evt.currentTarget) {
      case this.input:
        switch (evt.type) {
          case 'click': this.open(); break;
          case 'input': this.filterChanged(); break;
          case 'keydown': this.onInputKeydown(evt as KeyboardEvent); break;
        }
        break;
    }
  }

  debouncePromise: DiscardablePromise<void>;
  searchPromise: DiscardablePromise<unknown[]>;
  suppressFilterChanged: boolean;
  async filterChanged() {
    if (this.suppressFilterChanged) {
      this.suppressFilterChanged = false;
      return;
    }

    this.debouncePromise?.discard();
    this.debouncePromise = new DiscardablePromise(new Promise(r => setTimeout(() => r(), this.debounce ?? 0)));
    try {
      await this.debouncePromise;
    }
    catch (e) {
      return;
    }
    this.setValue(undefined);
    this.searchPromise?.discard();
    if (!this.isOpen) {
      this.open();
    }
    this.searching = true;
    this.errorMessage = undefined;
    this.notFound = false;

    this.optionsArray = [];
    try {
      await this.loadOptions();
    }
    catch (e) {
      if (e !== DiscardablePromise.discarded) {
        this.errorMessage = e.message;
      }
    }
    finally {
      this.searching = false;
    }
  }

  async loadOptions() {
    this.searchPromise = new DiscardablePromise(this.getOptions(this.input?.value, undefined));
    this.optionsArray = await this.searchPromise;
    this.notFound = !this.optionsArray?.length;
  }

  setFilter(filter: string | undefined) {
    if (!this.input || this.input.value === filter) {
      return;
    }
    this.suppressFilterChanged = true;
    this.input.value = filter ?? '';
  }

  async updateFilterBasedOnValue() {
    if (this.value) {
      this.optionsArray = await this.getOptions(undefined, this.value);
    }
    else {
      this.optionsArray = [];
    }
    if (this.optionsArray && this.optionsArray.length) {
      this.setFilter(this.getDisplay(this.optionsArray[0]));
    } else {
      this.setFilter(undefined);
    }
  }

  handleMenuItemAction(evt: IMdcMenuItemComponentEvent) {
    this.select(evt.detail.data);
  }

  select(option: unknown) {
    this.value = this.getValue(option);
    this.close();
  }

  onBlur() {
    this.close();
  }

  onInputKeydown(evt: KeyboardEvent) {
    switch (evt.which) {
      case DOWN:
        if (!this.menu.open) {
          this.open();
        }
        this.menu.list_?.foundation?.focusFirstElement();
        break;
      case UP:
        if (!this.menu.open) {
          this.open();
        }
        this.menu.list_?.foundation?.focusLastElement();
        break;
    }
  }

  onWindowWheel(evt: Event) {
    if (this.isOpen) {
      if (evt.target === PLATFORM.global || !this.root.contains(evt.target as HTMLElement)) {
        this.close();
      }
    }
  }

  addError(error: unknown) {
    if (this.input && Object.getOwnPropertyDescriptor(this.input, 'addError')) {
      (this.input as any).addError(error);
    }
  }

  removeError(error: unknown) {
    if (this.input && Object.getOwnPropertyDescriptor(this.input, 'addError')) {
      (this.input as any).removeError(error);
    }
  }

  getErrors() {
    if (this.input && Object.getOwnPropertyDescriptor(this.input, 'getErrors')) {
      return (this.input as any).getErrors();
    }
  }
}

export interface IMdcLookupElement extends HTMLElement {
  au: {
    controller: {
      viewModel: MdcLookup;
    }
  },
  getErrors(): unknown[]
}

function defineMdcLookupElementApis(element: HTMLElement) {
  Object.defineProperties(element, {
    addError: {
      value(this: IMdcLookupElement, error: unknown) {
        this.au.controller.viewModel.addError(error);
      },
      configurable: true
    },
    removeError: {
      value(this: IMdcLookupElement, error: unknown) {
        this.au.controller.viewModel.removeError(error);
      },
      configurable: true
    },
    getErrors: {
      value(this: IMdcLookupElement): unknown[] {
        return this.au.controller.viewModel.getErrors();
      },
      configurable: true
    }
  });
};
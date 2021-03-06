import { MdcComponent } from '@aurelia-mdc-web/base';
import { MDCNotchedOutlineFoundation, MDCNotchedOutlineAdapter, cssClasses } from '@material/notched-outline';
import { MDCFloatingLabelFoundation } from '@material/floating-label';
import { inject, customElement, useView, PLATFORM, child } from 'aurelia-framework';
import { MdcFloatingLabel } from '@aurelia-mdc-web/floating-label';

@inject(Element)
@useView(PLATFORM.moduleName('./mdc-notched-outline.html'))
@customElement('mdc-notched-outline')
export class MdcNotchedOutline extends MdcComponent<MDCNotchedOutlineFoundation> {
  private notchElement_!: HTMLElement; // assigned in html

  @child(`.${MDCFloatingLabelFoundation.cssClasses.ROOT}`)
  label: MdcFloatingLabel;
  labelChanged(){
    if (this.label) {
      this.label.root.style.transitionDuration = '0s';
      this.root.classList.add(cssClasses.OUTLINE_UPGRADED);
      requestAnimationFrame(() => {
        this.label.root.style.transitionDuration = '';
      });
    }
  }

  /**
   * Updates classes and styles to open the notch to the specified width.
   * @param notchWidth The notch width in the outline.
   */
  notch(notchWidth: number) {
    this.foundation?.notch(notchWidth);
  }

  /**
   * Updates classes and styles to close the notch.
   */
  closeNotch() {
    this.foundation?.closeNotch();
  }

  getDefaultFoundation() {
    // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
    // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
    const adapter: MDCNotchedOutlineAdapter = {
      addClass: (className) => this.root.classList.add(className),
      removeClass: (className) => this.root.classList.remove(className),
      setNotchWidthProperty: (width) => this.notchElement_.style.setProperty('width', `${width}px`),
      removeNotchWidthProperty: () => this.notchElement_.style.removeProperty('width'),
    };
    return new MDCNotchedOutlineFoundation(adapter);
  }

}

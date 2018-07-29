import { toaster } from "./Toaster.js";
import Input from "../components/Input.html";

import Buttons from "../components/Buttons.html";

/* here is how you can use this component!! 
                deleteAllToasts(); 
                let element = document.createElement("div"); 
                element.textContent = "Please enter a set name";
   //             let newToast = new Toast(element,'toast','toast-success'); //console.log('code is now ' + code)
   
                let newToast = new Toast(element,'modal','input',0); //console.log('code is now ' + code)
   
             //   element.parentNode.parentNode.addEventListener("click", () => newToast.delete()); // delete a toast on message click!
  
                element.addEventListener("click", () => newToast.delete()); // delete a toast on message click!
*/
const saveInput = (input, type) => {
    console.log('input is '+input)
    console.log('type is '+type)
    switch (type) {
        case 'note':
        let state = store.get();
        let obj = state.temp;
        let id = obj.id;
        obj.note = input;
        let bookmarks = localStorage.getItem('bookmarks') || {};
        bookmarks = JSON.parse(bookmarks)
        bookmarks[id] = obj;
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));	
        break;
    }
    deleteAllToasts();
}


Toast.TYPE = "toast" // possible 'toast', 'modal', 'fullscreen'  => this becomes the className for the outer div
Toast.MODE = "info";  /* possible: => this is added to the classNames for the inner div

                            'toast info' - regular side served fading toast blue w/ info icon
                            'toast success' - regular side served fading toast green with success icon
                            'toast error' - regular side served fading toast red w/ error icon
                            'modal success' - modal middle fading success like windowise
                            'modal error' - modal middle fading error like windowise
                            'modal info' - modal middle, blue - info like windowise
                            'modal warning' - modal middle, yellow - warning like windowise
                            'modal input' - only for modal middle, orange - input like windowise

                            */

Toast.BUTTONS = []; // possible [], ['ok'], ['ok', 'cancel']

Toast.TIME_SHORT = 2000;
Toast.TIME_NORMAL = 4000;
Toast.TIME_LONG = 8000;
Toast.TIME_STICK = 0;
Toast.INPUT_TYPE = 'import_palette';

let options = {
	deleteDelay: 350,
    topOrigin: 0
};

/**
 * Allows you to configure Toasts options during the application setup.
 * @param newOptions
 */
export function configureToasts (newOptions = {}) {
    Object.assign(options, newOptions);
}

/**
 * Delete all toast currently displayed.
 */
export function deleteAllToasts () {
    return toaster.removeAll();
}

/**
 * On-screen toast message.
 * @param {string|Element} text - Message text.
 * @param {string} [mode] - Toast.MODE_*
 * @param {number} [timeout] - Toast.TIME_*
 * @constructor
 */
export function Toast (text = `No text!`, type = Toast.TYPE, mode = Toast.MODE, timeout = Toast.TIME_SHORT, buttons = Toast.BUTTONS, input_type = Toast.INPUT_TYPE) {


    console.log('got yer toast, type: '+type + ' mode: '+mode)

    let el1 = document.createElement("div"),
        el2 = document.createElement("div"),
        el3 = document.createElement("div"), // added this for our text so we can adjust text/icons inline-block
        icon = document.createElement("div");
    
    if (type == 'modal') {
        var overlay = document.createElement("div"),
        wrapper = document.createElement("div");
        overlay.className = 'modal-overlay';
        wrapper.className = 'modal-wrapper animated zoomIn';
    }

    icon.className = type+'-icon-holder';
    el1.className = type;
    el2.className = `body ${type}-${mode}`;

    el1.appendChild(el2);
    el2.appendChild(el3);

    if (text instanceof Element) {
        el3.appendChild(text);
    } else {
	    el3.textContent = `${text}`;
    }
    el3.className = type+'-message noselect';

    let svg;
    let cat = mode;
    
    // add icons from windowise, when not fullscreen
    if (cat != 'fullscreen') {
      //console.log('addding svg for '+cat)
        svg = this.addicon(mode);
        icon.innerHTML = svg;
        el2.appendChild(icon);
    }
    else {
   // nada
    }
    
    if (type == 'modal') {
        document.body.appendChild(overlay);
        /* comment this out if you want to disable closing on click overlay */
        overlay.addEventListener("click", () => this.delete());      
        wrapper.appendChild(el1);
        this.element = wrapper;
    }
    else {
        this.element = el1;
    }

    /* this is how easy it is to add a Svelte component inside another es6 module... */

    if (cat == 'input') {
        var input;
        
    
            input = new Input({
                target: el2,
                data: {
                    placeholder: 'enter text',
                    maxLength: 20
                }
            });        
        input.on('saveInput', event => {
            saveInput(event.text_input,input_type);
        });
    }
    if (cat == 'fullscreen') {


    // fullscreen logic here

        let close = document.createElement("div");
        close.className = 'modal-close';
        close.addEventListener("click", () => this.delete());      
        el2.appendChild(close);
    }


 /* I added the 'value' attr so we could pass a value to the fn, like deleting a palette by name */
    if (type == 'modal' && cat == 'warning') {
        let val = buttons[1].value || false;
        let input = new Buttons({
         target: el2,
         data: {
             btn1: buttons[0].text,
             btn2: buttons[1].text,
             action1: buttons[0].action,
             action2: buttons[1].action,
             value: val
         }
        });
    }
    if (type == 'modal' && cat == 'error' && buttons.length>0) {
        var input = new Buttons({
            target: el2,
            data: {
                btn1: buttons[0].text,
                action1:buttons[0].action
            }
           });
    }

    this.position = 0;
    toaster.push(this, cat, timeout);
}

/**
 * Attaches toast to DOM and returns the height of the element.
 */
Toast.prototype.attach = function (position,cat) {
	
    this.position = position;
    this.updateVisualPosition(cat);
    document.body.appendChild(this.element);

    requestAnimationFrame(() => {
	    this.element.classList.add("displayed");
    });
    return this.element.offsetHeight;

};

/**
 * Seek the toast message by Y coordinate.
 * @param delta
 */
Toast.prototype.seek = function (delta) {

    this.position += delta;
    let cat = Toast.mode;
    /* I am not doing stacked toasts and it messes up my modals, so I am disabling this */
    this.updateVisualPosition(cat);

};

/**
 * @private
 */
Toast.prototype.updateVisualPosition = function (cat) {

    requestAnimationFrame(() => {
    /* add style, colors for mode. We could also adjust text or box-shadow here. */

  //  color: white;
  //  text-shadow: 0 0 1px black;
//  console.log('I got a cat of '+cat)
	let colors = {
		info: 'rgba(42, 128, 255, 0.95)', 
		warning: 'rgba(255, 183, 99, 0.95)',
		error: 'rgba(255, 86, 86, 0.95)',
        success: 'rgba(45, 193, 80, 0.95)',
        fullscreen: '#ffffff'
    }
    let text = {
        warning: '#3c4148f2'
    }
    colors.input = colors.info;


    var bod = this.element.getElementsByClassName('body')[0];
    bod.style.background =  colors[cat];
    
    if (cat == 'warning')  {
      bod.firstChild.style.color =  text[cat];
    }

        //   this.element.style.bottom = -options.topOrigin + this.position + "px";
    });

};

/**
 * Removes toast from DOM.
 */
Toast.prototype.detach = function () {

    let self = this;


    if (!this.element.parentNode) return;

    requestAnimationFrame(() => {
        this.element.classList.remove("displayed");
        this.element.classList.remove("zoomIn")
        this.element.classList.add("zoomOut");
    });
    setTimeout(() => {
        requestAnimationFrame(() => {
            if (!self.element || !self.element.parentNode)
                return;
            self.element.parentNode.removeChild(self.element);

            // added for modals, get rid of overlay too!
            let overlay = document.getElementsByClassName('modal-overlay')[0];

            if (overlay) {
                overlay.parentNode.removeChild(overlay)
            }   
       
        });
    }, options.deleteDelay);

};

Toast.prototype.delete = function () {

    toaster.remove(this);

};

Toast.prototype.addicon = function(mode) {

    let href = '';
    (mode == 'info') && (href = '#info-button');
    (mode == 'success') && (href = '#tick');
    (mode == 'error') && (href = '#cancel');
    (mode == 'input') && (href = '#danger');
    (mode == 'warning') && (href = '#danger');
  //  (mode == 'min') && (href = '#line');
  //  (mode == 'close') && (href = '#close');

    return '<svg class="toast-icon"><use xlink:href="'+href+'" /></svg>';
}
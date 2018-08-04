import Notebook from './notebook.html';

export default class NotebookHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
        if (gtag) {
          gtag('event', 'notebook');
        }
      },
      enter(current, previous) {
        this.component = new Notebook ({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        })
        console.log('Entered notebook!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left notebook!');
      }
    }
  }
}
import Categories from './categories.html';

export default class CategoriesHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
        if (gtag) {
          gtag('event', 'categories');
        }
      },
      enter(current, previous) {
        this.component = new Categories({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        })
        console.log('Entered categories!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left categories!');
      }
    }
  }
}
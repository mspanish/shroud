import CategoryDetails from './category-details.html';

export default class CategoryDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
   
        if (gtag) {
          gtag('event', 'category detail '+route.pathname);
        }
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        let id = current.params.id.split('-');
        if (id.length > 1) {
          store.set({sub: id[0], id: id[1]})
        }
        else {
          store.set({sub: false, id: id[0]})
        }
       
        this.component = new CategoryDetails({
          target: document.getElementById('app'),
          data: {
   
          }
        })
       // console.log('Entered post details!');
      },
      leave(current, previous) {
        this.component.destroy();
      //  console.log('Left post details!');
      }
    }
  }
}
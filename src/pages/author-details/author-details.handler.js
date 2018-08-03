import AuthorDetails from './author-details.html';


export default class AuthorDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
        if (gtag) {
          gtag('event', 'author detail '+route.pathname);
        }
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        store.set({id: current.params.id})
    
        this.component = new AuthorDetails({
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
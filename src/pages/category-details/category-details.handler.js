import CategoryDetails from './category-details.html';


export default class CategoryDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
     
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        store.set({id: current.params.id})
    
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
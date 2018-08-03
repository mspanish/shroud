import PostDetails from './post-details.html';


export default class PostDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
        if (gtag) {
          gtag('event', 'post page '+route);
        }
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        store.set({id: current.params.id})
    
        this.component = new PostDetails({
          target: document.getElementById('app'),
          data: {
            desc: '',
            lessonTags: []
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
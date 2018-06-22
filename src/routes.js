import roadtrip from 'roadtrip';
import IndexHandler from './pages/index/index.handler';
//import SnippetsHandler from './pages/snippets/snippets.handler';
//import SnippetDetailsHandler from './pages/snippet-details/snippet-details.handler';
import PostDetailsHandler from './pages/post-details/post-details.handler';

export default class Routes {
  constructor() {
    this.router = roadtrip;
    this.init();
  }

  init() {
    this.index_handler = new IndexHandler();
   // this.snippets_handler = new SnippetsHandler();
   // this.snippet_details_handler = new SnippetDetailsHandler();
    this.post_details_handler = new PostDetailsHandler();

    this.router
      .add('/', this.index_handler.route)
     // .add('/snippets', this.snippets_handler.route)
     // .add('/snippets/:id', this.snippet_details_handler.route)  
      .add('/topics/:id', this.post_details_handler.route)         
      .start({
        fallback: '/'
      });
  }
}